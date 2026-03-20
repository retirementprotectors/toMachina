'use client'

import { useState, useEffect, useCallback } from 'react'
import { fetchWithAuth } from '../fetchWithAuth'
import { PipelineKanban } from '../PipelineKanban'

// ============================================================================
// FlowTab — Domain cards (Retirement/Medicare/Legacy) + KanbanBoard
// ============================================================================

const BRAND_COLOR = 'var(--app-prozone, #0ea5e9)'

const DOMAINS = [
  { key: 'PROSPECT_RETIREMENT', label: 'Retirement', icon: 'trending_up', color: '#10b981' },
  { key: 'PROSPECT_MEDICARE', label: 'Medicare', icon: 'health_and_safety', color: '#3b82f6' },
  { key: 'PROSPECT_LEGACY', label: 'Legacy', icon: 'volunteer_activism', color: '#8b5cf6' },
] as const

interface FlowTabProps {
  portal: string
  specialistId: string | null
}

export default function FlowTab({ portal, specialistId }: FlowTabProps) {
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null)
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [loadingCounts, setLoadingCounts] = useState(true)
  const [enrolling, setEnrolling] = useState(false)
  const [enrollResult, setEnrollResult] = useState<string | null>(null)

  // Fetch instance counts per domain
  useEffect(() => {
    if (!specialistId) return
    let cancelled = false

    async function loadCounts() {
      setLoadingCounts(true)
      const newCounts: Record<string, number> = {}

      const promises = DOMAINS.map(async (domain) => {
        try {
          const res = await fetchWithAuth(
            `/api/flow/instances?pipeline_key=${domain.key}&specialist_id=${specialistId}`
          )
          const json = await res.json() as { success: boolean; data?: Array<Record<string, unknown>> }
          if (json.success && json.data) {
            newCounts[domain.key] = (Array.isArray(json.data) ? json.data : []).filter(
              (i) => i.stage_status === 'pending' || i.stage_status === 'in_progress'
            ).length
          } else {
            newCounts[domain.key] = 0
          }
        } catch {
          newCounts[domain.key] = 0
        }
      })

      await Promise.all(promises)
      if (!cancelled) {
        setCounts(newCounts)
        setLoadingCounts(false)
      }
    }

    loadCounts()
    return () => { cancelled = true }
  }, [specialistId])

  // Auto-enroll handler
  const handleEnroll = useCallback(async () => {
    if (!specialistId || enrolling) return
    setEnrolling(true)
    setEnrollResult(null)

    try {
      const domain = selectedDomain || undefined
      const res = await fetchWithAuth('/api/prozone/enroll', {
        method: 'POST',
        body: JSON.stringify({ specialist_id: specialistId, domain }),
      })
      const json = await res.json() as { success: boolean; data?: { enrolled: number }; error?: string }
      if (json.success && json.data) {
        setEnrollResult(`${json.data.enrolled} prospects enrolled`)
        // Refresh counts
        setTimeout(() => setEnrollResult(null), 3000)
      } else {
        setEnrollResult(json.error || 'Enrollment failed')
      }
    } catch {
      setEnrollResult('Network error during enrollment')
    } finally {
      setEnrolling(false)
    }
  }, [specialistId, selectedDomain, enrolling])

  if (!specialistId) {
    return (
      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-5 py-12 text-center">
        <span className="material-icons-outlined text-[var(--text-muted)]" style={{ fontSize: '32px' }}>conversion_path</span>
        <p className="mt-2 text-sm text-[var(--text-muted)]">Select a specialist above to view pipeline flow.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header with Auto-Enroll */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-[var(--text-muted)]">
          Select a pipeline domain to view its Kanban board
        </p>
        <div className="flex items-center gap-2">
          {enrollResult && (
            <span className="text-xs text-emerald-400">{enrollResult}</span>
          )}
          <button
            type="button"
            onClick={handleEnroll}
            disabled={enrolling}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-opacity disabled:opacity-50"
            style={{ backgroundColor: BRAND_COLOR }}
          >
            {enrolling ? (
              <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <span className="material-icons-outlined" style={{ fontSize: '14px' }}>person_add</span>
            )}
            Auto-Enroll
          </button>
        </div>
      </div>

      {/* Domain Cards */}
      <div className="grid grid-cols-3 gap-3">
        {DOMAINS.map((domain) => {
          const isActive = selectedDomain === domain.key
          const count = counts[domain.key] ?? 0

          return (
            <button
              key={domain.key}
              type="button"
              onClick={() => setSelectedDomain(isActive ? null : domain.key)}
              className="rounded-xl border-2 p-5 text-center transition-all"
              style={{
                borderColor: isActive ? domain.color : 'var(--border-subtle)',
                background: isActive ? `${domain.color}12` : 'var(--bg-card)',
              }}
            >
              <span
                className="material-icons-outlined"
                style={{
                  fontSize: '28px',
                  color: isActive ? domain.color : 'var(--text-muted)',
                }}
              >
                {domain.icon}
              </span>
              <p
                className="mt-2 text-sm font-bold"
                style={{ color: isActive ? domain.color : 'var(--text-primary)' }}
              >
                {domain.label}
              </p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                {loadingCounts ? '...' : `${count} active`}
              </p>
            </button>
          )
        })}
      </div>

      {/* Kanban Board */}
      {selectedDomain && (
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4">
          <PipelineKanban
            pipelineKey={selectedDomain}
            portal={portal as 'prodashx' | 'riimo' | 'sentinel'}
            apiBase="/api"
          />
        </div>
      )}

      {/* No domain selected state */}
      {!selectedDomain && (
        <div className="rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-card)] px-5 py-12 text-center">
          <span className="material-icons-outlined text-[var(--text-muted)]" style={{ fontSize: '32px' }}>view_kanban</span>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            Click a domain above to view its pipeline board
          </p>
        </div>
      )}
    </div>
  )
}
