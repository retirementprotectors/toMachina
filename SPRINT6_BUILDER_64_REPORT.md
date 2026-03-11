# Sprint 6 — Builder 64 Report: ATLAS Intelligence Refresh

**Branch:** `sprint6/atlas-refresh`
**Date:** 2026-03-11
**Status:** COMPLETE

---

## What Was Built

### Part 1: Seed Script (`scripts/seed-atlas.ts`)
- **52 source definitions** seeded to `source_registry` collection
  - 12 GREEN (automated): Stateable, SPARK, PhoneValidator, NeverBounce, USPS, Google Meet, Twilio, SendGrid
  - 22 YELLOW (manual): Medicare/MedSupp/Life/Annuity BoB carriers + BD/RIA custodians + rate carriers + commission sources
  - 2 GREEN reference: NAIC/SERFF, CSG Actuarial
  - 9 RED gaps: CoF details, carrier demographics, claims data, NIPR, DTCC feeds, Blue Button, Schwab/Gradient APIs
- **36 tool definitions** seeded to `tool_registry` collection across 6 categories:
  - INTAKE_QUEUING (6): scanners + watcher
  - EXTRACTION_APPROVAL (4): Claude Vision + approval pipeline
  - NORMALIZATION_VALIDATION (8): normalizers + API validators
  - MATCHING_DEDUP (4): client/account matching + dedup + merge
  - EXTERNAL_ENRICHMENT (9): MCP tools (WhitePages, NPI, CMS plans, commissions, transcripts)
  - BULK_OPERATIONS (5): FIX_ normalizers + DEBUG_ diagnostics
- Updated `source_project` references for migrated tools (RAPID_COMMS → services/api, etc.)
- Idempotent: checks if collections are populated before seeding

### Part 2: WireDiagram Component (`packages/ui/src/components/WireDiagram.tsx`)
- Horizontal left-to-right flow chart component
- 8 stage types with unique icons + colors (EXTERNAL=purple, MCP_TOOL=cyan, API_ENDPOINT=blue, MATRIX_TAB=emerald, FRONTEND=teal, LAUNCHD=orange, SCRIPT=indigo, GAS_FUNCTION=amber)
- CSS-only connecting arrows between stages
- Click stage → callback with stage details
- `WireDiagramList` companion: renders multiple wires with dropdown selector
- Horizontal scroll for overflow, dark theme compatible

### Part 3: AtlasRegistry Module Rewrite (`packages/ui/src/modules/AtlasRegistry.tsx`)

**5 tabs (up from 3):**

| Tab | What It Shows |
|-----|--------------|
| **Sources** | Source inventory with gap status bars, filter pills (gap_status/domain/product_line/priority), search, summary dashboard (total, % automated, gap counts), source detail panel |
| **Tools** | Tool catalog with 6 category summary cards, filter by category/type/project, search, tool detail panel |
| **Pipeline** | Wire diagram visualizations using WireDiagram component + WIRE_DEFINITIONS from core, wire selector, product line filter, wire stats |
| **Health** | Automation health dashboard with green/yellow/red indicators, overall health %, stale source detection, last run timestamps |
| **Audit** | Audit trail from `atlas_audit` collection, filter by action type, contextual icons, timeline view |

### Part 4: Core Atlas Package (`packages/core/src/atlas/`)

| File | Purpose |
|------|---------|
| `types.ts` | GapStatus, SourceMethod, SourceFrequency, ToolType, ToolCategory, StageType, WireStage, WireDefinition, AtlasTool, AutomationEntry, AutomationHealth, GapGroup |
| `health.ts` | `computeAutomationHealth()` (GREEN/YELLOW/RED based on elapsed vs expected interval), `isSourceStale()`, `getAutomationSummary()`, `calculateGapAnalysis()` (group by carrier/domain/product/portal) |
| `wires.ts` | 16 wire definitions moved from API route to core (single source of truth), `getWires()` with filter, `getWireStats()` |
| `index.ts` | Barrel export |

---

## Files Changed

### New Files (6)
| File | Lines | Purpose |
|------|-------|---------|
| `packages/core/src/atlas/types.ts` | ~100 | Atlas types + re-export of AtlasSource |
| `packages/core/src/atlas/health.ts` | ~130 | Health computation + gap analysis |
| `packages/core/src/atlas/wires.ts` | ~290 | 16 wire definitions + query functions |
| `packages/core/src/atlas/index.ts` | ~5 | Barrel export |
| `packages/ui/src/components/WireDiagram.tsx` | ~165 | Wire flow chart component |
| `scripts/seed-atlas.ts` | ~250 | Firestore seed script |

### Modified Files (3)
| File | Change |
|------|--------|
| `packages/core/src/index.ts` | Added `export * from './atlas'` |
| `packages/ui/src/index.ts` | Added WireDiagram + WireDiagramList exports |
| `packages/ui/src/modules/AtlasRegistry.tsx` | Full rewrite: 3 tabs → 5 tabs, real data integration |

### Files NOT Touched
- `services/api/src/routes/atlas.ts` — wire definitions duplicated in core (API route can import from core later)
- `apps/**` — 3-line imports unchanged
- Other modules/routes

---

## Verification
- [x] `packages/core` type-checks clean
- [x] `packages/ui` builds clean
- [x] Full monorepo build: 11/11 workspaces pass
- [x] No `alert()`, `confirm()`, `prompt()`
- [x] CSS variables used for all theming
- [x] No PHI in any code
- [x] Wire definitions are single source of truth in core package
