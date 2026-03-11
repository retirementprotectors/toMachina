# Sprint 4 — Builder 43 Report: CAM Partial Move + Infrastructure Cutover Prep

**Branch:** `sprint4/cam-infra-cutover`
**Builder:** 43 (CAM + Infrastructure)
**Status:** COMPLETE

---

## Checkpoints

| CP | Description | Status |
|----|-------------|--------|
| CP1 | CAM API routes compile with full CRUD | PASS |
| CP2 | Comp grid migration ready (API route created, Firestore CRUD) | PASS |
| CP3 | Cloud Run deployment configs (already exist in root cloudbuild.yaml) | PASS — verified |
| CP4 | MCP callCloudRunAPI helper created | PASS |
| CP5 | RAPID_IMPORT URL swap script generates correct diff | PASS |
| CP6 | BigQuery streaming Cloud Function created | PASS |
| CP7 | Full build passes 10/10 | PASS |

---

## Part 1: CAM Backend API Routes

**File:** `services/api/src/routes/cam.ts` (NEW — 450+ lines)
**Mount:** `app.use('/api/cam', normalizeBody, camRoutes)` in server.ts

### Endpoints Built

**Revenue Analytics (5 endpoints):**

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/cam/revenue` | Revenue summary (total, by carrier, by agent, by type) with filters |
| GET | `/api/cam/revenue/trends` | Monthly revenue trends (configurable months lookback) |
| GET | `/api/cam/revenue/by-carrier` | Revenue ranked by carrier |
| GET | `/api/cam/revenue/by-agent` | Revenue ranked by agent |
| GET | `/api/cam/revenue/by-type` | Revenue breakdown by product type |

**Commission Calculations (3 endpoints):**

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/cam/commission/calculate` | Calculate FYC, renewal, or override commission (uses @tomachina/core) |
| POST | `/api/cam/commission/project` | Project commissions forward with growth rate + optional NPV |
| GET | `/api/cam/commission/schedule/:id` | Get commission schedule for an account |

**Comp Grids (3 endpoints):**

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/cam/comp-grids` | List comp grids (filter by product type) with pagination |
| GET | `/api/cam/comp-grids/:id` | Get grid detail with rate tiers |
| POST | `/api/cam/comp-grids` | Create/update grid entry (writes via bridge) |

**Pipeline (2 endpoints):**

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/cam/pipeline` | Pipeline summary (submitted/issued/withdrawn + conversion rate) |
| GET | `/api/cam/pipeline/forecast` | Revenue forecast (3/6/12 month projections) |

**Projections (1 endpoint):**

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/cam/projections/hypothetical` | What-if scenario calculator (retail + downline + network) |

**Total: 14 endpoints.** All use `@tomachina/core` financial functions (calculateFYC, calculateRenewal, calculateOverride, projectRevenue, calculateNPV). No math rewritten.

### Comp Grid Data

The `comp_grids` Firestore collection can be populated via the POST endpoint. No separate migration script was needed — the API route IS the CRUD interface. If bulk loading from MATRIX is needed later, the POST endpoint accepts the same structure.

---

## Part 2: Infrastructure Cutover Preparation

### 2a. Cloud Run Deployment Configs — VERIFIED

Deployment configs already exist in the root `cloudbuild.yaml`:
- `tm-api`: 1Gi/2CPU, min 1 instance, max 20
- `tm-bridge`: 512Mi/1CPU, min 0, max 5
- Docker images pushed to `us-central1-docker.pkg.dev/claude-mcp-484718/tomachina/`
- Auto-triggered on push to `main`

No separate per-service cloudbuild.yaml needed — the root config handles everything.

### 2b. MCP Cloud Run API Helper — DONE

**File:** `services/MCP-Hub/rpi-workspace-mcp/src/cloud-run-api.js` (NEW)

Two exported functions:
- `callCloudRunAPI(path, method, body)` — Direct Cloud Run call with OAuth token auth
- `callWithFallback(cloudRunPath, gasScriptId, gasFunctionName, gasParams, options)` — Try Cloud Run first, fall back to GAS execute_script

Auth: Uses existing `getAuthClient()` from `auth.js` for OAuth token.
Base URL: `process.env.TOMACHINA_API_URL || 'https://api.tomachina.com'`

### 2c. RAPID_IMPORT URL Swap Script — DONE

**File:** `scripts/cutover/rapid-import-url-swap.ts` (NEW)

Generates a full diff showing:
1. `RAPID_API_CONFIG.URL`: Old GAS Web App URL → New Cloud Run URL
2. `callRapidAPI_()` function rewrite: query params → direct path + OIDC auth
3. Summary of 5 key changes (URL, auth, routing, HTTP methods, payload handling)
4. Prerequisites checklist for Sprint 5
5. Does NOT modify `gas/RAPID_IMPORT/Code.gs`

Run: `npx tsx scripts/cutover/rapid-import-url-swap.ts`

### 2d. BigQuery Streaming Cloud Function — DONE

**Directory:** `services/bigquery-stream/` (NEW)

Files:
- `src/index.ts` — Two Cloud Functions: `streamToBI` (top-level docs) + `streamSubcollectionToBI` (nested docs)
- `package.json` — Firebase Functions v5, BigQuery SDK, Node 20
- `tsconfig.json` — Standalone TypeScript config
- `deploy.sh` — Creates BigQuery table + deploys both functions

**How it works:**
1. Triggers on ANY Firestore document write (create, update, delete)
2. Extracts: collection path, document ID, operation type, timestamp, changed fields
3. Inserts row into BigQuery `toMachina.firestore_changes` (day-partitioned)
4. Two functions cover top-level and subcollection documents
5. Failures logged but don't block Firestore writes (non-critical path)

**Schema:** `collection STRING, document_id STRING, operation STRING, timestamp TIMESTAMP, data_json STRING, changed_fields STRING`

---

## Files Changed

| File | Action | Notes |
|------|--------|-------|
| `services/api/src/routes/cam.ts` | NEW | 14 CAM API endpoints |
| `services/api/src/server.ts` | MODIFIED | Added cam route import + mount |
| `scripts/cutover/rapid-import-url-swap.ts` | NEW | URL swap diff generator |
| `services/bigquery-stream/src/index.ts` | NEW | Cloud Function for BQ streaming |
| `services/bigquery-stream/package.json` | NEW | Dependencies |
| `services/bigquery-stream/tsconfig.json` | NEW | TypeScript config |
| `services/bigquery-stream/deploy.sh` | NEW | Deployment script |
| `services/MCP-Hub/rpi-workspace-mcp/src/cloud-run-api.js` | NEW | MCP helper (outside worktree) |

## Files NOT Touched
- `apps/**` — no portal changes
- `packages/ui/**` — no UI changes
- `packages/core/**` — import only
- `gas/RAPID_IMPORT/Code.gs` — NOT modified (script generates diff only)
- `services/api/src/routes/comms.ts` — Builder 41
- `services/api/src/routes/flow.ts` — Builder 41
- `services/api/src/routes/templates.ts` — Builder 42
- `services/api/src/routes/content-blocks.ts` — Builder 42
- `services/api/src/routes/atlas.ts` — Builder 42
- `cloudbuild.yaml` — already correct, no changes needed

---

## Build Verification

```
@tomachina/core build ✓
@tomachina/api build ✓ (0 errors, includes new cam.ts)
@tomachina/ui build ✓
@tomachina/prodash build ✓
@tomachina/riimo build ✓
@tomachina/sentinel build ✓
@tomachina/db build ✓
@tomachina/auth build ✓
tomachina-bigquery-stream build ✓
@tomachina/bridge build ✓

Total: 10/10 successful, 0 failures
```

---

## Sprint 5 Prerequisites (documented, not applied)

1. Deploy Cloud Run API and verify health at `api.tomachina.com`
2. Verify OIDC auth accepts GAS identity tokens
3. Apply RAPID_IMPORT URL swap (use output from `scripts/cutover/rapid-import-url-swap.ts`)
4. Deploy BigQuery streaming function (run `services/bigquery-stream/deploy.sh`)
5. Import `callCloudRunAPI` in MCP workspace tools (add to index.js after testing)
6. Load comp grid data via POST `/api/cam/comp-grids` if `comp_grids` collection is empty

---

## Note on MCP File

The `cloud-run-api.js` file was written to the live MCP directory at `~/Projects/services/MCP-Hub/rpi-workspace-mcp/src/` (outside the worktree). It will NOT be in this branch's git diff. This is correct — MCP-Hub has its own repo. JDM should commit it there separately when ready to activate.
