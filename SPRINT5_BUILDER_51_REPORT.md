# Sprint 5 — Builder 51 Report: RAPID_IMPORT Approval Engine

**Branch:** `sprint5/approval-engine`
**Date:** 2026-03-11
**Status:** COMPLETE

---

## What Was Built

The RAPID_IMPORT approval pipeline (22K lines of GAS) rebuilt as clean TypeScript in `packages/core/src/approval/` + `services/api/src/routes/approval.ts`. This is the most critical intake system — every document that enters The Machine goes through this pipeline.

### Core Package: `packages/core/src/approval/`

| File | Lines | Purpose |
|------|-------|---------|
| `types.ts` | ~210 | All types, enums, constants. `ApprovalItem`, `ApprovalBatch`, `BatchSummary`, `ExecutionResult`, `TrainingRecord`, `ExtractedData`, `ExtractionContext`. Status lifecycle: `PENDING → APPROVED/EDITED/KILLED → EXECUTED/ERROR`. Tab-to-endpoint, tab-to-matrix, tab-to-collection mappings. Skip fields set. Acronym set for label generation. |
| `flatten.ts` | ~115 | **Stage 1: FLATTEN** — `flattenExtractedData()` transforms Claude Vision output into field-level approval items. Handles client, accounts (5 categories), producer, revenue. Skips auto-generated fields. `generateFieldLabel()` for human-readable labels with acronym support. |
| `batch.ts` | ~140 | **Stage 2: BATCH** — `createBatch()` generates full batch with items, summary, timestamps. `validateBatch()` ensures extractable data exists. `updateItemStatus()` for individual approve/edit/kill. `bulkUpdateItems()` for batch-level decisions. `buildSummary()` computes stats. |
| `routing.ts` | ~130 | **Reviewer routing** — `determineReviewer()` reads org collection for division leader + Slack channel. `determineDivision()` maps tab content to SALES/SERVICE/LEGACY. `groupItemsForExecution()` groups items by tab+entity_id with client-first ordering. `determineTargetCollection()` maps tabs to Firestore paths. |
| `execute.ts` | ~120 | **Stage 5: EXECUTE** — `buildExecutionPayload()` groups approved items into write operations. `applyExecutionResults()` marks items EXECUTED/ERROR. `determineBatchStatus()` computes final batch state. `extractTrainingData()` captures EDITED corrections for extraction improvement. `finalizeBatch()` ties it all together. |
| `index.ts` | ~10 | Barrel export |

### API Routes: `services/api/src/routes/approval.ts`

| Route | Method | Stage | Purpose |
|-------|--------|-------|---------|
| `/api/approval/batches` | POST | 2+3 | Create batch from extracted data. Flattens, batches, determines reviewer from org collection, persists to Firestore. Stores original values for training data. |
| `/api/approval/batches/:id/notify` | POST | 3 | Sends PHI-free Slack notification with Block Kit. Entity name + field counts + tab breakdown + "Review Now" link. Stores `slack_message_ts` for later deletion. |
| `/api/approval/batches/:id/items/:itemId` | PATCH | 4 | Update single item: APPROVED, EDITED (with corrected value), or KILLED. Tracks decided_by + decided_at. |
| `/api/approval/batches/:id/bulk` | PATCH | 4 | Bulk update all PENDING items (approve all / kill all with optional exclude list). |
| `/api/approval/batches/:id/execute` | POST | 5 | Execute approved items. Writes to Firestore (clients, accounts, agents, revenue). Client-first ordering. Account creates inject `account_type_category`. Captures training data from EDITED items. Deletes Slack notification. Logs activities. |
| `/api/approval/batches` | GET | Dashboard | List batches with filters (status, assigned_to, source_type). Paginated, strips items for list view. |
| `/api/approval/batches/:id` | GET | Dashboard | Full batch detail with all items. |
| `/api/approval/stats` | GET | Dashboard | Stats: pending, in_review, executed, partial, error, completed_today, avg_approval_minutes. |
| `/api/approval/training` | GET | Training | List training records for extraction improvement analysis. |

### Training Data Capture

When a user EDITS an approval item (corrects the extraction), the system captures:
- Original extracted value (stored at batch creation time in `_original_values`)
- User's corrected value
- Field name, confidence score, source type
- Stored in Firestore `approval_training` collection
- Accessible via `GET /api/approval/training` for analysis

---

## Architecture Decisions

1. **Pure functions in `packages/core`**: All business logic (flatten, batch, routing, execute payload building) is in pure functions with no Firestore dependency. API routes handle persistence. This makes the logic testable and reusable by Cloud Functions or CLI tools.

2. **Firestore-first, bridge-optional**: Writes go through `writeThroughBridge()` which attempts bridge (dual-write Firestore+Sheets) first, falls back to direct Firestore if bridge is unavailable. This is the transition pattern — when Sheets writes are fully killed, bridge calls simply no-op.

3. **Client-first execution ordering**: `groupItemsForExecution()` sorts CLIENT groups before ACCOUNT groups. Accounts need a `client_id` which may come from a just-created client in the same batch.

4. **Training data as a first-class concept**: Every EDITED item generates a training record. This creates a feedback loop: extraction improves over time as corrections accumulate. The `approval_training` collection is the seed for future fine-tuning or prompt engineering improvements.

5. **PHI-safe Slack notifications**: Only entity_name, field counts, and tab names in Slack messages. No SSN, DOB, email, phone, policy numbers. Matches the hook-enforced PHI rules from the GAS era.

---

## Verification Checkpoints

- [x] **CP1**: Approval types + flatten + batch pure functions compile (`tsc --noEmit` on core — clean)
- [x] **CP2**: Approval API routes compile (`tsc --noEmit` on api — clean)
- [x] **CP3**: Training data capture implemented (extractTrainingData + original values stored at batch creation)
- [x] **CP4**: Core package type-checks clean, API service type-checks clean

---

## Files Changed

### New Files (7)
| File | Purpose |
|------|---------|
| `packages/core/src/approval/types.ts` | All types, enums, constants |
| `packages/core/src/approval/flatten.ts` | Stage 1: FLATTEN |
| `packages/core/src/approval/batch.ts` | Stage 2: BATCH + Stage 4: APPROVE |
| `packages/core/src/approval/routing.ts` | Reviewer routing + execution grouping |
| `packages/core/src/approval/execute.ts` | Stage 5: EXECUTE |
| `packages/core/src/approval/index.ts` | Barrel export |
| `services/api/src/routes/approval.ts` | All API routes (9 endpoints) |

### Modified Files (2)
| File | Change |
|------|--------|
| `packages/core/src/index.ts` | Added `export * from './approval'` |
| `services/api/src/server.ts` | Added `approvalRoutes` import + mount at `/api/approval` |

### Files NOT Touched (per scope boundaries)
- `apps/**` — no portal changes
- `packages/ui/**` — no UI changes
- `gas/RAPID_IMPORT/**` — GAS source untouched
- `services/api/src/routes/comms.ts` — Sprint 4 (used, not modified)
- `services/api/src/routes/flow.ts` — Sprint 4

---

## What's Next (for other builders)

1. **Builder 52 (Intake Channels)**: Wire `watcher.js` to call `POST /api/approval/batches` instead of writing to `_APPROVAL_QUEUE` sheet. The API expects the same `ExtractedData` + `ExtractionContext` shape.

2. **Builder 53 (Infrastructure)**: Deploy API to Cloud Run with `SLACK_BOT_TOKEN` env var for notifications.

3. **Portal UI**: Build approval review page at `/approval?batch_id=xxx` in ProDashX (Sprint 6+). The API supports all CRUD needed — list, detail, item update, bulk update, execute.

4. **RAPID_IMPORT cutover**: Once API is deployed and portal UI exists, change `callRapidAPI_()` in RAPID_IMPORT to call Cloud Run instead of GAS Web App for the approval pipeline.
