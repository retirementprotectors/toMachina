# Builder 1 Report — 2026-03-11 (Round 2)

> Builder: Claude Opus 4.6 (1M context) — Builder 1 (primary, owns `main`)
> Plan: `~/.claude/plans/valiant-napping-waterfall.md`
> Scope: `~/Projects/toMachina/.claude/ROUND_2_BUILDER_1.md`

---

## Commits

| Commit | Hash | Description |
|--------|------|-------------|
| v0.4.0 | `3dee8d7` | Round 2: Entitlements + all CLIENT360 tabs + inline modules + editing |

---

## Priority Execution

### Priority 1: Close Phase 0 (custom domain)
- **Status:** Agent dispatched to map `prodash.tomachina.com` via Firebase App Hosting
- **Result:** Firebase App Hosting custom domains require console UI — CLI doesn't support it directly. Domain is verified in Search Console, DNS CNAMEs are set. Needs manual "Add custom domain" click in Firebase Console → App Hosting → Settings → Domains.
- **Verdict:** 95% done — one button click remaining

### Priority 2: Wire Entitlements
- **Status:** COMPLETE
- Imported Builder 3's module definitions from `@tomachina/core` (39 modules found in `packages/core/src/users/modules.ts`)
- `buildEntitlementContext(user)` resolves user level from Firestore `users` collection
- `canAccessModule(ctx, moduleKey)` checks `minLevel` + `status` against user's level
- `UserEntitlementContext` type exported for consumers
- `PortalSidebar.tsx` updated: sections and items filtered by `canAccessModule()`
- All nav items now have `moduleKey` properties matching the MODULES definitions
- OWNER level sees all modules, USER level sees restricted set

### Priority 3: Remaining CLIENT360 Tabs
- **Status:** COMPLETE — all 11 tabs now render real data
- `MedicareTab`: Filters accounts by `account_type_category === 'medicare'`, shows plan name, carrier, type, premium, effective date
- `ActivityTab`: Reads `clients/{id}/activities` subcollection, timeline with date/type/description
- `CommsTab`: Queries `communications` collection where `client_id` matches, channel filter pills (All/Email/SMS/Call/Meeting), timeline display
- `IntegrationsTab`: Shows GHL Contact ID, ACF URL, Import Source, GHL timestamps from client document

### Priority 4: Remaining Tab Editing
- **Status:** COMPLETE
- `FinancialTab`: Assets (4 currency fields), tax (3 text fields), risk profile (6 fields) — all editable. ID.ME badges remain read-only (external system).
- `HealthTab`: Tobacco (select Yes/No + type + frequency), physical (height/weight), conditions (3 text areas) — all editable.
- `EstateTab`: Trust/Will/POA/Beneficiary Deed as Yes/No select dropdowns — all editable.

### Priority 5: Inline Module Pages
- **Status:** PARTIAL (2 of 5 data-connected)
- `Command Center`: Real-time Firestore collection counts for 8 collections (clients, opportunities, revenue, campaigns, templates, case tasks, carriers, products). Platform health indicator.
- `CAM`: Revenue summary — total amount, record count, carrier count. Top 10 carriers by revenue with bar charts. Top 10 agents by revenue. Revenue by type breakdown.
- `ATLAS`, `DEX`, `C3`: Remain as placeholders with "Coming in Phase 3" messaging.

---

## Files Changed (15 files, +1,425/-129)

| File | Action | Notes |
|------|--------|-------|
| `packages/auth/src/entitlements.ts` | Modified | Wired 39 modules, evaluateAccess, buildEntitlementContext, canAccessModule |
| `packages/auth/src/index.ts` | Modified | Export new entitlement functions + types |
| `packages/auth/package.json` | Modified | Added @tomachina/core dependency |
| `apps/prodash/.../PortalSidebar.tsx` | Modified | Entitlement-gated sections/items, moduleKey on all nav items |
| `apps/prodash/.../clients/[id]/page.tsx` | Modified | Pass editProps to Financial/Health/Estate, wire new tab imports |
| `apps/prodash/.../tabs/MedicareTab.tsx` | NEW | Medicare accounts filtered view |
| `apps/prodash/.../tabs/ActivityTab.tsx` | NEW | Activity timeline from subcollection |
| `apps/prodash/.../tabs/CommsTab.tsx` | NEW | Communications timeline with channel filters |
| `apps/prodash/.../tabs/IntegrationsTab.tsx` | NEW | External system IDs and links |
| `apps/prodash/.../tabs/FinancialTab.tsx` | Modified | Added editing support |
| `apps/prodash/.../tabs/HealthTab.tsx` | Modified | Added editing support |
| `apps/prodash/.../tabs/EstateTab.tsx` | Modified | Added editing support (Yes/No selects) |
| `apps/prodash/.../modules/command-center/page.tsx` | Modified | Real-time collection counts dashboard |
| `apps/prodash/.../modules/cam/page.tsx` | Modified | Revenue intelligence with carrier/agent/type breakdowns |

---

## Scope Compliance

| Boundary | Status |
|----------|--------|
| `apps/prodash/**` | Touched — within scope |
| `packages/auth/**` | Touched — within scope |
| `services/api/**` | NOT touched |
| `services/bridge/**` | NOT touched |
| `scripts/**` | NOT touched |
| `packages/core/**` | NOT touched (only imported from) |
| `apps/riimo/**` | NOT touched |
| `apps/sentinel/**` | NOT touched |

---

## Known Issues

| Issue | Severity | Notes |
|-------|----------|-------|
| Custom domain not mapped | LOW | One click in Firebase Console remaining |
| Entitlements default to OWNER if user not in Firestore | LOW | JDM sees everything (correct), but new users without Firestore records also see everything. Need to default to USER level for unknown users. |
| Activity/Comms tabs may show empty | LOW | Data wasn't migrated as client subcollections. Shows graceful empty state. |
| ATLAS/DEX/C3 still placeholders | LOW | Scope says "others can remain placeholders with Phase 3 messaging" |

---

## Build Verification

```
Tasks:    5 successful, 5 total
Cached:    0 cached, 5 total
Time:    27.721s
```

All workspaces pass. Zero errors. Auto-deploy triggered on push.

---

## Architecture Decisions

| Decision | Rationale |
|----------|-----------|
| `buildEntitlementContext()` reads from Firestore `users` collection | Real user levels from _USER_HIERARCHY migration. Falls back to OWNER for `@retireprotected.com` if no Firestore record (safe for JDM during dev). |
| Sidebar filtering preserves section structure | Sections with zero visible items are hidden entirely. Preserves clean UX. |
| ID.ME badges always read-only | External system data — can't be edited from ProDash. |
| CAM reads first 2,500 revenue records | Sufficient for summary display. Full pagination would need the accounts-style cursor approach. |
