/**
 * Compliance — PHI/PII masking and sanitization utilities.
 * Ported from CORE_Compliance.gs (deleted from RAPID_CORE in v1.18.0).
 *
 * CRITICAL: RPI handles Protected Health Information (PHI).
 * These utilities enforce HIPAA-compliant data handling:
 *   - Mask SSN (show last 4 only)
 *   - Mask DOB unless explicitly needed
 *   - NEVER log PHI to console, error messages, or debug output
 *
 * All functions are pure — no GAS dependencies.
 */

// ============================================================================
// SSN MASKING
// ============================================================================

/**
 * Mask SSN to show only last 4 digits.
 *
 * @example
 * maskSSN('123-45-6789')  // "***-**-6789"
 * maskSSN('123456789')    // "***-**-6789"
 * maskSSN('6789')         // "6789"
 * maskSSN(null)           // ""
 */
export function maskSSN(ssn: string | number | null | undefined): string {
  if (!ssn) return ''

  const digits = String(ssn).replace(/\D/g, '')
  if (digits.length === 0) return ''

  if (digits.length >= 9) {
    const last4 = digits.slice(-4)
    return `***-**-${last4}`
  }

  if (digits.length <= 4) {
    return digits
  }

  const last4 = digits.slice(-4)
  const masked = '*'.repeat(digits.length - 4)
  return masked + last4
}

/**
 * Extract last 4 digits of SSN.
 */
export function ssnLast4(ssn: string | number | null | undefined): string {
  if (!ssn) return ''
  const digits = String(ssn).replace(/\D/g, '')
  return digits.slice(-4)
}

/**
 * Check if SSN appears valid (9 digits).
 * Does NOT validate against SSA rules, just checks format.
 */
export function isValidSSNFormat(ssn: string | number | null | undefined): boolean {
  if (!ssn) return false
  const digits = String(ssn).replace(/\D/g, '')
  return digits.length === 9
}

// ============================================================================
// DOB / AGE MASKING
// ============================================================================

export interface MaskDOBOptions {
  /** If true, return age instead of masked date (default: true) */
  showAge?: boolean
  /** If true, show birth year (default: false) */
  showYear?: boolean
  /** If true, show full DOB — use sparingly! (default: false) */
  showFull?: boolean
  /** Reference date for age calculation (default: now) */
  referenceDate?: Date
}

/**
 * Mask DOB — returns age or masked date based on options.
 *
 * @example
 * maskDOB('1950-03-15')                        // "74" (age)
 * maskDOB('1950-03-15', { showAge: false })    // "**\/**\/1950"
 * maskDOB('1950-03-15', { showYear: true })    // "74 (b. 1950)"
 * maskDOB('1950-03-15', { showFull: true })    // "03/15/1950"
 */
export function maskDOB(
  dob: Date | string | null | undefined,
  options: MaskDOBOptions = {}
): string {
  if (!dob) return ''

  const showAge = options.showAge !== false
  const showYear = options.showYear === true
  const showFull = options.showFull === true

  let dateObj: Date
  if (dob instanceof Date) {
    dateObj = dob
  } else {
    dateObj = new Date(dob)
  }

  if (isNaN(dateObj.getTime())) return ''

  if (showFull) {
    const month = String(dateObj.getMonth() + 1).padStart(2, '0')
    const day = String(dateObj.getDate()).padStart(2, '0')
    const year = dateObj.getFullYear()
    return `${month}/${day}/${year}`
  }

  const age = calculateAge(dob, options.referenceDate)
  if (age === null) return ''

  if (showAge) {
    if (showYear) {
      return `${age} (b. ${dateObj.getFullYear()})`
    }
    return String(age)
  }

  return `**/**/${dateObj.getFullYear()}`
}

/**
 * Calculate age from DOB.
 * @returns Age in years or null if invalid.
 */
export function calculateAge(
  dob: Date | string | null | undefined,
  referenceDate?: Date
): number | null {
  if (!dob) return null

  let dateObj: Date
  if (dob instanceof Date) {
    dateObj = dob
  } else {
    dateObj = new Date(dob)
  }

  if (isNaN(dateObj.getTime())) return null

  const today = referenceDate ?? new Date()
  let age = today.getFullYear() - dateObj.getFullYear()
  const monthDiff = today.getMonth() - dateObj.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dateObj.getDate())) {
    age--
  }

  return age
}

// ============================================================================
// PHONE MASKING
// ============================================================================

/**
 * Mask phone number to show only last 4 digits.
 *
 * @example
 * maskPhone('5155551234')  // "(***) ***-1234"
 */
export function maskPhone(phone: string | number | null | undefined): string {
  if (!phone) return ''

  const digits = String(phone).replace(/\D/g, '')
  if (digits.length < 4) return digits

  const last4 = digits.slice(-4)
  return `(***) ***-${last4}`
}

// ============================================================================
// MEDICARE NUMBER MASKING
// ============================================================================

/**
 * Mask Medicare Beneficiary Identifier (MBI).
 * MBI format: 1AA1-A11-AA11 (11 characters).
 *
 * @example
 * maskMBI('1AA1A11AA11')  // "****-***-A11"
 */
export function maskMBI(mbi: string | null | undefined): string {
  if (!mbi) return ''

  const clean = String(mbi).replace(/[^A-Z0-9]/gi, '').toUpperCase()
  if (clean.length < 4) return clean

  const last4 = clean.slice(-4)
  return `****-***-${last4}`
}

// ============================================================================
// SAFE LOGGING / SANITIZATION
// ============================================================================

/** Field names that contain sensitive data. */
const SENSITIVE_FIELDS = new Set([
  'ssn', 'social_security', 'social_security_number',
  'dob', 'date_of_birth', 'birth_date', 'birthdate',
  'mbi', 'medicare_number', 'medicare_id', 'medicare_beneficiary_id',
  'password', 'secret', 'token', 'api_key', 'apikey',
  'credit_card', 'card_number', 'cvv', 'pin',
  'bank_account', 'routing_number', 'account_number',
])

/**
 * Check if a field key matches any sensitive field pattern.
 */
function isSensitiveField(key: string, additionalFields: Set<string>): boolean {
  const keyLower = key.toLowerCase()
  if (additionalFields.has(keyLower)) return true
  if (SENSITIVE_FIELDS.has(keyLower)) return true
  for (const sf of SENSITIVE_FIELDS) {
    if (keyLower.includes(sf)) return true
  }
  return false
}

/**
 * Apply the correct masking function based on field name.
 */
function maskSensitiveValue(key: string, value: unknown): unknown {
  const keyLower = key.toLowerCase()
  if (keyLower.includes('ssn') || keyLower.includes('social_security')) {
    return maskSSN(value as string)
  }
  if (keyLower.includes('dob') || keyLower.includes('birth')) {
    return maskDOB(value as string, { showAge: true })
  }
  if (keyLower.includes('mbi') || keyLower.includes('medicare')) {
    return maskMBI(value as string)
  }
  if (keyLower.includes('phone')) {
    return maskPhone(value as string)
  }
  return value ? '[REDACTED]' : null
}

/**
 * Sanitize an object for safe logging.
 * Automatically masks sensitive fields based on SENSITIVE_FIELDS list.
 *
 * @example
 * const client = { name: 'John', ssn: '123-45-6789', dob: '1950-01-01' };
 * sanitizeForLog(client);
 * // { name: 'John', ssn: '***-**-6789', dob: '76' }
 */
export function sanitizeForLog(
  obj: unknown,
  additionalFields: string[] = []
): unknown {
  if (!obj || typeof obj !== 'object') return obj

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeForLog(item, additionalFields))
  }

  const additionalSet = new Set(additionalFields.map(f => f.toLowerCase()))
  const result: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (isSensitiveField(key, additionalSet)) {
      result[key] = maskSensitiveValue(key, value)
    } else if (typeof value === 'object' && value !== null) {
      result[key] = sanitizeForLog(value, additionalFields)
    } else {
      result[key] = value
    }
  }

  return result
}

/**
 * Check if a value looks like it contains PHI.
 * Useful for pre-flight checks before logging or sending data externally.
 */
export function containsPHI(text: string): boolean {
  if (!text) return false

  // SSN pattern: 3-2-4 or 9 consecutive digits
  if (/\b\d{3}-\d{2}-\d{4}\b/.test(text)) return true
  if (/\b\d{9}\b/.test(text) && !/\b\d{10,}\b/.test(text)) return true

  // MBI pattern: alphanumeric 11 chars
  if (/\b[1-9][A-Z][A-Z0-9]\d[A-Z][A-Z0-9]\d[A-Z]{2}\d{2}\b/.test(text)) return true

  // DOB pattern in common formats (rough heuristic)
  if (/\b(0[1-9]|1[0-2])\/(0[1-9]|[12]\d|3[01])\/(19|20)\d{2}\b/.test(text)) return true

  return false
}
