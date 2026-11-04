# Expire365 project todos

Agents: read this at session start; update when items are added, done, or dropped.
Keep entries short. Prefer `open` / `doing` / `done` / `dropped`.

## Open

- [ ] **login_failed audit** — WIP stashed as `wip: login_failed audit before Homepage pull` (nullable `AuditLog.userId`, log attempted usernames). Decide: restore on master/Homepage, commit, then deploy to prod if wanted.
- [ ] **Homepage branch** — currently checked out; decide merge to `master` / deploy marketing homepage to prod (ask before push/deploy).
## Later / parked

- [ ] ESL / e-ink shelf label integration (ZKONG / OpenEPaperLink-style) — research only for now; not building yet.
- [ ] AI markdown / richer AI scan output — relative later.
- [ ] Failed-login usernames already visible in prod AuditLog only after deploy of the stash above.

## Done (recent)

- [x] **Homepage redesign** — full-width desktop hero + grids; mobile still stacked; hydration fix in `MobileI18nProvider`.
- [x] **Local Prisma sync** — `prisma generate` + restarting dev on `:3001`; `/api/auth/me` returns `canRemoveExpiry` when logged in.
- [x] Pull `origin/Homepage` locally (branch `Homepage` @ `b5722aa`).
- [x] Prod backup to PC (`E:\Work_Home\Backups\backup_expire365\…`).
- [x] IP `46.10.148.243` review — Vivacom Sofia; usernames tried: Irina/irina, deq/Deq (~not classic brute force).

