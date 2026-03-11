# Builder 2 Report — 2026-03-10

> Builder: Claude Opus 4.6 (1M context) — Builder 2
> Branch: `builder-2/api-and-migration`
> Worktree: `~/Projects/toMachina-builder2/`

---

## Commit

| Commit | Hash | Description |
|--------|------|-------------|
| v0.4.0 | `1ed4464` | Full REST API routes + migration types |

**Files changed:** 22 files, +1,556 lines

---

## Lane A: Full REST API Routes — COMPLETE

### What Was Built

13 route modules in `services/api/src/routes/` with full CRUD operations, plus a shared helper library in `services/api/src/lib/helpers.ts`.

### Route Inventory

| Route | Methods | Key Features |
|-------|---------|-------------|
| `/health` | GET | Firestore connectivity check, version info |
| `/api/clients` | GET, POST, PATCH, DELETE | Pagination, last_name prefix search, status filter, soft delete |
| `/api/clients/:id/accounts` | GET | Account type filter |
| `/api/clients/:id/activities` | GET | Ordered by created_at desc, limit param |
| `/api/clients/:id/relationships` | GET | Full subcollection read |
| `/api/accounts` | GET, POST, PATCH | **Collection group query** across all clients, type/status filters |
| `/api/accounts/:clientId/:accountId` | GET, PATCH | Direct subcollection access |
| `/api/agents` | GET, POST, PATCH | Pagination, name search, status filter |
| `/api/revenue` | GET, POST, PATCH | Filter by agent_id, account_id, type, period |
| `/api/revenue/summary/by-agent` | GET | Server-side aggregation by agent |
| `/api/opportunities` | GET, POST, PATCH, DELETE | Pipeline/stage/client/agent filters, soft delete to closed_lost |
| `/api/pipelines` | GET | Status filter |
| `/api/carriers` | GET | Name prefix search, limit 200 |
| `/api/products` | GET | Carrier filter, type filter, name search, limit 500 |
| `/api/campaigns` | GET | Status/type filters |
| `/api/campaigns/:id/templates` | GET | Related templates lookup |
| `/api/case-tasks` | GET, POST, PATCH | Status/assigned_to/client filters |
| `/api/communications` | GET | Client/channel/direction filters |
| `/api/org` | GET | Full org structure |
| `/api/org/:id/members` | GET | Team members in an org unit |
| `/api/users` | GET, PATCH | Admin-only updates (level 0-1 required) |
| `/api/users/me` | GET | Current authenticated user profile |

### Architecture Patterns

| Pattern | Implementation |
|---------|---------------|
| **Auth** | Firebase token verification middleware on all `/api/*` routes |
| **Domain restriction** | `@retireprotected.com` enforced in auth middleware |
| **Pagination** | Cursor-based: `?limit=25&startAfter=docId` (Firestore native) |
| **Responses** | `{ success: true, data, pagination? }` or `{ success: false, error }` |
| **Writes** | Bridge-first with Firestore fallback (bridge unavailable = direct write) |
| **Soft deletes** | Status field updates, no hard deletes |
| **Express v5** | `param()` helper for `string | string[]` route params |
| **Internal fields** | `_migrated_at`, `_source` stripped from all responses |
| **Audit trail** | `_created_by`, `_updated_by`, `_deleted_by` on all writes |

### Shared Helper Library (`services/api/src/lib/helpers.ts`)

| Export | Purpose |
|--------|---------|
| `successResponse()` | Standard success wrapper |
| `errorResponse()` | Standard error wrapper |
| `getPaginationParams()` | Parse limit/startAfter/orderBy/orderDir from query |
| `paginatedQuery()` | Apply cursor pagination to any Firestore query |
| `validateRequired()` | Check required fields in request body |
| `writeThroughBridge()` | Forward writes to bridge service with Firestore fallback |
| `stripInternalFields()` | Remove `_migrated_at`, `_source` from responses |
| `param()` | Normalize Express v5 `string | string[]` params |

---

## Lane B: Migration Additions — PARTIAL

### Changes Made

1. **`scripts/load-remaining.ts`** — Added `_SOURCE_REGISTRY` (ATLAS) to Batch 4 tabs
2. **`packages/core/src/types/index.ts`** — Added 10 new TypeScript interfaces: `Pipeline`, `Relationship`, `Activity`, `Campaign`, `Template`, `ContentBlock`, `SourceRegistry`, `Communication`, `CaseTask`
3. **`packages/db/src/firestore.ts`** — Added `contentBlocks`, `pipelines`, `sourceRegistry` collection references

### Migration Script Status

| Script | Status | Covers |
|--------|--------|--------|
| `load-clients.ts` | Existing (ran) | Clients + accounts |
| `load-reference.ts` | Existing (ran) | Carriers, products, users, org, agents |
| `load-remaining.ts` | Updated | Batch 3 (opps, pipelines, tasks, relationships, activities, revenue) + Batch 4 (campaigns, templates, content blocks, comms, source registry, flow) |

**Note:** The `load-remaining.ts` script was already built in v0.3.0 by Builder 1. It has NOT been run yet — running it requires `PRODASH_MATRIX_ID` env var and Sheets API access via Application Default Credentials. Builder 1 or JDM can run it when ready.

---

## TypeScript Verification

| Workspace | Errors |
|-----------|--------|
| `services/api` | 0 |
| `packages/core` | 0 |

---

## Files Created/Modified

### Created (15 files)
- `services/api/src/lib/helpers.ts`
- `services/api/src/routes/health.ts`
- `services/api/src/routes/clients.ts`
- `services/api/src/routes/accounts.ts`
- `services/api/src/routes/agents.ts`
- `services/api/src/routes/revenue.ts`
- `services/api/src/routes/users.ts`
- `services/api/src/routes/opportunities.ts`
- `services/api/src/routes/pipelines.ts`
- `services/api/src/routes/carriers.ts`
- `services/api/src/routes/products.ts`
- `services/api/src/routes/campaigns.ts`
- `services/api/src/routes/case-tasks.ts`
- `services/api/src/routes/communications.ts`
- `services/api/src/routes/org.ts`

### Modified (7 files)
- `services/api/src/server.ts` — Wired all 13 route modules + auth middleware
- `services/api/tsconfig.json` — Standalone Node.js config with `types: ["node"]`
- `packages/core/src/types/index.ts` — Added 10 interfaces
- `packages/db/src/firestore.ts` — Added 3 collection refs
- `scripts/load-remaining.ts` — Added `_SOURCE_REGISTRY`
- `scripts/package.json` — Added `load-remaining` script
- `package-lock.json` — Dependency resolution

---

## What Builder 1 Can Now Use

1. **All API routes are live** — start the API with `cd services/api && npx tsx src/server.ts`
2. **ProDash app can call** `/api/clients`, `/api/accounts`, etc. via `fetch()` with Firebase auth token
3. **Types are available** — `import { Pipeline, Campaign, ... } from '@tomachina/core'`
4. **Collection refs ready** — `collections.pipelines()`, `collections.contentBlocks()`, `collections.sourceRegistry()` in db package

---

## Merge Notes

This branch (`builder-2/api-and-migration`) touches only:
- `services/api/src/**` (primary — all new files)
- `packages/core/src/types/index.ts` (additive only — appended new interfaces)
- `packages/db/src/firestore.ts` (additive only — 3 new collection refs)
- `scripts/load-remaining.ts` (1 line added)
- `scripts/package.json` (1 line added)

**Zero conflicts expected with Builder 1's work** in `apps/**`, `packages/auth/**`, `packages/ui/**`.
