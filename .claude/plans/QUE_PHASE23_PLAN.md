# QUE Phase 2+3 Build Plan
## Yellow Stage — Casework Components + Outputs

**Sprint ID:** `jIQXdXMMfHfZxw8ARUzv`
**Discovery:** `_RPI_STANDARDS/reference/collateral/DISCOVERY-YELLOW-STAGE-PHASE2-PHASE3.md`
**Date:** 2026-03-17
**Status:** Plan Audited

---

## Current State

**33 of 88 items BUILT** — all calc + lookup tools from overnight session (commit `b613f52`, merged to main).

Built items (TRK-13345 through TRK-13377):
- 25 calc-* tools in `packages/core/src/que/tools/`
- 8 lookup-* tools in `packages/core/src/que/tools/`
- 9 data files in `packages/core/src/que/tools/data/`
- 1 types.ts with all shared types
- Type-check: 13/13 passing
- All formula verifications confirmed

**55 items remaining** (corrected back to `in_sprint`):
- 5 generators (TRK-13378 through TRK-13382)
- 10 super tools (TRK-13383 through TRK-13392)
- 10 wires (TRK-13393 through TRK-13402)
- 1 Pipeline Studio integration (TRK-13403)
- 6 process docs (TRK-13404 through TRK-13409)
- 16 HTML templates (TRK-13410 through TRK-13425)
- 3 reference data items (TRK-13426 through TRK-13428)
- 1 QUE registry (TRK-13429)
- 1 Factfinder locate+digitize (TRK-13430)
- 1 remaining file scan (TRK-13431)
- 1 DEX tools (TRK-13432)

**1 item BLOCKED:** TRK-13409 (ROTH Conversion process doc) — source template on Shared Drive is empty.

---

## Build Waves

### Wave 2a: ANALYZE_* Super Tools (8)
**Items:** TRK-13383 through TRK-13390 (8 items)
**Location:** `packages/core/src/que/super-tools/`
**Dependencies:** Wave 1 calc tools (DONE)
**Complexity:** Medium — orchestration logic over existing calc tools

Each ANALYZE_* super tool is a function that:
1. Takes household data + account data as input
2. Calls the appropriate calc-* tools in sequence
3. Returns a structured analysis result

| Item | Super Tool | Calc Tools Used | Output |
|------|-----------|----------------|--------|
| TRK-13383 | ANALYZE_INCOME_NOW | calc-household-aggregate, calc-gmib, calc-rmd, calc-breakeven-equity | Income gap/surplus, BEP metric |
| TRK-13384 | ANALYZE_INCOME_LATER | calc-rollup, calc-gmib, calc-provisional-income, calc-federal-tax | Roll-up table, 3-option framework |
| TRK-13385 | ANALYZE_ESTATE | calc-va-depletion, calc-income-multiplier, calc-college-funding, lookup-fyc-rate | Lapse warnings, DB erosion, survivor gap |
| TRK-13386 | ANALYZE_GROWTH | calc-va-depletion, calc-fia-projection, calc-delta, calc-surrender-charge, calc-ltcg, calc-bonus-offset | Depletion age, delta table, net cost |
| TRK-13387 | ANALYZE_LTC | calc-ltc-phase-access, calc-gmib, calc-mgsv, lookup-carrier-product | 4-phase access table, total pool, fees |
| TRK-13388 | ANALYZE_ROTH | calc-provisional-income, calc-ss-taxation, calc-federal-tax, calc-irmaa (×2 — before/after) | Bracket jump, IRMAA cliff, break-even |
| TRK-13389 | ANALYZE_TAX_HARVEST | calc-lot-selection, calc-ltcg, calc-ss-earnings-limit, calc-provisional-income | Lot table, effective rate, loss carryforward |
| TRK-13390 | ANALYZE_MGE | calc-household-aggregate + detect applicable types + call relevant ANALYZE_* | Household summary + applicable type list |

**IMPORTANT: ANALYZE_ROTH (TRK-13388) is NOT blocked.** Only the ROTH process doc (TRK-13409) is blocked. The super tool uses calc-* tools which are all built. Build it normally.

**Build order:**
1. Create `packages/core/src/que/super-tools/types.ts` — SuperToolInput, SuperToolOutput, AnalysisResult types
2. Build ANALYZE_INCOME_NOW (simplest — 4 calc tools, straightforward)
3. Build ANALYZE_GROWTH (most complex single type — 6 calc tools, consolidation math)
4. Build ANALYZE_INCOME_LATER, ANALYZE_ESTATE, ANALYZE_LTC, ANALYZE_TAX_HARVEST, ANALYZE_ROTH (parallel)
5. Build ANALYZE_MGE (orchestrator — depends on all 7 ANALYZE_* being done)

---

### Wave 2b: GENERATE_CASEWORK + ASSEMBLE_OUTPUT (after Wave 3)
**Items:** TRK-13391, TRK-13392 (2 items)
**Location:** `packages/core/src/que/super-tools/`
**Dependencies:** Wave 2a super tools + Wave 3 generators — CANNOT be built until Wave 3 is complete
**Complexity:** Medium

| Item | Super Tool | Dependencies | Output |
|------|-----------|-------------|--------|
| TRK-13391 | GENERATE_CASEWORK | Wave 3 generators (generate-summary-html, generate-detail-html) | Summary + Detail HTML per type |
| TRK-13392 | ASSEMBLE_OUTPUT | Wave 3 generators (generate-ai3-pdf, generate-factfinder) + DEX tools (html-to-pdf, file-to-acf) | Complete 5-output package |

**Build:** After Wave 3 generators are done, come back and wire these two super tools.

---

### Wave 3: Generators + HTML Templates
**Items:** TRK-13378 through TRK-13382 (5 generators) + TRK-13410 through TRK-13425 (16 HTML templates)
**Location:** Generators in `packages/core/src/que/generators/`, Templates in `_RPI_STANDARDS/reference/collateral/`
**Dependencies:** Wave 1 calc tools (DONE), existing HTML template patterns (DONE — 2 complete templates exist)
**Complexity:** Medium-High — HTML generation with RPI design system

#### Generators (5)

| Item | Generator | Input | Output |
|------|----------|-------|--------|
| TRK-13378 | generate-summary-html | AnalysisResult + casework type | Tier 1 one-pager HTML |
| TRK-13379 | generate-detail-html | AnalysisResult + casework type | Tier 2/3 year-by-year HTML |
| TRK-13380 | generate-ai3-pdf | Household data + account data | Clean AI3 HTML (for PDF conversion). **NOTE: Despite the name, this tool outputs an HTML string. PDF conversion is handled by DEX `html-to-pdf` in ASSEMBLE_OUTPUT.** |
| TRK-13381 | generate-meeting-prep | Household data + opportunity scan | 3-page meeting agenda HTML |
| TRK-13382 | generate-factfinder | Household data + auth forms needed | Pre-filled factfinder HTML |

**Design system (from existing templates):**
- Font: 'Segoe UI', system-ui, -apple-system, sans-serif
- Navy: #1a3a5c (headers, accents)
- Table headers: #e8edf2
- Highlight rows: #f0f6ff
- Opportunity boxes: Green (#2a7d4f/#f4faf6), Yellow (#c49000/#fef9ee), Blue (#2563b3/#f0f6ff)
- Print: Letter, 0.5in/0.6in margins, print-color-adjust: exact
- Body: 10pt, tables 9pt, opportunity details 8.5pt

**Pattern:** Each generator is a pure function: `(data: TypedInput) => string` (returns HTML string). No async, no Firestore. The HTML-to-PDF conversion and ACF filing happen in the ASSEMBLE_OUTPUT super tool via DEX tools.

#### HTML Templates (16 — Summary + Detail for each of 8 types)

| Items | Type | Summary Template | Detail Template |
|-------|------|-----------------|-----------------|
| TRK-13410, TRK-13411 | Income NOW | Current vs proposed income one-pager | Year-by-year projection with fee breakdown |
| TRK-13412, TRK-13413 | Income LATER | Rollup advantage + 3-option comparison | Year-by-year benefit base growth + tax math |
| TRK-13414, TRK-13415 | Estate MAX | Current path vs repositioned path | 15-year household projection + lapse detection |
| TRK-13416, TRK-13417 | Growth MAX | VA depletion vs FIA sustainability | Year-by-year delta + consolidation cost math |
| TRK-13418, TRK-13419 | LTC MAX | 4-phase access pool summary | Contract-by-contract LTC analysis + fees |
| TRK-13420, TRK-13421 | MGE Detailed | Household financial snapshot | Full AI3-style multi-category analysis |
| TRK-13422, TRK-13423 | ROTH Conversion | Before/after bracket comparison | Multi-year conversion sequence + IRMAA impact |
| TRK-13424, TRK-13425 | Tax Harvesting | Lot selection table + effective rate | Position-by-position with cost basis detail |

**COMPLIANCE REQUIREMENT (Tax Harvesting — TRK-13424, TRK-13425, and generators TRK-13378/TRK-13379 when rendering Tax Harvesting type):**
All Tax Harvesting outputs MUST include the RPI + Signal Advisors Wealth compliance disclosure footer. The disclosure text is stored in the Claude.AI archive at `_instructions.md` within the Tax Harvesting project. Builders must include this in both Summary and Detail templates for Tax Harvesting.

**Build order:**
1. Build `generate-summary-html` framework (takes analysis result + type, dispatches to type-specific template)
2. Build Income NOW Summary template (TRK-13410) — establishes the pattern
3. Build Income NOW Detail template (TRK-13411) — establishes detail pattern
4. Build remaining 7 Summary templates in parallel (TRK-13412, 13414, 13416, 13418, 13420, 13422, 13424)
5. Build remaining 7 Detail templates in parallel (TRK-13413, 13415, 13417, 13419, 13421, 13423, 13425)
6. Build `generate-detail-html` framework
7. Build `generate-ai3-pdf` (TRK-13380) — leverages household aggregate data
8. Build `generate-meeting-prep` (TRK-13381) — pattern exists: RPI-Client-Review-Meeting-Template.html
9. Build `generate-factfinder` (TRK-13382) — BLOCKED on TRK-13430 (locate factfinder). **FALLBACK: If the factfinder template is not found during TRK-13430, defer TRK-13382 to next sprint. Do NOT block the wave — all other generators and templates ship without it.**

**Existing reference templates (use as patterns):**
- `RPI-Client-Review-Meeting-Template.html` — 3-page meeting agenda with summary bar, asset tables, opportunity boxes, checklist, notes
- `RPI-Strategic-Life-Insurance-Funding-Analysis.html` — 4-page strategic comparison with cover, opportunity, options, math
- `~/Desktop/Sibenaller-Hansman-Review-Meeting.html` — Production example of meeting prep

---

### Wave 4: Wires + Process Docs + Registry
**Items:** TRK-13393 through TRK-13402 (10 wires) + TRK-13404 through TRK-13409 (6 process docs) + TRK-13429 (registry)
**Location:** Wires in `packages/core/src/que/wires/`, Process docs in `_RPI_STANDARDS/reference/collateral/`, Registry in `packages/core/src/que/`
**Dependencies:** Wave 2 super tools + Wave 3 generators
**Complexity:** Low-Medium

#### Wires (10)

Each wire is a function that chains super tools in sequence:

| Item | Wire | Sequence | Trigger |
|------|------|----------|---------|
| TRK-13393 | WIRE_INCOME_NOW | ANALYZE_INCOME_NOW → GENERATE_CASEWORK | Dormant income riders |
| TRK-13394 | WIRE_INCOME_LATER | ANALYZE_INCOME_LATER → GENERATE_CASEWORK | Rollup opportunity |
| TRK-13395 | WIRE_ESTATE_MAX | ANALYZE_ESTATE → GENERATE_CASEWORK | Life approaching lapse |
| TRK-13396 | WIRE_GROWTH_MAX | ANALYZE_GROWTH → GENERATE_CASEWORK | VA fees or idle CDs |
| TRK-13397 | WIRE_LTC_MAX | ANALYZE_LTC → GENERATE_CASEWORK | Multi-contract LTC |
| TRK-13398 | WIRE_ROTH_CONVERSION | ANALYZE_ROTH → GENERATE_CASEWORK | Large trad IRA |
| TRK-13399 | WIRE_TAX_HARVEST | ANALYZE_TAX_HARVEST → GENERATE_CASEWORK | NQ liquidation |
| TRK-13400 | WIRE_MGE_DETAILED | ANALYZE_MGE → GENERATE_CASEWORK | Full review |
| TRK-13401 | WIRE_REVIEW_MEETING | ANALYZE_MGE → generate-meeting-prep → file-to-acf | Scheduled review |
| TRK-13402 | WIRE_ASSEMBLE_B4 | ASSEMBLE_OUTPUT | All wires complete |

**Build:** All 10 are straightforward chaining — build in one pass after Waves 2+3.

#### Process Docs (6)

| Item | Process Doc | Source Material | Status |
|------|-----------|----------------|--------|
| TRK-13404 | CASEWORK-PROCESS-INCOME-NOW.md | Claude.AI Retirement Income Strategy (Demetry calculator, Anders case), ANNUITY- Income Comparison sheet, ANNUITY- Income Portfolio Analysis sheet, RETIREMENT- Income Strategy.BASIC sheet | Ready |
| TRK-13405 | CASEWORK-PROCESS-ESTATE-MAX.md | Claude.AI DeGeeter Estate Scenarios (15-year projection HTML), Mineart 3-Option Estate Comparison (2 HTML versions), LIFE- Family Needs Calculator sheet, LIFE- UL Case Matrix sheet | Ready |
| TRK-13406 | CASEWORK-PROCESS-GROWTH-MAX.md | ANNUITY- GROWTH MAX sheet, Claude.AI Portfolio Consolidation templates (Sebetka $579K, Stuart $548K HTMLs), FIA MVA Calculator (5 React iterations), ANNUITY- Index + MVA Calcs sheet | Ready |
| TRK-13407 | CASEWORK-PROCESS-LTC-MAX.md | Claude.AI LTC Access Analysis — Connell (4-phase framework, 2 HTML presentations), LTC- HYBRID Life + FIA Comparison Excel, CONCEPT- LTC MAX! Excel | Ready |
| TRK-13408 | CASEWORK-PROCESS-TAX-HARVEST.md | Claude.AI Tax Harvesting (4 HTML presentations, 4-phase workflow), CaseWork.INPUTS automation recipe sheet, Claude- Portfolio Liquidation Analysis PDF | Ready |
| TRK-13409 | CASEWORK-PROCESS-ROTH.md | PROV+FEDS+STATE sheet (Tax Engine) + IRMAA Calculator sheet + Full Retirement Age SS Calc sheet | **BLOCKED** — ROTH Conversion Analysis template on Shared Drive is empty |

**Pattern:** Follow CASEWORK-PROCESS-GMIB-TO-LIFE.md and CASEWORK-PROCESS-CLIENT-REVIEW-MEETING.md exactly.

#### QUE Registry (1)

| Item | What |
|------|------|
| TRK-13429 | Register all Phase 2+3 tools, super tools, and wires in QUE tool registry |

Schema per ATLAS pattern:
```typescript
type: 'TOOL' | 'SUPER_TOOL' | 'WIRE'
domain: 'que'
```

Register: 25 calc tools + 8 lookups + 5 generators + 8 ANALYZE_* + GENERATE_CASEWORK + ASSEMBLE_OUTPUT + 10 wires = **59 registry entries**.

---

### Wave 5: Integration + Remaining Items
**Items:** TRK-13403 (Pipeline Studio), TRK-13426 through TRK-13428 (reference data), TRK-13430 (Factfinder), TRK-13431 (file scan), TRK-13432 (DEX tools)
**Dependencies:** Waves 2-4 complete
**Complexity:** Mixed

| Item | What | Notes |
|------|------|-------|
| TRK-13403 | Pipeline Studio — Yellow Stage config | Add `execution_type: 'que_workbench'` to casework steps in SALES_RETIREMENT pipeline config. Add QUE_SESSION_COMPLETE check handler. Wire "Launch QUE" button. |
| TRK-13426 | Carrier contact directory | Firestore reference collection or `packages/core/src/que/tools/data/carrier-contacts.ts` |
| TRK-13427 | Document classification (18 types) | Constants file in `packages/core/src/que/tools/data/document-types.ts` |
| TRK-13428 | PDF naming convention | Utility function in `packages/core/src/que/tools/` |
| TRK-13430 | Locate + digitize RPI Factfinder | Search Shared Drive, Google Forms, or recreate from Playbook description |
| TRK-13431 | Scan remaining casework files | 6 Excel files, 4 visual sheets, 2 non-default tab sheets |
| TRK-13432 | DEX tools — document operations | create-acf-folder, file-to-acf, html-to-pdf, merge-documents, classify-outgoing-doc |

---

## Builder Assignment Strategy

| Wave | Estimated Files | Parallelizable? | Recommended Approach |
|------|----------------|----------------|---------------------|
| **Wave 2a** (8 ANALYZE_*) | ~10 files | Yes — 7 are independent, MGE depends on all 7 | Build 7 ANALYZE_* in parallel, then MGE |
| **Wave 3** (Generators + Templates) | ~21 files | Yes — each template is independent | 1 builder for generator framework + Income NOW pattern, then parallel builders for remaining 7 types |
| **Wave 2b** (GENERATE + ASSEMBLE) | ~2 files | No — sequential | Single builder after Wave 3 completes |
| **Wave 4** (Wires + Docs + Registry) | ~17 files | Yes — wires, docs, and registry are all independent | 3 parallel builders: wires, process docs, registry |
| **Wave 5** (Integration) | ~7 files | Partially | Sequential — Pipeline Studio depends on everything else |

**Overnight agent strategy:**
- Wave 2a: Single agent, sequential (super tools compose calc tools, need to verify chaining)
- Wave 3: 2-3 agents in parallel (generator framework + template batches)
- Wave 2b: Folded into end of Wave 3 agent (just 2 files)
- Wave 4: 3 agents in parallel (wires / docs / registry)
- Wave 5: Single agent, sequential

---

## Dependencies Graph

```
Wave 1 (DONE) ─── calc-* tools + lookup-* tools + data files + types
     │
     ▼
Wave 2 ────────── ANALYZE_* super tools (8)
     │              │
     │              ├── ANALYZE_INCOME_NOW (uses calc-household-aggregate, calc-gmib, calc-rmd, calc-breakeven)
     │              ├── ANALYZE_INCOME_LATER (uses calc-rollup, calc-gmib, calc-provisional, calc-federal-tax)
     │              ├── ANALYZE_ESTATE (uses calc-va-depletion, calc-income-multiplier, calc-college, lookup-fyc)
     │              ├── ANALYZE_GROWTH (uses calc-va-depletion, calc-fia, calc-delta, calc-surrender, calc-ltcg, calc-bonus)
     │              ├── ANALYZE_LTC (uses calc-ltc-phase, calc-gmib, calc-mgsv, lookup-carrier)
     │              ├── ANALYZE_ROTH (uses calc-provisional ×2, calc-ss-taxation, calc-federal ×2, calc-irmaa ×2)
     │              ├── ANALYZE_TAX_HARVEST (uses calc-lot-selection, calc-ltcg, calc-ss-earnings, calc-provisional)
     │              └── ANALYZE_MGE (orchestrator — calls all 7 above)
     │
     ▼
Wave 3 ────────── Generators (5) + HTML Templates (16)
     │              │
     │              ├── generate-summary-html (dispatches to type-specific Summary templates)
     │              ├── generate-detail-html (dispatches to type-specific Detail templates)
     │              ├── 16 HTML templates (Summary + Detail × 8 types)
     │              ├── generate-ai3-pdf
     │              ├── generate-meeting-prep (pattern: RPI-Client-Review-Meeting-Template.html)
     │              └── generate-factfinder (BLOCKED on TRK-13430)
     │
     ▼
Wave 2b ───────── GENERATE_CASEWORK + ASSEMBLE_OUTPUT (finish Wave 2 items that depend on Wave 3)
     │
     ▼
Wave 4 ────────── Wires (10) + Process Docs (5+1 BLOCKED) + Registry (1)
     │              │
     │              ├── 10 wires (chain super tools → generators)
     │              ├── 5 process docs (CASEWORK-PROCESS-*.md)
     │              ├── TRK-13409 BLOCKED (ROTH — empty source template)
     │              └── QUE tool registry (59 entries)
     │
     ▼
Wave 5 ────────── Pipeline Studio + Reference Data + Factfinder + DEX + File Scan
                    │
                    ├── Pipeline Studio Yellow Stage config
                    ├── Carrier contacts + doc types + naming convention
                    ├── Locate factfinder (unblocks TRK-13382)
                    ├── DEX tools (5 document operations)
                    └── Scan remaining Excel/visual files
```

---

## Blocked Items

| Item | Title | Blocked By | Resolution |
|------|-------|-----------|------------|
| TRK-13409 | CASEWORK-PROCESS-ROTH.md | ROTH Conversion Analysis sheet on Shared Drive is EMPTY | Either: (1) JDM populates the source sheet, (2) build process doc from Tax Engine (PROV+FEDS+STATE) + IRMAA Calculator alone, or (3) defer to next sprint |
| TRK-13382 | generate-factfinder | RPI Factfinder template not located (TRK-13430) | If not found during TRK-13430, **defer to next sprint**. Do not block Wave 3 — all other generators ship without it. |

---

## Verification Criteria

### Per Wave

**Wave 2:** Each ANALYZE_* super tool must:
- Accept typed household + account input
- Call its calc tools in documented sequence
- Return typed AnalysisResult with breakdown
- Pass type-check

**Wave 3:** Each generator must:
- Accept typed AnalysisResult input
- Return valid HTML string
- Match RPI design system (navy #1a3a5c, print-optimized, letter size)
- Render correctly in browser
- Print cleanly to PDF

**Wave 4:** Each wire must:
- Chain super tools in documented sequence
- Accept household_id as entry point
- Return final output status
- Each process doc must follow CASEWORK-PROCESS-GMIB-TO-LIFE.md pattern exactly

**Wave 5:** Pipeline integration must:
- Add execution_type to flow config
- Register QUE_SESSION_COMPLETE handler
- Type-check 13/13 passing
- FORGE items updated to `built`

---

## Files Created by This Plan

```
packages/core/src/que/
├── tools/                          ← DONE (Wave 1 — 45 files, 3,044 lines)
│   ├── calc-*.ts (25)
│   ├── lookup-*.ts (8)
│   ├── data/ (9 files)
│   ├── types.ts
│   └── index.ts
├── super-tools/                    ← Wave 2 (NEW)
│   ├── types.ts
│   ├── analyze-income-now.ts
│   ├── analyze-income-later.ts
│   ├── analyze-estate.ts
│   ├── analyze-growth.ts
│   ├── analyze-ltc.ts
│   ├── analyze-roth.ts
│   ├── analyze-tax-harvest.ts
│   ├── analyze-mge.ts
│   ├── generate-casework.ts
│   ├── assemble-output.ts
│   └── index.ts
├── generators/                     ← Wave 3 (NEW)
│   ├── types.ts
│   ├── generate-summary-html.ts
│   ├── generate-detail-html.ts
│   ├── generate-ai3-pdf.ts
│   ├── generate-meeting-prep.ts
│   ├── generate-factfinder.ts
│   ├── templates/
│   │   ├── income-now-summary.ts
│   │   ├── income-now-detail.ts
│   │   ├── income-later-summary.ts
│   │   ├── income-later-detail.ts
│   │   ├── estate-max-summary.ts
│   │   ├── estate-max-detail.ts
│   │   ├── growth-max-summary.ts
│   │   ├── growth-max-detail.ts
│   │   ├── ltc-max-summary.ts
│   │   ├── ltc-max-detail.ts
│   │   ├── mge-detailed-summary.ts
│   │   ├── mge-detailed-detail.ts
│   │   ├── roth-conversion-summary.ts
│   │   ├── roth-conversion-detail.ts
│   │   ├── tax-harvesting-summary.ts
│   │   └── tax-harvesting-detail.ts
│   └── index.ts
├── wires/                          ← Wave 4 (NEW)
│   ├── types.ts
│   ├── wire-income-now.ts
│   ├── wire-income-later.ts
│   ├── wire-estate-max.ts
│   ├── wire-growth-max.ts
│   ├── wire-ltc-max.ts
│   ├── wire-roth-conversion.ts
│   ├── wire-tax-harvest.ts
│   ├── wire-mge-detailed.ts
│   ├── wire-review-meeting.ts
│   ├── wire-assemble-b4.ts
│   └── index.ts
├── registry.ts                     ← Wave 4 (NEW — 59 QUE tool registrations)
└── index.ts                        ← UPDATE (re-export super-tools, generators, wires)

_RPI_STANDARDS/reference/collateral/     ← Wave 4 (Process docs)
├── CASEWORK-PROCESS-INCOME-NOW.md                     (TRK-13404)
├── CASEWORK-PROCESS-ESTATE-MAX.md                     (TRK-13405)
├── CASEWORK-PROCESS-GROWTH-MAX.md                     (TRK-13406)
├── CASEWORK-PROCESS-LTC-MAX.md                        (TRK-13407)
├── CASEWORK-PROCESS-TAX-HARVEST.md                    (TRK-13408)
└── CASEWORK-PROCESS-ROTH.md                           (TRK-13409 — BLOCKED)
```

**Estimated total new files: ~55**
**Estimated total new lines: ~4,000-5,000**

---

## Summary

| Wave | Items | Status | Dependencies |
|------|-------|--------|-------------|
| **Wave 1** | 33 (TRK-13345–13377) | **BUILT** | None |
| **Wave 2a** | 8 (TRK-13383–13390) | Planned | Wave 1 (done) |
| **Wave 3** | 21 (TRK-13378–13382, 13410–13425) | Planned | Wave 1 (done) + existing template patterns |
| **Wave 2b** | 2 (TRK-13391–13392) | Planned | Wave 2a + Wave 3 |
| **Wave 4** | 17 (TRK-13393–13402, 13404–13409, 13429) | Planned | Waves 2a+2b+3 |
| **Wave 5** | 7 (TRK-13403, 13426–13428, 13430–13432) | Planned | Waves 2-4 |
| **BLOCKED** | 1 (TRK-13409) | Blocked | ROTH source template empty |
| **DEFERRED IF NOT FOUND** | 1 (TRK-13382) | Conditional | TRK-13430 (factfinder locate) |
| **TOTAL** | **88** | **33 built, 54 planned, 1 blocked, 1 conditional** | |
