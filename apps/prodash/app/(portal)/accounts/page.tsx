'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
import { collectionGroup, getDocs, query, orderBy } from 'firebase/firestore'
import { getDb } from '@tomachina/db'
import { useCollection } from '@tomachina/db'
import { collections } from '@tomachina/db/src/firestore'
import type { Account } from '@tomachina/core'

function str(val: unknown): string {
  if (val == null) return ''
  return String(val)
}

function formatCurrency(raw: unknown): string {
  if (raw == null || raw === '') return ''
  const num = typeof raw === 'number' ? raw : parseFloat(String(raw).replace(/[$,\s]/g, ''))
  if (isNaN(num)) return String(raw)
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(num)
}

function formatDate(raw: unknown): string {
  if (!raw) return ''
  const d = new Date(String(raw))
  if (isNaN(d.getTime())) return String(raw)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type FilterKey = 'all' | 'annuity' | 'life' | 'medicare' | 'bdria'

interface AccountRow extends Account {
  _id: string
  _clientId: string
  _clientName?: string
}

interface ClientNameDoc {
  _id: string
  first_name?: string
  last_name?: string
}

const FILTER_TABS: { key: FilterKey; label: string; color: string }[] = [
  { key: 'all', label: 'All', color: 'var(--portal)' },
  { key: 'annuity', label: 'Annuity', color: '#f59e0b' },
  { key: 'life', label: 'Life', color: '#10b981' },
  { key: 'medicare', label: 'Medicare', color: '#3b82f6' },
  { key: 'bdria', label: 'Investment', color: '#a78bfa' },
]

// Default column keys per product type
const DEFAULT_COLUMNS: Record<FilterKey, string[]> = {
  all: ['_clientName', 'account_number', 'carrier_name', 'product_type', 'status', 'effective_date', 'account_value'],
  annuity: ['_clientName', 'carrier_name', 'product_name', 'account_type', 'tax_status', 'issue_date', 'market', 'account_value', 'account_number'],
  life: ['_clientName', 'carrier_name', 'product_name', 'face_amount', 'premium', 'issue_date', 'status', 'cash_value', 'account_number'],
  medicare: ['_clientName', 'carrier_name', 'plan_type', 'plan_id', 'effective_date', 'premium', 'coverage_type', 'status', 'account_number'],
  bdria: ['_clientName', 'custodian', 'account_type', 'account_value', 'advisor', 'account_number', 'effective_date', 'status'],
}

// Friendly labels
const COLUMN_LABELS: Record<string, string> = {
  _clientName: 'Client',
  account_number: 'Account #',
  carrier_name: 'Carrier',
  product_type: 'Type',
  product_name: 'Product',
  plan_name: 'Plan Name',
  plan_type: 'Plan Type',
  plan_id: 'Plan ID',
  status: 'Status',
  effective_date: 'Effective Date',
  issue_date: 'Issue Date',
  account_value: 'Value',
  premium: 'Premium',
  face_amount: 'Face Amount',
  cash_value: 'Cash Value',
  death_benefit: 'Death Benefit',
  tax_status: 'Tax Status',
  market: 'Market',
  account_type: 'Account Type',
  coverage_type: 'Coverage Type',
  custodian: 'Custodian',
  advisor: 'Advisor',
  policy_number: 'Policy #',
  contract_number: 'Contract #',
  owner_name: 'Owner',
}

const PAGE_SIZE = 25

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default function AccountsPage() {
  const [rawAccounts, setRawAccounts] = useState<AccountRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<FilterKey>('all')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('Active')
  const [carrierFilter, setCarrierFilter] = useState('All')
  const [visibleColumns, setVisibleColumns] = useState<string[]>(DEFAULT_COLUMNS['all'])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showColumnPicker, setShowColumnPicker] = useState(false)
  const [sortKey, setSortKey] = useState<string | null>('carrier_name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [page, setPage] = useState(0)

  // Load ALL client names for enrichment (real-time listener, same pattern as contacts)
  const clientsQ = useMemo(() => query(collections.clients()), [])
  const { data: clientDocs } = useCollection<ClientNameDoc>(clientsQ, 'accounts-client-names')

  const clientNameMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const c of clientDocs) {
      const name = `${c.first_name || ''} ${c.last_name || ''}`.trim()
      if (name) map.set(c._id, name)
    }
    return map
  }, [clientDocs])

  // Load ALL accounts (one-time fetch — no limit)
  useEffect(() => {
    async function loadAll() {
      try {
        const db = getDb()
        const q = query(collectionGroup(db, 'accounts'), orderBy('carrier_name'))
        const snap = await getDocs(q)
        const rows: AccountRow[] = snap.docs.map((d) => {
          const data = d.data() as unknown as Account
          const pathParts = d.ref.path.split('/')
          return { ...data, _id: d.id, _clientId: pathParts[1] || '' }
        })
        setRawAccounts(rows)
      } catch (err) {
        setError(String(err))
      } finally {
        setLoading(false)
      }
    }
    loadAll()
  }, [])

  // Enrich accounts with client names
  const accounts = useMemo(() => {
    if (clientNameMap.size === 0) return rawAccounts
    return rawAccounts.map((a) => ({
      ...a,
      _clientName: clientNameMap.get(a._clientId) || a._clientName || '',
    }))
  }, [rawAccounts, clientNameMap])

  // Update columns when filter changes
  useEffect(() => {
    setVisibleColumns(DEFAULT_COLUMNS[filter])
    setPage(0)
  }, [filter])

  // Category classifier
  const getCategory = useCallback((acct: AccountRow): FilterKey => {
    const cat = str(acct.account_type_category).toLowerCase()
    if (cat === 'annuity') return 'annuity'
    if (cat === 'life') return 'life'
    if (cat === 'medicare') return 'medicare'
    if (cat === 'bdria' || cat === 'bd_ria') return 'bdria'
    const t = (str(acct.product_type) + ' ' + str(acct.account_type)).toLowerCase()
    if (t.includes('annuity') || t.includes('fia') || t.includes('myga')) return 'annuity'
    if (t.includes('life')) return 'life'
    if (t.includes('medicare') || t.includes('mapd') || t.includes('pdp') || t.includes('med supp')) return 'medicare'
    if (t.includes('bd') || t.includes('ria') || t.includes('advisory')) return 'bdria'
    return 'all'
  }, [])

  // Counts — computed from ALL accounts, always accurate
  const counts = useMemo(() => {
    const c: Record<FilterKey, number> = { all: accounts.length, annuity: 0, life: 0, medicare: 0, bdria: 0 }
    accounts.forEach((a) => { const cat = getCategory(a); if (cat !== 'all') c[cat]++ })
    return c
  }, [accounts, getCategory])

  // Unique carriers — from ALL accounts
  const carriers = useMemo(() => {
    const set = new Set<string>()
    accounts.forEach((a) => { const c = str(a.carrier_name) || str(a.carrier); if (c) set.add(c) })
    return Array.from(set).sort()
  }, [accounts])

  // Search + filter — operates on FULL dataset
  const filtered = useMemo(() => {
    let result = filter === 'all' ? accounts : accounts.filter((a) => getCategory(a) === filter)

    if (statusFilter !== 'All') {
      result = result.filter((a) => str(a.status).toLowerCase() === statusFilter.toLowerCase())
    }

    if (carrierFilter !== 'All') {
      result = result.filter((a) => (str(a.carrier_name) || str(a.carrier)) === carrierFilter)
    }

    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter((a) =>
        str(a.carrier_name).toLowerCase().includes(q) ||
        str(a.product_name).toLowerCase().includes(q) ||
        str(a.plan_name).toLowerCase().includes(q) ||
        str(a.account_number).toLowerCase().includes(q) ||
        str(a.policy_number).toLowerCase().includes(q) ||
        str(a._clientName).toLowerCase().includes(q)
      )
    }
    return result
  }, [accounts, filter, search, statusFilter, carrierFilter, getCategory])

  // Sort
  const sorted = useMemo(() => {
    if (!sortKey) return filtered
    return [...filtered].sort((a, b) => {
      const av = str((a as Record<string, unknown>)[sortKey])
      const bv = str((b as Record<string, unknown>)[sortKey])
      const na = parseFloat(av.replace(/[$,\s]/g, ''))
      const nb = parseFloat(bv.replace(/[$,\s]/g, ''))
      if (!isNaN(na) && !isNaN(nb)) return sortDir === 'asc' ? na - nb : nb - na
      const cmp = av.localeCompare(bv, undefined, { numeric: true })
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [filtered, sortKey, sortDir])

  // Paginate
  const totalPages = Math.ceil(sorted.length / PAGE_SIZE)
  const paged = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const showingStart = sorted.length > 0 ? page * PAGE_SIZE + 1 : 0
  const showingEnd = Math.min((page + 1) * PAGE_SIZE, sorted.length)

  const handleSort = useCallback((key: string) => {
    if (sortKey === key) setSortDir((d) => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }, [sortKey])

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }, [])

  const handleDdup = useCallback(() => {
    const ids = Array.from(selectedIds).join(',')
    window.open(`/ddup?ids=${ids}&type=account`, '_blank', 'noopener,noreferrer')
  }, [selectedIds])

  const toggleColumn = useCallback((col: string) => {
    setVisibleColumns((prev) => {
      if (prev.includes(col)) return prev.filter((c) => c !== col)
      if (prev.length >= 10) return prev
      return [...prev, col]
    })
  }, [])

  const getCellValue = useCallback((acct: AccountRow, col: string): string => {
    const val = (acct as Record<string, unknown>)[col]
    if (col.includes('value') || col.includes('premium') || col.includes('amount') || col.includes('benefit')) return formatCurrency(val)
    if (col.includes('date') || col.includes('_at')) return formatDate(val)
    return str(val)
  }, [])

  useEffect(() => { setPage(0) }, [filter, search, statusFilter, carrierFilter])

  // Style for active vs inactive filter dropdown
  const filterSelectClass = (isActive: boolean) =>
    `h-[34px] rounded-md border px-3 text-sm font-medium outline-none transition-all cursor-pointer ${
      isActive
        ? 'border-[var(--portal)] bg-[var(--portal)] text-white'
        : 'border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:border-[var(--portal)] hover:text-[var(--portal)]'
    } focus:border-[var(--portal)]`

  if (loading) {
    return (
      <div className="flex flex-col gap-5">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Accounts</h1>
        </div>
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--portal)] border-t-transparent" />
            <p className="text-sm text-[var(--text-muted)]">Loading accounts...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col gap-5">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Accounts</h1>
        <div className="mt-6 flex flex-col items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] py-20">
          <span className="material-icons-outlined text-5xl text-[var(--error)]">warning</span>
          <p className="mt-4 text-sm text-[var(--text-muted)]">Failed to load accounts.</p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Filters — no background wrapper, matches dark bg throughout */}
      <div className="space-y-3">
        {/* Row 1: Search + New */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative">
            <span className="material-icons-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-[var(--text-muted)]">search</span>
            <input
              type="text"
              placeholder="Search accounts..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-[34px] w-72 rounded-md border border-[var(--border)] bg-[var(--bg-surface)] pl-10 pr-4 text-sm font-medium text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--portal)]"
            />
          </div>
          <a
            href="/intake"
            className="inline-flex items-center gap-1.5 rounded-md border border-[var(--portal)] bg-[var(--portal)] h-[34px] px-3 text-sm font-medium text-white transition-colors hover:opacity-90"
            title="New Account"
          >
            <span className="material-icons-outlined text-[18px]">add</span>
            New
          </a>
        </div>

        {/* Row 2: Filters + Columns */}
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={filterSelectClass(statusFilter !== 'All')}
          >
            <option value="All">All Statuses</option>
            <option value="Active">Active</option>
            <option value="In Force">In Force</option>
            <option value="Pending">Pending</option>
            <option value="Inactive">Inactive</option>
            <option value="Terminated">Terminated</option>
          </select>

          <select
            value={carrierFilter}
            onChange={(e) => setCarrierFilter(e.target.value)}
            className={filterSelectClass(carrierFilter !== 'All')}
          >
            <option value="All">All Carriers</option>
            {carriers.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>

          <button
            onClick={() => setShowColumnPicker(!showColumnPicker)}
            className={`inline-flex items-center gap-1.5 rounded-md border h-[34px] px-3 text-sm font-medium transition-all ${
              showColumnPicker ? 'border-[var(--portal)] bg-[var(--portal)] text-white' : 'border-[var(--portal)] bg-[var(--bg-surface)] text-[var(--portal)] hover:bg-[var(--portal)] hover:text-white'
            }`}
          >
            <span className="material-icons-outlined text-[16px]">view_column</span>
            Columns
          </button>

          {selectedIds.size >= 2 && (
            <button
              onClick={handleDdup}
              className="inline-flex items-center gap-1.5 rounded-md bg-amber-500 h-[34px] px-4 text-sm font-medium text-white transition-colors hover:bg-amber-600"
            >
              <span className="material-icons-outlined text-[16px]">merge_type</span>
              Ddup Selected ({selectedIds.size})
            </button>
          )}
        </div>

        {/* Row 3: Type pills + Count */}
        <div className="flex flex-wrap items-center gap-2">
          {FILTER_TABS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`inline-flex items-center gap-1.5 rounded-md h-[34px] px-3.5 text-sm font-medium transition-all ${
                filter === f.key ? 'text-white' : 'bg-[var(--bg-surface)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
              }`}
              style={filter === f.key ? { backgroundColor: f.color } : undefined}
            >
              {f.label}
              <span className={`ml-0.5 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1 text-xs ${
                filter === f.key ? 'bg-white/20 text-white' : 'bg-[var(--bg-card)] text-[var(--text-muted)]'
              }`}>
                {counts[f.key].toLocaleString()}
              </span>
            </button>
          ))}

          {/* Count pill — matches contacts pattern */}
          <span
            className="inline-flex items-center rounded-md border border-[var(--border)] bg-[var(--bg-surface)] h-[34px] px-3 text-sm font-medium ml-auto"
            style={{ color: 'var(--portal)' }}
          >
            {filtered.length.toLocaleString()}
          </span>
        </div>

        {/* Column picker panel */}
        {showColumnPicker && (
          <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-[var(--text-primary)]">Visible Columns ({visibleColumns.length}/10)</p>
              <button
                onClick={() => setVisibleColumns(DEFAULT_COLUMNS[filter])}
                className="text-xs text-[var(--portal)] hover:underline"
              >
                Reset to Default
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {Object.keys(COLUMN_LABELS).map((col) => (
                <label
                  key={col}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium cursor-pointer transition-all ${
                    visibleColumns.includes(col)
                      ? 'bg-[var(--portal)]/15 text-[var(--portal)]'
                      : 'bg-[var(--bg-surface)] text-[var(--text-muted)]'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={visibleColumns.includes(col)}
                    onChange={() => toggleColumn(col)}
                    className="sr-only"
                  />
                  {COLUMN_LABELS[col]}
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* No results */}
      {sorted.length === 0 && (
        <div className="flex items-center justify-center py-16">
          <div className="flex flex-col items-center gap-3 text-center">
            <span className="material-icons-outlined text-4xl text-[var(--text-muted)]">search</span>
            <p className="text-sm text-[var(--text-muted)]">
              No accounts match your filters. Try adjusting your search or filters.
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
                      checked={paged.length > 0 && paged.every((a) => selectedIds.has(`${a._clientId}::${a._id}`))}
                      onChange={(e) => {
                        const ids = paged.map((a) => `${a._clientId}::${a._id}`)
                        setSelectedIds((prev) => {
                          const next = new Set(prev)
                          ids.forEach((id) => e.target.checked ? next.add(id) : next.delete(id))
                          return next
                        })
                      }}
                    />
                  </th>
                  {visibleColumns.map((col) => (
                    <th
                      key={col}
                      onClick={() => handleSort(col)}
                      className="cursor-pointer select-none px-3 py-3 text-left text-xs font-semibold uppercase text-[var(--portal)] transition-colors hover:text-[var(--text-primary)]"
                    >
                      <span className="inline-flex items-center gap-1">
                        {COLUMN_LABELS[col] || col}
                        {sortKey === col && (
                          <span className="text-[var(--portal)]">{sortDir === 'asc' ? '\u2191' : '\u2193'}</span>
                        )}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paged.map((acct) => {
                  const rowKey = `${acct._clientId}::${acct._id}`
                  const isSelected = selectedIds.has(rowKey)
                  const statusColor = getStatusColor(str(acct.status))

                  return (
                    <tr
                      key={rowKey}
                      onClick={() => window.open(`/accounts/${acct._clientId}/${acct._id}`, '_blank')}
                      className={`cursor-pointer border-t border-[var(--border)] transition-colors hover:bg-[var(--bg-hover)] ${isSelected ? 'bg-[var(--portal)]/5' : ''}`}
                    >
                      <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(rowKey)}
                          className="h-4 w-4 rounded border-[var(--border)] accent-[var(--portal)]"
                        />
                      </td>
                      {visibleColumns.map((col) => {
                        const cellVal = getCellValue(acct, col)
                        const isStatus = col === 'status'

                        return (
                          <td key={col} className="px-3 py-3">
                            {isStatus ? (
                              <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor}`}>
                                {cellVal || 'Unknown'}
                              </span>
                            ) : col === '_clientName' ? (
                              <p className="font-medium text-[var(--text-primary)]">{cellVal || acct._clientId.slice(0, 8)}</p>
                            ) : (
                              <p className={`text-[var(--text-secondary)] ${col.includes('number') || col.includes('id') ? 'font-mono text-xs' : ''}`}>
                                {cellVal || '\u2014'}
                              </p>
                            )}
                          </td>
                        )
                      })}
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

function getStatusColor(status: string): string {
  const s = status.toLowerCase()
  if (s === 'active' || s === 'in force') return 'bg-emerald-500/15 text-emerald-400'
  if (s === 'pending') return 'bg-amber-500/15 text-amber-400'
  if (s === 'terminated' || s === 'lapsed' || s === 'cancelled') return 'bg-red-500/15 text-red-400'
  if (s === 'replaced') return 'bg-blue-500/15 text-blue-400'
  return 'bg-[var(--bg-surface)] text-[var(--text-muted)]'
}
