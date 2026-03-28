'use client'

import { useCallback, useEffect, useState } from 'react'
import { fetchValidated } from '@tomachina/ui/src/modules/fetchValidated'
import type {
  VoltronRegistryEntry,
  VoltronWireDefinition,
  VoltronUserRole,
} from '../types'
import { ROLE_RANK } from '../types'

interface RegistryState {
  entries: VoltronRegistryEntry[]
  wires: VoltronWireDefinition[]
  loading: boolean
  error: string | null
}

/**
 * Fetches the VOLTRON registry filtered by the caller's role.
 * GET /api/voltron/registry returns role-filtered tools based on Firebase Auth token.
 */
export function useRegistry(userRole?: VoltronUserRole) {
  const [state, setState] = useState<RegistryState>({
    entries: [],
    wires: [],
    loading: true,
    error: null,
  })

  const fetchRegistry = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }))
    try {
      const result = await fetchValidated<VoltronRegistryEntry[]>(
        '/api/voltron/registry'
      )
      if (!result.success) {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: result.error || 'Failed to load registry',
        }))
        return
      }

      const entries = result.data ?? []

      // Extract wire definitions from WIRE-type registry entries
      const wireEntries = entries.filter((e) => e.type === 'WIRE')
      const wires: VoltronWireDefinition[] = wireEntries.map((e) => ({
        wire_id: e.tool_id,
        name: e.name,
        description: e.description,
        super_tools: (e.parameters?.super_tools as string[]) ?? [],
        approval_gates: (e.parameters?.approval_gates as string[]) ?? [],
        entitlement_min: e.entitlement_min,
      }))

      setState({ entries, wires, loading: false, error: null })
    } catch (err) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      }))
    }
  }, [])

  useEffect(() => {
    fetchRegistry()
  }, [fetchRegistry])

  /** Client-side check: can the user run this wire? */
  const canExecuteWire = useCallback(
    (wire: VoltronWireDefinition): boolean => {
      if (!userRole) return false
      return ROLE_RANK[userRole] >= ROLE_RANK[wire.entitlement_min]
    },
    [userRole]
  )

  return {
    ...state,
    refetch: fetchRegistry,
    canExecuteWire,
  }
}
