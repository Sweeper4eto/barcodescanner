#!/usr/bin/env bash
# Backup expire365 SQLite DB + product uploads.
# Safe while the app is running: uses sqlite3 .backup (not a raw file copy).
#
# Policy (default):
#   - 1 local backup per week (crontab)
#   - Keep the 2 newest folders (~2 weeks); each run drops anything older
#   - Once a month: download /var/backups/expire365/ to your PC (optional), then you can
#     clear the folder — next weekly runs recreate up to 2 again
#
# Env (optional). An existing MAGAZIN_* value or folder is used when the new one is absent.
#   EXPIRE365_APP_DIR      default /var/www/expire365
#   EXPIRE365_DB_PATH      default /var/lib/expire365/data.db
#   EXPIRE365_BACKUP_DIR   default /var/backups/expire365
#   EXPIRE365_BACKUP_KEEP  default 2
#
# Install (weekly, Sunday 03:15 server time):
#   sudo apt install -y sqlite3
#   sudo mkdir -p /var/backups/expire365
#   sudo chmod +x /var/www/expire365/scripts/backup-expire365.sh
#   crontab -e
#   15 3 * * 0 /var/www/expire365/scripts/backup-expire365.sh >> /var/log/expire365-backup.log 2>&1
#
# Monthly download (from your PC), optional clear:
#   scp -r root@YOUR_SERVER:/var/backups/expire365 ./expire365-backup-$(date +%Y%m)
#   ssh root@YOUR_SERVER 'rm -rf /var/backups/expire365/*'

set -euo pipefail

pick_existing() {
  local preferred="$1"
  local legacy="$2"
  local kind="$3"
  if [[ "$kind" == "file" && -f "$preferred" ]]; then echo "$preferred"; return; fi
  if [[ "$kind" == "dir" && -d "$preferred" ]]; then echo "$preferred"; return; fi
  if [[ "$kind" == "file" && -f "$legacy" ]]; then echo "$legacy"; return; fi
  if [[ "$kind" == "dir" && -d "$legacy" ]]; then echo "$legacy"; return; fi
  echo "$preferred"
}

APP_DIR="${EXPIRE365_APP_DIR:-${MAGAZIN_APP_DIR:-}}"
if [[ -z "$APP_DIR" ]]; then
  APP_DIR="$(pick_existing /var/www/expire365 /var/www/magazin dir)"
fi
DB_PATH="${EXPIRE365_DB_PATH:-${MAGAZIN_DB_PATH:-}}"
if [[ -z "$DB_PATH" ]]; then
  DB_PATH="$(pick_existing /var/lib/expire365/data.db /var/lib/magazin/data.db file)"
fi
BACKUP_DIR="${EXPIRE365_BACKUP_DIR:-${MAGAZIN_BACKUP_DIR:-}}"
if [[ -z "$BACKUP_DIR" ]]; then
  BACKUP_DIR="$(pick_existing /var/backups/expire365 /var/backups/magazin dir)"
fi
KEEP="${EXPIRE365_BACKUP_KEEP:-${MAGAZIN_BACKUP_KEEP:-2}}"
# New photos live in data/uploads. public/uploads is only a leftover from older builds.
UPLOADS_PRIVATE="${APP_DIR}/data/uploads"
UPLOADS_LEGACY="${APP_DIR}/public/uploads"
UPLOADS_EXTRA="${EXPIRE365_UPLOAD_DIR:-${MAGAZIN_UPLOAD_DIR:-}}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
DEST="${BACKUP_DIR}/${STAMP}"

mkdir -p "$DEST"

if [[ ! -f "$DB_PATH" ]]; then
  echo "ERROR: database not found: $DB_PATH" >&2
  exit 1
fi

if ! command -v sqlite3 >/dev/null 2>&1; then
  echo "ERROR: sqlite3 CLI is required (apt install sqlite3)" >&2
  exit 1
fi

echo "==> Backup ${STAMP}"
echo "    DB:      $DB_PATH"
echo "    Uploads: $UPLOADS_PRIVATE"
echo "    Dest:    $DEST"

# Consistent snapshot even with WAL / live writers.
sqlite3 "$DB_PATH" ".backup '${DEST}/data.db'"
# Compress for smaller download / less disk (~1.3G often shrinks a lot).
gzip -9 "${DEST}/data.db"

stage="$(mktemp -d)"
mkdir -p "$stage/uploads"
copied=0
if [[ -d "$UPLOADS_LEGACY" && -n "$(ls -A "$UPLOADS_LEGACY" 2>/dev/null || true)" ]]; then
  cp -a "$UPLOADS_LEGACY"/. "$stage/uploads"/
  copied=1
fi
if [[ -d "$UPLOADS_PRIVATE" && -n "$(ls -A "$UPLOADS_PRIVATE" 2>/dev/null || true)" ]]; then
  cp -a "$UPLOADS_PRIVATE"/. "$stage/uploads"/
  copied=1
fi
if [[ -n "$UPLOADS_EXTRA" && -d "$UPLOADS_EXTRA" && "$UPLOADS_EXTRA" != "$UPLOADS_PRIVATE" && "$UPLOADS_EXTRA" != "$UPLOADS_LEGACY" && -n "$(ls -A "$UPLOADS_EXTRA" 2>/dev/null || true)" ]]; then
  cp -a "$UPLOADS_EXTRA"/. "$stage/uploads"/
  copied=1
fi
if [[ "$copied" -eq 1 ]]; then
  tar -C "$stage" -czf "${DEST}/uploads.tar.gz" uploads
else
  echo "    (no uploads dir yet — skipped)"
fi
rm -rf "$stage"

(
  cd "$DEST"
  sha256sum data.db.gz uploads.tar.gz 2>/dev/null > SHA256SUMS || sha256sum data.db.gz > SHA256SUMS
)

echo "==> Wrote:"
du -sh "$DEST"/* 2>/dev/null || true

# Retention: keep only the newest $KEEP backup folder(s).
KEEP_COUNT=0
for dir in $(ls -1dt "$BACKUP_DIR"/[0-9]*T*Z 2>/dev/null); do
  KEEP_COUNT=$((KEEP_COUNT + 1))
  if [[ "$KEEP_COUNT" -gt "$KEEP" ]]; then
    echo "==> Pruning $dir"
    rm -rf "$dir"
  fi
done

echo "==> Done. Latest: $DEST (~${KEEP} week(s) kept under ${BACKUP_DIR})"
