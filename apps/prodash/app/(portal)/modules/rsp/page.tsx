'use client'

import type { Metadata } from 'next'
import { useEffect, useState } from 'react'

// RSP Pipeline landing page — shows active pipeline instances
// Components (RSPDiscoveryPanel, RSPBlueGate, etc.) render per-instance
// This page lists all active RSP instances for the current user

interface RSPInstance {
  id: string
  client_name: string
  stage: string
  stage_color: string
  updated_at: string
}

export default function RSPPage() {
  const [instances, setInstances] = useState<RSPInstance[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/flow/instances?pipeline_key=RSP_PIPELINE&status=active')
        const data = await res.json()
        if (data.success && Array.isArray(data.data)) {
          setInstances(data.data as RSPInstance[])
        }
      } catch {
        // Pipeline may not have instances yet
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Retirement Sales Process</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          5-stage pipeline: Discovery → Analysis → Presentation → Implementation → Service
        </p>
      </div>

      {loading && (
        <div className="text-center py-12 text-[var(--text-muted)]">Loading pipeline instances...</div>
      )}

      {!loading && instances.length === 0 && (
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-8 text-center">
          <span className="material-icons-outlined text-[var(--text-muted)] mb-3 block" style={{ fontSize: '48px' }}>
            conversion_path
          </span>
          <p className="text-sm font-medium text-[var(--text-secondary)] mb-1">No active RSP instances</p>
          <p className="text-xs text-[var(--text-muted)] max-w-md mx-auto">
            RSP pipeline instances are created automatically when a discovery meeting is booked.
            Book an appointment through ProZone to start the process.
          </p>
        </div>
      )}

      {!loading && instances.length > 0 && (
        <div className="space-y-3">
          {instances.map((inst) => (
            <a
              key={inst.id}
              href={`/modules/rsp/${inst.id}`}
              className="block rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 hover:border-[var(--portal)] transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: inst.stage_color || 'var(--portal)' }}
                  />
                  <span className="text-sm font-medium text-[var(--text-primary)]">{inst.client_name}</span>
                </div>
                <span className="text-xs text-[var(--text-muted)]">{inst.stage}</span>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
