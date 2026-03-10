'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { collectionGroup, getDocs, query, type DocumentData } from 'firebase/firestore'
import { getDb } from '@tomachina/db'
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

function formatPhone(raw: unknown): string {
  if (!raw) return ''
  const digits = String(raw).replace(/\D/g, '')
  const d = digits.length === 11 && digits[0] === '1' ? digits.slice(1) : digits
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`
  return String(raw)
}

type FilterKey = 'all' | 'annuity' | 'life' | 'medicare' | 'bdria'
type SortKey = 'carrier_name' | 'product_name' | 'status' | 'account_value' | 'client_name' | null

interface AccountRow extends Account {
  _id: string
  _clientId: string
  _clientName?: string
}

const FILTERS: { key: FilterKey; label: string; color: string }[] = [
  { key: 'all', label: 'All', color: 'var(--portal)' },
  { key: 'annuity', label: 'Annuity', color: '#f59e0b' },
  { key: 'life', label: 'Life', color: '#10b981' },
  { key: 'medicare', label: 'Medicare', color: '#3b82f6' },
  { key: 'bdria', label: 'BD/RIA', color: '#a78bfa' },
]

export default function AccountsPage() {
  const router = useRouter()
  const [accounts, setAccounts] = useState<AccountRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<FilterKey>('all')
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('carrier_name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [page, setPage] = useState(0)
  const pageSize = 25

  // Load all accounts via collection group query
  useEffect(() => {
    async function load() {
      try {
        const db = getDb()
        const q = query(collectionGroup(db, 'accounts'))
        const snap = await getDocs(q)
        const rows: AccountRow[] = snap.docs.map((doc) => {
          const data = doc.data() as Account
          // Extract clientId from the document path: clients/{clientId}/accounts/{accountId}
          const pathParts = doc.ref.path.split('/')
          const clientId = pathParts[1] || ''
          return {
            ...data,
            _id: doc.id,
            _clientId: clientId,
          }
        })
        setAccounts(rows)
      } catch (err) {
        setError(String(err))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  // Enrich with client names (async, after initial load)
  useEffect(() => {
    if (accounts.length === 0) return
    // Build unique client IDs
    const clientIds = [...new Set(accounts.map((a) => a._clientId).filter(Boolean))]
    if (clientIds.length === 0) return

    async function enrichNames() {
      const db = getDb()
      const { doc, getDoc } = await import('firebase/firestore')
      const nameMap = new Map<string, string>()

      // Batch read client names (first 500 unique clients)
      const batch = clientIds.slice(0, 500)
      const results = await Promise.all(
        batch.map(async (id) => {
          try {
            const snap = await getDoc(doc(db, 'clients', id))
            if (snap.exists()) {
              const d = snap.data()
              return { id, name: `${d.first_name || ''} ${d.last_name || ''}`.trim() }
            }
          } catch { /* skip */ }
          return { id, name: '' }
        })
      )

      results.forEach((r) => { if (r.name) nameMap.set(r.id, r.name) })

      setAccounts((prev) =>
        prev.map((a) => ({
          ...a,
          _clientName: nameMap.get(a._clientId) || a._clientName,
        }))
      )
    }
    enrichNames()
  }, [accounts.length])

  // Filter by type
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

  // Counts
  const counts = useMemo(() => {
    const c: Record<FilterKey, number> = { all: accounts.length, annuity: 0, life: 0, medicare: 0, bdria: 0 }
    accounts.forEach((a) => { const cat = getCategory(a); if (cat !== 'all') c[cat]++ })
    return c
  }, [accounts, getCategory])

  // Search + filter
  const filtered = useMemo(() => {
    let result = filter === 'all' ? accounts : accounts.filter((a) => getCategory(a) === filter)
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
  }, [accounts, filter, search, getCategory])

  // Sort
  const sorted = useMemo(() => {
    if (!sortKey) return filtered
    return [...filtered].sort((a, b) => {
      let av = '', bv = ''
      if (sortKey === 'client_name') { av = str(a._clientName); bv = str(b._clientName) }
      else if (sortKey === 'account_value') {
        const na = parseFloat(String(a.account_value || a.premium || 0)) || 0
        const nb = parseFloat(String(b.account_value || b.premium || 0)) || 0
        return sortDir === 'asc' ? na - nb : nb - na
      } else { av = str((a as any)[sortKey]); bv = str((b as any)[sortKey]) }
      const cmp = av.localeCompare(bv, undefined, { numeric: true })
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [filtered, sortKey, sortDir])

  // Paginate
  const totalPages = Math.ceil(sorted.length / pageSize)
  const paged = sorted.slice(page * pageSize, (page + 1) * pageSize)

  const handleSort = useCallback((key: SortKey) => {
    if (sortKey === key) setSortDir((d) => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }, [sortKey])

  const handleRowClick = useCallback((acct: AccountRow) => {
    router.push(`/accounts/${acct._clientId}/${acct._id}`)
  }, [router])

  // Reset page on filter/search change
  useEffect(() => { setPage(0) }, [filter, search])

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl animate-pulse space-y-4">
        <div className="h-8 w-48 rounded bg-[var(--bg-surface)]" />
        <div className="h-12 rounded bg-[var(--bg-surface)]" />
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-14 rounded bg-[var(--bg-card)]" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="mx-auto max-w-7xl">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Accounts</h1>
        <div className="mt-6 flex flex-col items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] py-20">
          <span className="material-icons-outlined text-5xl text-[var(--error)]">warning</span>
          <p className="mt-4 text-sm text-[var(--text-muted)]">Failed to load accounts.</p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">{error}</p>
        </div>
      </div>
    )
  }

  const SortHeader = ({ label, field }: { label: string; field: SortKey }) => (
    <th
      onClick={() => handleSort(field)}
      className="cursor-pointer select-none px-4 py-3 text-left text-xs font-semibold uppercase text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {sortKey === field && (
          <span className="text-[var(--portal)]">{sortDir === 'asc' ? '\u2191' : '\u2193'}</span>
        )}
      </span>
    </th>
  )

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Accounts</h1>
          <span className="rounded-full bg-[var(--portal)] px-2.5 py-0.5 text-xs font-semibold text-white">
            {accounts.length.toLocaleString()}
          </span>
        </div>
        {/* Search */}
        <div className="relative">
          <span className="material-icons-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-[var(--text-muted)]">search</span>
          <input
            type="text"
            placeholder="Search accounts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-64 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] py-2 pl-10 pr-4 text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--portal)]"
          />
        </div>
      </div>

      {/* Type filter pills */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-all ${
              filter === f.key
                ? 'text-white'
                : 'bg-[var(--bg-surface)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
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
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--bg-card)]">
        <table className="w-full text-sm">
          <thead className="bg-[var(--bg-surface)]">
            <tr>
              <SortHeader label="Client" field="client_name" />
              <SortHeader label="Carrier" field="carrier_name" />
              <SortHeader label="Product" field="product_name" />
              <SortHeader label="Status" field="status" />
              <SortHeader label="Value" field="account_value" />
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-[var(--text-muted)]">Type</th>
            </tr>
          </thead>
          <tbody>
            {paged.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-16 text-center text-sm text-[var(--text-muted)]">
                  {search || filter !== 'all' ? 'No accounts match your filters.' : 'No accounts found.'}
                </td>
              </tr>
            ) : (
              paged.map((acct) => {
                const cat = getCategory(acct)
                const catFilter = FILTERS.find((f) => f.key === cat) || FILTERS.find((f) => f.key === 'all')!
                const statusColor = getStatusColor(str(acct.status))

                return (
                  <tr
                    key={`${acct._clientId}-${acct._id}`}
                    onClick={() => handleRowClick(acct)}
                    className="cursor-pointer border-t border-[var(--border)] transition-colors hover:bg-[var(--bg-hover)]"
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-[var(--text-primary)]">{acct._clientName || acct._clientId.slice(0, 8)}</p>
                    </td>
                    <td className="px-4 py-3 text-[var(--text-secondary)]">
                      {str(acct.carrier_name) || str(acct.carrier) || '\u2014'}
                    </td>
                    <td className="px-4 py-3 text-[var(--text-secondary)]">
                      <p className="truncate max-w-[200px]">{str(acct.product_name) || str(acct.plan_name) || '\u2014'}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor}`}>
                        {str(acct.status) || 'Unknown'}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-[var(--text-primary)]">
                      {formatCurrency(acct.account_value || acct.premium)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="inline-block rounded-full px-2 py-0.5 text-xs font-medium text-white"
                        style={{ backgroundColor: catFilter.color }}
                      >
                        {catFilter.label}
                      </span>
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
        <div className="flex items-center justify-between text-sm text-[var(--text-muted)]">
          <span>
            {(page * pageSize + 1).toLocaleString()}–{Math.min((page + 1) * pageSize, sorted.length).toLocaleString()} of {sorted.length.toLocaleString()}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="rounded-lg border border-[var(--border)] px-3 py-1.5 transition-colors hover:bg-[var(--bg-hover)] disabled:opacity-30"
            >
              Previous
            </button>
            <span>Page {page + 1} of {totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="rounded-lg border border-[var(--border)] px-3 py-1.5 transition-colors hover:bg-[var(--bg-hover)] disabled:opacity-30"
            >
              Next
            </button>
          </div>
        </div>
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
