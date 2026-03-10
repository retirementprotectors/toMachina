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

/** Format 10-digit phone string as (XXX) XXX-XXXX */
function formatPhone(raw: string): string {
  const digits = normalizePhone(raw)
  if (digits.length !== 10) return raw || ''
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
}

/** Build a stable query reference */
const clientsQuery: Query<DocumentData> = query(collections.clients(), orderBy('last_name'))

type SortKey = 'name' | 'book_of_business' | 'agent_name' | 'client_status' | 'state' | null

interface ClientRow extends Client {
  _id: string
  account_types?: string[]
  book_of_business?: string
  agent_name?: string
}

const PAGE_SIZE = 25

export default function ClientsPage() {
  const router = useRouter()
  const { data: rawClients, loading, error } = useCollection<ClientRow>(clientsQuery, 'all-clients')

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [accountTypeFilter, setAccountTypeFilter] = useState('All')
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [page, setPage] = useState(0)

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

    // Account type filter
    if (accountTypeFilter !== 'All') {
      const filterVal = accountTypeFilter.toLowerCase()
      result = result.filter((c) => {
        const types = c.account_types || []
        return types.some((t) => {
          const norm = (t || '').toLowerCase()
          if (filterVal === 'bd/ria') return norm === 'bd' || norm === 'ria' || norm === 'bd/ria'
          return norm === filterVal
        })
      })
    }

    return result
  }, [rawClients, search, statusFilter, accountTypeFilter])

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
        case 'state':
          av = `${a.state || ''} ${a.city || ''}`.toLowerCase()
          bv = `${b.state || ''} ${b.city || ''}`.toLowerCase()
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

  // Reset page when filters change
  const handleSearchChange = useCallback((value: string) => {
    setSearch(value)
    setPage(0)
  }, [])

  const handleStatusChange = useCallback((value: string) => {
    setStatusFilter(value)
    setPage(0)
  }, [])

  const handleAccountTypeChange = useCallback((value: string) => {
    setAccountTypeFilter(value)
    setPage(0)
  }, [])

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
      router.push(`/clients/${client._id || client.client_id}`)
    },
    [router]
  )

  // Column header helper
  const renderSortHeader = (label: string, key: SortKey) => (
    <th
      onClick={() => handleSort(key)}
      className="cursor-pointer select-none px-4 py-3 text-left text-xs font-semibold uppercase text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {sortKey === key && (
          <span className="text-[var(--portal)]">{sortDir === 'asc' ? '\u2191' : '\u2193'}</span>
        )}
      </span>
    </th>
  )

  // Loading state
  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Clients</h1>
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
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Clients</h1>
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

  // Empty state (no data in Firestore at all)
  if (rawClients.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <ClientFilters
          search={search}
          onSearchChange={handleSearchChange}
          statusFilter={statusFilter}
          onStatusChange={handleStatusChange}
          accountTypeFilter={accountTypeFilter}
          onAccountTypeChange={handleAccountTypeChange}
          totalCount={0}
        />
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--bg-surface)]">
              <svg className="h-8 w-8 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div>
              <p className="text-lg font-medium text-[var(--text-primary)]">No clients found</p>
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                Data migration pending. Clients will appear here once the bridge syncs from RAPID_MATRIX.
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header + Filters */}
      <ClientFilters
        search={search}
        onSearchChange={handleSearchChange}
        statusFilter={statusFilter}
        onStatusChange={handleStatusChange}
        accountTypeFilter={accountTypeFilter}
        onAccountTypeChange={handleAccountTypeChange}
        totalCount={filtered.length}
      />

      {/* No results after filtering */}
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
          <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
            <table className="w-full text-sm">
              <thead className="bg-[var(--bg-secondary)]">
                <tr>
                  {renderSortHeader('Contact', 'name')}
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-[var(--text-muted)]">
                    Phone / Email
                  </th>
                  {renderSortHeader('Book / Agent', 'book_of_business')}
                  {renderSortHeader('Status', 'client_status')}
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-[var(--text-muted)]">
                    Accounts
                  </th>
                  {renderSortHeader('Location', 'state')}
                </tr>
              </thead>
              <tbody>
                {paged.map((client) => (
                  <tr
                    key={client._id || client.client_id}
                    onClick={() => handleRowClick(client)}
                    className="cursor-pointer border-t border-[var(--border)] transition-colors hover:bg-[var(--bg-hover)]"
                  >
                    {/* Contact */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <ClientAvatar
                          firstName={client.first_name}
                          lastName={client.last_name}
                        />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-[var(--text-primary)]">
                            {client.first_name} {client.last_name}
                          </p>
                          {client.client_classification && (
                            <p className="truncate text-xs text-[var(--text-muted)]">
                              {client.client_classification}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Phone / Email */}
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-0.5">
                        {client.phone && (
                          <span className="text-[var(--text-secondary)]">
                            {formatPhone(client.phone)}
                          </span>
                        )}
                        {client.email && (
                          <a
                            href={`mailto:${client.email}`}
                            onClick={(e) => e.stopPropagation()}
                            className="truncate text-xs text-[var(--portal)] hover:underline"
                          >
                            {client.email}
                          </a>
                        )}
                        {!client.phone && !client.email && (
                          <span className="text-xs text-[var(--text-muted)]">&mdash;</span>
                        )}
                      </div>
                    </td>

                    {/* Book / Agent */}
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-0.5">
                        {client.book_of_business && (
                          <span className="text-[var(--text-secondary)]">
                            {client.book_of_business}
                          </span>
                        )}
                        {client.agent_name && (
                          <span className="text-xs text-[var(--text-muted)]">
                            {client.agent_name}
                          </span>
                        )}
                        {!client.book_of_business && !client.agent_name && (
                          <span className="text-xs text-[var(--text-muted)]">&mdash;</span>
                        )}
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      <StatusBadge status={client.client_status} />
                    </td>

                    {/* Accounts */}
                    <td className="px-4 py-3">
                      <AccountTypePills accountTypes={client.account_types || []} />
                    </td>

                    {/* Location */}
                    <td className="px-4 py-3">
                      {client.city || client.state ? (
                        <span className="text-[var(--text-secondary)]">
                          {[client.city, client.state].filter(Boolean).join(', ')}
                        </span>
                      ) : (
                        <span className="text-xs text-[var(--text-muted)]">&mdash;</span>
                      )}
                    </td>
                  </tr>
                ))}
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
