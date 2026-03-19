'use client'

import { useState, useEffect } from 'react'
import ScheduleView from './ScheduleView'
import type { SpecialistConfig } from './types'

// ============================================================================
// InventoryTab — SPC filter buttons + ScheduleView wrapper
// TRK-13540
// ============================================================================

const BRAND_COLOR = 'var(--app-prozone, #0ea5e9)'

interface InventoryTabProps {
  portal: string
  specialists: SpecialistConfig[]
  selectedId: string | null
}

export default function InventoryTab({ portal, specialists, selectedId }: InventoryTabProps) {
  const [activeSpecialist, setActiveSpecialist] = useState<string | null>(selectedId)

  // Sync with parent selection changes
  useEffect(() => {
    setActiveSpecialist(selectedId)
  }, [selectedId])

  const activeSpecs = specialists.filter((s) => s.status === 'active')

  if (activeSpecs.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-5 py-12 text-center">
        <span
          className="material-icons-outlined text-[var(--text-muted)]"
          style={{ fontSize: '32px' }}
        >
          inventory_2
        </span>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          No active specialists configured.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* SPC Button Bar */}
      <div className="flex flex-wrap gap-3">
        {activeSpecs.map((spec) => {
          const isActive = activeSpecialist === spec.config_id
          return (
            <button
              key={spec.config_id}
              type="button"
              onClick={() => setActiveSpecialist(spec.config_id)}
              className="flex-1 min-w-[140px] rounded-xl border-2 p-4 text-left transition-all"
              style={{
                borderColor: isActive ? BRAND_COLOR : 'var(--border-subtle)',
                background: isActive ? 'rgba(14, 165, 233, 0.08)' : 'var(--bg-card)',
              }}
            >
              <p
                className="text-sm font-bold"
                style={{
                  color: isActive ? BRAND_COLOR : 'var(--text-primary)',
                }}
              >
                {spec.specialist_name.split(' ')[0].toUpperCase()}
              </p>
              <p className="mt-0.5 text-[10px] text-[var(--text-muted)]">
                {spec.territory_name} &middot; {spec.zone_count}z
              </p>
            </button>
          )
        })}
      </div>

      {/* Schedule Grid */}
      {activeSpecialist ? (
        <ScheduleView specialistId={activeSpecialist} portal={portal} />
      ) : (
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-5 py-12 text-center">
          <span
            className="material-icons-outlined text-[var(--text-muted)]"
            style={{ fontSize: '32px' }}
          >
            calendar_today
          </span>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            Select a specialist to view their schedule inventory.
          </p>
        </div>
      )}
    </div>
  )
}
