/**
 * Validation Routes — External API validation endpoints.
 * Ported from RAPID_CORE CORE_Validation_API.gs
 *
 * Routes:
 *   POST /api/validation/score   — Composite contact quality score
 *   POST /api/validation/phone   — Phone number validation (PhoneValidator)
 *   POST /api/validation/email   — Email deliverability check (NeverBounce)
 *   POST /api/validation/address — Address standardization (USPS v3)
 *   GET  /api/validation/city-state?zip=XXXXX — City/state from ZIP
 *   POST /api/validation/routing  — Bank routing number lookup
 */

import { Router, type Request, type Response } from 'express'
import { successResponse, errorResponse, validateRequired } from '../lib/helpers.js'
import {
  validatePhone,
  validateEmail,
  validateAddress,
  lookupCityState,
  lookupRoutingNumber,
} from '../lib/validation-apis.js'
import {
  scoreContactQuality,
  isPhoneValid,
  isEmailValid,
  isAddressValid,
  type PhoneValidationData,
  type EmailValidationData,
  type AddressValidationData,
} from '@tomachina/core'

export const validationRoutes = Router()

// ============================================================================
// POST /api/validation/score — Composite contact quality score
// ============================================================================

validationRoutes.post('/score', async (req: Request, res: Response) => {
  try {
    const { phone, email, address, skipPhone, skipEmail, skipAddress } = req.body as {
      phone?: string
      email?: string
      address?: { streetAddress: string; secondaryAddress?: string; city?: string; state?: string; ZIPCode?: string }
      skipPhone?: boolean
      skipEmail?: boolean
      skipAddress?: boolean
    }

    // Validate in parallel (only channels that have data and aren't skipped)
    const [phoneResult, emailResult, addressResult] = await Promise.all([
      phone && !skipPhone ? validatePhone(phone) : Promise.resolve(null),
      email && !skipEmail ? validateEmail(email) : Promise.resolve(null),
      address?.streetAddress && !skipAddress ? validateAddress(address) : Promise.resolve(null),
    ])

    // Build channel inputs for scoring
    const channels: Parameters<typeof scoreContactQuality>[0] = {}

    if (phoneResult) {
      channels.phone = {
        success: phoneResult.success,
        valid: phoneResult.success && phoneResult.data ? isPhoneValid(phoneResult.data as unknown as PhoneValidationData) : false,
        error: phoneResult.error,
        data: phoneResult.data as unknown as Record<string, unknown>,
      }
    }

    if (emailResult) {
      channels.email = {
        success: emailResult.success,
        valid: emailResult.success && emailResult.data ? isEmailValid(emailResult.data as unknown as EmailValidationData) : false,
        error: emailResult.error,
        data: emailResult.data as unknown as Record<string, unknown>,
      }
    }

    if (addressResult) {
      channels.address = {
        success: addressResult.success,
        valid: addressResult.success && addressResult.data ? isAddressValid(addressResult.data as unknown as AddressValidationData) : false,
        error: addressResult.error,
        data: addressResult.data as unknown as Record<string, unknown>,
      }
    }

    const score = scoreContactQuality(channels)

    res.json(successResponse(score))
  } catch (err) {
    console.error('POST /api/validation/score error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ============================================================================
// POST /api/validation/phone — Phone number validation
// ============================================================================

validationRoutes.post('/phone', async (req: Request, res: Response) => {
  try {
    const missing = validateRequired(req.body, ['phone'])
    if (missing) { res.status(400).json(errorResponse(missing)); return }

    const { phone, type } = req.body as { phone: string; type?: 'basic' | 'detail' }
    const result = await validatePhone(phone, type)

    if (!result.success) {
      res.status(422).json(errorResponse(result.error || 'Phone validation failed'))
      return
    }

    res.json(successResponse(result.data))
  } catch (err) {
    console.error('POST /api/validation/phone error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ============================================================================
// POST /api/validation/email — Email deliverability check
// ============================================================================

validationRoutes.post('/email', async (req: Request, res: Response) => {
  try {
    const missing = validateRequired(req.body, ['email'])
    if (missing) { res.status(400).json(errorResponse(missing)); return }

    const { email } = req.body as { email: string }
    const result = await validateEmail(email)

    if (!result.success) {
      res.status(422).json(errorResponse(result.error || 'Email validation failed'))
      return
    }

    res.json(successResponse(result.data))
  } catch (err) {
    console.error('POST /api/validation/email error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ============================================================================
// POST /api/validation/address — Address standardization (USPS v3)
// ============================================================================

validationRoutes.post('/address', async (req: Request, res: Response) => {
  try {
    const missing = validateRequired(req.body, ['streetAddress'])
    if (missing) { res.status(400).json(errorResponse(missing)); return }

    const address = req.body as { streetAddress: string; secondaryAddress?: string; city?: string; state?: string; ZIPCode?: string }
    const result = await validateAddress(address)

    if (!result.success) {
      res.status(422).json(errorResponse(result.error || 'Address validation failed'))
      return
    }

    res.json(successResponse(result.data))
  } catch (err) {
    console.error('POST /api/validation/address error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ============================================================================
// GET /api/validation/city-state?zip=XXXXX — City/state from ZIP
// ============================================================================

validationRoutes.get('/city-state', async (req: Request, res: Response) => {
  try {
    const zip = (req.query.zip as string) || ''
    if (!zip) {
      res.status(400).json(errorResponse('Missing required query parameter: zip'))
      return
    }

    const result = await lookupCityState(zip)

    if (!result.success) {
      res.status(422).json(errorResponse(result.error || 'City-state lookup failed'))
      return
    }

    res.json(successResponse(result.data))
  } catch (err) {
    console.error('GET /api/validation/city-state error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ============================================================================
// POST /api/validation/routing — Bank routing number lookup
// ============================================================================

validationRoutes.post('/routing', async (req: Request, res: Response) => {
  try {
    const missing = validateRequired(req.body, ['routingNumber'])
    if (missing) { res.status(400).json(errorResponse(missing)); return }

    const { routingNumber } = req.body as { routingNumber: string }
    const result = await lookupRoutingNumber(routingNumber)

    if (!result.success) {
      res.status(422).json(errorResponse(result.error || 'Routing number lookup failed'))
      return
    }

    res.json(successResponse(result.data))
  } catch (err) {
    console.error('POST /api/validation/routing error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})
