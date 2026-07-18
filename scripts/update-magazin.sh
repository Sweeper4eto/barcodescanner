#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${MAGAZIN_APP_DIR:-/var/www/magazin}"
SCRIPT_PATH="${APP_DIR}/scripts/update-magazin.sh"

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

# SQLite cannot migrate while the app holds a write lock.
echo "==> Stopping app before migrate/build..."
pm2 stop magazin 2>/dev/null || true
# Extra safety: wait briefly for WAL/lock release
sleep 1

echo "==> Applying migrations..."
npx prisma migrate deploy

echo "==> Removing old .next build..."
rm -rf .next

echo "==> Building app (webpack, low-memory friendly)..."
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=1536}"
npm run build

echo "==> Restarting PM2..."
pm2 restart magazin || pm2 start npm --name magazin -- start

echo "==> Done."
