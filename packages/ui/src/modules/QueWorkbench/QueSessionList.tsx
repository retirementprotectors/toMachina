'use client'

import { useState, useEffect, useCallback } from 'react'
import { fetchWithAuth } from '../fetchWithAuth'
import type { QueProductLine, SessionListItem } from './types'

interface QueSessionListProps {
  productLine: QueProductLine
  onSelectSession: (sessionId: string) => void
  onNewSession: () => void
}

const STATUS_BADGES: Record<string, { bg: string; text: string; label: string }> = {
  draft: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Draft' },
  quoting: { bg: 'bg-sky-100', text: 'text-sky-700', label: 'Quoting' },
  comparing: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Comparing' },
  recommending: { bg: 'bg-violet-100', text: 'text-violet-700', label: 'Recommending' },
  complete: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Complete' },
  archived: { bg: 'bg-gray-100', text: 'text-gray-500', label: 'Archived' },
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  } catch {
    return iso
  }
}

export function QueSessionList({ productLine, onSelectSession, onNewSession }: QueSessionListProps) {
  const [sessions, setSessions] = useState<SessionListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const loadSessions = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetchWithAuth(`/api/que?product_line=${productLine}`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Failed to load sessions' }))
        setError((body as { error?: string }).error ?? 'Failed to load sessions')
        return
      }
      const body = await res.json() as { success: boolean; data?: SessionListItem[]; error?: string }
      if (body.success && body.data) {
        setSessions(body.data)
      } else {
        setError(body.error ?? 'Unexpected response')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error')
    } finally {
      setLoading(false)
    }
  }, [productLine])

  useEffect(() => {
    void loadSessions()
  }, [loadSessions])

  const filtered = sessions.filter((s) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      s.household_name.toLowerCase().includes(q) ||
      s.assigned_to.toLowerCase().includes(q) ||
      s.status.toLowerCase().includes(q)
    )
  })

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-6 py-4">
        <div>
          <h2 className="text-lg font-bold text-[var(--text-primary)]">QUE Sessions</h2>
          <p className="text-xs text-[var(--text-muted)]">{productLine} quoting sessions</p>
        </div>
        <button
          type="button"
          onClick={onNewSession}
          className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors hover:brightness-110"
          style={{ background: 'var(--portal)' }}
        >
          <span className="material-icons-outlined" style={{ fontSize: '16px' }}>add</span>
          New Session
        </button>
      </div>

      {/* Search */}
      <div className="px-6 pt-4 pb-2">
        <div className="relative">
          <span
            className="material-icons-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
            style={{ fontSize: '18px' }}
          >
            search
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search sessions..."
            className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] py-2 pl-10 pr-3 text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--portal)]"
          />
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto px-6 pt-2">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <span
              className="material-icons-outlined animate-spin text-[var(--text-muted)]"
              style={{ fontSize: '32px' }}
            >
              sync
            </span>
            <p className="mt-3 text-sm text-[var(--text-muted)]">Loading sessions...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <span className="material-icons-outlined text-4xl text-[var(--text-muted)]">error_outline</span>
            <p className="mt-3 text-sm font-medium text-[var(--text-secondary)]">{error}</p>
            <button
              type="button"
              onClick={() => void loadSessions()}
              className="mt-2 text-xs font-medium transition-colors hover:brightness-110"
              style={{ color: 'var(--portal)' }}
            >
              Retry
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <span className="material-icons-outlined text-4xl text-[var(--text-muted)]">assignment</span>
            <p className="mt-3 text-sm font-medium text-[var(--text-secondary)]">No sessions found</p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              {search ? 'Try adjusting your search' : 'Create a new session to get started'}
            </p>
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--border-subtle)] text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
                <th className="py-3 pr-4">Household</th>
                <th className="py-3 pr-4">Status</th>
                <th className="py-3 pr-4">Assigned To</th>
                <th className="py-3 pr-4">Quotes</th>
                <th className="py-3 pr-4">Updated</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((session) => {
                const badge = STATUS_BADGES[session.status] ?? STATUS_BADGES.draft
                return (
                  <tr
                    key={session.session_id}
                    onClick={() => onSelectSession(session.session_id)}
                    className="cursor-pointer border-b border-[var(--border-subtle)] transition-colors hover:bg-[var(--bg-surface)]"
                  >
                    <td className="py-3 pr-4">
                      <span className="font-medium text-[var(--text-primary)]">{session.household_name}</span>
                    </td>
                    <td className="py-3 pr-4">
                      <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${badge.bg} ${badge.text}`}>
                        {badge.label}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-[var(--text-secondary)]">{session.assigned_to}</td>
                    <td className="py-3 pr-4 text-[var(--text-secondary)]">{session.quote_count ?? 0}</td>
                    <td className="py-3 pr-4 text-xs text-[var(--text-muted)]">{formatDate(session.updated_at)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-[var(--border-subtle)] px-6 py-3">
        <span className="text-xs text-[var(--text-muted)]">{filtered.length} session{filtered.length !== 1 ? 's' : ''}</span>
      </div>
    </div>
  )
}
