/**
 * Signal IMO Revenue Format Parser.
 * Parses Signal's proprietary commission/revenue export format
 * into canonical toMachina revenue records.
 */

import { createHash } from 'crypto'

// ============================================================================
// INTERFACES
// ============================================================================

/** Raw record shape from Signal IMO exports */
export interface SignalRawRecord {
  /** Producer Name */
  pn?: string
  /** Amount */
  am?: string | number
  /** Type (FYC, Renewal, Override) */
  ty?: string
  /** Payment Date (M/D/YY or M/D/YYYY) */
  pd?: string
  /** Carrier */
  cr?: string
  /** Account/Policy Number */
  an?: string
  /** Client Name */
  cn?: string
  /** Source (carrier source identifier) */
  src?: string
  /** Level/Tier */
  lt?: string
  /** Product */
  prd?: string
  /** Allow extra fields */
  [key: string]: unknown
}

/** Canonical parsed revenue record */
export interface ParsedRevenueRecord {
  agent_name: string
  amount: number
  revenue_type: 'FYC' | 'REN' | 'OVR'
  payment_date: string
  carrier: string
  policy_number: string
  client_name: string
  import_source: string
  level: string
  product: string
  stateable_id: string
}

/** Result of parsing a batch of Signal records */
export interface SignalParseResult {
  parsed: ParsedRevenueRecord[]
  errors: Array<{ index: number; error: string; raw?: SignalRawRecord }>
}

// ============================================================================
// SIGNAL KEY NAMES (for format detection)
// ============================================================================

const SIGNAL_KEYS = ['pn', 'am', 'ty', 'pd', 'cr', 'an', 'cn', 'src', 'lt', 'prd']

// ============================================================================
// NORMALIZATION
// ============================================================================

/**
 * Normalize Signal date format to ISO YYYY-MM-DD.
 * Handles M/D/YY, M/D/YYYY, MM/DD/YY, MM/DD/YYYY
 */
export function normalizeSignalDate(raw: string): string {
  if (!raw || typeof raw !== 'string') return ''

  const trimmed = raw.trim()
  // Already ISO format
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10)

  const match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/)
  if (!match) return trimmed

  const month = match[1].padStart(2, '0')
  const day = match[2].padStart(2, '0')
  let year = match[3]

  // Handle 2-digit year
  if (year.length === 2) {
    const yearNum = parseInt(year, 10)
    year = yearNum >= 50 ? `19${year}` : `20${year}`
  }

  return `${year}-${month}-${day}`
}

/**
 * Normalize Signal revenue type to canonical FYC | REN | OVR.
 */
export function normalizeSignalType(raw: string): 'FYC' | 'REN' | 'OVR' {
  if (!raw) return 'FYC'
  const upper = raw.toUpperCase().trim()

  if (upper === 'FYC' || upper.includes('FIRST') || upper === 'F') return 'FYC'
  if (upper === 'REN' || upper.includes('RENEWAL') || upper === 'R') return 'REN'
  if (upper === 'OVR' || upper.includes('OVERRIDE') || upper === 'O') return 'OVR'

  return 'FYC'
}

/**
 * Generate a composite dedup key (stateable_id) from record fields.
 * Hash of: agent_name + policy_number + payment_date + amount + revenue_type
 */
export function generateStateableId(record: {
  agent_name: string
  policy_number: string
  payment_date: string
  amount: number
  revenue_type: string
}): string {
  const composite = [
    record.agent_name.toLowerCase().trim(),
    record.policy_number.trim(),
    record.payment_date,
    String(record.amount),
    record.revenue_type,
  ].join('|')

  return createHash('sha256').update(composite).digest('hex').slice(0, 32)
}

// ============================================================================
// PARSING
// ============================================================================

/**
 * Parse a batch of Signal IMO raw records into canonical format.
 */
export function parseSignalRecords(records: SignalRawRecord[]): SignalParseResult {
  const parsed: ParsedRevenueRecord[] = []
  const errors: SignalParseResult['errors'] = []

  for (let i = 0; i < records.length; i++) {
    const raw = records[i]

    try {
      // Validate minimum fields
      if (raw.am == null && raw.pd == null) {
        errors.push({ index: i, error: 'Missing amount (am) and payment date (pd)', raw })
        continue
      }

      const amount = parseFloat(String(raw.am ?? 0))
      if (isNaN(amount)) {
        errors.push({ index: i, error: `Invalid amount: ${raw.am}`, raw })
        continue
      }

      const paymentDate = normalizeSignalDate(String(raw.pd || ''))
      if (!paymentDate) {
        errors.push({ index: i, error: 'Missing or invalid payment date', raw })
        continue
      }

      const revenueType = normalizeSignalType(String(raw.ty || ''))
      const agentName = String(raw.pn || '').trim()
      const policyNumber = String(raw.an || '').trim()
      const clientName = String(raw.cn || '').trim()
      const carrier = String(raw.cr || '').trim()
      const level = String(raw.lt || '').trim()
      const product = String(raw.prd || '').trim()

      const record: ParsedRevenueRecord = {
        agent_name: agentName,
        amount,
        revenue_type: revenueType,
        payment_date: paymentDate,
        carrier,
        policy_number: policyNumber,
        client_name: clientName,
        import_source: `SIGNAL_${String(raw.src || 'IMO').toUpperCase()}`,
        level,
        product,
        stateable_id: '', // computed below
      }

      record.stateable_id = generateStateableId(record)
      parsed.push(record)
    } catch (err) {
      errors.push({ index: i, error: String(err), raw })
    }
  }

  return { parsed, errors }
}

/**
 * Detect whether a set of records is in Signal format.
 * Returns true if at least 4 of the 10 known Signal keys are present
 * in the first record.
 */
export function isSignalFormat(records: unknown[]): boolean {
  if (!Array.isArray(records) || records.length === 0) return false

  const first = records[0]
  if (typeof first !== 'object' || first === null) return false

  const keys = Object.keys(first as Record<string, unknown>)
  const matchCount = SIGNAL_KEYS.filter(k => keys.includes(k)).length
  return matchCount >= 4
}
