/**
 * QUE Tool Registry (TRK-13429)
 *
 * Registers all QUE tools, super tools, and wires per ATLAS pattern.
 * 59 registry entries: 25 calc + 8 lookup + 5 generators + 8 ANALYZE_* +
 * GENERATE_CASEWORK + ASSEMBLE_OUTPUT + 10 wires
 */

export interface QueRegistryEntry {
  id: string
  type: 'TOOL' | 'SUPER_TOOL' | 'WIRE'
  domain: 'que'
  name: string
  description: string
  /** Calc tools used (for super tools/wires) */
  composedOf?: string[]
}

export const QUE_REGISTRY: QueRegistryEntry[] = [
  // =============================================
  // CALC TOOLS (25)
  // =============================================
  { id: 'calc-rmd', type: 'TOOL', domain: 'que', name: 'RMD Calculator', description: 'Required Minimum Distribution: Prior Year Value / IRS Factor' },
  { id: 'calc-gmib', type: 'TOOL', domain: 'que', name: 'GMIB Calculator', description: 'Guaranteed income: Benefit Base x Payout Rate' },
  { id: 'calc-rollup', type: 'TOOL', domain: 'que', name: 'Rollup Projection', description: 'Benefit base growth (simple or compound)' },
  { id: 'calc-surrender-charge', type: 'TOOL', domain: 'que', name: 'Surrender Charge', description: 'Cost to exit: AV x Charge% - Free Withdrawal' },
  { id: 'calc-ltcg', type: 'TOOL', domain: 'que', name: 'LTCG Tax', description: 'Long-term capital gains: (MV - Basis) x Rate' },
  { id: 'calc-bonus-offset', type: 'TOOL', domain: 'que', name: 'Bonus Offset', description: 'Net cost after carrier bonus on consolidation' },
  { id: 'calc-provisional-income', type: 'TOOL', domain: 'que', name: 'Provisional Income', description: 'IRS formula for SS taxation threshold' },
  { id: 'calc-ss-taxation', type: 'TOOL', domain: 'que', name: 'SS Taxation', description: 'How much SS is taxable (0%/50%/85%)' },
  { id: 'calc-federal-tax', type: 'TOOL', domain: 'que', name: 'Federal Tax', description: '2025 marginal bracket calculation' },
  { id: 'calc-state-tax', type: 'TOOL', domain: 'que', name: 'State Tax', description: 'State income tax with retirement exemptions' },
  { id: 'calc-irmaa', type: 'TOOL', domain: 'que', name: 'IRMAA Calculator', description: 'Medicare premium surcharge by MAGI tier' },
  { id: 'calc-ss-earnings-limit', type: 'TOOL', domain: 'que', name: 'SS Earnings Limit', description: 'Pre-FRA earnings impact on SS benefits' },
  { id: 'calc-income-multiplier', type: 'TOOL', domain: 'que', name: 'Income Multiplier', description: 'Life insurance needs by age bracket' },
  { id: 'calc-college-funding', type: 'TOOL', domain: 'que', name: 'College Funding', description: 'Future cost of college with inflation' },
  { id: 'calc-net-outlay', type: 'TOOL', domain: 'que', name: 'Net Outlay', description: 'True cost of life insurance (premium - CV)' },
  { id: 'calc-breakeven-equity', type: 'TOOL', domain: 'que', name: 'Breakeven Equity', description: 'Return needed to sustain withdrawals' },
  { id: 'calc-mva', type: 'TOOL', domain: 'que', name: 'MVA Calculator', description: 'Hidden market value adjustment decomposition' },
  { id: 'calc-mgsv', type: 'TOOL', domain: 'que', name: 'MGSV Calculator', description: 'Minimum guaranteed surrender value floor' },
  { id: 'calc-va-depletion', type: 'TOOL', domain: 'que', name: 'VA Depletion', description: 'Year-by-year VA burn rate projection' },
  { id: 'calc-fia-projection', type: 'TOOL', domain: 'que', name: 'FIA Projection', description: 'Year-by-year FIA growth with bonus' },
  { id: 'calc-delta', type: 'TOOL', domain: 'que', name: 'Delta Comparison', description: 'Year-by-year proposed vs current advantage' },
  { id: 'calc-lot-selection', type: 'TOOL', domain: 'que', name: 'Lot Selection', description: 'Optimal tax lot liquidation order' },
  { id: 'calc-ltc-phase-access', type: 'TOOL', domain: 'que', name: 'LTC Phase Access', description: '4-Phase LTC framework mapping' },
  { id: 'calc-household-aggregate', type: 'TOOL', domain: 'que', name: 'Household Aggregate', description: 'Combined household financials' },
  { id: 'calc-effective-tax-rate', type: 'TOOL', domain: 'que', name: 'Effective Tax Rate', description: 'Combined federal + state efficiency' },

  // =============================================
  // LOOKUP TOOLS (8)
  // =============================================
  { id: 'lookup-irs-factor', type: 'TOOL', domain: 'que', name: 'IRS Factor Lookup', description: 'Uniform Lifetime Table divisor by age' },
  { id: 'lookup-carrier-product', type: 'TOOL', domain: 'que', name: 'Carrier Product Lookup', description: 'Product specs, rates, features' },
  { id: 'lookup-index-rate', type: 'TOOL', domain: 'que', name: 'Index Rate Lookup', description: 'FIA index/crediting method/cap/par rate' },
  { id: 'lookup-surrender-schedule', type: 'TOOL', domain: 'que', name: 'Surrender Schedule Lookup', description: 'Surrender charge % by carrier/product/year' },
  { id: 'lookup-fyc-rate', type: 'TOOL', domain: 'que', name: 'FYC Rate Lookup', description: 'First-year commission target/excess by carrier' },
  { id: 'lookup-tax-bracket', type: 'TOOL', domain: 'que', name: 'Tax Bracket Lookup', description: 'Federal + state by filing status + income' },
  { id: 'lookup-irmaa-bracket', type: 'TOOL', domain: 'que', name: 'IRMAA Bracket Lookup', description: 'Part B + D surcharge by MAGI tier' },
  { id: 'lookup-community-property', type: 'TOOL', domain: 'que', name: 'Community Property Lookup', description: 'States requiring spousal signatures' },

  // =============================================
  // GENERATORS (5)
  // =============================================
  { id: 'generate-summary-html', type: 'TOOL', domain: 'que', name: 'Summary HTML Generator', description: 'Tier 1 one-pager per casework type' },
  { id: 'generate-detail-html', type: 'TOOL', domain: 'que', name: 'Detail HTML Generator', description: 'Tier 2/3 year-by-year per casework type' },
  { id: 'generate-ai3-pdf', type: 'TOOL', domain: 'que', name: 'AI3 PDF Generator', description: 'Client-facing AI3 from household data' },
  { id: 'generate-meeting-prep', type: 'TOOL', domain: 'que', name: 'Meeting Prep Generator', description: '3-page meeting agenda with talk tracks' },
  { id: 'generate-factfinder', type: 'TOOL', domain: 'que', name: 'Factfinder Generator', description: 'Pre-filled application package' },

  // =============================================
  // SUPER TOOLS (10)
  // =============================================
  { id: 'ANALYZE_INCOME_NOW', type: 'SUPER_TOOL', domain: 'que', name: 'Analyze Income Now', description: 'Dormant income rider activation analysis', composedOf: ['calc-household-aggregate', 'calc-gmib', 'calc-rmd', 'calc-breakeven-equity'] },
  { id: 'ANALYZE_INCOME_LATER', type: 'SUPER_TOOL', domain: 'que', name: 'Analyze Income Later', description: 'Deferred rollup growth strategy', composedOf: ['calc-rollup', 'calc-gmib', 'calc-provisional-income', 'calc-federal-tax'] },
  { id: 'ANALYZE_ESTATE', type: 'SUPER_TOOL', domain: 'que', name: 'Analyze Estate', description: 'Lapse detection + survivor needs', composedOf: ['calc-va-depletion', 'calc-income-multiplier', 'calc-college-funding', 'lookup-fyc-rate'] },
  { id: 'ANALYZE_GROWTH', type: 'SUPER_TOOL', domain: 'que', name: 'Analyze Growth', description: 'VA vs FIA sustainability comparison', composedOf: ['calc-va-depletion', 'calc-fia-projection', 'calc-delta', 'calc-surrender-charge', 'calc-ltcg', 'calc-bonus-offset'] },
  { id: 'ANALYZE_LTC', type: 'SUPER_TOOL', domain: 'que', name: 'Analyze LTC', description: '4-Phase LTC access framework mapping', composedOf: ['calc-ltc-phase-access', 'calc-gmib', 'calc-mgsv', 'lookup-carrier-product'] },
  { id: 'ANALYZE_ROTH', type: 'SUPER_TOOL', domain: 'que', name: 'Analyze Roth', description: 'Roth conversion bracket/IRMAA modeling', composedOf: ['calc-provisional-income', 'calc-ss-taxation', 'calc-federal-tax', 'calc-irmaa'] },
  { id: 'ANALYZE_TAX_HARVEST', type: 'SUPER_TOOL', domain: 'que', name: 'Analyze Tax Harvest', description: 'Optimal lot selection for NQ liquidation', composedOf: ['calc-lot-selection', 'calc-ltcg', 'calc-ss-earnings-limit', 'calc-provisional-income'] },
  { id: 'ANALYZE_MGE', type: 'SUPER_TOOL', domain: 'que', name: 'Analyze MGE', description: 'Master gateway — runs all 7 ANALYZE_*', composedOf: ['calc-household-aggregate', 'ANALYZE_INCOME_NOW', 'ANALYZE_INCOME_LATER', 'ANALYZE_ESTATE', 'ANALYZE_GROWTH', 'ANALYZE_LTC', 'ANALYZE_ROTH', 'ANALYZE_TAX_HARVEST'] },
  { id: 'GENERATE_CASEWORK', type: 'SUPER_TOOL', domain: 'que', name: 'Generate Casework', description: 'Summary + Detail HTML per applicable type', composedOf: ['generate-summary-html', 'generate-detail-html'] },
  { id: 'ASSEMBLE_OUTPUT', type: 'SUPER_TOOL', domain: 'que', name: 'Assemble Output', description: 'All 5 Yellow Stage outputs into ACF B4', composedOf: ['generate-ai3-pdf', 'generate-factfinder'] },

  // =============================================
  // WIRES (10)
  // =============================================
  { id: 'WIRE_INCOME_NOW', type: 'WIRE', domain: 'que', name: 'Income Now Wire', description: 'ANALYZE_INCOME_NOW → GENERATE_CASEWORK', composedOf: ['ANALYZE_INCOME_NOW', 'GENERATE_CASEWORK'] },
  { id: 'WIRE_INCOME_LATER', type: 'WIRE', domain: 'que', name: 'Income Later Wire', description: 'ANALYZE_INCOME_LATER → GENERATE_CASEWORK', composedOf: ['ANALYZE_INCOME_LATER', 'GENERATE_CASEWORK'] },
  { id: 'WIRE_ESTATE_MAX', type: 'WIRE', domain: 'que', name: 'Estate Max Wire', description: 'ANALYZE_ESTATE → GENERATE_CASEWORK', composedOf: ['ANALYZE_ESTATE', 'GENERATE_CASEWORK'] },
  { id: 'WIRE_GROWTH_MAX', type: 'WIRE', domain: 'que', name: 'Growth Max Wire', description: 'ANALYZE_GROWTH → GENERATE_CASEWORK', composedOf: ['ANALYZE_GROWTH', 'GENERATE_CASEWORK'] },
  { id: 'WIRE_LTC_MAX', type: 'WIRE', domain: 'que', name: 'LTC Max Wire', description: 'ANALYZE_LTC → GENERATE_CASEWORK', composedOf: ['ANALYZE_LTC', 'GENERATE_CASEWORK'] },
  { id: 'WIRE_ROTH_CONVERSION', type: 'WIRE', domain: 'que', name: 'Roth Conversion Wire', description: 'ANALYZE_ROTH → GENERATE_CASEWORK', composedOf: ['ANALYZE_ROTH', 'GENERATE_CASEWORK'] },
  { id: 'WIRE_TAX_HARVEST', type: 'WIRE', domain: 'que', name: 'Tax Harvest Wire', description: 'ANALYZE_TAX_HARVEST → GENERATE_CASEWORK', composedOf: ['ANALYZE_TAX_HARVEST', 'GENERATE_CASEWORK'] },
  { id: 'WIRE_MGE_DETAILED', type: 'WIRE', domain: 'que', name: 'MGE Detailed Wire', description: 'ANALYZE_MGE → GENERATE_CASEWORK (all types)', composedOf: ['ANALYZE_MGE', 'GENERATE_CASEWORK'] },
  { id: 'WIRE_REVIEW_MEETING', type: 'WIRE', domain: 'que', name: 'Review Meeting Wire', description: 'ANALYZE_MGE → generate-meeting-prep → file-to-acf', composedOf: ['ANALYZE_MGE', 'generate-meeting-prep'] },
  { id: 'WIRE_ASSEMBLE_B4', type: 'WIRE', domain: 'que', name: 'Assemble B4 Wire', description: 'ASSEMBLE_OUTPUT — package all 5 outputs', composedOf: ['ASSEMBLE_OUTPUT'] },
]

/** Look up a QUE registry entry by ID */
export function getQueRegistryEntry(id: string): QueRegistryEntry | undefined {
  return QUE_REGISTRY.find((e) => e.id === id)
}

/** Get all entries of a given type */
export function getQueRegistryByType(type: 'TOOL' | 'SUPER_TOOL' | 'WIRE'): QueRegistryEntry[] {
  return QUE_REGISTRY.filter((e) => e.type === type)
}
