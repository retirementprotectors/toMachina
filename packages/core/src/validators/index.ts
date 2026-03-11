/**
 * Validators — field-level validation functions.
 * Ported from CORE_Validation_API.gs (local validators) and expanded
 * with validation rule schemas for the toMachina platform.
 *
 * External API validators (phone validator, NeverBounce, USPS, bank routing)
 * remain server-side only — they are NOT ported here. These are pure,
 * client-safe functions.
 */

// ============================================================================
// CORE VALIDATORS (from CORE_Validation_API.gs local patterns)
// ============================================================================

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export function isValidPhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, '')
  return digits.length === 10
}

export function isValidNPI(npi: string): boolean {
  if (!/^\d{10}$/.test(npi)) return false
  // Luhn check with NPI prefix
  const digits = npi.split('').map(Number)
  let sum = 24 // Prefix for NPI
  for (let i = digits.length - 2; i >= 0; i--) {
    let d = digits[i]
    if ((digits.length - 1 - i) % 2 === 0) {
      d *= 2
      if (d > 9) d -= 9
    }
    sum += d
  }
  return (sum + digits[digits.length - 1]) % 10 === 0
}

export function isValidZip(zip: string): boolean {
  return /^\d{5}(-\d{4})?$/.test(zip)
}

export function isValidSSNLast4(ssn: string): boolean {
  return /^\d{4}$/.test(ssn)
}

// ============================================================================
// ADDITIONAL VALIDATORS
// ============================================================================

/** Validate a US state code (2-letter abbreviation). */
export function isValidState(state: string): boolean {
  const VALID_STATES = new Set([
    'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'FL',
    'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME',
    'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH',
    'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI',
    'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI',
    'WY',
  ])
  return VALID_STATES.has(state.toUpperCase().trim())
}

/** Validate a date string in YYYY-MM-DD format. */
export function isValidDate(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false
  const [year, month, day] = dateStr.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  )
}

/** Validate a 9-digit ABA routing number with checksum. */
export function isValidRoutingNumber(routing: string): boolean {
  const digits = routing.replace(/\D/g, '')
  if (digits.length !== 9) return false
  // ABA checksum: 3(d1 + d4 + d7) + 7(d2 + d5 + d8) + 1(d3 + d6 + d9) mod 10 == 0
  const d = digits.split('').map(Number)
  const checksum = 3 * (d[0] + d[3] + d[6]) + 7 * (d[1] + d[4] + d[7]) + (d[2] + d[5] + d[8])
  return checksum % 10 === 0
}

/** Validate an RPI-domain email address. */
export function isRPIEmail(email: string): boolean {
  if (!isValidEmail(email)) return false
  return email.toLowerCase().endsWith('@retireprotected.com')
}

// ============================================================================
// VALIDATION RULE TYPES
// ============================================================================

export type ValidationRuleType =
  | 'required'
  | 'email'
  | 'phone'
  | 'zip'
  | 'state'
  | 'date'
  | 'npi'
  | 'ssn_last4'
  | 'min_length'
  | 'max_length'
  | 'pattern'
  | 'custom'

export interface ValidationRule {
  type: ValidationRuleType
  field: string
  message?: string
  /** For min_length / max_length */
  value?: number
  /** For pattern type */
  pattern?: string
  /** For custom type */
  validate?: (value: unknown) => boolean
}

export interface ValidationResult {
  valid: boolean
  errors: Array<{ field: string; message: string }>
}

/**
 * Validate a record against a set of rules.
 * Pure function, works on any record shape.
 */
export function validateRecord(
  record: Record<string, unknown>,
  rules: ValidationRule[]
): ValidationResult {
  const errors: Array<{ field: string; message: string }> = []

  for (const rule of rules) {
    const value = record[rule.field]
    const strVal = value != null ? String(value).trim() : ''
    const defaultMsg = `${rule.field} failed ${rule.type} validation`

    switch (rule.type) {
      case 'required':
        if (value == null || strVal === '') {
          errors.push({ field: rule.field, message: rule.message || `${rule.field} is required` })
        }
        break

      case 'email':
        if (strVal && !isValidEmail(strVal)) {
          errors.push({ field: rule.field, message: rule.message || `${rule.field} is not a valid email` })
        }
        break

      case 'phone':
        if (strVal && !isValidPhone(strVal)) {
          errors.push({ field: rule.field, message: rule.message || `${rule.field} is not a valid phone number` })
        }
        break

      case 'zip':
        if (strVal && !isValidZip(strVal)) {
          errors.push({ field: rule.field, message: rule.message || `${rule.field} is not a valid ZIP code` })
        }
        break

      case 'state':
        if (strVal && !isValidState(strVal)) {
          errors.push({ field: rule.field, message: rule.message || `${rule.field} is not a valid state code` })
        }
        break

      case 'date':
        if (strVal && !isValidDate(strVal)) {
          errors.push({ field: rule.field, message: rule.message || `${rule.field} is not a valid date (YYYY-MM-DD)` })
        }
        break

      case 'npi':
        if (strVal && !isValidNPI(strVal)) {
          errors.push({ field: rule.field, message: rule.message || `${rule.field} is not a valid NPI` })
        }
        break

      case 'ssn_last4':
        if (strVal && !isValidSSNLast4(strVal)) {
          errors.push({ field: rule.field, message: rule.message || `${rule.field} must be 4 digits` })
        }
        break

      case 'min_length':
        if (strVal && rule.value != null && strVal.length < rule.value) {
          errors.push({ field: rule.field, message: rule.message || `${rule.field} must be at least ${rule.value} characters` })
        }
        break

      case 'max_length':
        if (strVal && rule.value != null && strVal.length > rule.value) {
          errors.push({ field: rule.field, message: rule.message || `${rule.field} must be at most ${rule.value} characters` })
        }
        break

      case 'pattern':
        if (strVal && rule.pattern && !new RegExp(rule.pattern).test(strVal)) {
          errors.push({ field: rule.field, message: rule.message || defaultMsg })
        }
        break

      case 'custom':
        if (rule.validate && !rule.validate(value)) {
          errors.push({ field: rule.field, message: rule.message || defaultMsg })
        }
        break
    }
  }

  return { valid: errors.length === 0, errors }
}

// ============================================================================
// CONTACT QUALITY SCORE (pure client-side version)
// ============================================================================

export interface ContactQualityInput {
  phone?: string
  email?: string
  address?: string
  city?: string
  state?: string
  zip?: string
}

export interface ContactQualityResult {
  score: number
  grade: 'green' | 'yellow' | 'red'
  channelsChecked: number
  channelsValid: number
  details: {
    phone: boolean | null
    email: boolean | null
    address: boolean | null
  }
}

/**
 * Score contact data quality based on available fields.
 * Client-side only -- does not call external APIs.
 * For API-validated scoring, use the server-side scoreContactQuality.
 */
export function scoreContactQualityLocal(contact: ContactQualityInput): ContactQualityResult {
  let channels = 0
  let valid = 0
  const details: ContactQualityResult['details'] = {
    phone: null,
    email: null,
    address: null,
  }

  if (contact.phone) {
    channels++
    const isValid = isValidPhone(contact.phone)
    details.phone = isValid
    if (isValid) valid++
  }

  if (contact.email) {
    channels++
    const isValid = isValidEmail(contact.email)
    details.email = isValid
    if (isValid) valid++
  }

  if (contact.address && contact.state && contact.zip) {
    channels++
    const isValid = isValidState(contact.state) && isValidZip(contact.zip)
    details.address = isValid
    if (isValid) valid++
  }

  let grade: ContactQualityResult['grade'] = 'red'
  if (channels > 0) {
    if (valid === channels) grade = 'green'
    else if (valid > 0) grade = 'yellow'
  }

  return {
    score: channels > 0 ? Math.round((valid / channels) * 100) : 0,
    grade,
    channelsChecked: channels,
    channelsValid: valid,
    details,
  }
}
