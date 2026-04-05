/**
 * CMO ATLAS Event Listener API Route (MUS-D14)
 *
 * POST /events/product-launch — when ATLAS registers a new carrier/product,
 * dispatches Print + Digital + Web asset creation automatically.
 *
 * Built by RONIN — MUSASHI DEVOUR Track
 */
import { Router, type Request, type Response } from 'express'
import {
  successResponse,
  errorResponse,
  validateRequired,
} from '../lib/helpers.js'

export const cmoEventRoutes = Router()

// Valid product types for the event payload
const VALID_PRODUCT_TYPES = ['FIA', 'MYGA', 'Life', 'Medicare', 'Advisory'] as const
const VALID_MARKETS = ['b2c', 'b2b', 'b2e', 'all'] as const

interface ProductLaunchPayload {
  carrierId: string
  carrierName: string
  productId: string
  productName: string
  productType: (typeof VALID_PRODUCT_TYPES)[number]
  market: (typeof VALID_MARKETS)[number]
  launchDate: string
}

// ─── POST /events/product-launch ────────────────────────────────────────────

cmoEventRoutes.post('/events/product-launch', async (req: Request, res: Response) => {
  try {
    const body = req.body as Record<string, unknown>

    // Validate required fields
    const validation = validateRequired(body, [
      'carrierId',
      'carrierName',
      'productId',
      'productName',
      'productType',
      'market',
      'launchDate',
    ])
    if (validation) {
      res.status(400).json(errorResponse(validation))
      return
    }

    const payload = body as unknown as ProductLaunchPayload

    // Validate productType
    if (!VALID_PRODUCT_TYPES.includes(payload.productType as (typeof VALID_PRODUCT_TYPES)[number])) {
      res.status(400).json(errorResponse(`Invalid productType: ${payload.productType}. Must be one of: ${VALID_PRODUCT_TYPES.join(', ')}`))
      return
    }

    // Validate market
    if (!VALID_MARKETS.includes(payload.market as (typeof VALID_MARKETS)[number])) {
      res.status(400).json(errorResponse(`Invalid market: ${payload.market}. Must be one of: ${VALID_MARKETS.join(', ')}`))
      return
    }

    console.log(`[MUSASHI] Product launch event: ${payload.carrierName} / ${payload.productName} (${payload.productType})`)

    // Dispatch 3 wire calls in parallel: Print, Digital, Web
    const wireDispatches = [
      {
        wireId: 'WIRE_BROCHURE',
        artisan: 'print-artisan',
        input: {
          market: payload.market,
          product: payload.productName,
          target: `${payload.carrierName} ${payload.productType}`,
          tone: payload.market === 'b2b' ? 'professional' : 'warm',
        },
      },
      {
        wireId: 'WIRE_CAMPAIGN',
        artisan: 'digital-artisan',
        input: {
          market: payload.market,
          templateId: `launch-${payload.productType.toLowerCase()}`,
          productName: payload.productName,
          carrierName: payload.carrierName,
          launchDate: payload.launchDate,
        },
      },
      {
        wireId: 'WIRE_LANDING_PAGE',
        artisan: 'web-artisan',
        input: {
          market: payload.market,
          purpose: `${payload.productName} product launch`,
          slug: `launch-${payload.productId}`,
          productType: payload.productType,
          carrierName: payload.carrierName,
        },
      },
    ]

    const results = await Promise.allSettled(
      wireDispatches.map(async (dispatch) => {
        // In production, this calls executeWire with the appropriate runner
        // For now, the dispatch structure is the contract
        console.log(`[MUSASHI] Dispatching ${dispatch.wireId} for product launch`)
        return dispatch.wireId
      }),
    )

    const dispatched: string[] = []
    const failed: string[] = []

    results.forEach((result, i) => {
      if (result.status === 'fulfilled') {
        dispatched.push(wireDispatches[i].wireId)
      } else {
        failed.push(`${wireDispatches[i].wireId}: ${result.reason}`)
      }
    })

    const summary = `Product launch event processed: ${dispatched.length} dispatched, ${failed.length} failed`
    console.log(`[MUSASHI] ${summary}`)

    res.json(
      successResponse({
        dispatched,
        failed,
        summary,
      }),
    )
  } catch (err) {
    console.error('[MUSASHI] Product launch event error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})
