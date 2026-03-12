# Sprint 7 — Builder 72 Report: DEX PDF Generation + DocuSign + Pipeline

## Status: COMPLETE

## Branch: `sprint7/dex-pdf-docusign-pipeline`

## What Was Built

### Part 1: New Route File (`services/api/src/routes/dex-pipeline.ts`)
Created a complete DEX pipeline API with 7 endpoints:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/dex-pipeline/packages` | POST | Create package from kit (DRAFT) |
| `/api/dex-pipeline/packages` | GET | List packages (filter by status, client_id) |
| `/api/dex-pipeline/packages/summary` | GET | Pipeline counts by status (for viz) |
| `/api/dex-pipeline/packages/:id` | GET | Package detail + event timeline |
| `/api/dex-pipeline/packages/:id/status` | PATCH | Manual status update |
| `/api/dex-pipeline/packages/:id/generate-pdf` | POST | Resolve fields, call PDF_SERVICE /fill-and-merge, store result |
| `/api/dex-pipeline/packages/:id/send-docusign` | POST | JWT auth via PDF_SERVICE, create DocuSign envelope |

**PDF Generation flow:**
1. Reads kit forms + field mappings from Firestore
2. Resolves client data using existing `resolveDataSource` pattern from dex.ts
3. Calls PDF_SERVICE `/fill-and-merge` with `{ forms, flatten: true }`
4. Stores filled PDF in subcollection (`artifacts/filled_pdf`) to avoid bloating package doc
5. Updates package status to READY

**DocuSign flow:**
1. Reads DocuSign config from env vars (no hardcoded credentials)
2. Gets JWT access token via PDF_SERVICE `/docusign/token`
3. Creates envelope at DocuSign REST API v2.1 with filled PDF
4. Supports EMAIL, SMS, and BOTH delivery methods (mirrors DEX_DocuSign.gs)
5. Stores envelope_id, updates status to SENT

**New Firestore Collections:**
- `dex_packages` — full lifecycle tracking with 21 fields
- `dex_package_events` — audit trail (event_id, package_id, from_status, to_status, source, metadata, timestamp)

### Part 2: DocuSign Webhook (`services/api/src/routes/webhooks.ts`)
Added `POST /api/webhooks/docusign` handler:
- Handles both JSON and XML payloads defensively
- Supports DocuSign Connect v1 and v2 event formats
- Maps statuses: sent/delivered -> SENT, signed -> SIGNED, completed -> COMPLETE, voided -> VOIDED, declined -> DECLINED
- Updates `dex_packages` doc with status + timestamps
- Logs to `dex_package_events` audit trail
- Always returns 200 to DocuSign (prevents retry storms)

### Part 3: Server Mount (`services/api/src/server.ts`)
Two lines added:
- Import: `import { dexPipelineRoutes } from './routes/dex-pipeline.js'`
- Mount: `app.use('/api/dex-pipeline', normalizeBody, dexPipelineRoutes)`

### Part 4: UI Updates (`packages/ui/src/modules/DexDocCenter.tsx`)

**Pipeline tab** — Rewritten from 3-stage kit-based view to 6-stage package pipeline:
- DRAFT -> READY -> SENT -> SIGNED -> SUBMITTED -> COMPLETE
- Real counts from `dex_packages` collection
- Voided/declined indicator

**Kit Builder step 5** — Added PDF generation + DocuSign send:
- Delivery method selector (EMAIL / SMS / BOTH)
- "Generate PDF" button -> creates package -> calls `/generate-pdf`
- Progress spinner during generation
- "Send for Signature" button -> calls `/send-docusign`
- Success confirmation with envelope ID
- Error display for failures at each step

**Tracker tab** — Rewritten from kit-based to package-based:
- Reads from `dex_packages` collection
- Status filter dropdown (All + 9 statuses)
- Click-to-select detail panel
- Full status timeline (created, sent, viewed, signed, submitted, completed)
- DocuSign envelope ID display

**NOT touched:** Form Library tab (Builder 71 owns it)

## Files Changed

| File | Action | Lines |
|------|--------|-------|
| `services/api/src/routes/dex-pipeline.ts` | CREATED | ~400 |
| `services/api/src/routes/webhooks.ts` | MODIFIED | +100 (DocuSign webhook) |
| `services/api/src/server.ts` | MODIFIED | +2 lines |
| `packages/ui/src/modules/DexDocCenter.tsx` | MODIFIED | Full rewrite of Pipeline, Kit Builder step 5, Tracker |

## TypeScript Verification
- `services/api`: 0 errors
- `packages/ui`: 0 errors

## Environment Variables Required
For DocuSign integration, the API service needs:
- `PDF_SERVICE_URL` — URL to the PDF_SERVICE Cloud Run instance
- `DOCUSIGN_INTEGRATION_KEY` — DocuSign app integration key
- `DOCUSIGN_USER_ID` — DocuSign user ID for JWT
- `DOCUSIGN_ACCOUNT_ID` — DocuSign account ID
- `DOCUSIGN_BASE_URI` — `https://demo.docusign.net` (demo) or production URI
- `DOCUSIGN_PRIVATE_KEY` — RSA private key (PEM format)

## Architecture Decisions
1. **PDF stored in subcollection** — `dex_packages/{id}/artifacts/filled_pdf` keeps the base64 out of the main document to avoid Firestore 1MB doc limit issues
2. **Webhook always returns 200** — DocuSign retries on non-200, which can cause duplicate processing storms
3. **XML support in webhook** — DocuSign Connect may send XML depending on configuration; defensive parsing prevents breakage
4. **FIRM_DATA duplicated** — Same constant as in dex.ts; kept in sync manually since Builder 71 owns that file
