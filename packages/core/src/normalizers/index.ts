// Ported from RAPID_CORE CORE_Normalize.gs + CORE_Database.gs FIELD_NORMALIZERS
// 16 normalizer types applied to 90+ fields

// ============================================================================
// NAME NORMALIZERS
// ============================================================================

/**
 * Normalize a single name component with McName/O'Name awareness.
 * Ported from CORE_Normalize.gs normalizeSingleName().
 */
export function normalizeName(raw: string): string {
  if (!raw) return ''
  return String(raw).trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map(word => {
      if (/^mc/i.test(word)) {
        return 'Mc' + word.slice(2).charAt(0).toUpperCase() + word.slice(3).toLowerCase()
      }
      if (/^o'/i.test(word)) {
        return "O'" + word.slice(2).charAt(0).toUpperCase() + word.slice(3).toLowerCase()
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    })
    .join(' ')
}

/**
 * Parse full name into first/last parts.
 * Ported from CORE_Normalize.gs parseFullName().
 */
export function parseFullName(fullName: string): { firstName: string; lastName: string } {
  if (!fullName) return { firstName: '', lastName: '' }
  const parts = String(fullName).trim().split(/\s+/)
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: '' }
  }
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' ')
  }
}

// ============================================================================
// PHONE NORMALIZER
// ============================================================================

/** Normalize phone to 10 digits. Ported from CORE_Database.gs normalizer. */
export function normalizePhone(raw: string): string {
  if (!raw) return ''
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 10) return digits
  if (digits.length === 11 && digits[0] === '1') return digits.slice(1)
  return digits
}

/**
 * Format phone as (XXX) XXX-XXXX. Ported from CORE_Normalize.gs normalizePhone().
 */
export function formatPhone(raw: string): string {
  if (!raw) return ''
  const digits = normalizePhone(raw)
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  }
  return raw.trim()
}

/** Extract 10 digits from phone. Ported from CORE_Normalize.gs phoneDigits(). */
export function phoneDigits(raw: string): string {
  if (!raw) return ''
  const digits = String(raw).replace(/\D/g, '')
  if (digits.length === 11 && digits.charAt(0) === '1') return digits.slice(1)
  return digits.length === 10 ? digits : ''
}

// ============================================================================
// EMAIL NORMALIZER
// ============================================================================

export function normalizeEmail(raw: string): string {
  if (!raw) return ''
  return raw.trim().toLowerCase()
}

// ============================================================================
// DATE NORMALIZER
// ============================================================================

/**
 * Normalize date to YYYY-MM-DD. Uses UTC getters to avoid timezone day-shift.
 * Ported from CORE_Normalize.gs normalizeDate() with all format handling.
 */
export function normalizeDate(raw: string | Date | unknown): string {
  if (!raw) return ''

  if (raw instanceof Date) {
    if (isNaN(raw.getTime())) return ''
    const y = raw.getUTCFullYear()
    const m = String(raw.getUTCMonth() + 1).padStart(2, '0')
    const d = String(raw.getUTCDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }

  if (typeof raw !== 'string') return String(raw)

  const str = raw.trim()

  // Guard: day-of-week names
  if (/^(mon|tue|wed|thu|fri|sat|sun)(day|sday|nesday|rsday|urday)?$/i.test(str)) {
    return ''
  }

  // MM/DD/YYYY
  let match = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (match) {
    return `${match[3]}-${String(match[1]).padStart(2, '0')}-${String(match[2]).padStart(2, '0')}`
  }

  // YYYY-MM-DD (already target format)
  match = str.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (match) return str

  // MM-DD-YYYY
  match = str.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/)
  if (match) {
    return `${match[3]}-${String(match[1]).padStart(2, '0')}-${String(match[2]).padStart(2, '0')}`
  }

  // Fallback: native parsing with UTC getters
  const date = new Date(str)
  if (isNaN(date.getTime())) return ''

  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// ============================================================================
// STATE NORMALIZER
// ============================================================================

const STATE_NAMES: Record<string, string> = {
  'ALABAMA': 'AL', 'ALASKA': 'AK', 'ARIZONA': 'AZ', 'ARKANSAS': 'AR',
  'CALIFORNIA': 'CA', 'COLORADO': 'CO', 'CONNECTICUT': 'CT', 'DELAWARE': 'DE',
  'FLORIDA': 'FL', 'GEORGIA': 'GA', 'HAWAII': 'HI', 'IDAHO': 'ID',
  'ILLINOIS': 'IL', 'INDIANA': 'IN', 'IOWA': 'IA', 'KANSAS': 'KS',
  'KENTUCKY': 'KY', 'LOUISIANA': 'LA', 'MAINE': 'ME', 'MARYLAND': 'MD',
  'MASSACHUSETTS': 'MA', 'MICHIGAN': 'MI', 'MINNESOTA': 'MN', 'MISSISSIPPI': 'MS',
  'MISSOURI': 'MO', 'MONTANA': 'MT', 'NEBRASKA': 'NE', 'NEVADA': 'NV',
  'NEW HAMPSHIRE': 'NH', 'NEW JERSEY': 'NJ', 'NEW MEXICO': 'NM', 'NEW YORK': 'NY',
  'NORTH CAROLINA': 'NC', 'NORTH DAKOTA': 'ND', 'OHIO': 'OH', 'OKLAHOMA': 'OK',
  'OREGON': 'OR', 'PENNSYLVANIA': 'PA', 'RHODE ISLAND': 'RI', 'SOUTH CAROLINA': 'SC',
  'SOUTH DAKOTA': 'SD', 'TENNESSEE': 'TN', 'TEXAS': 'TX', 'UTAH': 'UT',
  'VERMONT': 'VT', 'VIRGINIA': 'VA', 'WASHINGTON': 'WA', 'WEST VIRGINIA': 'WV',
  'WISCONSIN': 'WI', 'WYOMING': 'WY', 'DISTRICT OF COLUMBIA': 'DC'
}

/** Normalize state to 2-letter code. Ported from CORE_Normalize.gs normalizeState(). */
export function normalizeState(raw: string): string {
  if (!raw) return ''
  const cleaned = String(raw).trim().toUpperCase()
  if (/^[A-Z]{2}$/.test(cleaned)) return cleaned
  return STATE_NAMES[cleaned] || raw.trim()
}

// ============================================================================
// ZIP NORMALIZER
// ============================================================================

/** Normalize ZIP to 5-digit or ZIP+4. Zero-pads 4-digit ZIPs. */
export function normalizeZip(raw: string | number): string {
  if (raw == null) return ''
  const digits = String(raw).replace(/\D/g, '')
  if (digits.length === 4) return '0' + digits
  if (digits.length === 5) return digits
  if (digits.length === 9) return `${digits.slice(0, 5)}-${digits.slice(5)}`
  if (digits.length === 8) return '0' + digits.slice(0, 4) + '-' + digits.slice(4)
  return String(raw).trim()
}

// ============================================================================
// AMOUNT NORMALIZER
// ============================================================================

/** Normalize currency amount. Handles $, commas, Date guards. */
export function normalizeAmount(raw: string | number | unknown): number {
  if (raw == null || raw === '') return 0

  // Guard: Date objects in amount fields
  if (raw instanceof Date) return 0

  if (typeof raw === 'number') return raw

  const str = String(raw)
  // Guard: epoch date strings
  if (/1899.*GMT/i.test(str) || /1900.*GMT/i.test(str)) return 0

  const cleaned = str.replace(/[$,]/g, '').trim()
  const num = parseFloat(cleaned)
  return isNaN(num) ? 0 : num
}

// ============================================================================
// CARRIER NAME NORMALIZER
// ============================================================================

import { CARRIER_ALIASES } from './field-normalizers'
import { resolveCharterIdentity, resolveDefaultCharter, type CarrierIdentity } from './carrier-charter-map'

export type { CarrierIdentity }

export interface CarrierNormResult {
  /** Parent brand display name (e.g., "Aetna") — backward-compatible string */
  carrier_name: string
  /** Underwriting charter legal entity (e.g., "Accendo Insurance Company") */
  charter: string | null
  /** Charter short code (e.g., "ACC") */
  charter_code: string | null
  /** NAIC code if known */
  naic: number | null
  /** Carrier doc ID in Firestore */
  carrier_id: string | null
}

/**
 * Normalize carrier name using alias map.
 * Ported from CORE_Normalize.gs normalizeCarrierName().
 * Note: Database lookups removed -- pure function in toMachina.
 *
 * BACKWARD COMPATIBLE: Still returns a string (parent brand name).
 * Use normalizeCarrierFull() for the two-layer identity.
 */
export function normalizeCarrierName(raw: string): string {
  if (!raw) return ''
  const cleaned = String(raw).trim().toLowerCase()
    .replace(/_/g, ' ')
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, ' ')

  if (CARRIER_ALIASES[cleaned]) return CARRIER_ALIASES[cleaned]

  // Title case fallback
  return cleaned.split(/\s+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
}

/**
 * Full two-layer carrier normalization.
 *
 * Returns parent brand + underwriting charter + NAIC + carrier_id.
 * First tries to resolve charter directly from raw input.
 * If no charter match, resolves parent via CARRIER_ALIASES and checks
 * if parent is a single-charter carrier (auto-assign).
 */
export function normalizeCarrierFull(raw: string): CarrierNormResult {
  if (!raw) return { carrier_name: '', charter: null, charter_code: null, naic: null, carrier_id: null }

  // Step 1: Try direct charter resolution
  const charterMatch = resolveCharterIdentity(raw)
  if (charterMatch) {
    return {
      carrier_name: charterMatch.parent,
      charter: charterMatch.charter,
      charter_code: charterMatch.charter_code,
      naic: charterMatch.naic ?? null,
      carrier_id: charterMatch.carrier_id,
    }
  }

  // Step 2: Fall back to parent-level alias resolution
  const parentName = normalizeCarrierName(raw)

  // Step 3: Check if parent is single-charter (auto-assign)
  const defaultCharter = resolveDefaultCharter(parentName)
  if (defaultCharter) {
    return {
      carrier_name: parentName,
      charter: defaultCharter.charter,
      charter_code: defaultCharter.charter_code,
      naic: defaultCharter.naic ?? null,
      carrier_id: defaultCharter.carrier_id,
    }
  }

  // Step 4: Multi-charter parent — can't determine charter from name alone
  return {
    carrier_name: parentName,
    charter: null,
    charter_code: null,
    naic: null,
    carrier_id: null,
  }
}

// ============================================================================
// PRODUCT TYPE NORMALIZER
// ============================================================================

import { PRODUCT_TYPES } from './field-normalizers'

/** Normalize product type. Ported from CORE_Normalize.gs normalizeProductType(). */
export function normalizeProductType(raw: string): string {
  if (!raw) return ''
  const cleaned = String(raw).trim().toLowerCase()
    .replace(/_/g, ' ')
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, ' ')

  if (PRODUCT_TYPES[cleaned]) return PRODUCT_TYPES[cleaned]

  return cleaned.split(/\s+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
}

// ============================================================================
// PRODUCT NAME NORMALIZER
// ============================================================================

import { PRODUCT_NAME_ALIASES } from './field-normalizers'

/** Normalize product name. Alias match then cleanup. */
export function normalizeProductName(raw: string): string {
  if (!raw) return ''
  const str = String(raw).trim()
    .replace(/\u00AE/g, '') // Strip registered trademark
    .replace(/\s+/g, ' ')
    .trim()
  if (!str) return ''

  const lower = str.toLowerCase()
  if (PRODUCT_NAME_ALIASES[lower]) return PRODUCT_NAME_ALIASES[lower]
  return str
}

// ============================================================================
// PLAN NAME NORMALIZER
// ============================================================================

import { PLAN_NAME_ALIASES } from './field-normalizers'

/** Normalize plan name. Alias match, regex fixes, CMS ID cleanup. */
export function normalizePlanName(raw: string): string {
  if (!raw) return ''
  let str = String(raw).trim()
    .replace(/\u00AE/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!str) return ''

  const lower = str.toLowerCase()
  if (lower in PLAN_NAME_ALIASES) return PLAN_NAME_ALIASES[lower]

  // Regex fixes for systematic typos
  str = str.replace(/Heathcare/g, 'Healthcare')
  str = str.replace(/PLATNIUM/g, 'PLATINUM')

  // CMS plan IDs used as plan names -- clear them
  if (/^[HSR]\d{4}-\d{3}$/i.test(str)) return ''

  return str
}

// ============================================================================
// IMO NAME NORMALIZER
// ============================================================================

import { IMO_ALIASES } from './field-normalizers'

/** Normalize IMO name. Ported from CORE_Normalize.gs normalizeIMOName(). */
export function normalizeIMOName(raw: string): string {
  if (!raw) return ''
  const cleaned = String(raw).trim().toLowerCase()
    .replace(/_/g, ' ')
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, ' ')

  if (IMO_ALIASES[cleaned]) return IMO_ALIASES[cleaned]

  return cleaned.split(/\s+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
}

// ============================================================================
// STATUS NORMALIZER
// ============================================================================

import { STATUS_MAP } from './field-normalizers'

/** Normalize status field. Strips date suffixes, maps aliases. Unmapped values → 'Unknown'. */
export function normalizeStatus(raw: string): string {
  if (!raw) return ''
  const cleaned = String(raw).trim().toLowerCase()
    .replace(/_/g, ' ')
    .replace(/[^\w\s()-]/g, '')
    .replace(/\s+eff\s+.*$/g, '')
    .replace(/\s+date\s+.*$/g, '')
    .replace(/\s*[-]\s*\d[\d/\s]*$/g, '')
    .replace(/\s+\d{4,}$/g, '')
    .replace(/\s*-\s*$/g, '')
    .replace(/\s+/g, ' ')
    .trim()

  if (!cleaned) return ''
  if (STATUS_MAP[cleaned]) return STATUS_MAP[cleaned]

  // No title-case fallback — unmapped values are flagged as Unknown
  return 'Unknown'
}

// ============================================================================
// BOOK OF BUSINESS NORMALIZER
// ============================================================================

import { BOB_ALIASES } from './field-normalizers'

/** Normalize book_of_business. Strips agent suffix, maps aliases. */
export function normalizeBoB(raw: string): string {
  if (!raw) return ''
  const cleaned = String(raw).trim()
    .replace(/_/g, ' ')
    .replace(/\s*\/\s*.*$/, '')
    .replace(/\s+/g, ' ')
    .trim()

  if (!cleaned) return ''

  const lower = cleaned.toLowerCase()
  if (BOB_ALIASES[lower]) return BOB_ALIASES[lower]

  return cleaned.split(/\s+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
}

// ============================================================================
// ADDRESS NORMALIZER
// ============================================================================

const ADDRESS_KEEP_UPPER: Record<string, string> = {
  'N': 'N', 'S': 'S', 'E': 'E', 'W': 'W',
  'NE': 'NE', 'NW': 'NW', 'SE': 'SE', 'SW': 'SW',
  'PO': 'PO', 'RR': 'RR', 'US': 'US', 'HWY': 'HWY',
  'CR': 'CR', 'FM': 'FM'
}

const ADDRESS_SUFFIXES: Record<string, string> = {
  'st': 'St', 'street': 'St', 'ave': 'Ave', 'avenue': 'Ave',
  'blvd': 'Blvd', 'boulevard': 'Blvd', 'dr': 'Dr', 'drive': 'Dr',
  'ln': 'Ln', 'lane': 'Ln', 'rd': 'Rd', 'road': 'Rd',
  'ct': 'Ct', 'court': 'Ct', 'pl': 'Pl', 'place': 'Pl',
  'cir': 'Cir', 'circle': 'Cir', 'way': 'Way',
  'pkwy': 'Pkwy', 'parkway': 'Pkwy', 'ter': 'Ter', 'terrace': 'Ter',
  'trl': 'Trl', 'trail': 'Trl', 'apt': 'Apt', 'ste': 'Ste', 'suite': 'Ste',
  'bldg': 'Bldg', 'building': 'Bldg', 'fl': 'Fl', 'floor': 'Fl',
  'unit': 'Unit', 'box': 'Box', 'hwy': 'Hwy', 'highway': 'Hwy'
}

/** Normalize street address. Only transforms ALL-CAPS values. */
export function normalizeAddress(raw: string): string {
  if (!raw && raw !== '0') return ''
  const str = String(raw).trim()
  if (!str) return ''

  const letters = str.replace(/[^a-zA-Z]/g, '')
  if (!letters) return str
  const upperCount = (letters.match(/[A-Z]/g) || []).length
  if (upperCount / letters.length < 0.8) return str

  return str.split(/\s+/).map(word => {
    const upper = word.toUpperCase()
    if (/^\d+/.test(word)) {
      return word.replace(/^(\d+)(ST|ND|RD|TH)$/i, (_m, num, suf) => num + suf.toLowerCase())
    }
    if (ADDRESS_KEEP_UPPER[upper]) return ADDRESS_KEEP_UPPER[upper]
    const lower = word.toLowerCase()
    if (ADDRESS_SUFFIXES[lower]) return ADDRESS_SUFFIXES[lower]
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  }).join(' ')
}

// ============================================================================
// CITY NORMALIZER
// ============================================================================

/** Normalize city name. Only transforms ALL-CAPS values. */
export function normalizeCity(raw: string): string {
  if (!raw && raw !== '0') return ''
  const str = String(raw).trim()
  if (!str) return ''

  const letters = str.replace(/[^a-zA-Z]/g, '')
  if (!letters) return str
  const upperCount = (letters.match(/[A-Z]/g) || []).length
  if (upperCount / letters.length < 0.8) return str

  return str.split(/\s+/).map(word =>
    word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  ).join(' ')
}

// ============================================================================
// NORMALIZE DATA DISPATCHER
// Ported from CORE_Database.gs normalizeData_() (lines 1382-1449)
// ============================================================================

import { FIELD_NORMALIZERS, type NormalizerType } from './field-normalizers'

/**
 * Normalize all fields on a data object using the FIELD_NORMALIZERS map.
 * Only normalizes fields listed in FIELD_NORMALIZERS. Everything else passes through.
 * Empty/null/undefined values are left unchanged. Normalizer failures preserve original.
 *
 * Ported from CORE_Database.gs normalizeData_().
 */
export function normalizeData(data: Record<string, unknown>): Record<string, unknown> {
  const normalized: Record<string, unknown> = {}

  for (const key of Object.keys(data)) {
    const val = data[key]
    const normType: NormalizerType | undefined = FIELD_NORMALIZERS[key] as NormalizerType | undefined

    // Skip null/empty/undefined -- do not normalize nothing
    if (val === null || val === undefined || val === '') {
      normalized[key] = val
      continue
    }

    // Skip marked fields or unmapped fields -- pass through unchanged
    if (!normType || normType === 'skip') {
      normalized[key] = val
      continue
    }

    // Apply normalizer with safety net
    try {
      normalized[key] = applyNormalizer(normType, val)
    } catch {
      // If normalization fails, preserve original value -- never block a write
      normalized[key] = val
    }
  }

  return normalized
}

function applyNormalizer(normType: NormalizerType, val: unknown): unknown {
  switch (normType) {
    case 'name':         return normalizeName(String(val))
    case 'phone':        return normalizePhone(String(val))
    case 'email':        return normalizeEmail(String(val))
    case 'date':         return normalizeDate(val)
    case 'state':        return normalizeState(String(val))
    case 'zip':          return normalizeZip(val as string | number)
    case 'amount':       return normalizeAmount(val)
    case 'carrier':      return normalizeCarrierName(String(val))
    case 'product':      return normalizeProductType(String(val))
    case 'product_name': return normalizeProductName(String(val))
    case 'plan_name':    return normalizePlanName(String(val))
    case 'imo':          return normalizeIMOName(String(val))
    case 'status':       return normalizeStatus(String(val))
    case 'bob':          return normalizeBoB(String(val))
    case 'address':      return normalizeAddress(String(val))
    case 'city':         return normalizeCity(String(val))
    default:             return val
  }
}
