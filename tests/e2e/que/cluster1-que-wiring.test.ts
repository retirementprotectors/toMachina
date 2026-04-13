/**
 * Cluster 1: QUE Wiring — 12 Tests
 *
 * Pure Vitest tests — direct function imports, no API, no Firestore, synchronous.
 * All QUE wires are pure TypeScript functions.
 *
 * Config: vitest.pure.config.ts (tests/e2e/{que,types}/**\/*.test.ts)
 */

import { describe, it, expect, vi } from 'vitest'

// Mock the securities disclosure gate for tests — the gate throws in prod
// when no active BD affiliation is set (intentional — see disclosures.ts).
// Tests need to exercise the generators, so we stub the disclosure getters
// with fixture strings. The gate is tested by its own unit (not here).
vi.mock('../../../packages/core/src/que/generators/disclosures', () => ({
  ACTIVE_BD_AFFILIATION: null,
  getSecuritiesDisclosure: () =>
    'TEST DISCLOSURE — fixture string used in Cluster 1 tests only.',
  getTaxHarvestingDisclosure: () =>
    'TEST DISCLOSURE — fixture string used in Cluster 1 tests only.',
  getPortfolioAdvisoryDisclosure: () =>
    'TEST DISCLOSURE — fixture string used in Cluster 1 tests only.',
}))

// Super tools
import { analyzeIncomeNow } from '../../../packages/core/src/que/super-tools/analyze-income-now'
import { analyzeIncomeLater } from '../../../packages/core/src/que/super-tools/analyze-income-later'
import { analyzeEstate } from '../../../packages/core/src/que/super-tools/analyze-estate'
import { analyzeGrowth } from '../../../packages/core/src/que/super-tools/analyze-growth'
import { analyzeLtc } from '../../../packages/core/src/que/super-tools/analyze-ltc'
import { analyzeRoth } from '../../../packages/core/src/que/super-tools/analyze-roth'
import { analyzeTaxHarvest } from '../../../packages/core/src/que/super-tools/analyze-tax-harvest'
import { analyzeMge } from '../../../packages/core/src/que/super-tools/analyze-mge'
import { generateCasework } from '../../../packages/core/src/que/super-tools/generate-casework'

// Wires
import { wireIncomeNow } from '../../../packages/core/src/que/wires/wire-income-now'
import { wireAssembleB4 } from '../../../packages/core/src/que/wires/wire-assemble-b4'
import { wireMgeDetailed } from '../../../packages/core/src/que/wires/wire-mge-detailed'

// Pipeline Studio config
import {
  YELLOW_STAGE_PIPELINE,
  CASEWORK_TYPE_TO_WIRE,
  isQueSessionComplete,
} from '../../../packages/core/src/que/pipeline-studio-config'

// Test fixtures
import {
  buildBaseHousehold,
  withDormantRiders,
  withRollup,
  withLifePolicies,
  withVaAccounts,
  withLtcFeatures,
  withIraAccounts,
  withNqAccounts,
  withAllTriggers,
} from '../helpers/que-fixtures'

describe('Cluster 1: QUE Wiring', () => {
  // ── TRK-13625: ANALYZE_INCOME_NOW ──────────────────────────────────────

  it('TRK-13625: analyzeIncomeNow detects dormant riders and returns income_now findings', () => {
    const household = withDormantRiders(buildBaseHousehold())
    const result = analyzeIncomeNow(household)

    expect(result.success).toBe(true)
    expect(result.result.type).toBe('income_now')
    expect(result.result.applicable).toBe(true)
    expect(result.toolsUsed).toContain('calc-gmib')
    expect(result.toolsUsed).toContain('calc-household-aggregate')
    expect(result.result.findings.length).toBeGreaterThan(0)
  })

  // ── TRK-13611: ANALYZE_INCOME_LATER ────────────────────────────────────

  it('TRK-13611: analyzeIncomeLater models rollup deferral advantage', () => {
    const household = withRollup(buildBaseHousehold())
    const result = analyzeIncomeLater(household)

    expect(result.success).toBe(true)
    expect(result.result.type).toBe('income_later')
    expect(result.result.applicable).toBe(true)
  })

  // ── TRK-13614: ANALYZE_ESTATE ──────────────────────────────────────────

  it('TRK-13614: analyzeEstate detects life policies and estate opportunities', () => {
    const household = withLifePolicies(buildBaseHousehold())
    const result = analyzeEstate(household)

    expect(result.success).toBe(true)
    expect(result.result.type).toBe('estate_max')
    expect(result.result.applicable).toBe(true)
  })

  // ── TRK-13619: ANALYZE_GROWTH ──────────────────────────────────────────

  it('TRK-13619: analyzeGrowth evaluates VA consolidation opportunities', () => {
    const household = withVaAccounts(buildBaseHousehold())
    const result = analyzeGrowth(household)

    expect(result.success).toBe(true)
    expect(result.result.type).toBe('growth_max')
    expect(result.result.applicable).toBe(true)
  })

  // ── TRK-13604: ANALYZE_LTC ────────────────────────────────────────────

  it('TRK-13604: analyzeLtc maps LTC features to 4-Phase Access Framework', () => {
    const household = withLtcFeatures(buildBaseHousehold())
    const result = analyzeLtc(household)

    expect(result.success).toBe(true)
    expect(result.result.type).toBe('ltc_max')
    expect(result.result.applicable).toBe(true)
  })

  // ── TRK-13641: ANALYZE_ROTH ───────────────────────────────────────────

  it('TRK-13641: analyzeRoth models Roth conversion tax impact', () => {
    const household = withIraAccounts(buildBaseHousehold())
    const result = analyzeRoth(household)

    expect(result.success).toBe(true)
    expect(result.result.type).toBe('roth_conversion')
    expect(result.result.applicable).toBe(true)
  })

  // ── TRK-13605: ANALYZE_TAX_HARVEST ────────────────────────────────────

  it('TRK-13605: analyzeTaxHarvest identifies NQ tax-loss harvesting opportunities', () => {
    const household = withNqAccounts(buildBaseHousehold())
    const result = analyzeTaxHarvest(household)

    expect(result.success).toBe(true)
    expect(result.result.type).toBe('tax_harvesting')
    expect(result.result.applicable).toBe(true)
  })

  // ── TRK-13601: ANALYZE_MGE orchestrator ───────────────────────────────

  it('TRK-13601: analyzeMge orchestrates all applicable analyses for full household', () => {
    const household = withAllTriggers(buildBaseHousehold())
    const result = analyzeMge(household)

    expect(result.success).toBe(true)
    // At least some types detected (exact count depends on trigger logic)
    expect(result.applicableTypes.length).toBeGreaterThanOrEqual(3)
    // One analysis per applicable type
    expect(result.analyses.length).toBe(result.applicableTypes.length)
    // Every analysis marked applicable
    for (const analysis of result.analyses) {
      expect(analysis.applicable).toBe(true)
    }
  })

  // ── TRK-13634: GENERATE_CASEWORK ─────────────────────────────────────

  it('TRK-13634: generateCasework produces HTML outputs for all applicable analyses', () => {
    const household = withAllTriggers(buildBaseHousehold())
    const mge = analyzeMge(household)
    const result = generateCasework(mge.analyses, household, 'E2E Test', '2026-03-22')

    expect(result.success).toBe(true)
    expect(result.outputs.length).toBeGreaterThan(0)
    // Every output has non-empty HTML
    for (const output of result.outputs) {
      expect(output.summaryHtml).toBeTruthy()
      expect(output.detailHtml).toBeTruthy()
    }
    expect(result.totalOutputs).toBe(result.outputs.length)
  })

  // ── TRK-13617: ASSEMBLE_OUTPUT ────────────────────────────────────────

  it('TRK-13617: wireAssembleB4 packages all outputs into B4 document set', () => {
    const household = withAllTriggers(buildBaseHousehold())
    const mge = analyzeMge(household)
    const casework = generateCasework(mge.analyses, household, 'E2E Test', '2026-03-22')

    const result = wireAssembleB4({
      household,
      preparedBy: 'E2E Test',
      preparedDate: '2026-03-22',
      analyses: mge.analyses,
      caseworkOutputs: casework.outputs,
    })

    expect(result.success).toBe(true)
    expect(result.wire).toBe('WIRE_ASSEMBLE_B4')
    // At least ai3 + reports + illustrations + factfinder + some casework
    expect(result.summary.totalDocuments).toBeGreaterThanOrEqual(3)
    expect(result.summary.output1_ai3).toBe(true)
    expect(result.summary.output5_factfinder).toBe(true)
    expect(result.summary.output4_casework).toBeGreaterThan(0)
  })

  // ── TRK-13644: QUE_SESSION_COMPLETE gate ──────────────────────────────

  it('TRK-13644: isQueSessionComplete gates on wire completion and CASEWORK_TYPE_TO_WIRE maps 8 types', () => {
    // Partial wires -> incomplete
    expect(
      isQueSessionComplete({
        householdId: 'test',
        completedWires: ['WIRE_INCOME_NOW'],
        requiredWires: ['WIRE_INCOME_NOW', 'WIRE_ESTATE_MAX'],
      })
    ).toBe(false)

    // All wires -> complete
    expect(
      isQueSessionComplete({
        householdId: 'test',
        completedWires: ['WIRE_INCOME_NOW', 'WIRE_ESTATE_MAX'],
        requiredWires: ['WIRE_INCOME_NOW', 'WIRE_ESTATE_MAX'],
      })
    ).toBe(true)

    // Empty required -> complete (vacuous truth)
    expect(
      isQueSessionComplete({
        householdId: 'test',
        completedWires: [],
        requiredWires: [],
      })
    ).toBe(true)

    // CASEWORK_TYPE_TO_WIRE has exactly 8 entries
    const wireKeys = Object.keys(CASEWORK_TYPE_TO_WIRE)
    expect(wireKeys).toHaveLength(8)
    expect(wireKeys).toContain('income_now')
    expect(wireKeys).toContain('income_later')
    expect(wireKeys).toContain('estate_max')
    expect(wireKeys).toContain('growth_max')
    expect(wireKeys).toContain('ltc_max')
    expect(wireKeys).toContain('roth_conversion')
    expect(wireKeys).toContain('tax_harvesting')
    expect(wireKeys).toContain('mge_detailed')
  })

  // ── TRK-13646: Pipeline Studio QUE source selection ───────────────────

  it('TRK-13646: YELLOW_STAGE_PIPELINE defines 4 stages with correct wire assignments', () => {
    // 4 stages
    expect(YELLOW_STAGE_PIPELINE).toHaveLength(4)

    // Stages in order
    const [stage1, stage2, stage3, stage4] = YELLOW_STAGE_PIPELINE
    expect(stage1.name).toBe('Analysis')
    expect(stage1.order).toBe(1)
    expect(stage2.name).toBe('Case Building')
    expect(stage2.order).toBe(2)
    expect(stage3.name).toBe('Package Assembly')
    expect(stage3.order).toBe(3)
    expect(stage4.name).toBe('Case Ready')
    expect(stage4.order).toBe(4)

    // Wire assignments
    expect(stage1.wire).toBe('WIRE_MGE_DETAILED')
    expect(stage2.wire).toBe('APPLICABLE_WIRES') // dynamic
    expect(stage3.wire).toBe('WIRE_ASSEMBLE_B4')
    expect(stage4.wire).toBeUndefined() // manual — no wire

    // All CASEWORK_TYPE_TO_WIRE values are valid wire identifiers (WIRE_*)
    const wireValues = Object.values(CASEWORK_TYPE_TO_WIRE)
    for (const wire of wireValues) {
      expect(wire).toMatch(/^WIRE_/)
    }
  })
})
