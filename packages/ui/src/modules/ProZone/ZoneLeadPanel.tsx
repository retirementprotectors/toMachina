'use client'

import { useState, useEffect, useMemo } from 'react'
import { fetchWithAuth } from '../fetchWithAuth'
import type { ZoneLead } from './types'

// ============================================================================
// ZoneLeadPanel — Zone selector + lead cards with reason badges
// ============================================================================

interface ZoneLeadPanelProps {
  specialistId: string
  zones: Array<{ zone_id: string; zone_name: string }>
  portal: string
}

const REASON_STYLES: Record<string, { bg: string; text: string }> = {
  'Active Medicare':   { bg: 'bg-sky-500/10',     text: 'text-sky-400' },
  'L&A 80+':          { bg: 'bg-amber-500/10',   text: 'text-amber-400' },
  'No Core Product':   { bg: 'bg-red-500/10',     text: 'text-red-400' },
  'Missing Coverage':  { bg: 'bg-orange-500/10',  text: 'text-orange-400' },
  'Upcoming Renewal':  { bg: 'bg-violet-500/10',  text: 'text-violet-400' },
  'Recent T65':        { bg: 'bg-emerald-500/10', text: 'text-emerald-400' },
}

function getReasonStyle(reason: string): { bg: string; text: string } {
  return REASON_STYLES[reason] || { bg: 'bg-neutral-500/10', text: 'text-neutral-400' }
}

export default function ZoneLeadPanel({ specialistId, zones }: ZoneLeadPanelProps) {
  const [selectedZone, setSelectedZone] = useState<string>('')
  const [leads, setLeads] = useState<ZoneLead[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Auto-select first zone
  useEffect(() => {
    if (zones.length > 0 && !selectedZone) {
      setSelectedZone(zones[0].zone_id)
    }
  }, [zones, selectedZone])

  // Fetch leads when zone changes
  useEffect(() => {
    if (!selectedZone) return

    let cancelled = false
    async function load() {
      try {
        setLoading(true)
        setError(null)
        const res = await fetchWithAuth(`/api/prozone/zone-leads/${specialistId}/${selectedZone}`)
        const json = await res.json() as { success: boolean; data?: ZoneLead[]; error?: string }
        if (!cancelled) {
          if (json.success && json.data) {
            setLeads(json.data)
          } else {
            setError(json.error || 'Failed to load zone leads')
            setLeads([])
          }
        }
      } catch {
        if (!cancelled) {
          setError('Network error loading zone leads')
          setLeads([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [specialistId, selectedZone])

  // Sort leads by age (oldest first)
  const sortedLeads = useMemo(() => {
    return [...leads].sort((a, b) => b.age - a.age)
  }, [leads])

  // Reason summary
  const reasonCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const lead of leads) {
      counts[lead.reason] = (counts[lead.reason] || 0) + 1
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1])
  }, [leads])

  const selectedZoneName = zones.find((z) => z.zone_id === selectedZone)?.zone_name || ''

  return (
    <div className="space-y-4">
      {/* Zone Selector + Summary */}
      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-4 py-3">
        {/* Zone Dropdown */}
        <div className="flex items-center gap-2">
          <span className="material-icons-outlined text-[var(--text-muted)]" style={{ fontSize: '18px' }}>grid_view</span>
          <select
            value={selectedZone}
            onChange={(e) => setSelectedZone(e.target.value)}
            className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--portal)] focus:outline-none"
          >
            {zones.length === 0 && <option value="">No zones available</option>}
            {zones.map((z) => (
              <option key={z.zone_id} value={z.zone_id}>{z.zone_name}</option>
            ))}
          </select>
        </div>

        {/* Lead Count */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-[var(--text-primary)]">
            {leads.length}
          </span>
          <span className="text-xs text-[var(--text-muted)]">
            lead{leads.length !== 1 ? 's' : ''} in {selectedZoneName}
          </span>
        </div>

        {/* Reason Badges Summary */}
        <div className="flex flex-wrap items-center gap-1.5">
          {reasonCounts.map(([reason, count]) => {
            const style = getReasonStyle(reason)
            return (
              <span
                key={reason}
                className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${style.bg} ${style.text}`}
              >
                {reason} ({count})
              </span>
            )
          })}
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--portal)] border-t-transparent" />
          <span className="ml-3 text-sm text-[var(--text-muted)]">Loading leads...</span>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 px-5 py-4">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && sortedLeads.length === 0 && (
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-5 py-12 text-center">
          <span className="material-icons-outlined text-[var(--text-muted)]" style={{ fontSize: '36px' }}>person_search</span>
          <p className="mt-2 text-sm text-[var(--text-muted)]">No leads in this zone.</p>
        </div>
      )}

      {/* Lead Cards */}
      {!loading && !error && sortedLeads.length > 0 && (
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] overflow-hidden">
          <div className="divide-y divide-[var(--border-subtle)]">
            {sortedLeads.map((lead) => {
              const reasonStyle = getReasonStyle(lead.reason)
              return (
                <div
                  key={lead.lead_id}
                  className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-[var(--bg-hover)]"
                >
                  {/* Avatar */}
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--bg-surface)]">
                    <span className="material-icons-outlined text-[var(--text-muted)]" style={{ fontSize: '20px' }}>person</span>
                  </span>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[var(--text-primary)]">
                      {lead.first_name} {lead.last_name}
                    </p>
                    <p className="text-xs text-[var(--text-muted)]">
                      {lead.city}, {lead.county} County
                    </p>
                  </div>

                  {/* Reason Badge */}
                  <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium ${reasonStyle.bg} ${reasonStyle.text}`}>
                    {lead.reason}
                  </span>

                  {/* Age */}
                  <div className="w-12 text-right">
                    <p className="text-sm font-semibold text-[var(--text-primary)]">{lead.age}</p>
                    <p className="text-[10px] text-[var(--text-muted)]">yrs</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
