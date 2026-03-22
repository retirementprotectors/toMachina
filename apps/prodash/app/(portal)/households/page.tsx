'use client'

import { useState, useMemo, useCallback } from 'react'
import { query, orderBy, type Query, type DocumentData } from 'firebase/firestore'
import { useCollection } from '@tomachina/db'
import { collections } from '@tomachina/db/src/firestore'
import { getAuth } from 'firebase/auth'
import type { Household } from '@tomachina/core'

// ---------------------------------------------------------------------------
// HOUSEHOLDS LIST — Grid view of all household groups
// ---------------------------------------------------------------------------

const householdsQuery: Query<DocumentData> = query(collections.households(), orderBy('household_name'))

const PAGE_SIZE = 25

export default function HouseholdsPage() {
  const { data: rawHouseholds, loading } = useCollection<Household>(householdsQuery, 'all-households')

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('Active')
  const [page, setPage] = useState(0)
  const [showCreate, setShowCreate] = useState(false)
  const [createName, setCreateName] = useState('')
  const [creating, setCreating] = useState(false)

  const handleCreateHousehold = useCallback(async () => {
    if (!createName.trim()) return
    setCreating(true)
    try {
      const auth = getAuth()
      const token = await auth.currentUser?.getIdToken()
      const res = await fetch('/api/households', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ household_name: createName.trim(), primary_contact_id: 'pending', members: [] }),
      })
      const json = await res.json()
      if (json.success) {
        const newId = json.data?.id || json.data?.household_id
        if (newId) window.location.href = `/households/${newId}`
        else window.location.reload()
      }
    } catch { /* handled */ }
    setCreating(false)
  }, [createName])

  const households = useMemo(() => {
    if (!rawHouseholds) return []
    return rawHouseholds.map(h => ({ ...h, _id: String((h as Record<string, unknown>).id || h.household_id || '') }))
  }, [rawHouseholds])

  const filtered = useMemo(() => {
    let result = households

    if (statusFilter !== 'All') {
      result = result.filter(h => (h.household_status || '').toLowerCase() === statusFilter.toLowerCase())
    }

    if (search) {
      const q = search.toLowerCase()
      result = result.filter(h => {
        const name = (h.household_name || '').toLowerCase()
        const primary = (h.primary_contact_name || '').toLowerCase()
        return name.includes(q) || primary.includes(q)
      })
    }

    return result
  }, [households, search, statusFilter])

  const paged = useMemo(() => {
    const start = page * PAGE_SIZE
    return filtered.slice(start, start + PAGE_SIZE)
  }, [filtered, page])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)

  const handleRowClick = useCallback((household: Household & { _id?: string }) => {
    const id = household._id || household.household_id
    window.open(`/households/${id}`, '_blank')
  }, [])

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Households</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            {loading ? 'Loading...' : `${filtered.length} households`}
          </p>
        </div>
        <button
          onClick={() => { setShowCreate(true); setCreateName('') }}
          className="inline-flex items-center gap-1.5 rounded-md h-[34px] px-4 text-xs font-medium bg-[var(--portal)] text-white transition-colors hover:brightness-110"
        >
          <span className="material-icons-outlined text-[14px]">add</span>
          Create Household
        </button>
      </div>

      {/* Create Household Modal */}
      {showCreate && (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-4 space-y-3">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Create Household</h3>
          <div>
            <label className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Household Name</label>
            <input
              type="text"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              placeholder="e.g. Smith Household"
              className="mt-1 w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--portal)]"
              autoFocus
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCreateHousehold}
              disabled={creating || !createName.trim()}
              className="rounded-md h-[34px] px-4 text-xs font-medium bg-[var(--portal)] text-white transition-colors hover:brightness-110 disabled:opacity-40"
            >
              {creating ? 'Creating...' : 'Create'}
            </button>
            <button onClick={() => setShowCreate(false)} className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]">Cancel</button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <span className="material-icons-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-[var(--text-muted)]">
            search
          </span>
          <input
            type="text"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0) }}
            placeholder="Search households..."
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] pl-10 pr-4 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--portal)] focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-0.5">
          {['Active', 'Inactive', 'All'].map(s => (
            <button
              key={s}
              onClick={() => { setStatusFilter(s); setPage(0) }}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                statusFilter === s
                  ? 'bg-[var(--portal)] text-white'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)]">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-surface)]/50">
                <th className="px-4 py-3 text-left font-medium text-[var(--text-secondary)]">Household</th>
                <th className="px-4 py-3 text-left font-medium text-[var(--text-secondary)]">Members</th>
                <th className="px-4 py-3 text-left font-medium text-[var(--text-secondary)]">Primary Contact</th>
                <th className="px-4 py-3 text-left font-medium text-[var(--text-secondary)]">Location</th>
                <th className="px-4 py-3 text-left font-medium text-[var(--text-secondary)]">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b border-[var(--border-subtle)]">
                    {Array.from({ length: 5 }).map((__, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 w-24 animate-pulse rounded bg-[var(--bg-surface)]" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : paged.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center">
                    <span className="material-icons-outlined text-4xl text-[var(--text-muted)]">home</span>
                    <p className="mt-2 text-sm text-[var(--text-muted)]">
                      {search ? 'No households match your search' : 'No households found'}
                    </p>
                  </td>
                </tr>
              ) : (
                paged.map(h => {
                  const members = (h.members || []) as Array<{ client_name?: string; role?: string }>
                  const location = [h.city, h.state].filter(Boolean).join(', ')
                  const initials = (h.household_name || 'H')
                    .split(' ')
                    .map((w: string) => w[0])
                    .join('')
                    .slice(0, 2)
                    .toUpperCase()

                  return (
                    <tr
                      key={h._id || h.household_id}
                      onClick={() => handleRowClick(h)}
                      className="border-b border-[var(--border-subtle)] transition-colors hover:bg-[var(--bg-surface)]/50 cursor-pointer"
                    >
                      {/* Household Name */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                            style={{ backgroundColor: hashColor(h.household_name || '') }}
                          >
                            {initials}
                          </div>
                          <span className="font-medium text-[var(--text-primary)]">{h.household_name}</span>
                        </div>
                      </td>

                      {/* Members Count */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <span className="material-icons-outlined text-[16px] text-[var(--text-muted)]">group</span>
                          <span className="text-[var(--text-secondary)]">{members.length}</span>
                        </div>
                      </td>

                      {/* Primary Contact */}
                      <td className="px-4 py-3 text-[var(--text-secondary)]">
                        {h.primary_contact_name || '—'}
                      </td>

                      {/* Location */}
                      <td className="px-4 py-3 text-[var(--text-secondary)]">
                        {location || '—'}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        <StatusBadge status={h.household_status || 'Unknown'} />
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-[var(--border-subtle)] px-4 py-3">
            <span className="text-xs text-[var(--text-muted)]">
              Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}
            </span>
            <div className="flex gap-1">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="rounded px-2 py-1 text-xs text-[var(--text-muted)] hover:bg-[var(--bg-surface)] disabled:opacity-30"
              >
                Prev
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="rounded px-2 py-1 text-xs text-[var(--text-muted)] hover:bg-[var(--bg-surface)] disabled:opacity-30"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase()
  let colorClass = 'bg-[var(--bg-surface)] text-[var(--text-muted)]'
  if (s === 'active') colorClass = 'bg-emerald-500/15 text-emerald-400'
  else if (s === 'inactive') colorClass = 'bg-red-500/15 text-red-400'
  else if (s === 'prospect') colorClass = 'bg-blue-500/15 text-blue-400'

  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${colorClass}`}>
      {status}
    </span>
  )
}

function hashColor(text: string): string {
  let hash = 0
  for (let i = 0; i < text.length; i++) {
    hash = text.charCodeAt(i) + ((hash << 5) - hash)
    hash = hash & hash
  }
  const hue = Math.abs(hash % 360)
  return `hsl(${hue}, 45%, 45%)`
}
