'use client'

import { useState } from 'react'
import type { SpecialistConfig } from './types'

// ============================================================================
// SpecialistSelector — Card-based picker for specialist configs
// ============================================================================

interface SpecialistSelectorProps {
  specialists: SpecialistConfig[]
  selected: string | null
  onSelect: (id: string) => void
}

export default function SpecialistSelector({ specialists, selected, onSelect }: SpecialistSelectorProps) {
  const [collapsed, setCollapsed] = useState(false)

  const selectedSpec = specialists.find((s) => s.config_id === selected) || null

  // Collapsed mode — show selected specialist as a small bar
  if (collapsed && selectedSpec) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="flex w-full items-center gap-3 rounded-xl border bg-[var(--bg-card)] px-4 py-3 text-left transition-all hover:border-[var(--border-medium)]"
        style={{ borderColor: 'var(--app-prozone, #0ea5e9)' }}
      >
        <span
          className="flex h-8 w-8 items-center justify-center rounded-lg"
          style={{ backgroundColor: 'rgba(14,165,233,0.15)' }}
        >
          <span
            className="material-icons-outlined"
            style={{ fontSize: '18px', color: 'var(--app-prozone, #0ea5e9)' }}
          >
            person
          </span>
        </span>
        <div className="flex-1">
          <span className="text-sm font-semibold text-[var(--text-primary)]">
            {selectedSpec.specialist_name}
          </span>
          <span className="ml-2 text-xs text-[var(--text-muted)]">
            {selectedSpec.territory_name} &middot; {selectedSpec.zone_count} zones
          </span>
        </div>
        <span
          className="material-icons-outlined text-[var(--text-muted)]"
          style={{ fontSize: '18px' }}
        >
          unfold_more
        </span>
      </button>
    )
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[var(--text-secondary)]">Select Specialist</h2>
        {selected && (
          <button
            onClick={() => setCollapsed(true)}
            className="flex items-center gap-1 text-xs text-[var(--text-muted)] transition-colors hover:text-[var(--text-secondary)]"
          >
            <span className="material-icons-outlined" style={{ fontSize: '14px' }}>unfold_less</span>
            Collapse
          </button>
        )}
      </div>

      {/* Specialist Cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {specialists.map((spec) => {
          const isSelected = spec.config_id === selected
          return (
            <button
              key={spec.config_id}
              onClick={() => {
                onSelect(spec.config_id)
                setCollapsed(true)
              }}
              className={`rounded-xl border-2 bg-[var(--bg-card)] p-4 text-left transition-all hover:shadow-md ${
                isSelected
                  ? 'shadow-md'
                  : 'border-[var(--border-subtle)] hover:border-[var(--border-medium)]'
              }`}
              style={
                isSelected
                  ? { borderColor: 'var(--app-prozone, #0ea5e9)' }
                  : undefined
              }
            >
              <div className="flex items-start gap-3">
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
                  style={{
                    backgroundColor: isSelected
                      ? 'rgba(14,165,233,0.15)'
                      : 'var(--bg-surface)',
                  }}
                >
                  <span
                    className="material-icons-outlined"
                    style={{
                      fontSize: '20px',
                      color: isSelected ? 'var(--app-prozone, #0ea5e9)' : 'var(--text-muted)',
                    }}
                  >
                    person
                  </span>
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[var(--text-primary)]">
                    {spec.specialist_name}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-[var(--text-secondary)]">
                    {spec.territory_name}
                  </p>
                  <div className="mt-2 flex items-center gap-3 text-xs text-[var(--text-muted)]">
                    <span className="flex items-center gap-1">
                      <span className="material-icons-outlined" style={{ fontSize: '14px' }}>pin_drop</span>
                      {spec.origin_zip}
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="material-icons-outlined" style={{ fontSize: '14px' }}>grid_view</span>
                      {spec.zone_count} zones
                    </span>
                  </div>
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
