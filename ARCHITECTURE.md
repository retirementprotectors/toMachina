# toMachina Architecture Reference

> The definitive map of every feature, where it lives, and how it connects.
> Updated: 2026-03-11

---

## Standard Definitions (Updated for toMachina)

| Term | Definition |
|------|-----------|
| **MACHINA** | The entire ecosystem. Everything. |
| **toMachina** | The monorepo. The codebase. `~/Projects/toMachina/` |
| **Portals** | The 3 front doors: ProDashX (B2C), RIIMO (B2E), SENTINEL (B2B) |
| **Sections** | Groupings in the sidebar nav of each Portal |
| **Modules** | Features that appear in multiple portals. Built as shared components in `packages/ui/src/modules/`. |
| **Pages** | Portal-specific features. Built as page files in `apps/[portal]/`. |
| **Packages** | Shared code libraries: ui, core, auth, db. Not deployed — compiled into whatever uses them. |
| **Services** | Deployed backend servers: api (Cloud Run), bridge (Cloud Run). |
| **GAS Engines** | Legacy backend processors in `~/Projects/gas/`. Maintenance mode. Communicate with toMachina via Firestore + bridge. |

---

## The Module System

### What Is a Shared Module?

A shared module is a React component in `packages/ui/src/modules/` that renders identically in any portal. It reads from Firestore, uses CSS variables for theming, and doesn't know or care which portal it's inside.

```
packages/ui/src/modules/CamDashboard.tsx    ← THE component (one source of truth)
         │
         ├── apps/prodash/modules/cam/page.tsx     ← 3 lines: import + render
         ├── apps/riimo/modules/cam/page.tsx        ← 3 lines: import + render
         └── apps/sentinel/modules/cam/page.tsx     ← 3 lines: import + render
```

Change the shared component → all 3 portals update on next build. Automatic.

### What Is a Portal Page?

A portal page is a feature unique to one portal. It lives in that portal's `app/` directory and is NOT shared.

```
apps/prodash/clients/[id]/page.tsx    ← CLIENT360 — ProDashX only
apps/riimo/dashboard/page.tsx          ← Ops Dashboard — RIIMO only
apps/sentinel/deals/page.tsx           ← Deal Kanban — SENTINEL only
```

---

## Complete Feature Map

### Shared Modules (build in `packages/ui/src/modules/`)

These appear in ALL 3 portals (or 2 of 3). One component, automatic theming.

| Module | What It Does | Portals | GAS Backend | Firestore Collections | Status |
|--------|-------------|---------|-------------|----------------------|--------|
| **CAM Dashboard** | Commission accounting: revenue breakdown, comp grids, top agents/carriers, projections | All 3 | `gas/CAM/` (commission calcs, comp grid writes) | `revenue`, `agents`, `carriers` | NEEDS BUILD — current pages are basic summaries |
| **C3 Manager** | Campaign engine: campaign builder, template editor, content blocks, send orchestration | All 3 | `gas/C3/` (campaign assembly — mostly HTML) | `campaigns`, `templates`, `content_blocks` | NEEDS BUILD — current pages show counts only |
| **ATLAS Registry** | Source of truth: source registry, tool registry, wire diagrams, pipeline flow, audit reports | All 3 | `gas/ATLAS/` (registry CRUD, triggers, Slack digests) | `source_registry`, `tool_registry` (pending) | NEEDS BUILD — current pages show basic source list |
| **DEX Doc Center** | Document efficiency: form library, kit builder, PDF preview, document pipeline tracking | All 3 | `gas/DEX/` (PDF filling, Drive filing, DocuSign) | `communications`, `case_tasks` (proxy — real DEX collections not yet migrated) | NEEDS BUILD — current pages are minimal |
| **Command Center** | Leadership visibility: cross-platform metrics, team performance, pipeline health | All 3 | None (reads aggregated data) | All collections (counts + aggregates) | PARTIAL — has collection counts, needs rich widgets |
| **MyRPI Profile** | Employee profile: personal info, team, meet room / drop zone, settings | All 3 | None (reads from users collection) | `users` | PARTIAL — RIIMO has it, needs to be shared component |
| **RPI Connect** | Communications hub: message threads, Twilio SMS/Voice, SendGrid email, Google Chat | All 3 | `gas/RAPID_COMMS/` (Twilio + SendGrid) + MCP comms tools | `communications` | NOT BUILT — was 56KB HTML in GAS, needs full rebuild |
| **Admin Panel** | User management: user list, org structure, entitlements, permissions | All 3 | None (reads from users + org) | `users`, `org` | PARTIAL — basic user list exists, needs entitlement editing |

### Portal-Specific Pages (stay in `apps/[portal]/`)

**ProDashX (B2C) — Client-facing features:**

| Page | Route | What It Does | GAS Backend | Firestore | Status |
|------|-------|-------------|-------------|-----------|--------|
| Client List | `/clients` | Client grid with search, filters, sort, pagination | None (Firestore direct) | `clients` | DONE |
| CLIENT360 | `/clients/[id]` | 11-tab client detail view | None (Firestore direct) | `clients`, `clients/*/accounts`, `communications`, `activities` | DONE (needs UX depth from archive) |
| Accounts | `/accounts` | Cross-client account grid with type filters | None (Firestore direct) | `clients/*/accounts` | DONE |
| Account Detail | `/accounts/[clientId]/[accountId]` | Single account detail | None (Firestore direct) | `clients/*/accounts` | DONE |
| Pipelines | `/pipelines` | Pipeline kanban boards | `gas/RAPID_FLOW/` (workflow engine) | `pipelines`, `flow/config/*` | BASIC — needs stage execution |
| Casework | `/casework` | Case management | None | `case_tasks` | BASIC — needs full case workflow |
| **RMD Center** | `/service-centers/rmd` | Required Minimum Distribution tracking + IRS calc | None (pure calc in `@tomachina/core`) | `clients`, `clients/*/accounts` | PLACEHOLDER — needs IRS RMD logic from archive |
| **Beni Center** | `/service-centers/beni` | Beneficiary management | None | `clients` | PLACEHOLDER — needs workflow from archive |
| **Medicare Quoting** | `/sales-centers/medicare` | Medicare plan comparison + recommendation | `services/MCP-Hub/healthcare-mcps/` (Cloud Run QUE-API) | None (API-driven) | PLACEHOLDER — needs CSG API integration |
| **Life Quoting** | `/sales-centers/life` | Life insurance quoting | Future | None | PLACEHOLDER |
| **Annuity Quoting** | `/sales-centers/annuity` | Annuity comparison | Future | None | PLACEHOLDER |
| **Advisory** | `/sales-centers/advisory` | RIA/BD advisory workflow | Future | None | PLACEHOLDER |
| **Discovery Kit** | Future route | Client discovery questionnaire + PDF | `gas/DEX/` (PDF generation) | `clients` | NOT BUILT — needs archive reference |
| **Quick Intake** | Future route | One-screen client creation | None (bridge write) | `clients` | NOT BUILT — needs archive reference |

**RIIMO (B2E) — Operations features:**

| Page | Route | What It Does | GAS Backend | Firestore | Status |
|------|-------|-------------|-------------|-----------|--------|
| Dashboard | `/dashboard` | 8-card ops overview across all platforms | None (Firestore aggregates) | All collections | DONE (needs rich widgets from archive) |
| Tasks | `/tasks` | Task system with filters, delegation | None | `case_tasks` | DONE (needs delegation workflow) |
| Pipelines | `/pipelines` | Ops pipelines: onboarding, offboarding | `gas/RAPID_FLOW/` | `pipelines`, `flow/config/*` | BASIC — needs stage execution from archive |
| Org Admin | `/org-admin` | Company structure + hierarchy | None | `org`, `users` | DONE |
| Intelligence | `/intelligence` | AI analytics dashboard | None | `clients`, `opportunities`, `revenue` | BASIC — needs rich analytics |
| **Job Templates** | Future route | Job description template editor | None | Future collection | NOT BUILT — needs archive reference |

**SENTINEL (B2B) — Deal/M&A features:**

| Page | Route | What It Does | GAS Backend | Firestore | Status |
|------|-------|-------------|-------------|-----------|--------|
| Deals | `/deals` | Kanban deal pipeline (6 stages) | None | `opportunities` | DONE |
| Producers | `/producers` | Producer card grid with NPN, search | None | `agents` | DONE |
| Analysis | `/analysis` | Revenue analysis by carrier/agent/type | None | `revenue`, `agents` | DONE |
| Market Intel | `/market-intel` | Agent/carrier/producer browser with tabs | None | `agents`, `carriers`, `producers` | DONE |
| **DAVID HUB** | `/modules/david-hub` | Entry calculators: MEC, PRP, SPH, Deal Valuation | `packages/core/financial/` | `revenue`, `agents`, `opportunities` | PLACEHOLDER — needs calculators from archive |

---

## How GAS Backends Connect to toMachina

```
┌─────────────────────────┐
│   toMachina Portals     │  ← Users see this (React, Firestore)
│   (ProDashX/RIIMO/SENT) │
└──────────┬──────────────┘
           │ reads Firestore
           ▼
┌─────────────────────────┐
│      Firestore          │  ← Single source of truth (29K+ docs)
└──────────┬──────────────┘
           │ bridge syncs
           ▼
┌─────────────────────────┐
│    Bridge Service       │  ← Keeps Firestore + Sheets in sync
│    (Cloud Run)          │
└──────────┬──────────────┘
           │ writes to Sheets
           ▼
┌─────────────────────────┐
│    Google Sheets        │  ← MATRIX spreadsheets (legacy data store)
│    (3 MATRIXes)         │
└──────────┬──────────────┘
           │ GAS reads/writes Sheets
           ▼
┌─────────────────────────┐
│    GAS Engines          │  ← Background automation (3 remain)
│    (RAPID_IMPORT, DEX,  │
│     RAPID_CORE)         │
└─────────────────────────┘
```

**The connection per app:**

| App | GAS Backend Does | toMachina Frontend Shows | Connection |
|-----|-----------------|------------------------|------------|
| **DEX** | Fills PDFs, files to Drive, manages DocuSign | Document library, kit builder, pipeline status | Firestore proxy (comms/tasks) — real DEX collections need migration |
| **RAPID_IMPORT** | 4-channel intake scanning, approval pipelines, data ingestion | No direct UI — data appears in client/account/revenue collections | Firestore (via bridge) |
| **RAPID_CORE** | Sheets adapter library for remaining GAS consumers (RAPID_IMPORT, DEX) | Shared library | Sheets MATRIX data |

**ARCHIVED (Sprint 5 — migrated to `services/api/`):**
CAM, C3, ATLAS, RAPID_FLOW, RAPID_COMMS, RAPID_API — all replaced by Cloud Run API routes.

---

## Package Reference

| Package | What's Inside | Used By |
|---------|--------------|---------|
| `@tomachina/ui` | 8 base components (Modal, Toast, ConfirmDialog, Sidebar, SmartLookup, DataTable, LoadingOverlay, KanbanBoard, PortalSwitcher) + shared modules (pending) | All 3 portals |
| `@tomachina/core` | Normalizers (123 fields), validators (11), financial calcs (14 functions), matching/dedup (10 functions), entitlement engine (39 modules), resolveUser, TABLE_ROUTING, FIRESTORE_COLLECTIONS | All 3 portals + API service |
| `@tomachina/auth` | Firebase Auth provider, useAuth() hook, buildEntitlementContext, canAccessModule | All 3 portals |
| `@tomachina/db` | Typed Firestore client, useDocument/useCollection hooks, collection references | All 3 portals + API service |

---

## Target State: Shared Modules

When the UI sprint is complete:

```
packages/ui/src/
├── components/           ← Base components (8 existing)
│   ├── Modal.tsx
│   ├── Toast.tsx
│   ├── DataTable.tsx
│   ├── Sidebar.tsx
│   ├── SmartLookup.tsx
│   ├── ConfirmDialog.tsx
│   ├── LoadingOverlay.tsx
│   ├── KanbanBoard.tsx
│   └── PortalSwitcher.tsx
│
└── modules/              ← Shared feature modules (8 to build)
    ├── CamDashboard.tsx
    ├── C3Manager.tsx
    ├── AtlasRegistry.tsx
    ├── DexDocCenter.tsx
    ├── CommandCenter.tsx
    ├── MyRpiProfile.tsx
    ├── ConnectPanel.tsx
    └── AdminPanel.tsx
```

Each portal page becomes:
```tsx
import { CamDashboard } from '@tomachina/ui'
export default function CamPage() {
  return <CamDashboard portal="prodashx" />
}
```

---

## What Needs Migration (GAS → toMachina)

### Already Migrated
| What | From | To |
|------|------|----|
| Business logic (normalizers, financial, matching, entitlements) | RAPID_CORE .gs files | `packages/core/` |
| Client/Account/Revenue data (29K docs) | MATRIX Sheets | Firestore |
| Portal UIs (structure + data connections) | PRODASHX/RIIMO/SENTINEL .html + .gs | `apps/prodash/riimo/sentinel/` |
| API endpoints (41+) | RAPID_API .gs files | `services/api/` |

### Needs Migration
| What | From | To | Blocks |
|------|------|----|--------|
| DEX form library + field mappings | `gas/DEX/` Sheets tabs | Firestore collections | DEX shared module UI |
| Tool Registry | `gas/ATLAS/` Sheets tab `_TOOL_REGISTRY` | Firestore `tool_registry` | ATLAS shared module completeness |
| Campaign send orchestration | `gas/C3/` embedded in HTML | `services/api/routes/campaign-send.ts` (exists, needs depth) | C3 shared module send feature |
| Comp grid data | `gas/CAM/` Sheets tabs | Firestore `comp_grids` | CAM shared module comp grid viewer |
| RMD calculation logic | `archive/PRODASHX/PRODASH_RMD_CENTER.gs` | `packages/core/financial/rmd.ts` | RMD Center page |
| DAVID HUB calculators | `archive/DAVID-HUB/` | `packages/core/financial/` or `apps/sentinel/` | DAVID HUB page |
| Discovery Kit logic | `archive/PRODASHX/PRODASH_DISCOVERY_KIT.gs` | `apps/prodash/` or `packages/core/` | Discovery Kit page |
| RPI Connect messaging | `archive/*/RPI_Connect.html` (56KB) | `packages/ui/src/modules/ConnectPanel.tsx` | Connect shared module |

---

## Decision Rules

**"Should this be a shared module or a portal page?"**

→ Does it appear in more than one portal? **Shared module.**
→ Does it show the same data the same way regardless of portal? **Shared module.**
→ Is it fundamentally different per portal (different data, different workflow)? **Portal page.**
→ Not sure? **Start as a portal page. Promote to shared module when the second portal needs it.**

**"Should this stay in GAS or move to toMachina?"**

→ Does it need DriveApp, GmailApp, or GAS triggers? **Stay GAS.**
→ Is it pure business logic with no Google API dependency? **Move to `packages/core/`.**
→ Is it an API endpoint? **Move to `services/api/`.**
→ Is it working fine and nobody touches it? **Leave it. Don't fix what isn't broken.**
→ Is it constantly breaking and requiring reactive maintenance? **Move it now.**
