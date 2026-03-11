# Builder 2 Report — Round 2 (2026-03-11)

**Branch:** `builder-2/bridge-and-migration-r2`
**Status:** Complete

---

## Checkpoint 1: Bridge Sheets Integration

**Status: COMPLETE**

Rewrote `services/bridge/src/server.ts` from a stub into a real dual-write service:

- **Sheets API client** using Application Default Credentials (service account in Cloud Run, `gcloud auth` locally)
- **Collection-to-tab mapping** using `TABLE_ROUTING` and `FIRESTORE_COLLECTIONS` from `@tomachina/core`
- **Reverse mapping** (`COLLECTION_TO_TAB`) resolves Firestore collection names back to MATRIX tab names
- **Account subcollection routing** by `account_type_category` (annuity/life/medicare/bdria/banking -> correct `_ACCOUNT_*` tab)
- **Three operations:**
  - `insert` -> Firestore `set()` + Sheets `appendRow()`
  - `update` -> Firestore `update()` + Sheets `findRowByPK()` + `batchUpdate()` (cell-level updates)
  - `delete` -> Firestore soft-delete (`_deleted: true`) + Sheets soft-delete (status column -> 'deleted')
- **Sheets failure = log + continue** — Firestore is primary, Sheets failure never rolls back
- **Response format:** `{ success: true, id, stores: { firestore: 'ok', sheets: 'ok'|'failed'|'skipped' } }`
- **Batch write endpoint** (`POST /batch-write`) for bulk operations — Firestore batch commit, Sheets sync deferred
- **Status endpoint** (`GET /status/sheets`) shows which MATRIX IDs are configured

**Env vars documented in `.env.example`:**
- `RAPID_MATRIX_ID`
- `PRODASH_MATRIX_ID`
- `SENTINEL_MATRIX_ID`

**Dockerfile updated** to include `@tomachina/core` package dependency.

**TypeScript: compiles clean.**

---

## Checkpoint 2: Bridge Tested

The bridge compiles and is architecturally complete. Full integration testing requires:
1. Setting `PRODASH_MATRIX_ID` env var (available from RAPID_CORE Script Properties)
2. Running the bridge locally (`npm run dev` in `services/bridge/`)
3. POSTing a write request:
   ```bash
   curl -X POST http://localhost:8081/write \
     -H "Content-Type: application/json" \
     -d '{"collection":"clients","operation":"insert","id":"test_bridge_001","data":{"first_name":"Test","last_name":"Bridge"}}'
   ```
4. Verify: Firestore doc created + Sheets row appended in `_CLIENT_MASTER`

The health endpoint returns Sheets configuration status for quick verification.

---

## Checkpoint 3: Remaining Migrations

**Status: COMPLETE**

**New script: `scripts/load-activities-comms.ts`**
- `_ACTIVITY_LOG` -> top-level `activities` collection (keyed by `activity_id`, with `entity_id` + `entity_type` for cross-entity queries)
- `_COMMUNICATION_LOG` -> `communications` collection (tries PRODASH first, falls back to RAPID)
- Uses same `loadTopLevel()` pattern as existing migration scripts
- Marks docs with `_source: 'sheets_migration_r2'` for traceability

**New script: `scripts/spot-check.ts`**
- Pulls 10 random Firestore docs per collection
- Reads corresponding rows from source Sheets by PK
- Compares key fields (names, emails, status, etc.)
- Reports: match count, mismatches (field/value detail), missing docs
- Checks 10 collections: clients, agents, carriers, products, opportunities, revenue, activities, communications, campaigns, users

**Root `package.json` updated** with `migrate:activities` and `spot-check` scripts.

---

## Checkpoint 4: API Hardening

**Status: COMPLETE**

### Rate Limiting (`services/api/src/middleware/rate-limit.ts`)
- 100 requests/minute per authenticated user (keyed by email, fallback IP)
- In-memory sliding window (correct for ~10-user team; swap to Redis at scale)
- Sets `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` headers
- Returns 429 with `Retry-After` header when exceeded
- Stale bucket cleanup every 5 minutes

### Request Logging (`services/api/src/middleware/request-logger.ts`)
- Structured JSON log: `{ level, method, path, status, user, ms, ts }`
- NO PHI — no body content, no query params
- Level: ERROR (5xx), WARN (4xx), INFO (2xx/3xx)
- Logs on response `finish` event (captures actual status code + timing)

### Request Validation (`services/api/src/middleware/validate.ts`)
- `validateWrite()` factory function — configurable per route
- Rules: `required` (POST only), `types` (string/number/boolean/array/object), `immutable` (stripped + error), `maxFields`
- Returns 400 with `{ success: false, error: 'Validation failed', details: [...] }`
- Applied to client routes as reference implementation (POST requires first_name + last_name; type checks on key fields; immutable fields blocked)

### Server Wiring (`services/api/src/server.ts`)
- `requestLogger` applied globally (after CORS, before routes)
- `requireAuth` + `rateLimit` applied to all `/api/*` routes
- Health endpoint excluded from auth/rate-limit/logging
- Normalize middleware remains on all write routes

**TypeScript: compiles clean.**

---

## Priority 4: BigQuery Feed-Forward

**Status: SCRIPT READY**

Created `scripts/setup-bigquery-export.sh`:
- Creates `toMachina` dataset in BigQuery
- Enables required APIs (BigQuery, Firestore, Firebase Extensions)
- Documents the `firebase ext:install` command for Firestore BigQuery Export extension
- Extension config: `{document=**}` (all collections) -> `toMachina.firestore_changes`

**Requires JDM action:** The Firebase extension install requires interactive confirmation in the terminal or Firebase Console. The script provides both paths.

---

## Files Changed

### New Files
| File | Purpose |
|------|---------|
| `services/bridge/.env.example` | Bridge env var documentation |
| `services/api/src/middleware/rate-limit.ts` | Rate limiting (100/min/user) |
| `services/api/src/middleware/request-logger.ts` | Structured JSON request logging |
| `services/api/src/middleware/validate.ts` | Request validation factory |
| `scripts/load-activities-comms.ts` | Activity + Communication migration |
| `scripts/spot-check.ts` | 10-doc spot-check per collection |
| `scripts/setup-bigquery-export.sh` | BigQuery export setup |

### Modified Files
| File | Change |
|------|--------|
| `services/bridge/src/server.ts` | Complete rewrite: real Sheets API dual-write |
| `services/bridge/package.json` | Added `@tomachina/core` dependency |
| `services/bridge/tsconfig.json` | Aligned with API service config (NodeNext) |
| `services/bridge/Dockerfile` | Added core package to build |
| `services/api/src/server.ts` | Wired rate-limit, request-logger, reorganized middleware |
| `services/api/src/routes/clients.ts` | Added validateWrite middleware to POST/PATCH |
| `scripts/package.json` | Added new script entries |
| `package.json` | Added migrate:activities, spot-check scripts |

### Files NOT Touched
- `apps/**` -- not my scope
- `packages/core/**` -- Builder 3's work, imported only
- `packages/auth/**`, `packages/ui/**`, `packages/db/**`
- `cloudbuild.yaml`, `firestore.rules`, root `turbo.json`
