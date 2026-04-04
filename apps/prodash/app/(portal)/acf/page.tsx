'use client'

import { useState, useMemo, useCallback } from 'react'
import { query, orderBy, type Query, type DocumentData } from 'firebase/firestore'
import { useCollection } from '@tomachina/db'
import { collections } from '@tomachina/db/src/firestore'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ClientACFRow {
  _id: string
  client_id?: string
  first_name?: string
  last_name?: string
  acf_folder_id?: string
  acf_folder_url?: string
  // Cached ACF metrics stored on the client doc (populated by audit job)
  acf_completeness?: number      // 0-100
  acf_doc_count?: number
  acf_subfolder_count?: number
  acf_last_modified?: string
  acf_dedup_count?: number
  status?: string
}

type SortKey = 'name' | 'completeness' | 'last_modified' | 'doc_count'
type CompletenessFilter = 'all' | 'low' | 'mid' | 'high'

const PAGE_SIZE = 25

const clientsQuery: Query<DocumentData> = query(collections.clients(), orderBy('last_name'))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function completenessColor(score: number): string {
  if (score > 80) return 'bg-emerald-500'
  if (score >= 50) return 'bg-amber-500'
  return 'bg-red-500'
}

function completenessTextColor(score: number): string {
  if (score > 80) return 'text-emerald-400'
  if (score >= 50) return 'text-amber-400'
  return 'text-red-400'
}

function formatDate(iso: string | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' })
}

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ACFGridPage() {
  const { data: rawClients, loading, error } = useCollection<ClientACFRow>(clientsQuery, 'acf-grid-clients')

  const [search, setSearch] = useState('')
  const [completenessFilter, setCompletenessFilter] = useState<CompletenessFilter>('all')
  const [hasDupes, setHasDupes] = useState(false)
  const [missingSubfolders, setMissingSubfolders] = useState(false)
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [page, setPage] = useState(0)

  // Only show clients that have (or had) an ACF folder
  const acfClients = useMemo(() => {
    return rawClients.filter((c) => c.acf_folder_id)
  }, [rawClients])

  const filtered = useMemo(() => {
    let result = acfClients

    if (search) {
      const normalized = search.trim().split(/\s+/).map(w => titleCase(w)).join(' ')
      const q = normalized.toLowerCase()
      result = result.filter((c) => {
        const full = `${c.last_name || ''} ${c.first_name || ''}`.toLowerCase()
        return (
          full.includes(q) ||
          (c.first_name || '').toLowerCase().includes(q) ||
          (c.last_name || '').toLowerCase().includes(q)
        )
      })
    }

    if (completenessFilter !== 'all') {
      result = result.filter((c) => {
        const score = c.acf_completeness ?? 0
        if (completenessFilter === 'low') return score < 50
        if (completenessFilter === 'mid') return score >= 50 && score <= 80
        if (completenessFilter === 'high') return score > 80
        return true
      })
    }

    if (hasDupes) {
      result = result.filter((c) => (c.acf_dedup_count ?? 0) > 0)
    }

    if (missingSubfolders) {
      result = result.filter((c) => (c.acf_subfolder_count ?? 0) < 5)
    }

    return result
  }, [acfClients, search, completenessFilter, hasDupes, missingSubfolders])

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let av: string | number
      let bv: string | number

      switch (sortKey) {
        case 'name':
          av = `${a.last_name || ''} ${a.first_name || ''}`.toLowerCase()
          bv = `${b.last_name || ''} ${b.first_name || ''}`.toLowerCase()
          break
        case 'completeness':
          av = a.acf_completeness ?? 0
          bv = b.acf_completeness ?? 0
          break
        case 'last_modified':
          av = a.acf_last_modified ?? ''
          bv = b.acf_last_modified ?? ''
          break
        case 'doc_count':
          av = a.acf_doc_count ?? 0
          bv = b.acf_doc_count ?? 0
          break
        default:
          return 0
      }

      const cmp =
        typeof av === 'number' && typeof bv === 'number'
          ? av - bv
          : String(av).localeCompare(String(bv), undefined, { numeric: true })

      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [filtered, sortKey, sortDir])

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE)
  const paged = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const showingStart = sorted.length > 0 ? page * PAGE_SIZE + 1 : 0
  const showingEnd = Math.min((page + 1) * PAGE_SIZE, sorted.length)

  const resetPage = useCallback(() => setPage(0), [])

  const handleSearch = useCallback(
    (v: string) => { setSearch(v); resetPage() },
    [resetPage]
  )

  const handleSort = useCallback(
    (key: SortKey) => {
      if (sortKey === key) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
      } else {
        setSortKey(key)
        setSortDir('asc')
      }
    },
    [sortKey]
  )

  const handleRowClick = useCallback((clientId: string) => {
    window.location.href = `/acf/${clientId}`
  }, [])

  const renderSortHeader = (label: string, key: SortKey, style?: string) => (
    <th
      onClick={() => handleSort(key)}
      className={`cursor-pointer select-none px-3 py-3 text-left text-xs font-semibold uppercase text-[var(--portal)] transition-colors hover:text-[var(--text-primary)] ${style ?? ''}`}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {sortKey === key && (
          <span className="text-[var(--portal)]">{sortDir === 'asc' ? '↑' : '↓'}</span>
        )}
      </span>
    </th>
  )

  // --- Loading ---
  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">ACF</h1>
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--portal)] border-t-transparent" />
            <p className="text-sm text-[var(--text-muted)]">Loading ACF records...</p>
          </div>
        </div>
      </div>
    )
  }

  // --- Error ---
  if (error) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">ACF</h1>
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10">
              <span className="material-icons-outlined text-red-400">error_outline</span>
            </div>
            <p className="text-sm text-[var(--text-secondary)]">Failed to load ACF records.</p>
            <p className="text-xs text-[var(--text-muted)]">{error.message}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">ACF</h1>
          <p className="text-sm text-[var(--text-muted)]">Active Client Files — {acfClients.length.toLocaleString()} clients</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="relative">
          <span className="material-icons-outlined pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" style={{ fontSize: '16px' }}>search</span>
          <input
            type="text"
            placeholder="Search client name..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="h-[34px] rounded-md border border-[var(--border)] bg-[var(--bg-surface)] pl-8 pr-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--portal)] focus:outline-none w-56"
          />
        </div>

        {/* Completeness filter */}
        <select
          value={completenessFilter}
          onChange={(e) => { setCompletenessFilter(e.target.value as CompletenessFilter); resetPage() }}
          className="h-[34px] rounded-md border border-[var(--border)] bg-[var(--bg-surface)] px-2 text-sm text-[var(--text-secondary)] focus:border-[var(--portal)] focus:outline-none"
        >
          <option value="all">All Completeness</option>
          <option value="low">&lt; 50%</option>
          <option value="mid">50–80%</option>
          <option value="high">&gt; 80%</option>
        </select>

        {/* Has Duplicates toggle */}
        <button
          onClick={() => { setHasDupes((v) => !v); resetPage() }}
          className={`inline-flex items-center gap-1.5 rounded-md border h-[34px] px-3 text-sm font-medium transition-colors ${
            hasDupes
              ? 'border-amber-500 bg-amber-500/15 text-amber-400'
              : 'border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:border-amber-500 hover:text-amber-400'
          }`}
        >
          <span className="material-icons-outlined" style={{ fontSize: '15px' }}>warning</span>
          Has Duplicates
        </button>

        {/* Missing Subfolders toggle */}
        <button
          onClick={() => { setMissingSubfolders((v) => !v); resetPage() }}
          className={`inline-flex items-center gap-1.5 rounded-md border h-[34px] px-3 text-sm font-medium transition-colors ${
            missingSubfolders
              ? 'border-[var(--portal)] bg-[var(--portal)]/15 text-[var(--portal)]'
              : 'border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:border-[var(--portal)] hover:text-[var(--portal)]'
          }`}
        >
          <span className="material-icons-outlined" style={{ fontSize: '15px' }}>folder_off</span>
          Missing Subfolders
        </button>

        {/* Result count */}
        <span className="ml-auto text-xs text-[var(--text-muted)]">
          {filtered.length.toLocaleString()} result{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Empty state */}
      {sorted.length === 0 && (
        <div className="flex items-center justify-center py-16">
          <div className="flex flex-col items-center gap-3 text-center">
            <span className="material-icons-outlined text-4xl text-[var(--text-muted)]">folder_open</span>
            <p className="text-sm text-[var(--text-muted)]">
              No ACF records match your filters. Try adjusting your search.
            </p>
          </div>
        </div>
      )}

      {/* Table */}
      {sorted.length > 0 && (
        <>
          <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--bg-card)]">
            <table className="w-full text-sm">
              <thead className="bg-[var(--bg-surface)]">
                <tr>
                  {renderSortHeader('Client', 'name', 'flex-[1.5]')}
                  {renderSortHeader('Complete', 'completeness', '')}
                  {renderSortHeader('Docs', 'doc_count', '')}
                  <th className="px-3 py-3 text-left text-xs font-semibold uppercase text-[var(--portal)]">Subfolders</th>
                  {renderSortHeader('Last Modified', 'last_modified', '')}
                </tr>
              </thead>
              <tbody>
                {paged.map((client) => {
                  const id = client._id || client.client_id || ''
                  const score = client.acf_completeness ?? 0
                  const dupeCount = client.acf_dedup_count ?? 0
                  const subCount = client.acf_subfolder_count ?? 0
                  const docCount = client.acf_doc_count ?? 0

                  return (
                    <tr
                      key={id}
                      onClick={() => handleRowClick(id)}
                      className="cursor-pointer border-t border-[var(--border)] transition-colors hover:bg-[var(--bg-hover)]"
                    >
                      {/* Client name + dedup badge */}
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-[var(--text-primary)]">
                            {client.last_name || '—'}, {client.first_name || '—'}
                          </span>
                          {dupeCount > 0 && (
                            <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-400">
                              <span className="material-icons-outlined" style={{ fontSize: 11 }}>warning</span>
                              {dupeCount} possible {dupeCount === 1 ? 'dupe' : 'dupes'}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Completeness bar */}
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-20 overflow-hidden rounded-full bg-[var(--bg-surface)]">
                            <div
                              className={`h-full rounded-full ${completenessColor(score)}`}
                              style={{ width: `${Math.min(100, score)}%` }}
                            />
                          </div>
                          <span className={`text-xs font-medium tabular-nums ${completenessTextColor(score)}`}>
                            {score}%
                          </span>
                        </div>
                      </td>

                      {/* Doc count */}
                      <td className="px-3 py-3 text-[var(--text-secondary)]">
                        {docCount}
                      </td>

                      {/* Subfolder count */}
                      <td className="px-3 py-3">
                        <span className={`text-sm ${subCount < 5 ? 'text-amber-400' : 'text-[var(--text-secondary)]'}`}>
                          {subCount}/5
                        </span>
                      </td>

                      {/* Last modified */}
                      <td className="px-3 py-3 text-[var(--text-secondary)]">
                        {formatDate(client.acf_last_modified)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between text-sm text-[var(--text-muted)]">
            <span>
              Showing {showingStart}–{showingEnd} of {sorted.length.toLocaleString()}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="cursor-pointer rounded-lg border border-[var(--border)] px-4 py-1.5 text-sm transition-colors hover:bg-[var(--bg-hover)] disabled:cursor-not-allowed disabled:opacity-30"
              >
                Previous
              </button>
              {totalPages > 1 && (
                <span className="flex items-center px-2 text-xs">
                  Page {page + 1} of {totalPages}
                </span>
              )}
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="cursor-pointer rounded-lg border border-[var(--border)] px-4 py-1.5 text-sm transition-colors hover:bg-[var(--bg-hover)] disabled:cursor-not-allowed disabled:opacity-30"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
