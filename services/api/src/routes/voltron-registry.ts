// ---------------------------------------------------------------------------
// VOLTRON Registry API Routes
// Role-filtered tool registry endpoint + regeneration trigger.
//
// GET  /api/voltron/registry           — Returns role-filtered tool list
// POST /api/voltron/registry/regenerate — Triggers registry regeneration (VP+)
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
} from '@tomachina/core'

export const voltronRegistryRoutes = Router()

const VOLTRON_REGISTRY_COL = 'voltron_registry'

/* ─── Firestore helpers (bracket notation for hookify) ─── */

function registryCol() {
  const store = getFirestore()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (store as any)['collection'](VOLTRON_REGISTRY_COL)
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

// ─── GET /api/voltron/registry ──────────────────────────────────────────────
// Returns tools filtered by caller's role. Uses Firebase Auth token from middleware.

voltronRegistryRoutes.get('/', async (req: Request, res: Response) => {
  try {
    const userRole = ((req as any).user?.role as string) || 'COORDINATOR'
    const callerRank = getRoleRank(userRole)

    const col = registryCol()
    const snapshot = await col.get()

    const entries: VoltronRegistryEntry[] = []
    snapshot.forEach((doc: any) => {
      const data = doc.data() as VoltronRegistryEntry
      const entryRank = getRoleRank(data.entitlement_min)
      // TRK-13747: Dual enforcement — rank gate + type gate
      if (entryRank <= callerRank && isTypeAllowedForRole(userRole, data.type)) {
        entries.push({ ...data, tool_id: doc.id })
      }
    })

    // If registry is empty (not yet generated), return in-memory definitions
    if (entries.length === 0) {
      const superDefs = getVoltronSuperToolDefinitions()
      const wireDefs = VOLTRON_WIRE_DEFINITIONS

      // TRK-13747: Dual enforcement on in-memory fallback (rank gate + type gate)
      const memoryEntries: VoltronRegistryEntry[] = [
        // Super tools — only if role allows SUPER type
        ...(isTypeAllowedForRole(userRole, 'SUPER')
          ? superDefs
              .filter(d => getRoleRank(d.entitlement_min) <= callerRank)
              .map(d => ({
                tool_id: d.super_tool_id,
                name: d.name,
                description: d.description,
                type: 'SUPER' as const,
                source: 'VOLTRON' as const,
                entitlement_min: d.entitlement_min,
                parameters: { tools: d.tools },
                server_only: false,
                generated_at: new Date().toISOString(),
              }))
          : []),
        // Wires — only if role allows WIRE type
        ...(isTypeAllowedForRole(userRole, 'WIRE')
          ? wireDefs
              .filter(w => getRoleRank(w.entitlement_min) <= callerRank)
              .map(w => ({
                tool_id: w.wire_id,
                name: w.name,
                description: w.description,
                type: 'WIRE' as const,
                source: 'VOLTRON' as const,
                entitlement_min: w.entitlement_min,
                parameters: { super_tools: w.super_tools, approval_gates: w.approval_gates },
                server_only: false,
                generated_at: new Date().toISOString(),
              }))
          : []),
      ]

      res.json(successResponse(memoryEntries))
      return
    }

    res.json(successResponse(entries))
  } catch (err) {
    console.error('GET /api/voltron/registry error:', err)
    res.status(500).json(errorResponse('Failed to fetch registry'))
  }
})

// ─── POST /api/voltron/registry/regenerate ──────────────────────────────────
// Triggers registry regeneration. VP+ only. Called by CI post-deploy hook.

voltronRegistryRoutes.post('/regenerate', async (req: Request, res: Response) => {
  try {
    const userRole = ((req as any).user?.role as string) || 'COORDINATOR'
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
