// ---------------------------------------------------------------------------
// WIRE_FARMLAND_VALUE_SEED — annual farmland valuation cache seeder.
//
// Sprint: SPR-FARMLAND-VALUATION-001 (FV-005)
// ZRD: ZRD-PLATFORM-FARMLAND-VALUATION-API
//
// Runs annually on Jan 15 @ 06:00 UTC (Cloud Scheduler
// `farmland-value-seed-annual`), or on manual trigger for Gate A
// pre-release seeding. Populates the `farmland_values` Firestore
// collection with ISU Extension (Iowa, 99 counties × 3 tiers) +
// USDA NASS (national county-year AG_LAND) rows that SUPER_FARMLAND_
// VALUATION reads cache-first.
//
// Stages (per disco Tab 3)
//   FETCH_ISU_PDF     — three-tier fetch (MEGAZORD GAP 1)
//   PARSE_ISU         — 99 × 3 row extraction (bundled with fetch in
//                       isu-land-value-parse atomic tool)
//   WRITE_ISU_ROWS    — batched upsert by composite id
//   FETCH_NASS_IOWA   — STUB until FV-002 lands (NASS atomic tool +
//                       GSM-held API key); noop today
//   WRITE_NASS_ROWS   — STUB; noop today
//   NOTIFY_MEGAZORD   — Slack post with row count + any missing-
//                       counties warnings from the parser (drift
//                       signal)
//
// The "ISU-only as first-class state" pattern (from FV-004) carries
// through: the wire ships with NASS stages present but inert, then
// transparently upgrades when FV-002 wires in the live NASS lookup —
// zero rewrite needed at this wire's metadata layer.
//
// This file is DEFINITION-ONLY. The actual execution handler lives in
// `services/api/src/routes/valuation.ts` (authorized write surface for
// farmland_values). MEGAZORD's directive points cron at
// /api/wire/execute; until the super-tool-based executor is extended
// to dispatch non-super-tool wires, the interim execution path is
// POST /api/valuation/seed (same work, different URL) — tracked as
// ZRD-ATLAS-WIRE-EXECUTOR-CUSTOM-STAGES for unification later.
// ---------------------------------------------------------------------------

import type { WireDefinitionV2 } from '../types'

export const WIRE_FARMLAND_VALUE_SEED: WireDefinitionV2 = {
  wire_id: 'WIRE_FARMLAND_VALUE_SEED',
  name: 'Farmland Value Seed (Annual)',
  description:
    'Annual cache seeder for farmland_values. Fetches + parses the ISU Extension Iowa Land Value Survey PDF (99 counties × 3 tiers = 297 rows) and the USDA NASS county-year AG_LAND values (national). Feeds SUPER_FARMLAND_VALUATION cache-first reads. Runs Jan 15 @ 06:00 UTC via Cloud Scheduler farmland-value-seed-annual.',
  product_lines: ['ALL'],
  data_domains: ['VALUATION'],
  super_tools: [
    // Not a traditional super-tool chain — the wire runs a bespoke
    // fetch + parse + upsert + notify sequence. Tool-layer composition
    // is documented below via stages[]. Listed here empty to satisfy
    // the WireDefinitionV2 shape; the executor dispatch upgrade is the
    // follow-up ZRD-ATLAS-WIRE-EXECUTOR-CUSTOM-STAGES.
  ],
  stages: [
    {
      type: 'SCRIPT',
      name: 'FETCH_ISU_PDF',
      project: 'packages/core',
      file: 'atlas/tools/isu-land-value-parse.ts',
      detail:
        'Three-tier fetch (MEGAZORD GAP 1): pattern URL → index scrape → fail-loud with index-page body. No silent prior-year fallback.',
    },
    {
      type: 'SCRIPT',
      name: 'PARSE_ISU',
      project: 'packages/core',
      file: 'atlas/tools/isu-land-value-parse.ts',
      detail:
        'Tolerant regex parse of 99 Iowa counties × 3 tiers (HIGH/MEDIUM/LOW). Emits warnings for partial rows, dupes, and — critically — the full missing-counties list so the next cron run detects ISU PDF layout drift.',
    },
    {
      type: 'API_ENDPOINT',
      name: 'WRITE_ISU_ROWS',
      project: 'services/api',
      file: 'routes/valuation.ts',
      detail:
        'Batched upsert into farmland_values by composite id ISU_{state}_{county}_{year}_{tier}. Runs through the writeThroughBridge helper (authorized path).',
    },
    {
      type: 'SCRIPT',
      name: 'FETCH_NASS_IOWA',
      project: 'packages/core',
      file: 'atlas/tools/nass-lookup.ts',
      detail:
        'STUB — no-op until FV-002 atomic tool lands with GSM-held NASS_QUICK_STATS_KEY. Queries USDA Quick Stats for Iowa county-year AG_LAND value/acre.',
    },
    {
      type: 'API_ENDPOINT',
      name: 'WRITE_NASS_ROWS',
      project: 'services/api',
      file: 'routes/valuation.ts',
      detail:
        'STUB — no-op. Once FV-002 lands, upserts NASS rows under composite id NASS_{state}_{county}_{year}. SUPER_FARMLAND_VALUATION automatically upgrades responses from ISU_EXTENSION (MEDIUM cap) to ENSEMBLE_ISU_NASS (HIGH on agreement) with zero super-tool code changes.',
    },
    {
      type: 'NOTIFICATION',
      name: 'NOTIFY_MEGAZORD',
      project: 'services/api',
      detail:
        'Slack post to #megazord with: ISU rows seeded, counties parsed vs expected (99), NASS stub status, any parser warnings (partial rows / missing counties = drift signal). Non-blocking — delivery failure does not fail the wire.',
    },
  ],
}
