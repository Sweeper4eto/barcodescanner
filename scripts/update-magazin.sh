#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${MAGAZIN_APP_DIR:-/var/www/magazin}"

cd "$APP_DIR"

echo "==> Syncing to latest origin/master..."
git fetch origin
git reset --hard origin/master

echo "==> Installing dependencies..."
npm install

echo "==> Generating Prisma client..."
npx prisma generate

# SQLite cannot migrate while the app holds a write lock.
echo "==> Stopping app before migrate/build..."
pm2 stop magazin 2>/dev/null || true

echo "==> Applying migrations..."
npx prisma migrate deploy

echo "==> Removing old .next build..."
rm -rf .next

echo "==> Building app (webpack, low-memory friendly)..."
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=1536}"
npm run build

echo "==> Restarting PM2..."
pm2 restart magazin || pm2 start npm --name magazin -- start

echo "==> Done. Verify register page has confirmPassword:"
grep -n confirmPassword src/components/auth-forms.tsx || true
