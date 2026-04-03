'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchWithAuth } from '@tomachina/ui/src/modules/fetchWithAuth'
import { EmptyState } from '../../lib/ui-helpers'

interface ActivityTabProps {
  clientId: string
}

type FilterKey = 'all' | 'calls' | 'sms' | 'emails' | 'activities' | 'opportunities'

interface TimelineEntry {
  id: string
  source: string
  type: string
  title: string
  description?: string
  performed_by?: string
  created_at: string
  meta?: Record<string, unknown>
}

interface TimelineResponse {
  entries: TimelineEntry[]
  counts: Record<string, number>
}

const ICON_MAP: Record<string, string> = {
  voice: 'phone',
  sms: 'message',
  email: 'mail',
  activity: 'event_note',
  opportunity: 'work',
}

const COLOR_MAP: Record<string, string> = {
  voice: 'text-green-500',
  sms: 'text-blue-400',
  email: 'text-purple-400',
  activity: 'text-amber-500',
  opportunity: 'text-teal-400',
}

function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined })
}

export function ActivityTab({ clientId }: ActivityTabProps) {
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all')
  const [entries, setEntries] = useState<TimelineEntry[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  const loadTimeline = useCallback(async () => {
    setLoading(true)
    try {
      const typeParam = activeFilter === 'all' ? '' : `&type=${activeFilter}`
      const res = await fetchWithAuth(`/api/clients/${clientId}/timeline?limit=100${typeParam}`)
      if (res.ok) {
        const json = await res.json()
        if (json.success) {
          const data = json.data as TimelineResponse
          setEntries(data.entries || [])
          setCounts(data.counts || {})
        }
      }
    } catch { /* silent */ }
    setLoading(false)
  }, [clientId, activeFilter])

  useEffect(() => { loadTimeline() }, [loadTimeline])

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const filters: { key: FilterKey; label: string; icon: string }[] = [
    { key: 'all', label: 'All', icon: 'list' },
    { key: 'calls', label: 'Calls', icon: 'phone' },
    { key: 'sms', label: 'SMS', icon: 'message' },
    { key: 'emails', label: 'Emails', icon: 'mail' },
    { key: 'activities', label: 'Activity', icon: 'event_note' },
    { key: 'opportunities', label: 'Opps', icon: 'work' },
  ]

  return (
    <div className="space-y-4">
      {/* Filter pills */}
      <div className="flex flex-wrap gap-2">
        {filters.map(f => {
          const count = counts[f.key] ?? 0
          const isActive = activeFilter === f.key
          return (
            <button
              key={f.key}
              onClick={() => setActiveFilter(f.key)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                isActive
                  ? 'bg-[var(--portal)] text-white'
                  : 'bg-[var(--bg-surface)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              <span className="material-icons-outlined text-[14px]">{f.icon}</span>
              {f.label}
              {count > 0 && (
                <span className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                  isActive ? 'bg-white/20' : 'bg-[var(--border-subtle)]'
                }`}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Timeline */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--portal)] border-t-transparent" />
          <span className="ml-3 text-sm text-[var(--text-muted)]">Loading timeline...</span>
        </div>
      ) : entries.length === 0 ? (
        <EmptyState icon="history" message="No activity recorded yet" />
      ) : (
        <div className="space-y-1">
          {entries.map(entry => {
            const icon = ICON_MAP[entry.type] || ICON_MAP[entry.source] || 'event_note'
            const color = COLOR_MAP[entry.type] || COLOR_MAP[entry.source] || 'text-[var(--text-muted)]'
            const expanded = expandedIds.has(entry.id)
            const hasDetail = !!(entry.description || entry.meta?.recording_url || entry.meta?.media_urls)

            return (
              <div
                key={entry.id}
                className="flex gap-3 rounded-lg border border-transparent px-3 py-2.5 transition-colors hover:border-[var(--border-subtle)] hover:bg-[var(--bg-surface)]"
              >
                {/* Icon */}
                <span className={`material-icons-outlined mt-0.5 text-[18px] ${color}`}>{icon}</span>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-sm font-medium text-[var(--text-primary)]">{entry.title}</span>
                      {entry.performed_by && (
                        <span className="ml-2 text-xs text-[var(--text-muted)]">by {entry.performed_by}</span>
                      )}
                    </div>
                    <span className="flex-shrink-0 text-xs text-[var(--text-muted)]">{formatDate(entry.created_at)}</span>
                  </div>

                  {/* Expandable detail */}
                  {hasDetail && (
                    <button
                      onClick={() => toggleExpand(entry.id)}
                      className="mt-1 text-xs text-[var(--portal)] hover:underline"
                    >
                      {expanded ? 'Hide details' : 'Show details'}
                    </button>
                  )}
                  {expanded && entry.description ? (
                    <p className="mt-1.5 text-xs text-[var(--text-secondary)] leading-relaxed">{String(entry.description)}</p>
                  ) : null}
                  {expanded && entry.meta?.recording_url ? (
                    <audio controls className="mt-2 h-8 w-full max-w-xs" src={entry.meta.recording_url as string} />
                  ) : null}
                  {expanded && entry.meta ? (() => {
                    const meta = entry.meta as Record<string, unknown>
                    const parts: React.ReactNode[] = []
                    if (meta.duration_sec) {
                      const sec = Number(meta.duration_sec)
                      parts.push(<span key="dur" className="mt-1 inline-block text-xs text-[var(--text-muted)]">
                        Duration: {Math.floor(sec / 60)}:{String(sec % 60).padStart(2, '0')}
                      </span>)
                    }
                    if (meta.disposition) {
                      parts.push(<span key="disp" className="ml-3 mt-1 inline-block rounded-full bg-[var(--bg-surface)] px-2 py-0.5 text-xs text-[var(--text-muted)]">
                        {String(meta.disposition).replace(/_/g, ' ')}
                      </span>)
                    }
                    return parts.length > 0 ? <>{parts}</> : null
                  })() : null}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
