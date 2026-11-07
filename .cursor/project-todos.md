# Expire365 project todos

Agents: read this at session start; update when items are added, done, or dropped.
Keep entries short. Prefer `open` / `doing` / `done` / `dropped`.

**Todo list** = curated work below (Build next).  
**Feature triage** = full catalog 1–74 only (✅/🔴/⚪). Do not add new numbers there; pick into Build next instead.

## Ops (not product features)

- [x] **login_failed audit** — restored to master; admin audit logs failed logins (usernames tried).
- [x] **Homepage branch** — merged to `master` (`e33db5c`); redeploy prod for homepage + revert.

## Build next (todo — important only)

- [x] **Home icon hub (gradient)** — local only for now; long-press rearrange, free 9 slots/page, drop=save
- [x] **Per-account new UI switch** — Admin → account toggle; all users on account get hub vs classic home
- [ ] **2.** Bluetooth barcode scanner
- [ ] **3.** PDA / warehouse handheld scan
- [ ] **33.** Daily shortlist “what to check today”
- [ ] **34.** Staff accountability — who checked what / when (feeds analytics #8)
- [ ] **35.** Compliance / HACCP reports & digital journals
- [ ] **43.** Scales sync
- [ ] **48.** Return to supplier workflow
- [ ] **52.** Relocate stock between locations
- [x] **Write-off (брак)** — on remove: mark qty scrapped (needed for waste analytics)
- [x] **Owner analytics MVP** (owners only) — `/app/analytics`
  1–9: missed, waste week/month/trend, markdowns, markdown→waste, store spikes, staff leaders, coverage gaps, reverts
- [ ] **61.** POS integration
- [ ] **62.** ERP / API integration
- [ ] **63.** Label printer integration
- [ ] **42.** Electronic price tags (ESL sync)
- [ ] **74.** Share list via QR
- [ ] Temperature monitoring logs
- [ ] Hygiene checklists
- [ ] DDD protocols archive
- [ ] BABH / inspector read-only access
- [ ] Warehouse replenishment / morning orders
- [ ] Offline floor mode
- [x] Revert actions — owners restore inventory/list changes from Team → Activity (incl. multi-select)

## Later / parked

- [ ] Failed-login usernames in prod (needs deploy of login_failed stash)

## Feature triage (catalog only — ✅23 · 🔴35 · ⚪16)

Legend: ✅ have · 🔴 missing · ⚪ not worth it now  
(Not a backlog. Copy into **Build next** when you want to build it.)

1. ✅ Camera barcode scan
2. 🔴 Bluetooth barcode scanner
3. 🔴 PDA / warehouse handheld scan
4. ✅ OCR date from label/photo (document AI)
5. ✅ AI scan: barcode + date together
6. ✅ Manual date entry
7. ✅ Calendar / date picker
8. ⚪ Date spinner
9. ✅ Quantity for same expiry date
10. ✅ Add with photo, no barcode
11. ✅ Receipt scan (document AI)
12. ✅ Auto-fill name/image from product DB
13. ⚪ Offline scan + auto sync
14. ✅ Batch inventory by expiry date
15. ⚪ Locations: aisle / shelf
16. ⚪ Locations: fridge
17. ⚪ Locations: freezer
18. ⚪ Locations: back room / warehouse
19. ⚪ Product categories
20. ⚪ Per-category alert lead time
21. ✅ Multi-store
22. ⚪ Multi-department in one store
23. ✅ Receiving-at-delivery (scan + document AI)
24. ⚪ Hold / quarantine
25. ✅ FEFO (via expiry list)
26. 🔴 Excel / CSV import
27. ⚪ Excel / CSV export (have JPG; CSV mainly for migration)
28. ✅ Push notifications before expiry
29. ⚪ Email alerts / daily digest (needs email provider)
30. ⚪ WhatsApp alerts (bot possible, QR session awkward)
31. ✅ Configurable days-before-expiry alerts
32. ⚪ Priority engine (margin / section / regulation)
33. 🔴 Daily shortlist “what to check today”
34. 🔴 Staff accountability (who / when / which section)
35. 🔴 Compliance / HACCP reports
36. ✅ Manual price markdown
37. 🔴 Rule-based markdown by days left
38. ⚪ AI markdown (later, after real sales/waste analytics)
39. 🔴 Bulk markdown
40. 🔴 Print REDUCED / markdown labels
41. 🔴 New barcode on markdown label
42. ⚪ ESL price sync (later, when stores have ESL hardware)
43. 🔴 Scales sync
44. 🔴 POS / till price sync
45. 🔴 Block expired sales at till
46. 🔴 Write-off with reason
47. 🔴 Write-off with manager approval
48. 🔴 Return to supplier + debit note
49. 🔴 Donate workflow
50. 🔴 Marketplace / Surprise Bags
51. 🔴 Reduced-to-clear / yellow sticker workflow
52. 🔴 Relocate stock
53. 🔴 Sell-through / shrink forecast
54. 🔴 Optimal discount timing / % forecast
55. 🔴 Waste analytics (loss value)
56. 🔴 Trends by week / month
57. 🔴 Top waste categories
58. 🔴 Supplier reliability scoring
59. 🔴 Shelf-life prediction from ERP
60. 🔴 Smart recommendations (markdown / bag / donate)
61. 🔴 POS integration
62. 🔴 ERP / API integration
63. 🔴 Label printer integration
64. 🔴 Donation platform integration
65. 🔴 Consumer marketplace integration
66. ✅ Roles: owner / member
67. ✅ Multiple staff scan at once
68. ✅ Team shared list per store
69. ✅ Web + mobile sync (PWA)
70. 🔴 Recipes from inventory (household)
71. ✅ Shopping list
72. ⚪ Fridge / pantry / medicine zones (household)
73. 🔴 AI buying / waste habit analytics
74. 🔴 Share list via QR

## Done (recent)

- [x] **Homepage redesign** — full-width desktop hero + grids; mobile still stacked; hydration fix in `MobileI18nProvider`.
- [x] **Local Prisma sync** — `prisma generate` + restarting dev on `:3001`; `/api/auth/me` returns `canRemoveExpiry` when logged in.
- [x] Pull `origin/Homepage` locally (branch `Homepage` @ `b5722aa`).
- [x] Prod backup to PC (`E:\Work_Home\Backups\backup_expire365\…`).
- [x] IP `46.10.148.243` review — Vivacom Sofia; usernames tried: Irina/irina, deq/Deq (~not classic brute force).
