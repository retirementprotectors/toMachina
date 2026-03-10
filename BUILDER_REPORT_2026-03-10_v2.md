# toMachina Builder Report v2 — 2026-03-10 (Evening Session)

> Continuation of the initial build session. Covers v0.2.1 through v0.2.2.
> Builder: Claude Opus 4.6 (1M context)
> Plan: `~/.claude/plans/valiant-napping-waterfall.md`

---

## Commits This Session

| Commit | Hash | Description |
|--------|------|-------------|
| v0.2.1 | `b822327` | Fix CLIENT360 crash + lazy Firebase init + env propagation + reference data |
| v0.2.2 | `01bd487` | Accounts module + account detail + collection group queries |

**Cumulative:** 4 commits, ~14,800 lines across ~185 files

---

## Issues Resolved From First Audit

| Audit Finding | Severity | Status | Resolution |
|---------------|----------|--------|------------|
| Root tsconfig.json missing jsx | HIGH | Fixed (v0.2.1) | Added `"jsx": "react-jsx"` |
| .env.local propagation | MEDIUM | Fixed (v0.2.1) | Symlink script + postinstall hook + turbo globalEnv |
| Load reference data (Batch 1) | REC | Done (v0.2.1) | 532 docs: 164 carriers, 325 products, 15 users, 11 org, 17 agents |
| Cloud Build trigger | HIGH | Attempted | APIs enabled, Artifact Registry created, build submitted — failed on missing env vars (now fixed by lazy init) |
| Cloud Run domain mappings | HIGH | Blocked | Needs successful Cloud Build first |

---

## New Work: v0.2.1

### Bug Fixes
- **CLIENT360 crash** (`Cannot read properties of undefined (reading 'call')`): Root cause was `collection(db, ...)` creating a new query object every render, causing `useCollection` hook to infinite-loop. Fixed with `useMemo` on the query ref.
- **useCollection hook**: Changed dependency from query object reference to serialized query path string. Added null guard.
- **Firebase lazy initialization**: Auth provider and Firestore client both crashed during SSR/build because `initializeApp()` ran at module load time when env vars weren't available. Refactored to lazy singleton pattern (`getDb()`, `getFirebaseAuth()`). Build now passes without `.env.local`.
- **Firestore Proxy approach failed**: Firebase SDK does `instanceof` checks on the Firestore object, so a `Proxy` wrapper doesn't work. Replaced with explicit `getDb()` function export.
- **Hydration mismatch (React #418)**: `AuthProvider` and `ToastProvider` (client components) were directly in the server-rendered root layout. Extracted to `providers.tsx` client component wrapper. Added `suppressHydrationWarning` on `<html>`.
- **Material Icons rendering as text**: Google Fonts loaded via CSS `@import` after `@import "tailwindcss"`, causing load failure. Moved to `<link>` tags in layout `<head>`.
- **`collections` export change**: Changed from eager values to lazy functions (`collections.clients()` instead of `collections.clients`) to prevent module-load-time Firestore initialization.

### Infrastructure
- **Env symlink script** (`scripts/link-env.sh`): Symlinks root `.env.local` into each app directory. Runs as `postinstall` hook.
- **Turbo globalEnv**: Added all 6 `NEXT_PUBLIC_FIREBASE_*` vars to `turbo.json` so cache invalidates on env changes.
- **Reference data migration** (`scripts/load-reference.ts`): Loaded Batch 1 reference data from RAPID_MATRIX and SENTINEL_MATRIX.

### Reference Data Loaded

| Sheet | Source | Firestore Collection | Documents |
|-------|--------|---------------------|-----------|
| `_CARRIER_MASTER` | RAPID_MATRIX | `carriers` | 164 |
| `_PRODUCT_MASTER` | RAPID_MATRIX | `products` | 325 |
| `_USER_HIERARCHY` | RAPID_MATRIX | `users` | 15 |
| `_COMPANY_STRUCTURE` | RAPID_MATRIX | `org` | 11 |
| `_PRODUCER_MASTER` | SENTINEL_MATRIX | `agents` | 17 |

**Adjustments from plan:**
- `_AGENT_MASTER` does not exist in SENTINEL_MATRIX — `_PRODUCER_MASTER` contains all agent data (keyed by `agent_id`)
- `_COMPANY_STRUCTURE` uses `entity_id` as primary key, not `unit_id`

---

## New Work: v0.2.2

### Accounts Module (`/accounts`)

Full cross-client accounts grid:
- **Data source**: Firestore collection group query (`collectionGroup(db, 'accounts')`) — queries across all `clients/{id}/accounts` subcollections in a single call
- **17,376 accounts** rendering with:
  - Search (carrier, product, plan, policy number, client name)
  - Type filter pills (All/Annuity/Life/Medicare/BD-RIA) with color-coded counts
  - Sortable columns: Client, Carrier, Product, Status, Value
  - 25-per-page pagination
- **Client name enrichment**: Async batch lookup of client names (first 500 unique client IDs) after initial load
- **Category classification**: Uses `account_type_category` (set during migration) with fallback text matching on `product_type` and `account_type`

### Account Detail (`/accounts/[clientId]/[accountId]`)

- Reads from Firestore subcollection: `clients/{clientId}/accounts/{accountId}`
- Header card: carrier name, product name, status badge, 4 key stat cards (value, premium, policy #, issue date)
- Detail section: auto-renders all non-empty, non-internal fields with smart formatting (currency for value fields, dates for date fields, monospace for ID fields)
- Back navigation to client's CLIENT360

### CLIENT360 Accounts Tab Fixes

- Account cards now clickable — navigate to `/accounts/[clientId]/[accountId]`
- Fixed field mapping to match actual Firestore data:
  - `carrier_name` (not `carrier`)
  - `product_name` / `plan_name` (not `product`)
  - `account_number` / `policy_number` / `contract_number` (with fallback chain)
  - `account_value` / `premium` / `face_amount` (with fallback chain)
  - `issue_date` / `effective_date` (with fallback)
- Category classification uses `account_type_category` first, then text matching

### Firestore Rules Update

- Added collection group query rule: `match /{path=**}/accounts/{docId} { allow read: if isRPIUser(); }`
- Deployed via Firebase Rules REST API (delete + recreate release)

### Sidebar Accounts Page

- Previously a `.gitkeep` stub (404) — now a proper placeholder with link to clients until full cross-client grid is wired (which it now is)

---

## Current Firestore State

| Collection | Documents | Source |
|-----------|-----------|--------|
| `clients` | 5,019 | PRODASH_MATRIX `_CLIENT_MASTER` |
| `clients/*/accounts` | ~18,949 | 4 account tabs (annuity: 1,069 / life: 5,178 / medicare: 12,702 / bdria: partial) |
| `carriers` | 164 | RAPID_MATRIX `_CARRIER_MASTER` |
| `products` | 325 | RAPID_MATRIX `_PRODUCT_MASTER` |
| `users` | 15 | RAPID_MATRIX `_USER_HIERARCHY` |
| `org` | 11 | RAPID_MATRIX `_COMPANY_STRUCTURE` |
| `agents` | 17 | SENTINEL_MATRIX `_PRODUCER_MASTER` |
| **Total** | **~24,500** | |

---

## Known Issues (Updated)

| Issue | Severity | Status | Notes |
|-------|----------|--------|-------|
| Cloud Build trigger not wired | High | In progress | APIs enabled, Artifact Registry created. Build submitted but failed on env vars (now fixed by lazy init). Needs re-submission. |
| Cloud Run domain mappings | High | Blocked | Needs successful first deploy |
| BD/RIA loader — 1 empty doc ID | Low | Open | One account had empty `account_id` + `policy_number` |
| Account type pills not visually obvious | Low | Open | Filter pills exist but need visual polish |
| Sidebar navigation needs polish | Medium | Open | Icons rendering, collapse works, but spacing and active states need tuning |
| Missing account fields in detail view | Low | Expected | Fields only display if non-empty in source data. Schema-aware display (per account type) is Phase 1 polish |
| `useCollection` dependency on serialized path | Low | Watch | Uses internal Firestore `_query.path` for dependency — may break on SDK updates |
| Accounts module loads all 17K docs on mount | Medium | Open | Works fast now but should add server-side pagination or limit for production scale |

---

## Phase Progress (Updated)

| Phase | Previous | Now | Delta |
|-------|----------|-----|-------|
| Phase 0: Foundation | 90% | 92% | +2% (env propagation fixed, Cloud Build attempted) |
| Phase 1: PRODASHX Portal | 60% | 72% | +12% (Accounts module, account detail, field mapping fixes, bug fixes) |
| Phase 2: Data Migration | 40% | 48% | +8% (Batch 1 reference data loaded: carriers, products, users, org, agents) |

---

## Remaining Work (Priority Order)

### Close Phase 0
1. Re-submit Cloud Build (lazy init should fix the env var issue)
2. Deploy ProDash to Cloud Run
3. Create domain mappings for `prodash.tomachina.com`

### Phase 1 Remaining
1. Navigation polish (sidebar active states, spacing, icons)
2. UI polish (match original PRODASHX dark theme more closely)
3. 46 module entitlement definitions (MODULES array)
4. Client edit functionality (write to Firestore + bridge)
5. Remaining sidebar pages (casework, pipelines, sales centers, service centers)
6. Inline modules (CAM, DEX, C3, ATLAS, Command Center) — placeholder pages
7. 4 placeholder CLIENT360 tabs (Medicare, Comms, Activity, Integrations)

### Phase 2 Remaining
1. Opportunities + Revenue (Batch 3)
2. Campaign data (Batch 4)
3. SENTINEL-specific data (Batch 5)
4. BigQuery feed-forward setup

---

## Architecture Decisions Made

| Decision | Rationale |
|----------|-----------|
| Lazy Firebase init (`getDb()`) over Proxy | Firebase SDK does `instanceof` checks — Proxy fails. Lazy getter is explicit and SSR-safe. |
| Collection group query for Accounts | Accounts are subcollections by design (most queries are per-client). Cross-client view uses `collectionGroup()` which Firestore natively supports. |
| Client name enrichment (async batch) | Avoided denormalizing client names into every account doc. Instead, batch-fetch names after initial load. Fast enough for 500 unique clients. |
| `providers.tsx` client boundary | Next.js 15 App Router requires explicit client/server boundaries. Auth + Toast providers must be client components — isolating them prevents hydration mismatches. |
| Symlink for env propagation | Simpler than dotenv in next.config, works with Turborepo's workspace isolation, no build-time config changes needed. |
