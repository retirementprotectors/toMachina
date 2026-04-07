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
  // =============================================
  // LIFE & ESTATE EXPANSION — CALC TOOLS (8)
  // =============================================
  { id: 'calc-income-need', type: 'TOOL', domain: 'que', name: 'Income Need Calculator', description: 'Calculates survivor income replacement need over specified years with inflation' },
  { id: 'calc-debt-need', type: 'TOOL', domain: 'que', name: 'Debt Need Calculator', description: 'Sums all outstanding debts that would need to be covered at death' },
  { id: 'calc-misc-cash-need', type: 'TOOL', domain: 'que', name: 'Miscellaneous Cash Need', description: 'Funeral costs, emergency fund, and other immediate cash needs' },
  { id: 'calc-survivor-cash-need', type: 'TOOL', domain: 'que', name: 'Survivor Cash Need', description: 'Total immediate cash needed at death: debts, funeral, emergency, final expenses' },
  { id: 'calc-survivor-income-need', type: 'TOOL', domain: 'que', name: 'Survivor Income Need', description: 'Ongoing income gap between survivor expenses and income sources' },
  { id: 'calc-existing-coverage-offset', type: 'TOOL', domain: 'que', name: 'Existing Coverage Offset', description: 'Total existing life coverage from group, individual, and asset sources' },
  { id: 'calc-total-life-need', type: 'TOOL', domain: 'que', name: 'Total Life Need Calculator', description: 'Master calculation: all needs minus existing coverage equals face amount target' },
  { id: 'calc-1035-exchange', type: 'TOOL', domain: 'que', name: '1035 Exchange Calculator', description: 'Tax-free insurance transfer: old CSV to new product with basis carryover' },

  // =============================================
  // LIFE & ESTATE EXPANSION — LOOKUP TOOLS (5)
  // =============================================
  { id: 'lookup-group-portability', type: 'TOOL', domain: 'que', name: 'Group Portability Lookup', description: 'Conversion windows and rate multipliers for employer group life' },
  { id: 'lookup-health-rating-map', type: 'TOOL', domain: 'que', name: 'Health Rating Map', description: 'Maps health conditions to underwriting rate classes' },
  { id: 'lookup-paramed-requirements', type: 'TOOL', domain: 'que', name: 'Paramed Requirements', description: 'Medical exam requirements based on face amount thresholds' },
  { id: 'lookup-life-rate', type: 'TOOL', domain: 'que', name: 'Life Rate Lookup', description: 'Premium lookup by product type, health class, age, and face amount' },
  { id: 'lookup-life-carrier-product', type: 'TOOL', domain: 'que', name: 'Life Carrier Product Lookup', description: 'Carrier product specs: term, UL, IUL, whole life offerings' },

  // =============================================
  // LIFE & ESTATE EXPANSION — SUPER TOOLS (4)
  // =============================================
  { id: 'ANALYZE_GROUP_GAP', type: 'SUPER_TOOL', domain: 'que', name: 'Group Gap Analysis', description: 'Assesses employer group coverage gap and portability risk', composedOf: ['lookup-group-portability', 'calc-existing-coverage-offset', 'calc-total-life-need'] },
  { id: 'ANALYZE_LIFE_NEED', type: 'SUPER_TOOL', domain: 'que', name: 'Life Needs Analysis', description: 'Complete life insurance needs calculation with face amount targets', composedOf: ['calc-income-need', 'calc-debt-need', 'calc-college-funding', 'calc-misc-cash-need', 'calc-existing-coverage-offset', 'calc-survivor-cash-need', 'calc-survivor-income-need', 'calc-total-life-need'] },
  { id: 'ANALYZE_UNDERWRITING_PATH', type: 'SUPER_TOOL', domain: 'que', name: 'Underwriting Path Analysis', description: 'Health to rate class to exam requirements to price impact', composedOf: ['lookup-health-rating-map', 'lookup-paramed-requirements', 'lookup-life-rate'] },
  { id: 'ANALYZE_LIFE_OPTIONS', type: 'SUPER_TOOL', domain: 'que', name: 'Life Options Analysis', description: 'Three-option comparison: final expenses, income replacement, Swiss-Army IUL', composedOf: ['calc-total-life-need', 'lookup-life-carrier-product', 'lookup-life-rate', 'calc-net-outlay'] },

  // =============================================
  // LIFE & ESTATE EXPANSION — WIRES (4)
  // =============================================
  { id: 'WIRE_LIFE_DISCOVERY', type: 'WIRE', domain: 'que', name: 'Life Discovery Wire', description: 'Group gap assessment and preliminary need estimate', composedOf: ['ANALYZE_GROUP_GAP'] },
  { id: 'WIRE_LIFE_NEEDS', type: 'WIRE', domain: 'que', name: 'Life Needs Wire', description: 'Full needs analysis with face amount targets', composedOf: ['ANALYZE_LIFE_NEED'] },
  { id: 'WIRE_LIFE_OPTIONS', type: 'WIRE', domain: 'que', name: 'Life Options Wire', description: 'Underwriting path plus three-option product comparison', composedOf: ['ANALYZE_UNDERWRITING_PATH', 'ANALYZE_LIFE_OPTIONS'] },
  { id: 'WIRE_LIFE_PRESENTATION', type: 'WIRE', domain: 'que', name: 'Life Presentation Wire', description: 'Complete multi-tab life insurance presentation', composedOf: ['ANALYZE_GROUP_GAP', 'ANALYZE_LIFE_NEED', 'ANALYZE_UNDERWRITING_PATH', 'ANALYZE_LIFE_OPTIONS'] },

]

/** Look up a QUE registry entry by ID */
export function getQueRegistryEntry(id: string): QueRegistryEntry | undefined {
  return QUE_REGISTRY.find((e) => e.id === id)
}

/** Get all entries of a given type */
export function getQueRegistryByType(type: 'TOOL' | 'SUPER_TOOL' | 'WIRE'): QueRegistryEntry[] {
  return QUE_REGISTRY.filter((e) => e.type === type)
}
