# toMachina Platform Roadmap

> The complete vision from migration through full feature buildout.
> Operating Model: 3-6 Builder Agents + 1 Planner/Auditor Agent
> Updated: 2026-03-11

---

## Status Overview

| Sprint | Name | Status | Key Deliverable |
|--------|------|--------|----------------|
| 1 | Data Integrity | **COMPLETE** | 26,889 docs cleaned, normalized, FK-validated |
| 2 | Shared Modules | **COMPLETE** | 8 shared components, 24 portal pages → 3-line imports |
| 3 | Portal Depth | **COMPLETE** | 18 features: CLIENT360, RMD, Beni, Medicare quoting, DAVID HUB calcs, rich dashboards |
| 4 | GAS Engine Migration | **IN PROGRESS** | COMMS + FLOW + C3 + ATLAS + CAM backends → toMachina |
| 5 | Infrastructure Cutover + RAPID_IMPORT | PLANNED | Cloud Run live, Sheets writes killed, RAPID_IMPORT ported |
| 6 | MyDropZone | PLANNED | Field agent capture → intelligence → routing (needs Cloud Run from Sprint 5) |
| 7 | DEX Modernization | PLANNED | PDF/Drive ops → Cloud Functions, form library in Firestore (unblocks Sprint 12 pipelines) |
| 8 | C3 Refresh | PLANNED | Full send orchestration, scheduling, A/B testing, analytics |
| 9 | CAM Modernization | PLANNED | Full commission management: grid editing, reconciliation, agent onboarding |
| 10 | ATLAS Refresh | PLANNED | Full source intelligence: wire diagrams, automation scoring, health monitoring |
| 11 | Command Center Refresh | PLANNED | Full leadership dashboard: cross-platform KPIs, team performance, alerts |
| 12 | Pipeline Factory (QUE/NBX/Ops/Deal) | PLANNED | Revenue workflows built on PROVEN foundation (DEX + C3 + CAM + ATLAS + CC all online) |
| 13 | DAVID M&A Platform | PLANNED | Acquisition tooling, Operating System distribution, book migration |

---

## Architecture Layers

```
┌─────────────────────────────────────────────────────────────────────┐
│                        USER LAYER (Browser)                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │
│  │  ProDashX    │  │    RIIMO     │  │   SENTINEL   │             │
│  │  (B2C)       │  │    (B2E)     │  │    (B2B)     │             │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘             │
│         │    Shared Modules (packages/ui/modules/)    │             │
│         │  CAM│C3│DEX│ATLAS│CC│MyRPI│Connect│Admin    │             │
│         │    Portal-Specific Modules                  │             │
│         │  QUE│NBX│DAVID-HUB│RMD│Beni│Discovery│etc   │             │
└─────────┼────────────────────────────────────────────┼─────────────┘
          │                                            │
┌─────────┼────────────────────────────────────────────┼─────────────┐
│         │           LOGIC LAYER (packages/)           │             │
│  ┌──────┴──────┐  ┌──────────┐  ┌────────┐  ┌──────┴──────┐      │
│  │ core/       │  │ auth/    │  │ db/    │  │ ui/         │      │
│  │ financial/  │  │ entitle- │  │ Fire-  │  │ components/ │      │
│  │ matching/   │  │ ments    │  │ store  │  │ modules/    │      │
│  │ normalizers/│  │ Firebase │  │ hooks  │  │             │      │
│  │ flow/       │  │ Auth     │  │        │  │             │      │
│  │ compliance/ │  │          │  │        │  │             │      │
│  │ users/      │  │          │  │        │  │             │      │
│  └─────────────┘  └──────────┘  └────────┘  └─────────────┘      │
└───────────────────────────────────────────────────────────────────┘
          │
┌─────────┼─────────────────────────────────────────────────────────┐
│         │            SERVICE LAYER (Cloud Run)                     │
│  ┌──────┴──────┐  ┌──────────┐  ┌────────────────┐               │
│  │ services/   │  │ services/│  │ bigquery-      │               │
│  │ api/        │  │ bridge/  │  │ stream/        │               │
│  │ (45+ routes)│  │ (Firestore│  │ (Cloud Func)  │               │
│  │             │  │  ↔ Sheets)│  │                │               │
│  └─────────────┘  └──────────┘  └────────────────┘               │
└───────────────────────────────────────────────────────────────────┘
          │
┌─────────┼─────────────────────────────────────────────────────────┐
│         │            DATA LAYER                                    │
│  ┌──────┴──────┐  ┌──────────┐  ┌────────────────┐               │
│  │ Firestore   │  │ BigQuery │  │ Google Sheets  │               │
│  │ (PRIMARY)   │  │(Analytics)│  │ (LEGACY →      │               │
│  │ 29K+ docs   │  │          │  │  read-only →   │               │
│  │             │  │          │  │  decommission) │               │
│  └─────────────┘  └──────────┘  └────────────────┘               │
└───────────────────────────────────────────────────────────────────┘
          │
┌─────────┼─────────────────────────────────────────────────────────┐
│         │            GAS LAYER (Maintenance → Archive)             │
│  ┌──────┴──────┐  ┌──────────┐                                    │
│  │ RAPID_      │  │ DEX      │  ← Only 2 that STAY long-term     │
│  │ IMPORT      │  │ (PDF/    │    (until Cloud Functions replace) │
│  │ (if not     │  │  Drive)  │                                    │
│  │  ported)    │  │          │                                    │
│  └─────────────┘  └──────────┘                                    │
└───────────────────────────────────────────────────────────────────┘
```

---

## Sprint 4: GAS Engine Migration (IN PROGRESS)

**Builders:** 41, 42, 43

| Builder | Scope | Delivers |
|---------|-------|----------|
| 41 | RAPID_COMMS → API routes + RAPID_FLOW → packages/core/flow/ | Comms send endpoints, workflow engine, flow API routes |
| 42 | C3 backend expansion + ATLAS full backend + tool registry migration | Campaign assembly, template/block CRUD, source/tool CRUD, Slack digest |
| 43 | CAM API routes + Cloud Run deploy configs + MCP helper + BigQuery Cloud Function + RAPID_IMPORT cutover script | Revenue analytics, comp grids, infra prep |

**After Sprint 4:** GAS engines RAPID_COMMS, RAPID_FLOW, C3, ATLAS, RAPID_API fully replaced in code. CAM partially replaced. Infrastructure scripts ready for Sprint 5 deployment.

---

## Sprint 5: Infrastructure Cutover + RAPID_IMPORT

**Goal:** Flip the switches. Deploy everything to production. Port RAPID_IMPORT. Kill Sheets writes. Archive dead GAS engines.

### Builder 51: RAPID_IMPORT — Approval Engine

**The big one.** IMPORT_Approval.gs (22K lines) is the approval pipeline that constantly breaks.

Scope:
- Read `gas/RAPID_IMPORT/IMPORT_Approval.gs` thoroughly
- Rebuild as `services/api/src/routes/approval.ts` + `packages/core/flow/approval-pipeline.ts`
- Key workflows: batch creation, field-level approval (Push/Edit/Kill), execution, training data
- Reads/writes Firestore (NOT Sheets)
- Slack notifications for approval requests (uses MCP Slack or direct Slack API)
- The approval UI already exists in toMachina (Sprint 2 built it via shared modules, Sprint 3 wired portal pages)

Files: `services/api/src/routes/approval.ts`, `packages/core/flow/approval-pipeline.ts`

### Builder 52: RAPID_IMPORT — Intake Channels + Import Functions

Port the 4 intake channels from GAS triggers to Cloud Functions:

| Channel | GAS Source | Cloud Function |
|---------|-----------|---------------|
| SPC_INTAKE | Drive folder polling | `onFileCreated` trigger on SPC folder |
| MEET_TRANSCRIPT | Meet recording polling | `onFileCreated` trigger on Meet recordings folder |
| MAIL | Gmail inbox scanning → Drive | Cloud Scheduler (5-min) → Cloud Function |
| EMAIL | Gmail inbox scanning | Cloud Scheduler (5-min) → Cloud Function |

Also port:
- `IMPORT_Client.gs` (2.3K) → `services/api/src/routes/import.ts` (expand existing)
- `IMPORT_Account.gs` (1.2K) → same
- `IMPORT_Agent.gs` (518) → same
- `IMPORT_Revenue.gs` (787) → same
- `IMPORT_CaseTasks.gs` (1.6K) → same

Files: `services/intake/` (NEW Cloud Functions directory), expand `services/api/src/routes/import.ts`

### Builder 53: Production Deployment + Archival

Execute all the cutover scripts Sprint 4 prepared:
1. Deploy `services/api/` to Cloud Run → `tm-api` at `api.tomachina.com`
2. Deploy `services/bridge/` to Cloud Run → `tm-bridge` (internal)
3. Deploy BigQuery streaming Cloud Function
4. Activate MCP `callCloudRunAPI()` — restart MCP servers
5. Disable bridge Sheets writes (Firestore becomes sole source of truth)
6. Archive GAS engines: RAPID_COMMS, RAPID_FLOW, C3, ATLAS, CAM, RAPID_API → `archive/`
7. Kill RAPID_CORE (or leave as thin DEX adapter)
8. Update CLAUDE.md, MEMORY.md, hookify, maintenance scripts
9. Run compliance sweep — verify 0 violations
10. Final OS health check

Files: Infrastructure configs, `gas/` → `archive/` moves, docs

### Sprint 5 Verification
- [ ] `api.tomachina.com` returns 200
- [ ] Bridge on Cloud Run (or disabled if Sheets writes killed)
- [ ] BigQuery receives Firestore changes in real-time
- [ ] RAPID_IMPORT approval pipeline works via Cloud Functions (not GAS triggers)
- [ ] All 4 intake channels fire via Cloud Functions/Scheduler
- [ ] MCP tools call Cloud Run (not GAS)
- [ ] Sheets are read-only (no more writes from any system)
- [ ] Only DEX remains in `gas/` (everything else archived)
- [ ] Compliance sweep: 0 violations

---

## Sprint 6: Pipeline Factory (QUE / NBX / Service Pipelines)

**Goal:** Build the specific business pipelines on top of the flow engine. These are the revenue-generating workflows.

### The Pipeline Catalog

**Sales Pipelines (QUE) — ProDashX:**

| Pipeline | Stages | Key Integration |
|----------|--------|----------------|
| QUE-Medicare | Inquiry → Quote → Compare → Recommend → Apply → Confirm | CSG API for quotes (Sprint 3 built the quoting UI) |
| QUE-Life | Inquiry → Needs Analysis → Quote → Underwriting → Issue | Future carrier API integration |
| QUE-Annuity | Inquiry → Suitability → Quote → Compare → Apply → Fund | Future carrier API integration |
| QUE-Advisory | Inquiry → Discovery → Proposal → Agreement → Transfer → Manage | Schwab/RBC integration (future) |

**New Business Pipelines (NBX) — ProDashX:**

| Pipeline | Stages | Key Gate |
|----------|--------|---------|
| NBX-Medicare | App Submitted → Carrier Review → Approved → Enrolled → Active | Carrier confirmation webhook |
| NBX-Life | App Submitted → Underwriting → Medical Review → Issued → Delivered | Underwriting decision |
| NBX-Annuity | App Submitted → Suitability Review → Funded → Contract Issued → Active | Funding confirmation |
| NBX-BDRIA | Account App → Compliance Review → Account Opened → Assets Transferred → Active | Custodian confirmation |

**Operations Pipelines — RIIMO:**

| Pipeline | Stages | Purpose |
|----------|--------|---------|
| Employee Onboarding | Hired → Paperwork → Training → Licensing → Production | New hire workflow |
| Employee Offboarding | Notice → Access Revoke → Client Reassign → Final Pay → Archived | Separation workflow |
| Compliance Review | Triggered → Evidence Gathering → Review → Findings → Resolution | Regulatory compliance |
| Client Setup | Intake → Data Entry → Account Link → Welcome Kit → Active | New client activation |
| Data Maintenance | Identified → Queued → Processing → Verified → Complete | Data quality pipeline |

**Deal Pipelines — SENTINEL:**

| Pipeline | Stages | Purpose |
|----------|--------|---------|
| M&A Deal | Discovery → Qualification → Due Diligence → Negotiation → Close → Integration | Acquisition workflow |
| Producer Onboarding | Interest → Vetting → Contracting → Training → Production | New producer |
| Partnership | Inquiry → Evaluation → Terms → Agreement → Launch | Strategic partnership |

### Builder Assignments (Sprint 6)

**Builder 61:** QUE pipelines (Medicare, Life, Annuity, Advisory) — define pipeline configs in Firestore, build stage-specific business logic, create ProDashX module pages

**Builder 62:** NBX pipelines (Medicare, Life, Annuity, BDRIA) — define pipeline configs, build carrier integration stubs, create ProDashX module pages

**Builder 63:** Operations + Deal pipelines (RIIMO: 5 pipelines, SENTINEL: 3 pipelines) — define pipeline configs, build stage logic, enhance existing Pipeline pages

### Sprint 6 Verification
- [ ] All pipeline definitions in Firestore `flow/config/pipelines`
- [ ] Each pipeline has correct stages, gates, hooks
- [ ] QUE-Medicare end-to-end: inquiry → quote (CSG API) → compare → recommend → apply
- [ ] NBX pipelines create proper records in Firestore on completion
- [ ] RIIMO pipeline pages show all operations pipelines
- [ ] SENTINEL deal pipeline has full M&A workflow
- [ ] Flow engine handles all pipeline types without modification

---

## Sprint 7: DEX Modernization

**Goal:** Migrate DEX's PDF/Drive operations from GAS to Cloud Functions. This is the last GAS holdout.

### What DEX Does
- PDF form filling (map client data to PDF fields → generate filled PDF)
- Document kit assembly (combine multiple forms into a package)
- Google Drive filing (create folders, move files, organize by client/carrier)
- DocuSign integration (send for signature, track status)
- Form library management (CRUD for form definitions, field mappings)

### Migration Path

| DEX Feature | GAS Dependency | Cloud Replacement |
|-------------|---------------|-------------------|
| PDF filling | Blob handling via GAS | `PDF_SERVICE` Cloud Run (already exists!) |
| Drive filing | DriveApp | Drive API via Cloud Function |
| DocuSign | UrlFetchApp | DocuSign Node.js SDK |
| Form library | Sheets tabs | Firestore collections |
| Kit assembly | In-memory blob concatenation | Cloud Function with PDF_SERVICE |

### Builder Assignments (Sprint 7)

**Builder 71:** Migrate form library + field mappings to Firestore. Build API routes for form CRUD. Update DexDocCenter shared module to read from Firestore instead of proxy data.

**Builder 72:** Build Cloud Functions for Drive filing + kit assembly. Wire to PDF_SERVICE for PDF generation. Create `services/dex/` Cloud Function directory.

**Builder 73:** DocuSign integration as API routes. Document tracking in Firestore. Status webhooks. Update DEX pipeline visualization with real data.

### After Sprint 7
- `gas/DEX/` → `archive/DEX/`
- `gas/` directory is EMPTY
- Google Sheets writes are COMPLETELY eliminated
- Bridge service can be decommissioned
- GAS is fully archived across the entire platform

---

## Sprint 8: Campaign Engine (C3 Full Rebuild)

**Goal:** Full campaign send orchestration with scheduling, audience targeting, A/B testing, and analytics.

Sprint 4 builds the backend (campaign assembly, template/block CRUD). Sprint 8 adds:
- Send scheduling (Cloud Scheduler → API route → comms routes)
- Audience segmentation (filter clients by status, product type, geography, etc.)
- A/B testing (variant templates, split targeting)
- Campaign analytics (open rates, click rates, delivery status — from SendGrid/Twilio webhooks)
- AEP Blackout enforcement (Oct-Dec: no Medicare marketing campaigns)
- Drip sequences (multi-touch campaigns: Day 1 email, Day 3 SMS, Day 7 call)

### Builder Assignments (Sprint 8)

**Builder 81:** Send orchestration + scheduling engine
**Builder 82:** Audience segmentation + A/B testing
**Builder 83:** Analytics dashboard + drip sequence builder

---

## Sprint 9: MyDropZone

**Goal:** Build the field agent's single entry point into MACHINA.

Currently a placeholder in the MyRPI shared module. Full build:

| Component | What It Does |
|-----------|-------------|
| Recording capture | Agent hits "Record" → captures audio via browser MediaRecorder API |
| Document capture | Agent snaps photos of documents → uploads to Drive intake folder |
| Intelligence processing | Cloud Function triggers on upload → Claude Vision analysis → structured data extraction |
| Routing | Extracted data → approval pipeline (Sprint 5) → correct MATRIX/Firestore destination |
| Status tracking | Agent sees: "3 items processing, 1 approved, 2 pending review" |

This is the "agent meets client at kitchen table, hits Record, snaps docs, leaves — MACHINA handles the rest" vision.

### Builder Assignments (Sprint 9)

**Builder 91:** Browser capture UI (audio + camera) + upload to Drive
**Builder 92:** Cloud Function intelligence pipeline (Claude Vision analysis, structured extraction)
**Builder 93:** Routing engine (extracted data → approval pipeline → Firestore) + status tracking UI

---

## Sprint 10: DAVID M&A Platform

**Goal:** Weaponize the platform for acquisitions. When RPI acquires an agency, hand them MACHINA.

| Component | What It Does |
|-----------|-------------|
| Acquisition Toolkit | SENTINEL module: due diligence checklist, book valuation (DAVID HUB calcs already built), data room |
| Operating System Distribution | Package hookify rules + compliance checks + deploy workflows as installable skill packs |
| Producer Onboarding Pipeline | Automated onboarding for acquired producers (contracting, training, production tracking) |
| Book Migration | Bulk data import from acquired agency's systems → Firestore (RAPID_IMPORT's successor) |
| Client Notification | C3 campaign: welcome sequence to acquired clients ("We're Your People™") |

### Builder Assignments (Sprint 10)

**Builder 101:** Acquisition toolkit SENTINEL module + data room
**Builder 102:** Operating System skill packs + producer onboarding pipeline
**Builder 103:** Book migration engine + client welcome campaign

---

## The Long View

| Phase | Sprints | Focus | Outcome |
|-------|---------|-------|---------|
| **Foundation** | 1-3 | Data + UI + portals | COMPLETE — platform live, 3 portals, 51 pages, 29K docs |
| **Migration** | 4-5 | GAS engines + infrastructure | Platform fully modern, Cloud Run live, RAPID_IMPORT ported |
| **Field Ops** | 6-7 | MyDropZone + DEX modernization | Field agents capture at kitchen table, PDF/Drive on Cloud Functions, GAS = ZERO |
| **Core Systems** | 8-11 | C3 + CAM + ATLAS + Command Center refreshes | Every shared module is production-grade with full feature depth |
| **Revenue Engine** | 12 | QUE/NBX/Ops/Deal pipelines | Revenue-generating workflows built on PROVEN foundation |
| **Scale** | 13 | DAVID M&A platform | Acquisition machine, Operating System distribution |

---

## Operating Model

Every sprint follows the same pattern:

```
JDM defines priority
    ↓
Planner/Auditor writes builder prompts (3-6 builders)
    ↓
Builders execute in parallel (worktree isolation)
    ↓
Planner/Auditor reviews reports + conflict analysis
    ↓
Merge coordinator integrates (Sprint 2 before Sprint 3, etc.)
    ↓
Auto-deploy to production
    ↓
Next sprint
```

**Proven throughput:** 6 builders shipped Sprints 2+3 (8 shared modules + 18 portal features + CSG API + 4 financial calculators) in one overnight session. ~9,000 lines, zero broken builds.

**Total platform at completion:** ~60,000+ lines of TypeScript, 3 portals, 50+ API endpoints, 8 shared modules, 20+ pipeline definitions, real-time Firestore, auto-deploy, zero GAS dependency.

---

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-03-10 | Name: toMachina | "to" (Greek "the") + "Machina" (Latin "machine") |
| 2026-03-10 | Display name: ProDashX | Legacy brand continuity |
| 2026-03-10 | Firebase App Hosting (not Firebase Hosting) | Auto-deploy from GitHub, no Cloud Build for portals |
| 2026-03-11 | Option A: Keep normalizers in GAS (frozen copy) | Zero risk during transition |
| 2026-03-11 | 3 builders = sweet spot, 6 for parallel sprints | Proven across 22 builder sessions |
| 2026-03-11 | Planner + Auditor = same agent | Author of plan is best judge of adherence |
| 2026-03-11 | RAPID_IMPORT WILL be ported (Sprint 5) | Constant breakage justifies the effort |
| 2026-03-11 | Sheets writes will be eliminated | No dual-write after Sprint 5 |
| 2026-03-11 | DEX stays GAS until Sprint 7 | DriveApp/Blob dependencies need Cloud Function replacements |
| 2026-03-11 | Skills packaging deferred | Skills lack enforcement — hookify system has teeth, skills don't |

---

*#RunningOurOwnRACE — Execute at the Speed You've Always Thought At*
