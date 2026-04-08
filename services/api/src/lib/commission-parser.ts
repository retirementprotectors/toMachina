/**
 * Generic Commission/Revenue Parser for carrier statement XLSX exports.
 * Auto-detects column mappings from headers and normalizes to canonical fields.
 */

// ============================================================================
// INTERFACES
// ============================================================================

/** Maps canonical field names to arrays of alternative header names */
export interface CommissionColumnMap {
  agent_name: string[]
  agent_npn: string[]
  amount: string[]
  revenue_type: string[]
  payment_date: string[]
  carrier: string[]
  policy_number: string[]
  client_name: string[]
  product: string[]
  period: string[]
}

// ============================================================================
// DEFAULTS
// ============================================================================

/** Default column name alternatives for each canonical field */
export const DEFAULT_COLUMN_MAP: CommissionColumnMap = {
  agent_name: [
    'agent_name', 'agent name', 'producer_name', 'producer name', 'producer',
    'writing_agent', 'writing agent', 'rep_name', 'rep name', 'advisor',
  ],
  agent_npn: [
    'agent_npn', 'npn', 'national_producer_number', 'producer_number',
    'agent_number', 'writing_number',
  ],
  amount: [
    'amount', 'commission', 'commission_amount', 'comm_amount', 'gross_commission',
    'net_commission', 'payment_amount', 'paid', 'comp', 'total',
  ],
  revenue_type: [
    'revenue_type', 'type', 'commission_type', 'comp_type', 'trans_type',
    'transaction_type', 'pay_type', 'payment_type',
  ],
  payment_date: [
    'payment_date', 'pay_date', 'paid_date', 'date', 'statement_date',
    'process_date', 'effective_date', 'transaction_date',
  ],
  carrier: [
    'carrier', 'carrier', 'company', 'company_name', 'insurer', 'issuer',
  ],
  policy_number: [
    'policy_number', 'policy', 'policy_no', 'contract_number', 'contract',
    'account_number', 'certificate', 'cert_number',
  ],
  client_name: [
    'client_name', 'client', 'insured', 'insured_name', 'owner', 'owner_name',
    'policyholder', 'annuitant',
  ],
  product: [
    'product', 'product_name', 'product_type', 'plan', 'plan_name', 'plan_code',
  ],
  period: [
    'period', 'statement_period', 'pay_period', 'month', 'year_month',
  ],
}

// ============================================================================
// REVENUE TYPE NORMALIZATION
// ============================================================================

const REVENUE_TYPE_MAP: Record<string, string> = {
  'first': 'FYC', 'first year': 'FYC', 'fyc': 'FYC', 'fy': 'FYC', '1st year': 'FYC',
  'renewal': 'REN', 'ren': 'REN', 'trail': 'REN', 'trailing': 'REN',
  'override': 'OVR', 'ovr': 'OVR', 'bonus': 'OVR', 'over': 'OVR',
}

function normalizeRevenueType(raw: string): string {
  if (!raw) return 'FYC'
  const upper = raw.toUpperCase().trim()
  if (['FYC', 'REN', 'OVR'].includes(upper)) return upper
  return REVENUE_TYPE_MAP[raw.toLowerCase().trim()] || 'FYC'
}

// ============================================================================
// COLUMN RESOLUTION
// ============================================================================

/**
 * Resolve a single canonical field from headers using alternative names.
 * Returns the actual header name or null if not found.
 */
export function resolveColumn(headers: string[], alternatives: string[]): string | null {
  const normalized = headers.map(h => h.toLowerCase().trim())
  for (const alt of alternatives) {
    const idx = normalized.indexOf(alt.toLowerCase())
    if (idx >= 0) return headers[idx]
  }
  return null
}

/**
 * Build a complete column resolution map from headers.
 * Returns a mapping of canonical field name -> actual header name (or null).
 * Optional overrides allow caller to force specific column mappings.
 */
export function buildColumnResolution(
  headers: string[],
  overrides?: Partial<Record<string, string>>
): Record<string, string | null> {
  const resolution: Record<string, string | null> = {}

  for (const [field, alternatives] of Object.entries(DEFAULT_COLUMN_MAP)) {
    if (overrides && overrides[field]) {
      resolution[field] = overrides[field] as string
    } else {
      resolution[field] = resolveColumn(headers, alternatives)
    }
  }

  return resolution
}

/**
 * Parse a single row using the resolved column mapping.
 * Returns a normalized record with canonical field names.
 */
export function parseCommissionRow(
  row: Record<string, unknown>,
  resolution: Record<string, string | null>
): Record<string, unknown> {
  const result: Record<string, unknown> = {}

  for (const [canonical, header] of Object.entries(resolution)) {
    if (!header) continue
    const value = row[header]
    if (value == null || value === '') continue

    switch (canonical) {
      case 'amount': {
        // Parse currency: strip $, commas, parens for negatives
        let str = String(value).replace(/[$,\s]/g, '')
        const isNegative = str.startsWith('(') && str.endsWith(')')
        if (isNegative) str = str.slice(1, -1)
        const parsed = parseFloat(str)
        result[canonical] = isNaN(parsed) ? 0 : (isNegative ? -parsed : parsed)
        break
      }
      case 'revenue_type':
        result[canonical] = normalizeRevenueType(String(value))
        break
      case 'agent_npn': {
        // Strip non-digits, keep 8-10 chars
        const digits = String(value).replace(/\D/g, '').slice(0, 10)
        result[canonical] = digits.length >= 8 ? digits : String(value).trim()
        break
      }
      default:
        result[canonical] = typeof value === 'string' ? value.trim() : value
    }
  }

  return result
}
