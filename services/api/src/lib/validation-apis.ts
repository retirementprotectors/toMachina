/**
 * External Validation API Wrappers — Server-side only.
 * Ported from RAPID_CORE CORE_Validation_API.gs
 *
 * Services:
 *   - Phone Validator (phonevalidator.com) — line type, carrier, ported status
 *   - NeverBounce — email deliverability validation
 *   - USPS Addresses v3 — CASS-certified address standardization + city/state lookup
 *   - Bank Routing (bankrouting.io) — ABA routing number → bank name
 *
 * All API keys read from environment variables.
 * USPS uses OAuth with in-memory token cache.
 *
 * @module services/api/lib/validation-apis
 */

// ============================================================================
// Configuration
// ============================================================================

const VALIDATION_CONFIG = {
  PHONE_VALIDATOR: {
    url: 'https://api.phonevalidator.com/api/v2/phonesearch',
    envKey: 'PHONE_VALIDATOR_API_KEY',
  },
  NEVERBOUNCE: {
    url: 'https://api.neverbounce.com/v4/single/check',
    envKey: 'NEVERBOUNCE_API_KEY',
  },
  USPS: {
    tokenUrl: 'https://apis.usps.com/oauth2/v3/token',
    addressUrl: 'https://apis.usps.com/addresses/v3/address',
    cityStateUrl: 'https://apis.usps.com/addresses/v3/city-state',
    clientIdKey: 'USPS_CONSUMER_KEY',
    clientSecretKey: 'USPS_CONSUMER_SECRET',
  },
  BANK_ROUTING: {
    url: 'https://bankrouting.io/api/v1/aba',
  },
} as const

// ============================================================================
// Types
// ============================================================================

interface StructuredResult<T> {
  success: boolean
  data?: T
  error?: string
}

export interface PhoneValidationResult {
  lineType: string
  carrier: string
  location: string
  ported: boolean | null
  fake: boolean | null
  isCell: boolean
  raw: Record<string, unknown>
}

export interface EmailValidationResult {
  result: string
  isValid: boolean
  isInvalid: boolean
  isDisposable: boolean
  isCatchAll: boolean
  isUnknown: boolean
  flags: string[]
  suggestedCorrection: string
  raw: Record<string, unknown>
}

export interface AddressInput {
  streetAddress: string
  secondaryAddress?: string
  city?: string
  state?: string
  ZIPCode?: string
}

export interface AddressValidationResult {
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
  raw: Record<string, unknown>
}

export interface CityStateResult {
  city: string
  state: string
  ZIPCode: string
  raw: Record<string, unknown>
}

export interface BankRoutingResult {
  bankName: string
  city: string
  state: string
  routingNumber: string
  raw: Record<string, unknown>
}

// ============================================================================
// USPS OAuth Token Cache (in-memory)
// ============================================================================

let uspsTokenCache: { token: string; expiresAt: number } | null = null

async function getUSPSToken(): Promise<string | null> {
  // Check cache — refresh 30 minutes before expiry
  if (uspsTokenCache && Date.now() < uspsTokenCache.expiresAt - 1_800_000) {
    return uspsTokenCache.token
  }

  const clientId = process.env[VALIDATION_CONFIG.USPS.clientIdKey]
  const clientSecret = process.env[VALIDATION_CONFIG.USPS.clientSecretKey]

  if (!clientId || !clientSecret) {
    console.error('USPS credentials not configured (USPS_CONSUMER_KEY / USPS_CONSUMER_SECRET)')
    return null
  }

  try {
    const response = await fetch(VALIDATION_CONFIG.USPS.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
        scope: 'addresses',
      }).toString(),
    })

    if (!response.ok) {
      const text = await response.text()
      console.error(`USPS OAuth failed [${response.status}]: ${text.substring(0, 500)}`)
      return null
    }

    const tokenData = (await response.json()) as { access_token: string; expires_in?: number }
    const expiresIn = tokenData.expires_in || 28800

    uspsTokenCache = {
      token: tokenData.access_token,
      expiresAt: Date.now() + expiresIn * 1000,
    }

    return tokenData.access_token
  } catch (err) {
    console.error('getUSPSToken error:', err)
    return null
  }
}

// ============================================================================
// PHONE VALIDATION (phonevalidator.com)
// ============================================================================

/**
 * Validate a phone number — returns line type, carrier, location, ported status.
 *
 * @param phone - Phone number (10 digits, any format)
 * @param type - Lookup type: 'basic' or 'detail'
 */
export async function validatePhone(
  phone: string,
  type: 'basic' | 'detail' = 'basic'
): Promise<StructuredResult<PhoneValidationResult>> {
  try {
    const apiKey = process.env[VALIDATION_CONFIG.PHONE_VALIDATOR.envKey]
    if (!apiKey) return { success: false, error: 'PHONE_VALIDATOR_API_KEY not configured' }

    // Clean phone to digits only
    let digits = (phone || '').replace(/\D/g, '')
    if (digits.length === 11 && digits.charAt(0) === '1') digits = digits.substring(1)
    if (digits.length !== 10) {
      return { success: false, error: `Invalid phone: must be 10 digits, got ${digits.length}` }
    }

    const url =
      `${VALIDATION_CONFIG.PHONE_VALIDATOR.url}` +
      `?apikey=${encodeURIComponent(apiKey)}` +
      `&phone=${digits}` +
      `&type=${type}`

    const response = await fetch(url)
    if (!response.ok) {
      const text = await response.text()
      return { success: false, error: `Phone Validator API returned ${response.status}: ${text.substring(0, 500)}` }
    }

    const raw = (await response.json()) as Record<string, unknown>
    const props = raw.PhoneProperties as Record<string, unknown> | undefined

    const lineType = props ? String(props.LineType || 'Unknown') : String(raw.LineType || 'Unknown')
    const carrier = props ? String(props.Carrier || '') : String(raw.Carrier || '')

    return {
      success: true,
      data: {
        lineType,
        carrier,
        location: props ? `${props.City}, ${props.State}` : '',
        ported: props ? (props.Ported as boolean | null) : null,
        fake: props ? (props.FakeNumber as boolean | null) : null,
        isCell: lineType.toLowerCase().includes('cell'),
        raw,
      },
    }
  } catch (err) {
    return { success: false, error: String(err instanceof Error ? err.message : err) }
  }
}

// ============================================================================
// EMAIL VALIDATION (NeverBounce)
// ============================================================================

/**
 * Validate an email address — returns deliverability status.
 * Result codes: valid, invalid, disposable, catchall, unknown.
 */
export async function validateEmail(email: string): Promise<StructuredResult<EmailValidationResult>> {
  try {
    const apiKey = process.env[VALIDATION_CONFIG.NEVERBOUNCE.envKey]
    if (!apiKey) return { success: false, error: 'NEVERBOUNCE_API_KEY not configured' }

    if (!email || !email.includes('@')) {
      return { success: false, error: 'Invalid email format' }
    }

    // Encode + as %2B per NeverBounce docs
    const encodedEmail = encodeURIComponent(email).replace(/\+/g, '%2B')
    const url = `${VALIDATION_CONFIG.NEVERBOUNCE.url}?key=${encodeURIComponent(apiKey)}&email=${encodedEmail}`

    const response = await fetch(url)
    if (!response.ok) {
      const text = await response.text()
      return { success: false, error: `NeverBounce API returned ${response.status}: ${text.substring(0, 500)}` }
    }

    const raw = (await response.json()) as Record<string, unknown>

    if (raw.status !== 'success') {
      return { success: false, error: `NeverBounce error: ${raw.message || raw.status}` }
    }

    const result = String(raw.result)
    return {
      success: true,
      data: {
        result,
        isValid: result === 'valid',
        isInvalid: result === 'invalid',
        isDisposable: result === 'disposable',
        isCatchAll: result === 'catchall',
        isUnknown: result === 'unknown',
        flags: (raw.flags as string[]) || [],
        suggestedCorrection: String(raw.suggested_correction || ''),
        raw,
      },
    }
  } catch (err) {
    return { success: false, error: String(err instanceof Error ? err.message : err) }
  }
}

// ============================================================================
// ADDRESS VALIDATION (USPS Addresses v3)
// ============================================================================

/**
 * Validate and standardize a US address via USPS CASS certification.
 *
 * DPV Confirmation codes:
 *   Y = Confirmed deliverable
 *   D = Address found, needs secondary info (apt/suite)
 *   S = Secondary info provided but not confirmed
 *   N = Not confirmed / not deliverable
 */
export async function validateAddress(address: AddressInput): Promise<StructuredResult<AddressValidationResult>> {
  try {
    if (!address?.streetAddress) {
      return { success: false, error: 'streetAddress is required' }
    }

    const token = await getUSPSToken()
    if (!token) return { success: false, error: 'Failed to obtain USPS OAuth token' }

    // Build query params
    const params = new URLSearchParams()
    params.set('streetAddress', address.streetAddress)
    if (address.secondaryAddress) params.set('secondaryAddress', address.secondaryAddress)
    if (address.city) params.set('city', address.city)
    if (address.state) params.set('state', address.state)
    if (address.ZIPCode) params.set('ZIPCode', address.ZIPCode)

    const url = `${VALIDATION_CONFIG.USPS.addressUrl}?${params.toString()}`

    const response = await fetch(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    })

    if (!response.ok) {
      let errMsg = `USPS API returned ${response.status}`
      try {
        const errData = (await response.json()) as { error?: { message?: string } }
        if (errData.error?.message) errMsg = errData.error.message
      } catch {
        // ignore JSON parse failure on error body
      }
      return { success: false, error: errMsg }
    }

    const raw = (await response.json()) as Record<string, unknown>
    const addr = (raw.address as Record<string, unknown>) || {}
    const info = (raw.additionalInfo as Record<string, unknown>) || {}
    const corrections = (raw.corrections as Array<{ text?: string; code?: string }>) || []

    const dpv = String(info.DPVConfirmation || '')
    const dpvDescriptions: Record<string, string> = {
      Y: 'Confirmed',
      D: 'Missing secondary (apt/suite)',
      S: 'Secondary not confirmed',
      N: 'Not deliverable',
    }

    return {
      success: true,
      data: {
        standardized: {
          streetAddress: String(addr.streetAddress || ''),
          secondaryAddress: String(addr.secondaryAddress || ''),
          city: String(addr.city || ''),
          state: String(addr.state || ''),
          ZIPCode: String(addr.ZIPCode || ''),
          ZIPPlus4: String(addr.ZIPPlus4 || ''),
        },
        deliverable: dpv === 'Y' || dpv === 'D',
        dpvConfirmation: dpv,
        dpvDescription: dpvDescriptions[dpv] || 'Unknown',
        vacant: info.vacant === 'Y',
        business: info.business === 'Y',
        cmra: info.DPVCMRA === 'Y',
        deliveryPoint: String(info.deliveryPoint || ''),
        carrierRoute: String(info.carrierRoute || ''),
        corrections: corrections.map((c) => String(c.text || c.code || '')),
        raw,
      },
    }
  } catch (err) {
    return { success: false, error: String(err instanceof Error ? err.message : err) }
  }
}

// ============================================================================
// CITY/STATE LOOKUP (USPS)
// ============================================================================

/**
 * Look up city and state from a ZIP code.
 */
export async function lookupCityState(zipCode: string): Promise<StructuredResult<CityStateResult>> {
  try {
    let zip = (zipCode || '').replace(/\D/g, '')
    if (zip.length === 4) zip = '0' + zip
    if (zip.length !== 5) {
      return { success: false, error: `Invalid ZIP code: must be 5 digits` }
    }

    const token = await getUSPSToken()
    if (!token) return { success: false, error: 'Failed to obtain USPS OAuth token' }

    const url = `${VALIDATION_CONFIG.USPS.cityStateUrl}?ZIPCode=${zip}`

    const response = await fetch(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    })

    if (!response.ok) {
      return { success: false, error: `USPS city-state lookup returned ${response.status}` }
    }

    const raw = (await response.json()) as Record<string, unknown>
    return {
      success: true,
      data: {
        city: String(raw.city || ''),
        state: String(raw.state || ''),
        ZIPCode: zip,
        raw,
      },
    }
  } catch (err) {
    return { success: false, error: String(err instanceof Error ? err.message : err) }
  }
}

// ============================================================================
// BANK ROUTING NUMBER LOOKUP (bankrouting.io)
// ============================================================================

/**
 * Look up bank name from ABA routing number.
 * Free API, no auth required, 100 requests/hour.
 */
export async function lookupRoutingNumber(routingNumber: string): Promise<StructuredResult<BankRoutingResult>> {
  try {
    const digits = (routingNumber || '').replace(/\D/g, '')
    if (digits.length !== 9) {
      return { success: false, error: `Invalid routing number: must be 9 digits, got ${digits.length}` }
    }

    const url = `${VALIDATION_CONFIG.BANK_ROUTING.url}/${digits}`

    const response = await fetch(url)
    if (!response.ok) {
      return { success: false, error: `Bank routing lookup returned ${response.status}` }
    }

    const raw = (await response.json()) as { status?: string; data?: Record<string, unknown>; error?: { message?: string } }

    if (raw.status !== 'success') {
      return { success: false, error: raw.error?.message || 'Routing number not found' }
    }

    const data = raw.data || {}
    return {
      success: true,
      data: {
        bankName: String(data.bank_name || ''),
        city: String(data.city || ''),
        state: String(data.state || ''),
        routingNumber: String(data.aba_number || digits),
        raw: raw as unknown as Record<string, unknown>,
      },
    }
  } catch (err) {
    return { success: false, error: String(err instanceof Error ? err.message : err) }
  }
}
