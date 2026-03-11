/**
 * Compliance utilities -- PHI/PII masking and safe logging.
 * Ported from CORE_Compliance.gs.
 *
 * CRITICAL: RPI handles Protected Health Information (PHI).
 * These utilities enforce HIPAA-compliant data handling.
 *
 * Per CLAUDE.md PHI Rules:
 * - Mask SSN (show last 4 only)
 * - Mask DOB unless explicitly needed
 * - NEVER log PHI to console, error messages, or debug output
 */

// ============================================================================
// SSN MASKING
// ============================================================================

/**
 * Mask SSN to show only last 4 digits.
 *
 * @example
 * maskSSN('123-45-6789')  // '***-**-6789'
 * maskSSN('123456789')    // '***-**-6789'
 * maskSSN('6789')         // '6789'
 * maskSSN(null)           // ''
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
  /** If true, show full DOB -- use sparingly! (default: false) */
  showFull?: boolean
}

/**
 * Mask DOB -- return age or masked date based on context.
 *
 * @example
 * maskDOB('1950-03-15')                        // '74' (age)
 * maskDOB('1950-03-15', { showAge: false })     // '**\/**\/1950'
 * maskDOB('1950-03-15', { showYear: true })     // '74 (b. 1950)'
 * maskDOB('1950-03-15', { showFull: true })     // '03/15/1950'
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

  if (isNaN(dateObj.getTime())) {
    return ''
  }

  if (showFull) {
    const month = String(dateObj.getMonth() + 1).padStart(2, '0')
    const day = String(dateObj.getDate()).padStart(2, '0')
    const year = dateObj.getFullYear()
    return `${month}/${day}/${year}`
  }

  const today = new Date()
  let age = today.getFullYear() - dateObj.getFullYear()
  const monthDiff = today.getMonth() - dateObj.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dateObj.getDate())) {
    age--
  }

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
 */
export function calculateAge(dob: Date | string | null | undefined): number | null {
  if (!dob) return null

  let dateObj: Date
  if (dob instanceof Date) {
    dateObj = dob
  } else {
    dateObj = new Date(dob)
  }

  if (isNaN(dateObj.getTime())) return null

  const today = new Date()
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
 */
export function maskMBI(mbi: string | null | undefined): string {
  if (!mbi) return ''

  const clean = String(mbi).replace(/[^A-Z0-9]/gi, '').toUpperCase()

  if (clean.length < 4) return clean

  const last4 = clean.slice(-4)
  return `****-***-${last4}`
}

// ============================================================================
// SAFE LOGGING UTILITIES
// ============================================================================

/** Field names that contain sensitive data. Used by sanitizeForLog(). */
export const SENSITIVE_FIELDS: string[] = [
  'ssn', 'social_security', 'social_security_number',
  'dob', 'date_of_birth', 'birth_date', 'birthdate',
  'mbi', 'medicare_number', 'medicare_id', 'medicare_beneficiary_id',
  'password', 'secret', 'token', 'api_key', 'apikey',
  'credit_card', 'card_number', 'cvv', 'pin',
  'bank_account', 'routing_number', 'account_number',
]

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

  const sensitiveSet = new Set([
    ...SENSITIVE_FIELDS,
    ...additionalFields.map(f => f.toLowerCase()),
  ])

  const result: Record<string, unknown> = {}
  const record = obj as Record<string, unknown>

  for (const [key, value] of Object.entries(record)) {
    const keyLower = key.toLowerCase()

    const isSensitive =
      sensitiveSet.has(keyLower) ||
      SENSITIVE_FIELDS.some(sf => keyLower.includes(sf))

    if (isSensitive) {
      if (keyLower.includes('ssn') || keyLower.includes('social_security')) {
        result[key] = maskSSN(value as string)
      } else if (keyLower.includes('dob') || keyLower.includes('birth')) {
        result[key] = maskDOB(value as string, { showAge: true })
      } else if (keyLower.includes('mbi') || keyLower.includes('medicare')) {
        result[key] = maskMBI(value as string)
      } else if (keyLower.includes('phone')) {
        result[key] = maskPhone(value as string)
      } else {
        result[key] = value ? '[REDACTED]' : null
      }
    } else if (typeof value === 'object' && value !== null) {
      result[key] = sanitizeForLog(value, additionalFields)
    } else {
      result[key] = value
    }
  }

  return result
}
