# Sprint 2 — Builder 2 Report: Campaign + Document Modules

**Branch:** `sprint2/campaign-document-modules`
**Builder:** 2 (Campaign + Document Modules)
**Status:** COMPLETE

---

## Modules Built

### 1. C3Manager.tsx (HIGH complexity)
**File:** `packages/ui/src/modules/C3Manager.tsx`
**Lines:** ~650

**Features implemented:**
- **4-tab interface:** Campaigns | Templates | Content Blocks | Builder
- **Campaigns tab:** Filterable list by status (Draft/Planned/Active/Paused/Completed), type, search. Expandable campaign detail view with metadata (type, division, pillar, trigger, dates, target count, audience, template count).
- **Templates tab:** Grid/list toggle view with search. Template detail panel showing block slot assignments (Subject, Greeting, Intro, ValueProp, PainPoint, CTA, Signature, Compliance) resolved to block names. Body preview.
- **Content Blocks tab:** Filterable grid by type (11 types), status (Draft/In Review/Approved/Archived), pillar (Health/Wealth/Legacy/Family), and search. Cards show block ID, content preview, metadata badges, owner.
- **Builder tab:** 4-step campaign builder workflow: Select Campaign → Select Template → View Block Assignments → Preview Assembled Content. Content preview concatenates block content in slot order with merge fields intact. Placeholder for API send.
- **Status dashboard:** 4 stat cards (campaigns, templates, blocks, approved count). Clickable status pills auto-filter campaign list.
- **Data sources:** Firestore `campaigns`, `templates`, `content_blocks` collections

**Archive patterns preserved:**
- Block slot order matches C3 GAS: Greeting → Intro → ValueProp → PainPoint → CTA → Signature → Compliance
- Block type taxonomy: 11 types with prefix naming (SUBJ, GRT, INT, VP, PP, CTA, SIG, COMP, TXT, VM, EM)
- Campaign types: PSM, AGE, COV, ENG, LEGACY
- Status workflow: Draft → In Review → Approved (blocks), Draft → Planned → Active → Completed (campaigns)
- Pillar categorization: Health, Wealth, Legacy, Family
- Template touchpoint/channel structure from archive

### 2. DexDocCenter.tsx (MEDIUM complexity)
**File:** `packages/ui/src/modules/DexDocCenter.tsx`
**Lines:** ~500

**Features implemented:**
- **4-tab interface:** Pipeline | Form Library | Kit Builder | Tracker
- **Pipeline tab:** 3-stage visualization (Intake → Processing → Filing) with arrow connectors. Stage cards show icon, description, count badge, and sub-statuses (NEW/SCANNING/QUEUED, EXTRACTING/CLASSIFYING, APPROVED/IMPORTING/WRITING/COMPLETE). Counts derived from task status analysis.
- **Form Library tab:** Category filter (Firm:Client, Firm:Account, Product:GI/Schwab/RBC/Carrier, Disclosure, Supporting), status filter (ACTIVE/TBD/N/A), search. Graceful empty state with 4 category preview cards since form data not yet migrated.
- **Kit Builder tab:** 3-dropdown selection (Platform × Registration Type × Account Action). 8 platforms, 6 reg types, 4 account actions. Generates 5-layer kit preview (Firm:Client, Firm:Account, Product, Supporting, Disclosures) matching DEX_Rules.gs layer structure.
- **Tracker tab:** Document task table with title, type, status, priority, assigned_to, date columns. Status + priority badges with color coding.
- **Data sources:** Firestore `communications`, `case_tasks` (proxy — real DEX collections pending migration)

**Archive patterns preserved:**
- 5-layer kit structure from DEX_Rules.gs (firmClient, firmAccount, productClient, supporting, disclosures)
- Platform list from DEX_KitBuilder.gs (GWM/Schwab, RBC, VA/FIA/VUL Direct, etc.)
- Registration types from DEX_KitBuilder.gs (Traditional IRA, Roth IRA, etc.)
- Pipeline stages from ATLAS_Pipeline.gs (Intake → Processing → Filing with DRAFT/SENT/VIEWED/SIGNED/SUBMITTED/COMPLETE)
- Form status taxonomy (ACTIVE/TBD/N/A)

### 3. AtlasRegistry.tsx (MEDIUM complexity)
**File:** `packages/ui/src/modules/AtlasRegistry.tsx`
**Lines:** ~600

**Features implemented:**
- **3-tab interface:** Sources | Tools | Pipeline Flow
- **Sources tab:** Filterable table with gap status (GREEN/YELLOW/RED/GRAY), method (API_FEED/MANUAL_CSV/WEBHOOK/SFTP/etc.), domain (ACCOUNTS/COMMISSIONS/DEMOGRAPHICS/etc.), priority (HIGH/MEDIUM/LOW), and text search. By-carrier and by-domain summary panels. Clickable rows open detailed source panel with current vs target method/frequency, gap status badge with color indicator, automation % progress bar, owner, pull dates, product category, description, notes.
- **Tools tab:** Graceful empty state ("Seed ATLAS to populate") with 6 tool category preview cards: Intake & Queuing, Extraction & Approval, Normalization & Validation, Matching & Dedup, External Enrichment, Bulk Operations.
- **Pipeline Flow tab:** 6-stage horizontal flow visualization (Source → Intake → Extraction → Approval → Matrix → Frontend) with color-coded stage cards. Stage detail cards with status descriptions. Wire diagram placeholder note.
- **Health dashboard:** 5 stat cards (Total Sources, Active, Avg Automation %, RED gaps, Domains). Clickable gap status pills.
- **Data sources:** Firestore `source_registry` collection

**Archive patterns preserved:**
- Gap status color system (GREEN=automated, YELLOW=semi-auto, RED=manual/missing, GRAY=planned)
- Source method taxonomy from ATLAS_Registry.gs
- 6 pipeline stages from ATLAS_Pipeline.gs with correct status progressions
- Tool categories from ATLAS_ToolRegistry.gs (6 categories)
- Automation % scoring with progress bars
- Carrier × product_line × data_domain dimensional model

---

## Portal Pages Replaced

| Portal | Module | Old Lines | New Lines | Path |
|--------|--------|-----------|-----------|------|
| ProDashX | C3 | 237 | 4 | `apps/prodash/app/(portal)/modules/c3/page.tsx` |
| RIIMO | C3 | 133 | 4 | `apps/riimo/app/(portal)/modules/c3/page.tsx` |
| SENTINEL | C3 | NEW | 4 | `apps/sentinel/app/(portal)/modules/c3/page.tsx` |
| ProDashX | DEX | 11 | 4 | `apps/prodash/app/(portal)/modules/dex/page.tsx` |
| RIIMO | DEX | 152 | 4 | `apps/riimo/app/(portal)/modules/dex/page.tsx` |
| SENTINEL | DEX | 124 | 4 | `apps/sentinel/app/(portal)/modules/dex/page.tsx` |
| ProDashX | ATLAS | 138 | 4 | `apps/prodash/app/(portal)/modules/atlas/page.tsx` |
| RIIMO | ATLAS | 197 | 4 | `apps/riimo/app/(portal)/modules/atlas/page.tsx` |
| SENTINEL | ATLAS | 152 | 4 | `apps/sentinel/app/(portal)/modules/atlas/page.tsx` |

**Total:** 9 portal pages replaced (10 pages — 1 new for Sentinel C3)
**Lines removed:** ~1,144 across portal pages
**Lines added:** ~1,750 in 3 shared modules + 36 in portal pages

**Note:** Sentinel previously had NO C3 module. Created `apps/sentinel/app/(portal)/modules/c3/` directory and page.

---

## Exports Updated

`packages/ui/src/index.ts` — Added 3 module exports (additive only):
```typescript
export { C3Manager } from './modules/C3Manager'
export { DexDocCenter } from './modules/DexDocCenter'
export { AtlasRegistry } from './modules/AtlasRegistry'
```

---

## Build Verification

```
turbo run build — 9/9 workspaces pass
├── @tomachina/core ✓
├── @tomachina/auth ✓
├── @tomachina/db ✓
├── @tomachina/ui ✓ (all 3 new modules compile clean)
├── @tomachina/prodash ✓
├── @tomachina/riimo ✓
├── @tomachina/sentinel ✓
├── @tomachina/api ✓
└── @tomachina/bridge ✓
```

---

## Component Rules Compliance

- [x] CSS variables for ALL colors (--text-primary, --portal, --bg-card, etc.)
- [x] `useCollection` from `@tomachina/db` for all data
- [x] Types from `@tomachina/core` (Campaign, Template, CaseTask, etc. — used corresponding interfaces)
- [x] NO hardcoded portal names or colors
- [x] `portal` prop for portal-specific cache keys
- [x] Loading states (spinner on initial load)
- [x] Empty states (graceful messaging for missing/unmigrated data)
- [x] Responsive layout (grid breakpoints at sm/lg)
- [x] No `alert()`, `confirm()`, `prompt()`
- [x] No inline color values (all via CSS variables or computed from status)

---

## Files Changed (Builder 2 Scope Only)

### Created
- `packages/ui/src/modules/C3Manager.tsx`
- `packages/ui/src/modules/DexDocCenter.tsx`
- `packages/ui/src/modules/AtlasRegistry.tsx`
- `apps/sentinel/app/(portal)/modules/c3/page.tsx` (NEW — Sentinel didn't have C3)

### Modified
- `packages/ui/src/index.ts` (additive exports)
- `apps/prodash/app/(portal)/modules/c3/page.tsx` (replaced with import)
- `apps/riimo/app/(portal)/modules/c3/page.tsx` (replaced with import)
- `apps/prodash/app/(portal)/modules/dex/page.tsx` (replaced with import)
- `apps/riimo/app/(portal)/modules/dex/page.tsx` (replaced with import)
- `apps/sentinel/app/(portal)/modules/dex/page.tsx` (replaced with import)
- `apps/prodash/app/(portal)/modules/atlas/page.tsx` (replaced with import)
- `apps/riimo/app/(portal)/modules/atlas/page.tsx` (replaced with import)
- `apps/sentinel/app/(portal)/modules/atlas/page.tsx` (replaced with import)

### NOT Touched (respecting scope boundaries)
- `packages/ui/src/modules/CamDashboard.tsx` — Builder 1
- `packages/ui/src/modules/CommandCenter.tsx` — Builder 1
- `packages/ui/src/modules/AdminPanel.tsx` — Builder 1
- `packages/ui/src/modules/MyRpiProfile.tsx` — Builder 3
- `packages/ui/src/modules/ConnectPanel.tsx` — Builder 3
- `packages/core/**` — import only
- `services/**` — not in scope

---

## Known Limitations

1. **DEX Form Library:** Shows empty state — form data not yet migrated to Firestore. UI structure and filters are ready for when data arrives.
2. **DEX Kit Builder:** Shows layer previews but can't generate actual kits — requires DEX GAS backend call or Firestore rule data.
3. **ATLAS Tool Registry:** Shows category previews but `tool_registry` collection may be empty — needs ATLAS seed.
4. **ATLAS Wire Diagrams:** Pipeline flow is generic. Per-product wire diagrams need wire definitions from ATLAS backend.
5. **C3 Campaign Builder:** Preview-only — actual send orchestration goes through API routes (placeholder noted in UI).
6. **Pipeline counts (DEX):** Derived from task status heuristics since real DEX pipeline collection not yet migrated.
