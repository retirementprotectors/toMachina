'use client'

import { useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { query, orderBy, type Query, type DocumentData } from 'firebase/firestore'
import { useCollection } from '@tomachina/db'
import { collections } from '@tomachina/db/src/firestore'
import { normalizePhone } from '@tomachina/core'
import type { Client } from '@tomachina/core'
import { ClientFilters } from './components/ClientFilters'
import { ClientAvatar } from './components/ClientAvatar'
import { StatusBadge } from './components/StatusBadge'
import { AccountTypePills } from './components/AccountTypePills'
import { ColumnSelector, getDefaultVisibleColumns } from './components/ColumnSelector'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatPhone(raw: string): string {
  const digits = normalizePhone(raw)
  if (digits.length !== 10) return raw || ''
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
}

function getAge(dob: unknown): number | null {
  if (!dob) return null
  const d = new Date(String(dob))
  if (isNaN(d.getTime())) return null
  const today = new Date()
  let age = today.getUTCFullYear() - d.getUTCFullYear()
  const monthDiff = today.getUTCMonth() - d.getUTCMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getUTCDate() < d.getUTCDate())) age--
  return age >= 0 ? age : null
}

// ---------------------------------------------------------------------------
// Types & Constants
// ---------------------------------------------------------------------------

const clientsQuery: Query<DocumentData> = query(collections.clients(), orderBy('last_name'))

type SortKey = 'name' | 'location' | 'book_of_business' | 'agent_name' | 'client_status' | null

interface ClientRow extends Client {
  _id: string
  account_types?: string[]
  book_of_business?: string
  agent_name?: string
  acf_link?: string
}

const PAGE_SIZE = 25

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default function ClientsPage() {
  const router = useRouter()
  const { data: rawClients, loading, error } = useCollection<ClientRow>(clientsQuery, 'all-clients')

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [bookFilter, setBookFilter] = useState('All')
  const [agentFilter, setAgentFilter] = useState('All')
  const [acfFilter, setAcfFilter] = useState('All')
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [page, setPage] = useState(0)
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(getDefaultVisibleColumns)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Extract unique books & agents from data
  const { books, agents } = useMemo(() => {
    const bookSet = new Set<string>()
    const agentSet = new Set<string>()
    for (const c of rawClients) {
      const b = String(c.book_of_business || '').trim()
      const a = String(c.agent_name || '').trim()
      if (b) bookSet.add(b)
      if (a) agentSet.add(a)
    }
    return {
      books: Array.from(bookSet).sort(),
      agents: Array.from(agentSet).sort(),
    }
  }, [rawClients])

  // Filter logic
  const filtered = useMemo(() => {
    let result = rawClients

    // Search filter
    if (search) {
      const q = search.toLowerCase()
      result = result.filter((c) => {
        const fullName = `${c.first_name || ''} ${c.last_name || ''}`.toLowerCase()
        const email = (c.email || '').toLowerCase()
        const phone = normalizePhone(c.phone || '')
        return (
          fullName.includes(q) ||
          email.includes(q) ||
          phone.includes(q) ||
          (c.first_name || '').toLowerCase().includes(q) ||
          (c.last_name || '').toLowerCase().includes(q)
        )
      })
    }

    // Status filter
    if (statusFilter !== 'All') {
      result = result.filter(
        (c) => (c.client_status || '').toLowerCase() === statusFilter.toLowerCase()
      )
    }

    // Book filter
    if (bookFilter !== 'All') {
      result = result.filter(
        (c) => String(c.book_of_business || '').trim() === bookFilter
      )
    }

    // Agent filter
    if (agentFilter !== 'All') {
      result = result.filter(
        (c) => String(c.agent_name || '').trim() === agentFilter
      )
    }

    // ACF filter
    if (acfFilter !== 'All') {
      if (acfFilter === 'Has ACF') {
        result = result.filter((c) => Boolean(c.acf_link))
      } else if (acfFilter === 'No ACF') {
        result = result.filter((c) => !c.acf_link)
      }
    }

    return result
  }, [rawClients, search, statusFilter, bookFilter, agentFilter, acfFilter])

  // Sort logic
  const sorted = useMemo(() => {
    if (!sortKey) return filtered

    return [...filtered].sort((a, b) => {
      let av: string
      let bv: string

      switch (sortKey) {
        case 'name':
          av = `${a.last_name || ''} ${a.first_name || ''}`.toLowerCase()
          bv = `${b.last_name || ''} ${b.first_name || ''}`.toLowerCase()
          break
        case 'location':
          av = `${a.state || ''} ${a.city || ''}`.toLowerCase()
          bv = `${b.state || ''} ${b.city || ''}`.toLowerCase()
          break
        case 'book_of_business':
          av = (a.book_of_business || '').toLowerCase()
          bv = (b.book_of_business || '').toLowerCase()
          break
        case 'agent_name':
          av = (a.agent_name || '').toLowerCase()
          bv = (b.agent_name || '').toLowerCase()
          break
        case 'client_status':
          av = (a.client_status || '').toLowerCase()
          bv = (b.client_status || '').toLowerCase()
          break
        default:
          return 0
      }

      const cmp = av.localeCompare(bv, undefined, { numeric: true })
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [filtered, sortKey, sortDir])

  // Pagination
  const totalPages = Math.ceil(sorted.length / PAGE_SIZE)
  const paged = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const showingStart = sorted.length > 0 ? page * PAGE_SIZE + 1 : 0
  const showingEnd = Math.min((page + 1) * PAGE_SIZE, sorted.length)

  // Handlers — reset page on filter change
  const resetPage = useCallback(() => setPage(0), [])
  const handleSearchChange = useCallback((v: string) => { setSearch(v); resetPage() }, [resetPage])
  const handleStatusChange = useCallback((v: string) => { setStatusFilter(v); resetPage() }, [resetPage])
  const handleBookChange = useCallback((v: string) => { setBookFilter(v); resetPage() }, [resetPage])
  const handleAgentChange = useCallback((v: string) => { setAgentFilter(v); resetPage() }, [resetPage])
  const handleAcfChange = useCallback((v: string) => { setAcfFilter(v); resetPage() }, [resetPage])

  const toggleClientSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }, [])

  const handleDdup = useCallback(() => {
    const ids = Array.from(selectedIds).join(',')
    window.open(`/ddup?ids=${ids}&type=client`, '_blank', 'noopener,noreferrer')
  }, [selectedIds])

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

  const handleRowClick = useCallback(
    (client: ClientRow) => {
      router.push(`/contacts/${client._id || client.client_id}`)
    },
    [router]
  )

  // Shorthand: is column visible?
  const col = useCallback((key: string) => visibleColumns.has(key), [visibleColumns])

  // Column header helper
  const renderSortHeader = (label: string, key: SortKey, className?: string) => (
    <th
      onClick={() => handleSort(key)}
      className={`cursor-pointer select-none px-3 py-3 text-left text-xs font-semibold uppercase text-[var(--portal)] transition-colors hover:text-[var(--text-primary)] ${className || ''}`}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {sortKey === key && (
          <span className="text-[var(--portal)]">{sortDir === 'asc' ? '\u2191' : '\u2193'}</span>
        )}
      </span>
    </th>
  )

  const renderStaticHeader = (label: string, className?: string) => (
    <th className={`px-3 py-3 text-left text-xs font-semibold uppercase text-[var(--portal)] ${className || ''}`}>
      {label}
    </th>
  )

  // Loading state
  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Contacts</h1>
        </div>
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--portal)] border-t-transparent" />
            <p className="text-sm text-[var(--text-muted)]">Loading clients...</p>
          </div>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Contacts</h1>
        </div>
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[rgba(239,68,68,0.1)]">
              <svg className="h-6 w-6 text-[var(--error)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <p className="text-sm text-[var(--text-secondary)]">
              Failed to load clients. Check your connection and try again.
            </p>
            <p className="text-xs text-[var(--text-muted)]">{error.message}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Header + Filters */}
      <ClientFilters
        search={search}
        onSearchChange={handleSearchChange}
        statusFilter={statusFilter}
        onStatusChange={handleStatusChange}
        bookFilter={bookFilter}
        onBookChange={handleBookChange}
        agentFilter={agentFilter}
        onAgentChange={handleAgentChange}
        acfFilter={acfFilter}
        onAcfChange={handleAcfChange}
        totalCount={filtered.length}
        books={books}
        agents={agents}
        columnSelector={
          <ColumnSelector
            visibleColumns={visibleColumns}
            onChange={setVisibleColumns}
          />
        }
      />

      {/* DeDup button — shown when 2+ clients selected */}
      {selectedIds.size >= 2 && (
        <div className="flex items-center gap-2">
          <button
            onClick={handleDdup}
            className="inline-flex items-center gap-1.5 rounded-md bg-amber-500 h-[34px] px-4 text-sm font-medium text-white transition-colors hover:bg-amber-600"
          >
            <span className="material-icons-outlined text-[16px]">merge_type</span>
            Ddup Selected ({selectedIds.size})
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] h-[34px] px-3 text-sm font-medium text-[var(--text-muted)] transition-colors hover:border-[var(--portal)] hover:text-[var(--portal)]"
          >
            Clear
          </button>
        </div>
      )}

      {/* No results */}
      {sorted.length === 0 && (
        <div className="flex items-center justify-center py-16">
          <div className="flex flex-col items-center gap-3 text-center">
            <svg className="h-10 w-10 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <p className="text-sm text-[var(--text-muted)]">
              No clients match your filters. Try adjusting your search or filters.
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
                  <th className="w-10 px-3 py-3">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-[var(--border)] accent-[var(--portal)]"
                      checked={paged.length > 0 && paged.every((c) => selectedIds.has(c._id || c.client_id))}
                      onChange={(e) => {
                        const ids = paged.map((c) => c._id || c.client_id)
                        setSelectedIds((prev) => {
                          const next = new Set(prev)
                          ids.forEach((id) => e.target.checked ? next.add(id) : next.delete(id))
                          return next
                        })
                      }}
                    />
                  </th>
                  {/* name is always visible */}
                  {renderSortHeader('Contact', 'name')}
                  {col('location') && renderSortHeader('City/State', 'location')}
                  {col('phone') && renderStaticHeader('Phone')}
                  {col('email') && renderStaticHeader('Email')}
                  {col('book') && renderSortHeader('Book', 'book_of_business')}
                  {col('agent') && renderSortHeader('Agent', 'agent_name')}
                  {col('status') && renderSortHeader('Status', 'client_status')}
                  {col('business') && renderStaticHeader('Business')}
                  {col('acf') && renderStaticHeader('ACF', 'text-center')}
                  {col('age') && renderStaticHeader('Age')}
                  {col('dob') && renderStaticHeader('DOB')}
                  {col('ssn') && renderStaticHeader('SSN')}
                  {col('gender') && renderStaticHeader('Gender')}
                  {col('marital') && renderStaticHeader('Marital')}
                  {col('timezone') && renderStaticHeader('Time Zone')}
                  {col('employment') && renderStaticHeader('Employment')}
                </tr>
              </thead>
              <tbody>
                {paged.map((client) => {
                  const age = getAge(client.dob)
                  const dash = <span className="text-xs text-[var(--text-muted)]">&mdash;</span>
                  return (
                    <tr
                      key={client._id || client.client_id}
                      onClick={() => handleRowClick(client)}
                      className="cursor-pointer border-t border-[var(--border)] transition-colors hover:bg-[var(--bg-hover)]"
                    >
                      {/* Checkbox */}
                      <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(client._id || client.client_id)}
                          onChange={() => toggleClientSelect(client._id || client.client_id)}
                          className="h-4 w-4 rounded border-[var(--border)] accent-[var(--portal)]"
                        />
                      </td>
                      {/* Contact: Name + Age below — always visible */}
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-3">
                          <ClientAvatar
                            firstName={client.first_name}
                            lastName={client.last_name}
                          />
                          <div className="min-w-0">
                            <p className="truncate font-medium text-[var(--text-primary)]">
                              {client.first_name} {client.last_name}
                            </p>
                            {age != null && (
                              <p className="text-xs text-[var(--text-muted)]">Age {age}</p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* City/State */}
                      {col('location') && (
                        <td className="px-3 py-3">
                          {client.city || client.state ? (
                            <span className="text-[var(--text-secondary)]">
                              {[client.city, client.state].filter(Boolean).join(', ')}
                            </span>
                          ) : dash}
                        </td>
                      )}

                      {/* Phone */}
                      {col('phone') && (
                        <td className="px-3 py-3">
                          {client.phone ? (
                            <span className="text-[var(--text-secondary)] whitespace-nowrap">
                              {formatPhone(client.phone)}
                            </span>
                          ) : dash}
                        </td>
                      )}

                      {/* Email */}
                      {col('email') && (
                        <td className="px-3 py-3">
                          {client.email ? (
                            <a
                              href={`mailto:${client.email}`}
                              onClick={(e) => e.stopPropagation()}
                              className="truncate text-xs text-[var(--portal)] hover:underline max-w-[180px] block"
                            >
                              {client.email}
                            </a>
                          ) : dash}
                        </td>
                      )}

                      {/* Book */}
                      {col('book') && (
                        <td className="px-3 py-3">
                          {client.book_of_business ? (
                            <span className="text-[var(--text-secondary)] text-xs">
                              {String(client.book_of_business)}
                            </span>
                          ) : dash}
                        </td>
                      )}

                      {/* Agent */}
                      {col('agent') && (
                        <td className="px-3 py-3">
                          {client.agent_name ? (
                            <span className="text-[var(--text-secondary)] text-xs">
                              {String(client.agent_name)}
                            </span>
                          ) : dash}
                        </td>
                      )}

                      {/* Status */}
                      {col('status') && (
                        <td className="px-3 py-3">
                          <StatusBadge status={client.client_status} />
                        </td>
                      )}

                      {/* Business Type */}
                      {col('business') && (
                        <td className="px-3 py-3">
                          <AccountTypePills accountTypes={client.account_types || []} />
                        </td>
                      )}

                      {/* ACF */}
                      {col('acf') && (
                        <td className="px-3 py-3 text-center">
                          {client.acf_link ? (
                            <a
                              href={String(client.acf_link)}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center justify-center text-[var(--portal)] hover:brightness-110 transition-colors"
                              title="Open Active Client File"
                            >
                              <span className="material-icons-outlined text-[18px]">folder_open</span>
                            </a>
                          ) : dash}
                        </td>
                      )}

                      {/* Age (optional column) */}
                      {col('age') && (
                        <td className="px-3 py-3">
                          {age != null ? (
                            <span className="text-[var(--text-secondary)] text-xs">{age}</span>
                          ) : dash}
                        </td>
                      )}

                      {/* Date of Birth (optional column) */}
                      {col('dob') && (
                        <td className="px-3 py-3">
                          {client.dob ? (
                            <span className="text-[var(--text-secondary)] text-xs whitespace-nowrap">
                              {new Date(String(client.dob)).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}
                            </span>
                          ) : dash}
                        </td>
                      )}

                      {/* SSN Last 4 (optional column) */}
                      {col('ssn') && (
                        <td className="px-3 py-3">
                          {client.ssn_last4 ? (
                            <span className="text-[var(--text-secondary)] text-xs">
                              ***-**-{String(client.ssn_last4)}
                            </span>
                          ) : dash}
                        </td>
                      )}

                      {/* Gender (optional column) */}
                      {col('gender') && (
                        <td className="px-3 py-3">
                          {client.gender ? (
                            <span className="text-[var(--text-secondary)] text-xs">{String(client.gender)}</span>
                          ) : dash}
                        </td>
                      )}

                      {/* Marital Status (optional column) */}
                      {col('marital') && (
                        <td className="px-3 py-3">
                          {client.marital_status ? (
                            <span className="text-[var(--text-secondary)] text-xs">{String(client.marital_status)}</span>
                          ) : dash}
                        </td>
                      )}

                      {/* Time Zone (optional column) */}
                      {col('timezone') && (
                        <td className="px-3 py-3">
                          {client.timezone ? (
                            <span className="text-[var(--text-secondary)] text-xs">{String(client.timezone)}</span>
                          ) : dash}
                        </td>
                      )}

                      {/* Employment (optional column) */}
                      {col('employment') && (
                        <td className="px-3 py-3">
                          {client.employment_status ? (
                            <span className="text-[var(--text-secondary)] text-xs">{String(client.employment_status)}</span>
                          ) : dash}
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between text-sm text-[var(--text-muted)]">
            <span>
              Showing {showingStart}&ndash;{showingEnd} of {sorted.length.toLocaleString()}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="rounded-lg border border-[var(--border)] px-4 py-1.5 text-sm transition-colors hover:bg-[var(--bg-hover)] disabled:cursor-not-allowed disabled:opacity-30"
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
                className="rounded-lg border border-[var(--border)] px-4 py-1.5 text-sm transition-colors hover:bg-[var(--bg-hover)] disabled:cursor-not-allowed disabled:opacity-30"
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
