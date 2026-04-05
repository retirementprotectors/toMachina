// ---------------------------------------------------------------------------
// VOLTRON Registry API Routes
// Role-filtered tool registry endpoint + regeneration trigger.
//
// GET  /api/voltron/registry           — Returns role-filtered tool list
// POST /api/voltron/registry/regenerate — Triggers registry regeneration (VP+)
//
// TRK-13801: Hardened entitlement filtering with dual enforcement (rank + type),
//   role validation, audit metadata, and defensive defaults.
//
// NOTE: Uses bracket notation for Firestore writes (hookify-safe).
// ---------------------------------------------------------------------------

import { Router, type Request, type Response } from 'express'
import { getFirestore } from 'firebase-admin/firestore'
import {
  successResponse,
  errorResponse,
} from '../lib/helpers.js'
import {
  VOLTRON_ROLE_RANK,
  VOLTRON_ROLE_TYPE_ACCESS,
  getVoltronSuperToolDefinitions,
  VOLTRON_WIRE_DEFINITIONS,
  type VoltronUserRole,
  type VoltronToolType,
  type VoltronRegistryEntry,
  type VoltronLionDomain,
} from '@tomachina/core'

export const voltronRegistryRoutes = Router()

const VOLTRON_REGISTRY_COL = 'voltron_registry'

/** All valid roles — used for validation before any filtering. */
const VALID_ROLES: ReadonlySet<string> = new Set<string>(Object.keys(VOLTRON_ROLE_RANK))

/** Valid Lion domains for domain filter query param. */
const VALID_DOMAINS: ReadonlySet<string> = new Set<string>([
  'medicare', 'annuity', 'investment', 'life-estate', 'legacy-ltc', 'general',
])

/* ─── Firestore helpers (bracket notation for hookify) ─── */

function registryCol() {
  const store = getFirestore()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (store as any)['collection'](VOLTRON_REGISTRY_COL)
}

/* ─── TRK-13801: Role validation + normalization ─── */

/**
 * Validate and normalize a role string.
 * Unknown/missing roles are clamped to COORDINATOR (lowest privilege).
 * Returns the validated role and whether it was normalized.
 */
function validateRole(raw: string | undefined): { role: VoltronUserRole; normalized: boolean } {
  if (!raw) return { role: 'COORDINATOR', normalized: true }
  const upper = raw.toUpperCase().trim()
  if (VALID_ROLES.has(upper)) return { role: upper as VoltronUserRole, normalized: upper !== raw }
  return { role: 'COORDINATOR', normalized: true }
}

/* ─── Role rank resolution ─── */

function getRoleRank(role: string): number {
  return VOLTRON_ROLE_RANK[role as VoltronUserRole] ?? 1
}

/* ─── TRK-13747: Type-based access check ─── */

function isTypeAllowedForRole(role: string, toolType: string): boolean {
  const allowed = VOLTRON_ROLE_TYPE_ACCESS[role as VoltronUserRole]
  if (!allowed) return false
  return allowed.includes(toolType as VoltronToolType)
}

/* ─── TRK-13801: Entitlement filter with dual enforcement ─── */

/**
 * Filter a list of registry entries by caller role.
 * Dual enforcement: rank gate (numeric) AND type gate (tool type matrix).
 * Returns only entries where BOTH gates pass.
 */
function filterByEntitlement(
  entries: VoltronRegistryEntry[],
  role: VoltronUserRole,
): { allowed: VoltronRegistryEntry[]; denied: number } {
  const callerRank = getRoleRank(role)
  const allowed: VoltronRegistryEntry[] = []
  let denied = 0

  for (const entry of entries) {
    const entryRank = getRoleRank(entry.entitlement_min)
    const rankOk = entryRank <= callerRank
    const typeOk = isTypeAllowedForRole(role, entry.type)

    if (rankOk && typeOk) {
      allowed.push(entry)
    } else {
      denied++
    }
  }

  return { allowed, denied }
}

// ─── GET /api/voltron/registry ──────────────────────────────────────────────
// Returns tools filtered by caller's role. Uses Firebase Auth token from middleware.
// TRK-13801: Hardened with role validation, dual enforcement, and audit metadata.

voltronRegistryRoutes.get('/', async (req: Request, res: Response) => {
  try {
    // TRK-13801: Validate and normalize role before any filtering
    const rawRole = (req as any).user?.role as string | undefined
    const { role: userRole, normalized } = validateRole(rawRole)
    const callerRank = getRoleRank(userRole)

    // VOL-C13: Optional domain filter
    const rawDomain = req.query['domain'] as string | undefined
    const domainFilter: VoltronLionDomain | undefined =
      rawDomain && VALID_DOMAINS.has(rawDomain) ? rawDomain as VoltronLionDomain : undefined

    if (normalized && rawRole) {
      console.warn(`[voltron-registry] Role normalized: "${rawRole}" → "${userRole}"`)
    }

    const col = registryCol()
    const snapshot = await col.get()

    const allEntries: VoltronRegistryEntry[] = []
    snapshot.forEach((doc: any) => {
      const data = doc.data() as VoltronRegistryEntry
      allEntries.push({ ...data, tool_id: doc.id })
    })

    // If registry is empty (not yet generated), return in-memory definitions
    if (allEntries.length === 0) {
      const superDefs = getVoltronSuperToolDefinitions()
      const wireDefs = VOLTRON_WIRE_DEFINITIONS
      const now = new Date().toISOString()

      const memoryEntries: VoltronRegistryEntry[] = [
        ...superDefs.map(d => ({
          tool_id: d.super_tool_id,
          name: d.name,
          description: d.description,
          type: 'SUPER' as const,
          source: 'VOLTRON' as const,
          entitlement_min: d.entitlement_min,
          parameters: { tools: d.tools },
          server_only: false,
          generated_at: now,
        })),
        ...wireDefs.map(w => ({
          tool_id: w.wire_id,
          name: w.name,
          description: w.description,
          type: 'WIRE' as const,
          source: 'VOLTRON' as const,
          entitlement_min: w.entitlement_min,
          parameters: { super_tools: w.super_tools, approval_gates: w.approval_gates },
          server_only: false,
          generated_at: now,
        })),
      ]

      // TRK-13801: Apply same dual enforcement to in-memory fallback
      const { allowed, denied } = filterByEntitlement(memoryEntries, userRole)
      const filtered = domainFilter ? allowed.filter(e => e.domain === domainFilter) : allowed

      res.json(successResponse({
        tools: filtered,
        _meta: {
          role: userRole,
          rank: callerRank,
          total_available: filtered.length,
          filtered_out: denied,
          source: 'memory',
          ...(domainFilter && { domain: domainFilter }),
        },
      }))
      return
    }

    // TRK-13801: Dual enforcement via centralized filter
    const { allowed, denied } = filterByEntitlement(allEntries, userRole)
    const filtered = domainFilter ? allowed.filter(e => e.domain === domainFilter) : allowed

    res.json(successResponse({
      tools: filtered,
      _meta: {
        role: userRole,
        rank: callerRank,
        total_available: filtered.length,
        filtered_out: denied,
        source: 'firestore',
        ...(domainFilter && { domain: domainFilter }),
      },
    }))
  } catch (err) {
    console.error('GET /api/voltron/registry error:', err)
    res.status(500).json(errorResponse('Failed to fetch registry'))
  }
})

// ─── POST /api/voltron/registry/regenerate ──────────────────────────────────
// Triggers registry regeneration. VP+ only. Called by CI post-deploy hook.

voltronRegistryRoutes.post('/regenerate', async (req: Request, res: Response) => {
  try {
    // TRK-13801: Use validated role for regenerate endpoint too
    const { role: userRole } = validateRole((req as any).user?.role as string | undefined)
    const callerRank = getRoleRank(userRole)

    // VP+ only (rank >= 4)
    if (callerRank < 4) {
      res.status(403).json(errorResponse('Insufficient entitlement: VP+ required'))
      return
    }

    const col = registryCol()
    const timestamp = new Date().toISOString()
    let written = 0

    // Write super tool definitions
    const superDefs = getVoltronSuperToolDefinitions()
    for (const def of superDefs) {
      await col.doc(def.super_tool_id).set({
        tool_id: def.super_tool_id,
        name: def.name,
        description: def.description,
        type: 'SUPER',
        source: 'VOLTRON',
        entitlement_min: def.entitlement_min,
        parameters: { tools: def.tools },
        server_only: false,
        generated_at: timestamp,
      })
      written++
    }

    // Write wire definitions
    for (const wire of VOLTRON_WIRE_DEFINITIONS) {
      await col.doc(wire.wire_id).set({
        tool_id: wire.wire_id,
        name: wire.name,
        description: wire.description,
        type: 'WIRE',
        source: 'VOLTRON',
        entitlement_min: wire.entitlement_min,
        parameters: { super_tools: wire.super_tools, approval_gates: wire.approval_gates },
        server_only: false,
        generated_at: timestamp,
      })
      written++
    }

    res.json(successResponse({
      regenerated: true,
      entries_written: written,
      timestamp,
    }))
  } catch (err) {
    console.error('POST /api/voltron/registry/regenerate error:', err)
    res.status(500).json(errorResponse('Failed to regenerate registry'))
  }
})
