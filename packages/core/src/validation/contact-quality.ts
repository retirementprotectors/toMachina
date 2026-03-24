/**
 * Contact Quality Scoring — Pure Business Logic
 * Ported from RAPID_CORE CORE_Validation_API.gs :: scoreContactQuality()
 *
 * This module contains ONLY the scoring/grading logic. No external API calls.
 * The actual validation API wrappers live in services/api/src/lib/validation-apis.ts
 * (server-side only — they need env vars + secrets).
 *
 * @module @tomachina/core/validation/contact-quality
 */

// ============================================================================
// Types
// ============================================================================

export type QualityGrade = 'green' | 'yellow' | 'red'

/** Result from a single channel validation (phone, email, or address). */
export interface ChannelValidationResult {
  success: boolean
  valid: boolean
  error?: string
  data?: Record<string, unknown>
}

/** Input contact data for scoring. */
export interface ContactScoreInput {
  phone?: string
  email?: string
  address?: {
    streetAddress: string
    secondaryAddress?: string
    city?: string
    state?: string
    ZIPCode?: string
  }
}

/** Options to skip specific channels. */
export interface ContactQualityOptions {
  skipPhone?: boolean
  skipEmail?: boolean
  skipAddress?: boolean
}

/** Individual channel result in the composite score. */
export interface ChannelResult {
  checked: boolean
  valid: boolean
  error?: string
  data?: Record<string, unknown>
}

/** Composite quality score output. */
export interface ContactQualityScore {
  score: number
  grade: QualityGrade
  channelsChecked: number
  channelsValid: number
  channelsDegraded: number
  phone: ChannelResult
  email: ChannelResult
  address: ChannelResult
  summary: string
}

// ============================================================================
// Phone Validation Result Interpretation
// ============================================================================

export interface PhoneValidationData {
  lineType: string
  carrier: string
  location: string
  ported: boolean | null
  fake: boolean | null
  isCell: boolean
}

/** Determine if a phone validation result counts as "valid" for scoring. */
export function isPhoneValid(data: PhoneValidationData): boolean {
  return data.lineType !== 'Unknown'
}

// ============================================================================
// Email Validation Result Interpretation
// ============================================================================

export interface EmailValidationData {
  result: string
  isValid: boolean
  isInvalid: boolean
  isDisposable: boolean
  isCatchAll: boolean
  isUnknown: boolean
  flags: string[]
  suggestedCorrection: string
}

/** Determine if an email validation result counts as "valid" for scoring. */
export function isEmailValid(data: EmailValidationData): boolean {
  // valid and catchall are both reachable (matching GAS behavior)
  return data.isValid || data.isCatchAll
}

// ============================================================================
// Address Validation Result Interpretation
// ============================================================================

export interface AddressValidationData {
  standardized: {
    streetAddress: string
    secondaryAddress: string
    city: string
    state: string
    ZIPCode: string
    ZIPPlus4: string
  }
  deliverable: boolean
  dpvConfirmation: string
  dpvDescription: string
  vacant: boolean
  business: boolean
  cmra: boolean
  deliveryPoint: string
  carrierRoute: string
  corrections: string[]
}

/** Determine if an address validation result counts as "valid" for scoring. */
export function isAddressValid(data: AddressValidationData): boolean {
  return data.deliverable && !data.vacant
}

// ============================================================================
// Composite Scoring
// ============================================================================

/**
 * Build a composite quality score from pre-validated channel results.
 *
 * This is the pure scoring function. It takes already-validated channel results
 * and computes the grade/score. The caller is responsible for running the
 * actual API validations and passing results here.
 *
 * @param channels - Object with phone/email/address validation outcomes.
 * @returns Composite ContactQualityScore with grade, score, and per-channel details.
 */
export function scoreContactQuality(channels: {
  phone?: { success: boolean; valid: boolean; error?: string; data?: Record<string, unknown> }
  email?: { success: boolean; valid: boolean; error?: string; data?: Record<string, unknown> }
  address?: { success: boolean; valid: boolean; error?: string; data?: Record<string, unknown> }
}): ContactQualityScore {
  let channelsChecked = 0
  let channelsValid = 0
  let channelsDegraded = 0

  const phoneResult: ChannelResult = { checked: false, valid: false }
  const emailResult: ChannelResult = { checked: false, valid: false }
  const addressResult: ChannelResult = { checked: false, valid: false }

  // Phone
  if (channels.phone) {
    phoneResult.checked = true
    channelsChecked++
    if (channels.phone.success && channels.phone.valid) {
      phoneResult.valid = true
      channelsValid++
    } else {
      channelsDegraded++
      phoneResult.error = channels.phone.error
    }
    phoneResult.data = channels.phone.data
  }

  // Email
  if (channels.email) {
    emailResult.checked = true
    channelsChecked++
    if (channels.email.success && channels.email.valid) {
      emailResult.valid = true
      channelsValid++
    } else {
      channelsDegraded++
      emailResult.error = channels.email.error
    }
    emailResult.data = channels.email.data
  }

  // Address
  if (channels.address) {
    addressResult.checked = true
    channelsChecked++
    if (channels.address.success && channels.address.valid) {
      addressResult.valid = true
      channelsValid++
    } else {
      channelsDegraded++
      addressResult.error = channels.address.error
    }
    addressResult.data = channels.address.data
  }

  // Calculate grade
  let grade: QualityGrade = 'red'
  let score = 0

  if (channelsChecked > 0) {
    score = Math.round((channelsValid / channelsChecked) * 100)
    if (channelsValid === channelsChecked) {
      grade = 'green'
    } else if (channelsValid > 0) {
      grade = 'yellow'
    }
  }

  // Build summary
  let summary: string
  if (grade === 'green') {
    summary = 'All channels valid'
  } else if (grade === 'yellow') {
    summary = `${channelsValid}/${channelsChecked} channels valid`
  } else if (channelsChecked === 0) {
    summary = 'No contact data provided'
  } else {
    summary = 'Unreachable — all channels invalid'
  }

  return {
    score,
    grade,
    channelsChecked,
    channelsValid,
    channelsDegraded,
    phone: phoneResult,
    email: emailResult,
    address: addressResult,
    summary,
  }
}

/**
 * Quick quality score from raw contact fields — no API calls.
 * Counts how many channels are present (non-empty) and gives a
 * presence-based score. For validated scoring, use the API endpoints.
 */
export function quickContactScore(contact: ContactScoreInput): ContactQualityScore {
  let channelsChecked = 0
  let channelsValid = 0

  const phoneResult: ChannelResult = { checked: false, valid: false }
  const emailResult: ChannelResult = { checked: false, valid: false }
  const addressResult: ChannelResult = { checked: false, valid: false }

  // Phone presence
  const phoneDigits = (contact.phone || '').replace(/\D/g, '')
  if (phoneDigits.length > 0) {
    phoneResult.checked = true
    channelsChecked++
    if (phoneDigits.length === 10 || (phoneDigits.length === 11 && phoneDigits.charAt(0) === '1')) {
      phoneResult.valid = true
      channelsValid++
    }
  }

  // Email presence
  if (contact.email && contact.email.includes('@')) {
    emailResult.checked = true
    channelsChecked++
    emailResult.valid = true
    channelsValid++
  }

  // Address presence
  if (contact.address?.streetAddress) {
    addressResult.checked = true
    channelsChecked++
    addressResult.valid = true
    channelsValid++
  }

  let grade: QualityGrade = 'red'
  let score = 0
  if (channelsChecked > 0) {
    score = Math.round((channelsValid / channelsChecked) * 100)
    if (channelsValid === channelsChecked) grade = 'green'
    else if (channelsValid > 0) grade = 'yellow'
  }

  const summary = channelsChecked === 0
    ? 'No contact data provided'
    : channelsValid === channelsChecked
      ? 'All channels present'
      : `${channelsValid}/${channelsChecked} channels present`

  return {
    score,
    grade,
    channelsChecked,
    channelsValid,
    channelsDegraded: channelsChecked - channelsValid,
    phone: phoneResult,
    email: emailResult,
    address: addressResult,
    summary,
  }
}
