<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Cursor Cloud specific instructions

- Dev server: `npm run dev` (Next.js on port 3001, hostname `0.0.0.0` when agents need to reach it). Login page: `http://127.0.0.1:3001/login`.
- There is no committed env file. The app needs `DATABASE_URL` (SQLite, `file:./dev.db`) and `SESSION_SECRET` (at least 16 characters). `next build` runs with `NODE_ENV=production`, and `src/lib/db.ts` throws when `DATABASE_URL` is missing. Prisma and the app load `.env` via dotenv.
- `npm ci` exits with a lockfile error: optional `@emnapi/runtime` and `@emnapi/core` are not pinned. Install with `npm install --no-fund --no-audit`, then `git checkout -- package-lock.json` so the lockfile stays as committed.
- Prisma Client is generated to gitignored `src/generated/prisma`. After install, run `npx prisma generate`. Apply migrations with `npx prisma migrate deploy` (non-interactive). Seed with `npm run db:seed`. The seeded admin is `admin` / `admin123`.
- `npm run validate` is lint, then `npm test`, then `npm run build`. Lint currently fails on existing `react-hooks/refs` errors in `src/app/app/buy-list/page.tsx` and `src/app/app/schedule/page.tsx`, so validate stops before the tests. `npm test` and `npm run build` succeed on their own.
- `@zxing/library@0.23.0` declares Node `>= 24`. Node 22 prints an engine warning during install; the app still runs.
