'use client'

import { useCallback, useState } from 'react'
import { SmartLookup } from '@tomachina/ui'
import type { VoltronWireDefinition } from '../types'

/** Friendly display metadata for known wires */
const WIRE_META: Record<string, { icon: string; color: string }> = {
  ANNUAL_REVIEW:    { icon: 'event_note',     color: 'var(--info)' },
  AEP_ENROLLMENT:   { icon: 'health_and_safety', color: 'var(--success)' },
  ONBOARD_AGENCY:   { icon: 'group_add',      color: 'var(--portal)' },
  NEW_BUSINESS:     { icon: 'trending_up',    color: 'var(--warning)' },
}

interface ClientItem {
  id: string
  label: string
  sublabel?: string
}

interface WireSelectorProps {
  wires: VoltronWireDefinition[]
  clients: ClientItem[]
  clientsLoading?: boolean
  canExecute: (wire: VoltronWireDefinition) => boolean
  onExecute: (wireId: string, clientId: string, params: Record<string, unknown>) => void
  disabled?: boolean
}

/**
 * Wire selection grid with Smart Lookup client input.
 * Shows available wires filtered by role, lets user pick a wire + client, then execute.
 */
export function WireSelector({
  wires,
  clients,
  clientsLoading,
  canExecute,
  onExecute,
  disabled,
}: WireSelectorProps) {
  const [selectedWire, setSelectedWire] = useState<string | null>(null)
  const [selectedClient, setSelectedClient] = useState('')

  const handleExecute = useCallback(() => {
    if (!selectedWire || !selectedClient) return
    onExecute(selectedWire, selectedClient, {})
  }, [selectedWire, selectedClient, onExecute])

  const activeWire = wires.find((w) => w.wire_id === selectedWire)

  return (
    <div className="space-y-6">
      {/* Wire grid */}
      <div>
        <h3 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3">
          Select a Wire
        </h3>
        {wires.length === 0 ? (
          <div className="text-sm text-[var(--text-muted)] py-8 text-center">
            No wires available for your role.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {wires.map((wire) => {
              const meta = WIRE_META[wire.wire_id] ?? { icon: 'bolt', color: 'var(--portal)' }
              const allowed = canExecute(wire)
              const isSelected = selectedWire === wire.wire_id

              return (
                <button
                  key={wire.wire_id}
                  type="button"
                  disabled={!allowed || disabled}
                  onClick={() => setSelectedWire(isSelected ? null : wire.wire_id)}
                  className={`
                    relative text-left rounded-lg border p-4 transition-all duration-150
                    ${isSelected
                      ? 'border-[var(--portal)] bg-[var(--bg-hover)] ring-1 ring-[var(--portal)]'
                      : 'border-[var(--border)] bg-[var(--bg-card)] hover:border-[var(--portal-accent)] hover:bg-[var(--bg-hover)]'}
                    ${!allowed || disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
                  `}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className="material-icons-outlined text-[24px] mt-0.5 shrink-0"
                      style={{ color: meta.color }}
                    >
                      {meta.icon}
                    </span>
                    <div className="min-w-0">
                      <div className="font-semibold text-sm text-[var(--text-primary)] truncate">
                        {wire.name}
                      </div>
                      <div className="text-xs text-[var(--text-secondary)] mt-0.5 line-clamp-2">
                        {wire.description}
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[var(--bg-surface)] text-[var(--text-muted)]">
                          {wire.super_tools.length} stages
                        </span>
                        {wire.approval_gates && wire.approval_gates.length > 0 && (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[var(--warning)]/10 text-[var(--warning)]">
                            gated
                          </span>
                        )}
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[var(--bg-surface)] text-[var(--text-muted)]">
                          {wire.entitlement_min}+
                        </span>
                      </div>
                    </div>
                  </div>
                  {isSelected && (
                    <div className="absolute top-2 right-2">
                      <span className="material-icons-outlined text-[18px] text-[var(--portal)]">
                        check_circle
                      </span>
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Client selection + execute */}
      {selectedWire && (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
              Client
            </label>
            <SmartLookup
              items={clients}
              value={selectedClient}
              onChange={setSelectedClient}
              placeholder={clientsLoading ? 'Loading clients...' : 'Search for a client...'}
              className="w-full"
            />
          </div>

          {activeWire && (
            <div className="text-xs text-[var(--text-muted)]">
              <span className="font-semibold text-[var(--text-secondary)]">Stages:</span>{' '}
              {activeWire.super_tools.join(' → ')}
            </div>
          )}

          <button
            type="button"
            disabled={!selectedClient || disabled}
            onClick={handleExecute}
            className={`
              w-full sm:w-auto px-6 py-3 rounded-lg font-semibold text-sm
              transition-all duration-150 flex items-center justify-center gap-2
              ${selectedClient && !disabled
                ? 'bg-[var(--portal)] text-white hover:brightness-110 active:scale-[0.98]'
                : 'bg-[var(--bg-surface)] text-[var(--text-muted)] cursor-not-allowed'}
            `}
          >
            <span className="material-icons-outlined text-[18px]">play_arrow</span>
            Execute Wire
          </button>
        </div>
      )}
    </div>
  )
}
