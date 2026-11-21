---
name: no-push-no-deploy
description: >-
  Never push to git or deploy to production without explicit user instruction.
  Use when committing, pushing, creating PRs that push, deploying, SSHing to
  prod, running update/deploy scripts, pm2 restart on servers, or finishing a
  fix the user will test on prod.
---

# No push / no prod deploy without asking

## Rule (verbatim)

Never push to git without me telling you or deploying to prod without me telling you.

## What counts as forbidden unless explicitly asked

- `git push` (any remote, any branch, including after a local commit)
- Prod deploy: SSH to the server, `update-expire365.sh` / `update-magazin.sh`,
  `git reset --hard` on the server, `pm2` restart/reload for the live app,
  maintenance flag on/off for a deploy, or any other live-server update

## Allowed without asking

- Local commits **only** when the user asked to commit
- Local builds, tests, lint
- Reading git status / log / diff

## If unclear

Do the local work. Stop. Ask before push or deploy. Do not infer permission from
"fix it", "it still does not work", prior chat deploy history, or a pending todo.
