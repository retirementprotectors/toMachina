# GAS Migration Audit — ZRD-D02

> Generated: 2026-04-05 | Track: MEGAZORD DEVOUR | Author: RONIN

---

## Summary

| Category | Count |
|----------|-------|
| Total GAS Functions Cataloged | 20 |
| MIGRATED (live in toMachina API) | 15 |
| PENDING SWAP (migrated but GAS callers not yet updated) | 5 |
| RETAINED (stays in GAS permanently) | 4 |
| ACTIVE GAS Engines Remaining | 3 |
| Archived GAS Engines (fully migrated) | 6 |

---

## GAS Engines — Current State

### RAPID_CORE (Library)

- **Status**: ACTIVE — Sheets adapter for remaining GAS consumers
- **Role**: Shared library imported by RAPID_IMPORT and DEX. Provides `TABLE_ROUTING`, `getMATRIX_ID()`, schema definitions, and all Sheets write primitives.
- **Migration Path**: Replaced by `packages/core/` for toMachina consumers. GAS consumers (RAPID_IMPORT, DEX) still require it until Sheets bridge is fully deprecated.
- **Key Functions**: `TABLE_ROUTING`, `getMATRIX_ID()`, `TAB_SCHEMAS`, all MATRIX write utilities
- **Decision**: ACTIVE until Sheets bridge fully deprecated. No migration ticket needed — it retires automatically when its consumers do.

---

### RAPID_IMPORT (Data Ingestion)

- **Status**: ACTIVE (partially migrated)
- **Migration Reference**: `services/api/src/scripts/rapid-import-swap.md` — full tracking document already exists in the codebase
- **Migrated Functions (15 — live on Cloud Run)**:

| GAS Function | Cloud Run Endpoint | Status |
|---|---|---|
| `importClientRecord` | `POST /api/import/client` | LIVE |
| `batchImportClients` | `POST /api/import/clients/batch` | LIVE |
| `importAccountRecord` | `POST /api/import/account` | LIVE |
| `importLifeAccount` | `POST /api/import/account` | LIVE |
| `importAnnuityAccount` | `POST /api/import/account` | LIVE |
| `importMedicareAccount` | `POST /api/import/account` | LIVE |
| `importInvestmentAccounts` | `POST /api/import/investment-accounts` | LIVE |
| `importRevenueRecord` | `POST /api/import/revenue` | LIVE |
| `batchImportRevenue` | `POST /api/import/revenue/batch` | LIVE |
| `importAgentRecord` | `POST /api/import/agent` | LIVE |
| `batchImportAgents` | `POST /api/import/agents/batch` | LIVE |
| `importCaseTask` | `POST /api/import/case-task` | LIVE |
| `processApproval` | `POST /api/import/approval` | LIVE |
| `getIntakeQueueStatus` | `GET /api/import/queue/status` | LIVE |
| `backfillClientDemos` | `POST /api/import/backfill-clients` | LIVE |

- **Pending URL Swap (5 — migrated endpoint exists, GAS callers not yet updated)**:

| GAS Function | File | Priority | Notes |
|---|---|---|---|
| `importSignalStatement` | `IMPORT_Signal.gs` | LOW | Signal → Gradient transition. Migrate only if Gradient needs same format. |
| `importDTCCFeed` | `IMPORT_DTCC.gs` | MEDIUM | Structured carrier feed. Straightforward migration. |
| `importDSTVisionFeed` | `IMPORT_DSTVision.gs` | MEDIUM | Investment account aggregator (DST Vision). |
| `processIntakeQueue` | `IMPORT_Intake.gs` | HIGH | Core intake processor — drives all inbound data. Migrate when intake Cloud Function is ready. |
| `enrichFromBoB` | `IMPORT_BoBEnrich.gs` | LOW | Book-of-business enrichment. Runs infrequently. |

- **Retained in GAS permanently (4)**:

| GAS Function | File | Reason |
|---|---|---|
| `IMPORT_GHL.*` | `IMPORT_GHL.gs` | GHL M&A intake. Uses GAS triggers + GHL webhooks. Retained for DAVID/SENTINEL acquisitions. |
| `IMPORT_Intake.*` (trigger) | `IMPORT_Intake.gs` | Time-based GAS trigger. Processing logic migrates; the trigger itself stays in GAS. |
| `IMPORT_BoBEnrich.*` | `IMPORT_BoBEnrich.gs` | Deep enrichment using GAS DriveApp for document scanning. |
| `IMPORT_DriveHygiene.*` | `IMPORT_DriveHygiene.gs` | Drive cleanup using GAS DriveApp APIs — no Cloud Run equivalent. |

---

### DEX (PDF/Drive Operations)

- **Status**: ACTIVE — last GAS holdout for Drive-native operations
- **Functions**: PDF generation, Drive file management, document processing, pipeline management
- **API Coverage**: `services/api/src/routes/dex.ts` and `dex-pipeline.ts` provide REST endpoints for DEX pipeline state and QUE output generation. Core Drive/PDF file operations still in GAS.
- **Migration Path**: `services/api/` + `packages/core/` when PDF_SERVICE is ready to absorb file operations
- **Decision**: ACTIVE until PDF operations fully ported to PDF_SERVICE. No timeline set.

---

## Archived Engines (Fully Migrated — Sprint 4-5)

| Engine | Migrated To | Sprint |
|---|---|---|
| RAPID_COMMS | `services/api/src/routes/comms.ts`, `communications.ts`, `comms-routing.ts` | Sprint 5 |
| RAPID_FLOW | `services/api/src/routes/flow.ts`, `flow-admin.ts` | Sprint 5 |
| RAPID_API | `services/api/` (general REST layer) | Sprint 5 |
| C3 | `services/api/src/routes/campaigns.ts`, `campaign-send.ts`, `campaign-analytics.ts`, `content-blocks.ts`, `templates.ts` | Sprint 5 |
| ATLAS | `services/api/src/routes/atlas.ts`, `wire.ts`, `rules.ts` | Sprint 5 |
| CAM | `services/api/src/routes/cam.ts` | Sprint 5 |

---

## toMachina API Route Coverage (84 routes)

Full list of live route files in `services/api/src/routes/`:

| Route File | Domain Coverage |
|---|---|
| `access.ts` | Portal/API access credentials per client |
| `accounts.ts` | Financial accounts (annuity, life, medicare, investment) |
| `acf.ts` | ACF (Active Client File) Drive folder management |
| `activities.ts` | Client activity log |
| `admin-learning-loop.ts` | Learning loop admin (exec access) |
| `admin-warriors.ts` | Warrior management (exec access) |
| `agents.ts` | Agent/producer records |
| `ai3.ts` | AI-3 household/template tooling |
| `analytics.ts` | Platform analytics |
| `approval.ts` | Approval workflow processing |
| `atlas.ts` | ATLAS registry — sources, tools, wires |
| `booking.ts` | Calendar booking |
| `cam.ts` | CAM (Campaign Asset Manager) |
| `campaign-analytics.ts` | Campaign send analytics |
| `campaign-send.ts` | Campaign delivery engine |
| `campaigns.ts` | Campaign CRUD + management |
| `carriers.ts` | Carrier registry |
| `case-tasks.ts` | Case task tracking |
| `ci.ts` | CI webhook receiver (GitHub workflow_run) |
| `clients.ts` | Client records (core entity) |
| `cmo-intake.ts` | CMO intake pipeline |
| `cmo-pipeline.ts` | CMO pipeline management |
| `cmo-wires.ts` | CMO wire definitions |
| `comms-routing.ts` | Communications routing engine |
| `comms.ts` | Communications (V2 feed) |
| `communications.ts` | Communications records |
| `compliance.ts` | Compliance tracking |
| `config.ts` | Config registry |
| `connect.ts` | RPI Connect channels + people |
| `content-blocks.ts` | Content block library |
| `dashboard.ts` | Dashboard data + instances |
| `dex-pipeline.ts` | DEX pipeline state management |
| `dex.ts` | DEX output generation (QUE deliverables) |
| `document-index.ts` | Client document index |
| `dropzone.ts` | File upload (Drive) |
| `firestore-config.ts` | Firestore config collection proxy |
| `flow-admin.ts` | Flow Engine admin CRUD |
| `flow.ts` | Flow Engine runtime |
| `guardian.ts` | Guardian data integrity system |
| `health.ts` | Health check + Firestore connectivity |
| `households.ts` | Household groupings |
| `import-accounts.ts` | Account import processor |
| `import-agents.ts` | Agent import processor |
| `import.ts` | Core import router (clients, accounts, revenue) |
| `intake-queue.ts` | Intake queue management |
| `intake.ts` | Intake channel processing |
| `leadership.ts` | Leadership data |
| `mdj.ts` | MDJ (MyDigitalJosh/VOLTRON) API |
| `medicare-quote.ts` | Medicare quoting (QUE engine) |
| `myst-ai.ts` | MYST AI character + content |
| `notifications.ts` | Notification delivery |
| `opportunities.ts` | Pipeline opportunities |
| `org.ts` | Org structure |
| `pipelines.ts` | Pipeline Studio |
| `producers.ts` | Producer records |
| `products.ts` | Product catalog |
| `prozone.ts` | ProZone territory + specialist config |
| `que.ts` | QUE session management |
| `queue.ts` | CEO Action Queue |
| `rangers.ts` | Rangers (MEGAZORD agents) |
| `revenue.ts` | Revenue records + commission processing |
| `rsp.ts` | RSP (Retirement Savings Plan) |
| `rules.ts` | Business rules engine |
| `search.ts` | Cross-entity search |
| `sensei-analytics.ts` | Sensei training analytics |
| `sensei-content.ts` | Sensei training content |
| `sensei-generator.ts` | Sensei training generation |
| `spark.ts` | Spark engine |
| `specialist-configs.ts` | VOLTRON specialist configurations |
| `sprints.ts` | Sprint tracking |
| `sync.ts` | Bridge sync |
| `templates.ts` | Template library |
| `territories.ts` | Territory management |
| `tracker.ts` | Issue/task tracker |
| `unit-defaults.ts` | Unit default settings |
| `users.ts` | User management |
| `validation.ts` | Data validation APIs |
| `voltron-cases.ts` | VOLTRON case management |
| `voltron-deploy.ts` | VOLTRON deploy orchestration |
| `voltron-gap-requests.ts` | VOLTRON gap request tracking |
| `voltron-registry.ts` | VOLTRON tool registry |
| `voltron-wire.ts` | VOLTRON wire definitions |
| `webhook-deploy.ts` | Webhook deploy receiver (HMAC-SHA256) |
| `webhooks.ts` | General webhooks |
| `wire.ts` | Wire definitions (ATLAS) |

---

## Remaining Migration Tickets (Recommended)

| Ticket | Function | Source File | Priority | Notes |
|--------|----------|-------------|----------|-------|
| ZRD-D04 | `processIntakeQueue` | `IMPORT_Intake.gs` | HIGH | Core intake processor — blocked on intake Cloud Function readiness |
| ZRD-D05 | `importDTCCFeed` | `IMPORT_DTCC.gs` | MEDIUM | Structured carrier feed migration |
| ZRD-D06 | `importDSTVisionFeed` | `IMPORT_DSTVision.gs` | MEDIUM | DST Vision investment aggregator migration |
| ZRD-D07 | `importSignalStatement` | `IMPORT_Signal.gs` | LOW | Signal → Gradient transition, only if Gradient requires same format |
| ZRD-D08 | `enrichFromBoB` | `IMPORT_BoBEnrich.gs` | LOW | BoB enrichment (infrequent, low urgency) |

---

## Notes

- `services/api/src/scripts/rapid-import-swap.md` is the authoritative GAS → Cloud Run migration map. It includes the URL swap pattern, auth pattern (`ScriptApp.getIdentityToken()`), and a per-function testing checklist.
- The 15 already-migrated functions are live but GAS callers may still be pointed at the old RAPID_API web app endpoint — the URL swap step (updating GAS source files + `clasp push`) must be completed per the checklist in `rapid-import-swap.md`.
- DEX's Drive/PDF operations have no direct Cloud Run analog yet — PDF_SERVICE (`services/PDF_SERVICE/`) is the intended destination.
