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

## Checkpoint 2: Bridge End-to-End Test

**Status: PASSED (2026-03-11T02:46Z)**

Full round-trip test against live MATRIX Sheets with confirmed MATRIX IDs:
- `RAPID_MATRIX_ID`: `1nnSY-J3n6DtVvKqyC40zpEt1sROtHkIEqmSwG-5d9dU`
- `PRODASH_MATRIX_ID`: `1byyXMJDpjzgqkhTjJ2GdvTclaGYMDKQ1BQEnz61Eg-w`
- `SENTINEL_MATRIX_ID`: `1K_DLb-txoI4F1dLrUyoFOuFc0xwsH1iW5eff3pQ_o6E`

### Test Sequence

**1. Health check:**
```
GET /health -> { status: "ok", sheetsConfigured: true, matrixStatus: { RAPID: true, PRODASH: true, SENTINEL: true } }
GET /status/sheets -> RAPID: 43 tabs, PRODASH: 23 tabs, SENTINEL: 4 tabs
```

**2. INSERT** — test carrier doc `TEST_BRIDGE_001` into `carriers` collection / `_CARRIER_MASTER` tab:
```
POST /write { collection: "carriers", operation: "insert", id: "TEST_BRIDGE_001", data: {...} }
Response: { success: true, stores: { firestore: "ok", sheets: "ok" } }  (1992ms)
```
Verified: Firestore doc exists with all fields. Sheets row 166 contains `TEST_BRIDGE_001 | BRIDGE TEST - DELETE ME | ... | test | test`.

**3. UPDATE** — change name and status:
```
POST /write { collection: "carriers", operation: "update", id: "TEST_BRIDGE_001", data: { name: "BRIDGE TEST UPDATED...", status: "test_updated" } }
Response: { success: true, stores: { firestore: "ok", sheets: "ok" } }  (889ms)
```
Verified: Firestore `name` updated. Sheets row 166 column B updated to new name, column H updated to `test_updated`.

**4. DELETE** (soft delete):
```
POST /write { collection: "carriers", operation: "delete", id: "TEST_BRIDGE_001" }
Response: { success: true, stores: { firestore: "ok", sheets: "ok" } }  (860ms)
```
Verified: Firestore has `_deleted: true`, `_deleted_at` set. Sheets row 166 status column = `deleted`.

**5. Cleanup:**
Test doc hard-deleted from Firestore. Test row deleted from Sheets. Carrier count back to 165 (original).

### Bridge Logs (complete session)
```
toMachina Bridge listening on port 8081
   RAPID_MATRIX_ID: configured
   PRODASH_MATRIX_ID: configured
   SENTINEL_MATRIX_ID: configured
[Bridge] insert carriers/TEST_BRIDGE_001 — firestore:ok sheets:ok (1992ms)
[Bridge] update carriers/TEST_BRIDGE_001 — firestore:ok sheets:ok (889ms)
[Bridge] delete carriers/TEST_BRIDGE_001 — firestore:ok sheets:ok (860ms)
```

### Finding: ADC Scope Requirement

During testing, discovered that Application Default Credentials must include `spreadsheets` (read/write) scope. The default `gcloud auth application-default login` only grants read-only. Fix:
```bash
gcloud auth application-default login --scopes="https://www.googleapis.com/auth/spreadsheets,https://www.googleapis.com/auth/cloud-platform"
```
**Cloud Run deployments use service account credentials which inherently have full scopes — this only affects local development.**

### Finding: Sheet Header Field Name Mismatch

The bridge maps data fields to Sheet columns by exact header match. Firestore field names must match the actual Sheet column headers. For example, `_CARRIER_MASTER` uses `name` (not `carrier_name`). Data sent through the bridge should use the Sheet's column names. This is by design — the bridge is a transparent passthrough, not a field-name translator.

### Test Script

Created `scripts/test-bridge.ts` with three modes:
- `check` — verify test doc exists in both Firestore and Sheets
- `insert-direct` — test Sheets API write directly (bypasses bridge)
- `cleanup` — hard-delete test doc from both stores

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
| `scripts/test-bridge.ts` | Bridge integration test (check/insert-direct/cleanup) |

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
