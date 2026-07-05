#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${MAGAZIN_APP_DIR:-/var/www/magazin}"

cd "$APP_DIR"

echo "==> Discarding local changes to generated PWA icons (rebuilt on npm install)..."
git checkout -- public/icons/apple-touch-icon.png public/icons/icon-192.png public/icons/icon-512.png public/icons/icon-512-maskable.png 2>/dev/null || true

echo "==> Pulling latest code..."
git pull

echo "==> Installing dependencies..."
npm install

echo "==> Generating Prisma client..."
npx prisma generate

echo "==> Applying migrations..."
npx prisma migrate deploy

echo "==> Stopping app for clean build..."
pm2 stop magazin 2>/dev/null || true

echo "==> Removing old .next build..."
rm -rf .next

echo "==> Building app..."
npm run build

echo "==> Restarting PM2..."
pm2 restart magazin

echo "==> Done. Verify register page has confirmPassword:"
grep -n confirmPassword src/components/auth-forms.tsx || true
