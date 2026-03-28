'use client'

import { useCallback, useEffect, useState } from 'react'
import { useToast } from '@tomachina/ui'
import { fetchValidated } from '@tomachina/ui/src/modules/fetchValidated'
import { useRegistry } from './hooks/use-registry'
import { useWireExecution } from './hooks/use-wire-execution'
import { WireSelector } from './components/wire-selector'
import { ExecutionProgress } from './components/execution-progress'
import { ArtifactDisplay } from './components/artifact-display'
import { SimulationToggle } from './components/simulation-toggle'
import type { VoltronUserRole } from './types'

interface ClientRecord {
  id: string
  first_name: string
  last_name: string
  email?: string
}

/**
 * VOLTRON Mode 1 — Wire Execution UI
 *
 * Phases:
 *  1. SELECT  — Pick a wire + client via Smart Lookup
 *  2. EXECUTE — Real-time SSE progress with stage-by-stage visualization
 *  3. RESULTS — Artifact display with actionable links
 */
export function VoltronMode1() {
  const { showToast } = useToast()

  // User role — fetched from session/profile
  const [userRole, setUserRole] = useState<VoltronUserRole | undefined>(undefined)
  const [simulation, setSimulation] = useState(false)

  // Client search data
  const [clients, setClients] = useState<{ id: string; label: string; sublabel?: string }[]>([])
  const [clientsLoading, setClientsLoading] = useState(true)

  // Registry + Wire execution
  const registry = useRegistry(userRole)
  const execution = useWireExecution()

  // Fetch user role on mount
  useEffect(() => {
    fetchValidated<{ role: VoltronUserRole }>('/api/auth/me')
      .then((res) => {
        if (res.success && res.data?.role) {
          setUserRole(res.data.role)
        } else {
          // Default to COORDINATOR for safety
          setUserRole('COORDINATOR')
        }
      })
      .catch(() => setUserRole('COORDINATOR'))
  }, [])

  // Fetch clients for Smart Lookup
  useEffect(() => {
    setClientsLoading(true)
    fetchValidated<ClientRecord[]>('/api/clients', {
      method: 'GET',
    })
      .then((res) => {
        if (res.success && res.data) {
          setClients(
            res.data.map((c) => ({
              id: c.id,
              label: `${c.first_name} ${c.last_name}`,
              sublabel: c.email,
            }))
          )
        }
      })
      .catch(() => {
        showToast('Failed to load client list', 'error')
      })
      .finally(() => setClientsLoading(false))
  }, [showToast])

  // Handle wire execution
  const handleExecute = useCallback(
    (wireId: string, clientId: string, params: Record<string, unknown>) => {
      const wire = registry.wires.find((w) => w.wire_id === wireId)
      if (!wire) {
        showToast('Wire not found', 'error')
        return
      }

      if (simulation) {
        showToast('Starting simulation...', 'info')
      } else {
        showToast(`Executing ${wire.name.replace(/_/g, ' ')}...`, 'info')
      }

      execution.execute(wireId, clientId, params, simulation)
    },
    [registry.wires, simulation, execution, showToast]
  )

  // Toast on completion
  useEffect(() => {
    if (execution.phase === 'complete') {
      showToast(
        simulation ? 'Simulation complete' : 'Wire execution complete',
        'success'
      )
    } else if (execution.phase === 'error' && execution.error) {
      showToast(execution.error, 'error')
    } else if (execution.phase === 'approval_pending') {
      showToast('Approval required to continue', 'warning')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [execution.phase])

  const isExecuting = execution.phase === 'executing' || execution.phase === 'approval_pending'

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-page-title flex items-center gap-2">
            <span className="material-icons-outlined text-[28px] text-[var(--portal)]">bolt</span>
            VOLTRON
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Action Engine — Select a wire, pick a client, execute.
          </p>
        </div>
        <SimulationToggle
          enabled={simulation}
          onChange={setSimulation}
          disabled={isExecuting}
        />
      </div>

      {/* Loading state */}
      {registry.loading && (
        <div className="flex items-center justify-center py-12">
          <span className="material-icons-outlined text-[32px] text-[var(--portal)] animate-spin">
            sync
          </span>
          <span className="ml-3 text-sm text-[var(--text-secondary)]">Loading registry...</span>
        </div>
      )}

      {/* Registry error */}
      {registry.error && !registry.loading && (
        <div className="rounded-lg border border-[var(--error)] bg-[var(--error)]/5 p-4">
          <div className="flex items-start gap-2">
            <span className="material-icons-outlined text-[18px] text-[var(--error)] shrink-0">
              error_outline
            </span>
            <div>
              <div className="text-sm text-[var(--error)] font-medium">
                Failed to load VOLTRON registry
              </div>
              <div className="text-xs text-[var(--text-muted)] mt-1">{registry.error}</div>
              <button
                type="button"
                onClick={registry.refetch}
                className="mt-2 text-xs text-[var(--portal)] hover:underline"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Wire selector — visible when idle or complete (can start new) */}
      {!registry.loading && !registry.error && execution.phase === 'idle' && (
        <WireSelector
          wires={registry.wires}
          clients={clients}
          clientsLoading={clientsLoading}
          canExecute={registry.canExecuteWire}
          onExecute={handleExecute}
          disabled={isExecuting}
        />
      )}

      {/* Execution progress — visible during and after execution */}
      <ExecutionProgress
        phase={execution.phase}
        stages={execution.stages}
        currentStage={execution.current_stage}
        wireId={execution.wire_id}
        executionId={execution.execution_id}
        simulation={execution.simulation}
        error={execution.error}
        onApprove={execution.approve}
        onReject={execution.reject}
        onReset={execution.reset}
      />

      {/* Artifacts — visible after completion */}
      {(execution.phase === 'complete' || execution.artifacts.length > 0) && (
        <ArtifactDisplay
          artifacts={execution.artifacts}
          simulation={execution.simulation}
        />
      )}

      {/* Role indicator (bottom) */}
      {userRole && (
        <div className="text-center pt-2">
          <span className="text-[10px] font-mono text-[var(--text-muted)]">
            Role: {userRole} | {registry.entries.length} tools | {registry.wires.length} wires
          </span>
        </div>
      )}
    </div>
  )
}
