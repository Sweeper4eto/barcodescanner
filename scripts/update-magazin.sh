#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${MAGAZIN_APP_DIR:-/var/www/magazin}"
SCRIPT_PATH="${APP_DIR}/scripts/update-magazin.sh"
DB_PATH="${MAGAZIN_DB_PATH:-/var/lib/magazin/data.db}"

cd "$APP_DIR"

# After git reset the file on disk is new, but bash keeps running the old
# inode. Re-exec once so migrate/stop order from origin/master actually runs.
if [[ "${MAGAZIN_UPDATE_REEXEC:-}" != "1" ]]; then
  echo "==> Syncing to latest origin/master..."
  git fetch origin
  git reset --hard origin/master
  export MAGAZIN_UPDATE_REEXEC=1
  exec bash "$SCRIPT_PATH"
fi

echo "==> Installing dependencies..."
npm install

echo "==> Generating Prisma client..."
npx prisma generate

release_db_lock() {
  echo "==> Stopping app and any DB lock holders..."
  pm2 stop magazin 2>/dev/null || true

  # Name-fix / import scripts also open the SQLite file and block migrate.
  pkill -f "tsx scripts/fix-names-from-internet" 2>/dev/null || true
  pkill -f "tsx scripts/fix-images-from-internet" 2>/dev/null || true
  pkill -f "tsx scripts/clean-product-names" 2>/dev/null || true
  pkill -f "tsx scripts/refresh-product-names" 2>/dev/null || true

  if command -v fuser >/dev/null 2>&1 && [[ -e "$DB_PATH" ]]; then
    echo "    Processes using ${DB_PATH}:"
    fuser -v "$DB_PATH" "$DB_PATH-wal" "$DB_PATH-shm" 2>&1 || true
    # Kill remaining holders (e.g. stray node/prisma).
    fuser -k "$DB_PATH" "$DB_PATH-wal" "$DB_PATH-shm" 2>/dev/null || true
  fi

  sleep 2
}

migrate_with_retry() {
  local attempt
  for attempt in 1 2 3 4 5; do
    echo "==> Applying migrations (attempt ${attempt}/5)..."
    if npx prisma migrate deploy; then
      return 0
    fi
    echo "    Database still locked; waiting and retrying..."
    release_db_lock
    sleep $((attempt * 2))
  done
  echo "ERROR: prisma migrate deploy failed after retries."
  echo "Check lock holders with: fuser -v $DB_PATH"
  return 1
}

release_db_lock
migrate_with_retry

echo "==> Removing old .next build..."
rm -rf .next

echo "==> Building app (webpack, low-memory friendly)..."
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=1536}"
npm run build

echo "==> Restarting PM2..."
pm2 restart magazin || pm2 start npm --name magazin -- start

echo "==> Done."
