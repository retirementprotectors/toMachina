# toMachina Platform Roadmap

> The complete vision from migration through full feature buildout.
> Operating Model: 3-6 Builder Agents + 1 Planner/Auditor Agent
> Updated: 2026-04-06

---

## Status Overview

### Completed Sprints (1-9)

| Sprint | Name | Key Deliverable |
|--------|------|----------------|
| 1 | Data Integrity | 26,889 docs cleaned, normalized, FK-validated |
| 2 | Shared Modules | 8 shared components, 24 portal pages as 3-line imports |
| 3 | Portal Depth | 18 features: CLIENT360, RMD, Beni, Medicare quoting, DAVID HUB calcs |
| 4 | GAS Engine Migration | COMMS + FLOW + C3 + ATLAS + CAM backends replaced by toMachina API |
| 5 | Infrastructure Cutover | Cloud Run live (tm-api + tm-bridge), approval engine, intake Cloud Functions, 6 GAS engines archived |
| 6 | UI Extravaganza | 6 parallel builders, 34 API routes, 9 shared UI modules, full visual overhaul |
| 7a | Pipeline Factory | 13 pipelines, Kanban UI, seed script, dynamic sidebar modules |
| 7b | Pipeline Studio | Full-screen pipeline builder app (teal brand), admin CRUD API, ~16,000 lines |
| 8 | Design Polish | COMMS Center, Access Center, DeDup Overhaul, Document Buttons, 47-item punch list |
| 8p | Sprint 8 Polish | Grid polish, Client360 tab restructure, shared component cleanup (3 builders) |
| 9 | Bug Fixes + Mockups | 23 bug fixes, Communications Module mockup, RPI Connect mockup, CI fix (13/13) |

### What Shipped (2026-03-11 through 2026-03-19)

- **~80,000+ lines** across Sprints 1-9
- **3 portals live**: prodash.tomachina.com, riimo.tomachina.com, sentinel.tomachina.com
- **CI green** — 13/13 type-check, Firebase App Hosting auto-deploying from main
- **30+ builder sessions**, 9.9/10 execution rate
- **Communications Module** slide-out mockup (feed + compose + dialer + inbound call card)
- **RPI Connect** slide-out redesign (Channels + People with presence + Meet)
- **Pipeline Studio** full builder app + 13 pipeline configs seeded
- **Chrome tab titles** — 76 pages across 3 portals with dynamic PORTAL | Feature naming
- **Dynamic detail titles** — Contact/Account pages show real names via server-side API fetch
- **Nickname scrub** — Vinnie/Matty/Behner cleaned across entire ecosystem (4-layer audit)
- **BD/RIA → Investments migration** — Firestore, GAS, worktrees, Sheet tab all migrated
- **NBX_SECURITIES → NBX_INVESTMENTS** — 318 Firestore docs + code migrated
- **Householding** — branch wave1/householding built, awaiting merge (T1)
- **ATLAS Wire** — branch wave1/atlas-wire built, awaiting merge (T2)

---

### Pending Merges

| Branch | Worktree | What | Status |
|--------|----------|------|--------|
| wave1/householding | T1 | Household as primary unit of work — new collection, API, migration, UI | Built, needs audit + merge |
| wave1/atlas-wire | T2 | ATLAS wire definitions wired to live data | Built, needs audit + merge |

---

## What's Next

### Sprint 10: Communications Wiring + Production Polish

**Priority: A — Nikki is testing NOW. Mock data is blocking real usage.**

**Goal:** Wire Communications Module + RPI Connect to real APIs. Fix the slide-out UX problem. Make what's built actually work.

| Deliverable | What | Integration |
|-------------|------|-------------|
| Comms "To:" search | Search real Firestore clients, not mock data | Firestore `clients` collection |
| Comms "View Client" link | Navigate to real Contact Detail page | Route to `/contacts/{id}` |
| SMS send | Send real texts from Comms compose | Twilio toll-free +18886208587 |
| Call dialer | Initiate real outbound calls | Twilio |
| Inbound call card | Show real inbound calls | Twilio webhooks |
| Email send | Send real emails from compose | Gmail API via rpi-comms MCP |
| Activity feed | Show real communication history per client | Firestore `communications` collection |
| Text from Contact Detail | Add SMS/call action buttons on CLIENT360 | Wire to Comms module |
| RPI Connect channels | Wire to real Google Chat spaces | Google Chat API |
| RPI Connect presence | Show real online/offline status | Firebase Realtime Database or Firestore |
| Slide-out UX | Solve the 400-460px panel eating screen real estate | Sidebar collapse or layout rethink |
| Shared API Response DTOs | Create `packages/core/src/api-types/` with typed response interfaces for all 54 API route files. Both API handlers and frontend consumers import the same type. TypeScript catches contract mismatches at build time. Prevents the ForgeAudit audit-round bug class entirely. | `packages/core` + `services/api` + all portal apps |

**Nikki's specific feedback (acceptance criteria):**
- Shane (with phone number) must appear in Comms "To:" search
- "View Client" button on communications must navigate to the real contact
- Test communications must appear in the client's Activity tab
- Contacts with communications must be searchable in Contacts page

---

### Sprint 11: DEX Modernization

**Priority: B — Last GAS holdout. Blocks full Sheets decommission.**

**Goal:** Migrate DEX's PDF/Drive operations from GAS to Cloud Functions.

| DEX Feature | GAS Dependency | Cloud Replacement |
|-------------|---------------|-------------------|
| PDF filling | Blob handling via GAS | `PDF_SERVICE` Cloud Run (already exists) |
| Drive filing | DriveApp | Drive API via Cloud Function |
| DocuSign | UrlFetchApp | DocuSign Node.js SDK |
| Form library | Sheets tabs | Firestore collections |
| Kit assembly | In-memory blob concatenation | Cloud Function with PDF_SERVICE |

**After Sprint 11:**
- `gas/DEX/` → `archive/DEX/`
- `gas/` directory is EMPTY
- Bridge service can be decommissioned
- GAS is fully archived across the entire platform

---

### Sprint 12: ProZone — Prospecting Hub

**Priority: B — Vince needs territory management for sales.**

**Goal:** Build the prospecting engine as a standalone App.

| Component | What |
|-----------|------|
| Territory Builder | Define geographic zones, assign to specialists |
| Specialist Config | 3 specialists (Arch, Shane, Matt) with zone assignments |
| Prospect Aggregation | Zone-based prospect lists from multiple data sources |
| Call Queue | Vince selects specialist → hammers calls → books appointments |
| Admin Config | Google Sheets per specialist (configurable via RIIMO) |

**Appears in:** ProDashX + potentially SENTINEL

---

### Sprint 13: Campaign Engine (C3 Full Rebuild)

**Priority: B — Revenue acceleration.**

**Goal:** Full campaign send orchestration.

- Send scheduling (Cloud Scheduler → API route → comms routes)
- Audience segmentation (filter clients by status, product type, geography)
- A/B testing (variant templates, split targeting)
- Campaign analytics (open rates, click rates, delivery status)
- AEP Blackout enforcement (Oct-Dec: no Medicare marketing)
- Drip sequences (multi-touch: Day 1 email, Day 3 SMS, Day 7 call)

---

### Sprint 14: MyDropZone — Field Agent Capture

**Priority: C — The kitchen table vision.**

**Goal:** Build the field agent's single entry point into The Machine.

| Component | What It Does |
|-----------|-------------|
| Recording capture | Agent hits "Record" → captures audio via browser MediaRecorder API |
| Document capture | Agent snaps photos of documents → uploads to Drive intake folder |
| Intelligence processing | Cloud Function → Claude Vision analysis → structured data extraction |
| Routing | Extracted data → approval pipeline → correct Firestore destination |
| Status tracking | "3 items processing, 1 approved, 2 pending review" |

---

### Sprint 15: DAVID M&A Platform

**Priority: C — Scale play. Requires Sprints 10-14 foundation.**

**Goal:** Weaponize the platform for acquisitions. Acquire an agency → hand them The Machine.

| Component | What It Does |
|-----------|-------------|
| Acquisition Toolkit | SENTINEL module: due diligence checklist, book valuation (DAVID HUB calcs built), data room |
| Operating System Distribution | Package hookify rules + compliance as installable skill packs |
| Producer Onboarding Pipeline | Automated onboarding for acquired producers |
| Book Migration | Bulk import from acquired agency's systems → Firestore |
| Client Notification | C3 campaign: welcome sequence to acquired clients ("We're Your People") |

---

## Architecture Layers

```
USER LAYER (Browser)
  ProDashX (B2C) | RIIMO (B2E) | SENTINEL (B2B)
    Shared Modules: CAM | C3 | DEX | ATLAS | CC | MyRPI | Comms | Connect | Admin | FORGE
    Portal-Specific: QUE | NBX | DAVID-HUB | RMD | Beni | Discovery | ProZone
    Standalone Apps: Pipeline Studio (teal) | The Dojo
    CXO Command Centers: MEGAZORD (CIO/ATLAS) | VOLTRON (CSO/QUE) | MUSASHI (CMO)

LOGIC LAYER (packages/)
  core/        — financial, matching, normalizers, flow engine, compliance, users
  auth/        — Firebase Auth + entitlements
  db/          — Typed Firestore client + hooks
  ui/          — Shared React components + modules

SERVICE LAYER (Cloud Run + Cloud Functions)
  services/api/           — 87 Express routes (tm-api)
  services/bridge/        — Firestore ↔ Sheets dual-write (tm-bridge, toggle-able)
  services/intake/        — 4 Cloud Functions (SPC, Meet, Mail, Email)
  services/bigquery-stream/ — Real-time BQ sink (2 Cloud Functions)

DATA LAYER
  Firestore (PRIMARY)     — 29K+ docs, all normalized
  BigQuery (ANALYTICS)    — Feed-forward from Firestore
  Google Sheets (LEGACY)  — Read-only, bridge-maintained, decommission after Sprint 11

GAS LAYER (Maintenance Only — 3 remain)
  RAPID_CORE              — Sheets adapter for remaining GAS consumers
  RAPID_IMPORT            — Data ingestion (being ported)
  DEX                     — PDF/Drive ops (Sprint 11 target)
```

---

## The Long View

| Phase | Sprints | Focus | Status |
|-------|---------|-------|--------|
| **Foundation** | 1-3 | Data + UI + portals | COMPLETE |
| **Migration** | 4-5 | GAS engines + infrastructure | COMPLETE |
| **Visual** | 6-8 | UI overhaul + pipelines + design polish | COMPLETE |
| **Stabilization** | 9 | Bug fixes + mockups + CI | COMPLETE |
| **CXO Division** | Wave 1-3 | 3 CXOs (CIO/CSO/CMO), 3 registries, 3 meshes, 131 tickets, 22K LOC | COMPLETE |
| **Deferred Maintenance** | DM | Knowledge pipeline, permissions, CI resilience, docs reorg | COMPLETE |
| **Production Wiring** | 10 | Communications + Connect live | NEXT |
| **GAS Elimination** | 11 | DEX modernization → zero GAS | PLANNED |
| **Revenue Tools** | 12-13 | ProZone + Campaign Engine | PLANNED |
| **Field Ops** | 14 | MyDropZone field agent capture | PLANNED |
| **Scale** | 15 | DAVID M&A platform | PLANNED |

---

## Operating Model

```
JDM defines priority
    ↓
CTO reviews Discovery Docs → CXOs orchestrate → RONIN builds
    ↓
RONINs execute in parallel (worktree isolation)
    ↓
CTO reviews + MUSASHI mentorship feedback loop
    ↓
CTO resolves shared files → auto-merge
    ↓
Auto-deploy to production (push to main → Firebase App Hosting)
    ↓
Next sprint
```

**Proven throughput:** 6 parallel builders in Sprint 6 (highest). 30+ builder sessions total. 9.9/10 execution rate.

---

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-03-10 | Name: toMachina | "to" (Greek "the") + "Machina" (Latin "machine") |
| 2026-03-10 | Display name: ProDashX | Legacy brand continuity |
| 2026-03-10 | Firebase App Hosting | Auto-deploy from GitHub, no Cloud Build for portals |
| 2026-03-11 | 3 builders = sweet spot, 6 for big sprints | Proven across 30+ sessions |
| 2026-03-11 | Planner + Auditor = same agent | Author of plan is best judge of adherence |
| 2026-03-13 | Communications = Module (portal-branded) | Not an App — branded per portal via CSS vars |
| 2026-03-13 | RPI Connect = Module (portal-branded) | Slide-out panel, not standalone |
| 2026-03-13 | Pipeline Studio = App (teal brand) | Own identity in every portal |
| 2026-03-14 | /clients/ renamed to /contacts/ | URL matches sidebar label |
| 2026-03-17 | API proxy architecture (permanent) | GCP org policy blocks allUsers on Cloud Run |
| 2026-03-18 | BD/RIA → Investments | Account category rename, backward-compat aliases retained |
| 2026-04-05 | CXO Division: MEGAZORD (CIO), VOLTRON (CSO), MUSASHI (CMO) | Registry Warriors architecture — each CXO owns a registry + mesh |
| 2026-04-05 | CONSUME → OPERATE → DEVOUR lifecycle | Universal CXO launch pattern |
| 2026-04-05 | 5 product specialists: Medicare/Annuity/Life-Estate/Investment/Legacy-LTC | Replace old 6 (General/Securities/Service/DAVID/Ops) |
| 2026-04-05 | MDJ = team chat panel, VOLTRON = CSO Command Center | Separate surfaces, separate brands |
| 2026-04-06 | Hub Dispatcher — CXO-aware intake routing | One triage point, five destinations |
| 2026-03-19 | Chrome tab titles: PORTAL \| Feature / toMachina / Portal | 76 pages, dynamic detail breadcrumbs |

---

*#RunningOurOwnRACE — Execute at the Speed You've Always Thought At*
