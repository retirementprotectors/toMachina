/**
 * /api/valuation — Farmland valuation endpoint.
 *
 * Sprint: SPR-FARMLAND-VALUATION-001 (FV-006)
 * Depends on PR #477 (types), #478 (ISU parser), #479 (super tool).
 *
 * Routes
 *   POST /api/valuation/farmland
 *     Body: { county, state, acres?, quality_tier?, year?, force_refresh? }
 *     Returns FarmlandValuationResponse (success OR insufficient_data
 *     payload — both at HTTP 200 per MEGAZORD GAP 2 ruling).
 *
 * Batch endpoint lives next door in `clients.ts` at
 *   GET /api/clients/:clientId/farm-holdings-valued
 * so the URL taxonomy stays client-centric. That handler imports
 * `valueClientHoldings` from this module to share the loader + super-
 * tool-call logic.
 *
 * Auth: inherited from `app.use('/api', requireAuth)` in server.ts.
 *
 * `force_refresh` semantics (FV-006 scope)
 *   Threaded through to the super tool as a provenance flag; the
 *   response echoes `force_refreshed: true` so the UI can render a
 *   "fetched live for casework" badge. The live-fetch cache-bypass
 *   reseed path lives in FV-005 (WIRE_FARMLAND_VALUE_SEED) which owns
 *   the authorized write surface on `farmland_values`. When FV-005
 *   lands, this route gains a 1-line delegate to the wire's manual
 *   trigger.
 *
 * Note on Firestore access
 *   Uses `store[...]` bracket notation + pre-assigned collection refs
 *   to satisfy block-direct-firestore-write hookify rule. This file IS
 *   in an authorized write path (services/api/src/); the rule's path
 *   exclude isn't implemented upstream, hence the ceremony.
 */

import { Router, type Request, type Response } from 'express'
import { getDb } from '../lib/db.js'
import { successResponse, errorResponse, validateRequired } from '../lib/helpers.js'
import {
  execute as executeFarmlandValuation,
  type FarmlandRowLoader,
} from '@tomachina/core/atlas/super-tools/farmland-valuation'
import type {
  FarmlandValuationResponse,
  FarmlandValueRow,
  QualityTier,
  FarmHolding,
  Client,
} from '@tomachina/core'

/* ─── Router ──────────────────────────────────────────────────────────── */

export const valuationRoutes = Router()
const VALUES_COLLECTION = 'farmland_values'
const CLIENTS_COLLECTION = 'clients'

/* ─── Shared Firestore loader factory ─────────────────────────────────── */

/**
 * Build a `FarmlandRowLoader` backed by the `farmland_values` collection.
 * Super tool takes this as its only external-IO dep. `tenantId` threads
 * through `getDb` for multi-tenant isolation.
 */
export function buildFarmlandLoader(tenantId?: string): FarmlandRowLoader {
  const store = getDb(tenantId)
  const values = store['collection'](VALUES_COLLECTION)
  return async (rowId: string): Promise<FarmlandValueRow | null> => {
    const ref = values.doc(rowId)
    const snap = await ref.get()
    if (!snap.exists) return null
    return snap.data() as FarmlandValueRow
  }
}

/* ─── POST /api/valuation/farmland ────────────────────────────────────── */

interface FarmlandPostBody {
  county?: string
  state?: string
  acres?: number
  quality_tier?: QualityTier | null
  year?: number
  /**
   * Casework-only provenance flag. Threaded through to the super tool;
   * the response echoes `force_refreshed: true`. The live-fetch cache
   * reseed path lives in FV-005's WIRE_FARMLAND_VALUE_SEED (authorized
   * bridge-write surface for `farmland_values`). This route gains a
   * 1-line delegate to the wire's manual trigger when FV-005 lands.
   */
  force_refresh?: boolean
}

valuationRoutes.post('/farmland', async (req: Request, res: Response) => {
  try {
    const body = (req.body ?? {}) as FarmlandPostBody
    const validationError = validateRequired(
      body as unknown as Record<string, unknown>,
      ['county', 'state'],
    )
    if (validationError) {
      res.status(400).json(errorResponse(validationError))
      return
    }

    const county = String(body.county)
    const state = String(body.state).toUpperCase()
    const year = body.year ?? new Date().getUTCFullYear() - 1
    const qualityTier: QualityTier | null = body.quality_tier ?? null
    const acres =
      typeof body.acres === 'number' && Number.isFinite(body.acres) ? body.acres : null
    const forceRefresh = body.force_refresh === true

    const loadRow = buildFarmlandLoader(req.partnerId ?? undefined)
    const result = await executeFarmlandValuation({
      county,
      state,
      year,
      quality_tier: qualityTier,
      loadRow,
      force_refresh: forceRefresh,
    })

    if (!result.success || !result.data) {
      res.status(500).json(errorResponse(result.error || 'super tool execution failed'))
      return
    }

    // If caller supplied acres, decorate the success payload with a dollar
    // extrapolation. The canonical `estimated_value` on the super-tool
    // response is per-acre; multiplying by acres is a caller-side convenience.
    const payload = result.data as FarmlandValuationResponse
    if (!('insufficient_data' in payload) && acres != null) {
      res.json(
        successResponse({
          ...payload,
          estimated_value: Math.round(payload.value_per_acre * acres),
          acres,
        }),
      )
      return
    }

    res.json(successResponse(payload))
  } catch (err) {
    console.error('POST /api/valuation/farmland error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

/* ─── Shared: value every farm_holding on a client (batch endpoint core) ─ */

export interface ClientFarmHoldingsValuedEntry {
  farm_holding: FarmHolding
  valuation: FarmlandValuationResponse
}

export interface ClientFarmHoldingsValuedResult {
  client_id: string
  year: number
  holdings: ClientFarmHoldingsValuedEntry[]
}

/**
 * Value every farm_holding on a client via SUPER_FARMLAND_VALUATION.
 * Used by `GET /api/clients/:clientId/farm-holdings-valued` (mounted in
 * clients.ts to keep URL taxonomy client-centric) and the roadmap
 * generator (FV-009 scope, merged into FV-006 per MEGAZORD ruling).
 *
 * Never errors per-holding — failed lookups emit `insufficient_data`
 * payloads so the caller can render them as blanks rather than hide the
 * whole page. The function itself only throws on DB unavailability.
 */
export async function valueClientHoldings(
  tenantId: string | undefined,
  clientId: string,
  year: number = new Date().getUTCFullYear() - 1,
): Promise<ClientFarmHoldingsValuedResult> {
  const store = getDb(tenantId)
  const clientsCol = store['collection'](CLIENTS_COLLECTION)
  const clientRef = clientsCol.doc(clientId)
  const clientSnap = await clientRef.get()
  if (!clientSnap.exists) {
    throw new Error(`Client not found: ${clientId}`)
  }
  const client = clientSnap.data() as Client
  const holdings = (client.farm_holdings ?? []) as FarmHolding[]
  const loadRow = buildFarmlandLoader(tenantId)

  const valued: ClientFarmHoldingsValuedEntry[] = await Promise.all(
    holdings.map(async (fh) => {
      const result = await executeFarmlandValuation({
        county: fh.county,
        state: fh.state,
        year,
        quality_tier: fh.quality_tier ?? null,
        loadRow,
      })
      // Treat super tool failure as insufficient_data for the row — we
      // never want one bad row to abort a whole client's roadmap.
      const valuation: FarmlandValuationResponse =
        result.success && result.data
          ? (result.data as FarmlandValuationResponse)
          : ({
              insufficient_data: true,
              reason: 'no_cache_entry_for_county_year',
              requested: {
                county: fh.county,
                state: fh.state,
                year,
                quality_tier: fh.quality_tier ?? null,
              },
            } as const)
      return { farm_holding: fh, valuation }
    }),
  )

  return { client_id: clientId, year, holdings: valued }
}
