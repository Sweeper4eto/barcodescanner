---
name: always-add-tests
description: >-
  Always add or update tests when changing app behavior. Covers unit, integration,
  and frontend/UI tests. Use when implementing features, fixing bugs, changing
  APIs, components, hooks, or user flows.
---

# Always add tests

## Rule

When you change product behavior, **do not finish** until tests cover the change.

Add or update all layers that apply:

1. **Unit** — pure logic, helpers, parsers, validators (`tests/*.test.ts`).
2. **Integration** — API routes, DB/auth flows (`tests/*.integration.test.ts` or existing integration suites).
3. **Frontend** — Playwright `e2e/` for user-visible flows; unit/component tests for non-trivial UI logic.

## What counts as “must test”

- New feature or user flow
- Bug fix (include a regression test)
- API / auth / permission change
- i18n-only copy: skip unless logic changed
- Pure refactor: keep existing tests green

## How to choose

| Change | Prefer |
|--------|--------|
| Pure function / lib | Unit |
| Route / Prisma / session | Integration |
| Screen / form / navigation | Frontend e2e (+ unit if needed) |

If unsure: **unit + one higher-level test** that would catch the regression.

## Done checklist

- [ ] Behavior covered by a test
- [ ] Related tests updated
- [ ] Relevant tests run (or note why not)
