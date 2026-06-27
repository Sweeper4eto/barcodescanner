#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${MAGAZIN_APP_DIR:-/var/www/magazin}"

cd "$APP_DIR"

echo "==> Pulling latest code..."
git pull

echo "==> Installing dependencies..."
npm install

echo "==> Generating Prisma client..."
npx prisma generate

echo "==> Applying migrations..."
npx prisma migrate deploy

echo "==> Building app..."
npm run build

echo "==> Restarting PM2..."
pm2 restart magazin

echo "==> Done. Verify register page has confirmPassword:"
grep -n confirmPassword src/components/auth-forms.tsx || true
