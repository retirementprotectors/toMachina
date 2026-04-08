'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore'
import { getDb } from '@tomachina/db'
import type { Client, Account, RmdResult, RmdScheduleRow } from '@tomachina/core'
import { calculateRmd, generateRmdSchedule, isRmdEligible, getRmdStartAge } from '@tomachina/core'

// ---------------------------------------------------------------------------
// RMD Center — Required Minimum Distribution tracking + IRS calculation
// Full grid/list view, detail panel, inline editing, client links
// ---------------------------------------------------------------------------

type RmdStatus = 'all' | 'pending' | 'completed' | 'overdue'
type ViewMode = 'grid' | 'card'
type SortField = 'name' | 'age' | 'carrier' | 'accountType' | 'value' | 'rmdAmount' | 'distributed' | 'remaining' | 'status' | 'deadline'
type SortDir = 'asc' | 'desc'

interface RmdRecord {
  clientId: string
  client: Client
  account: Account
  accountId: string
  rmd: RmdResult
  age: number
  balance: number
}

const VIEW_STORAGE_KEY = 'rmd-center-view-mode'

export default function RmdCenterPage() {
  const [rmdRecords, setRmdRecords] = useState<RmdRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [statusFilter, setStatusFilter] = useState<RmdStatus>('all')
  const [selectedRecord, setSelectedRecord] = useState<RmdRecord | null>(null)
  const [schedule, setSchedule] = useState<RmdScheduleRow[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [sortField, setSortField] = useState<SortField>('status')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  // Inline edit state
  const [editDistributed, setEditDistributed] = useState('')
  const [editSystematic, setEditSystematic] = useState(false)
  const [saving, setSaving] = useState(false)

  const currentYear = new Date().getFullYear()

  // Load view preference
  useEffect(() => {
    try {
      const saved = localStorage.getItem(VIEW_STORAGE_KEY)
      if (saved === 'grid' || saved === 'card') setViewMode(saved)
    } catch { /* noop */ }
  }, [])

  const setView = (mode: ViewMode) => {
    setViewMode(mode)
    try { localStorage.setItem(VIEW_STORAGE_KEY, mode) } catch { /* noop */ }
  }

  // Scan all clients and their accounts for RMD obligations
  const loadRmds = useCallback(async () => {
    setLoading(true)
    try {
      const db = getDb()
      const clientsSnap = await getDocs(collection(db, 'clients'))
      const records: RmdRecord[] = []

      for (const clientDoc of clientsSnap.docs) {
        const client = { ...clientDoc.data(), _id: clientDoc.id } as unknown as Client
        const clientId = clientDoc.id
        if (!client.dob) continue
        const dob = new Date(String(client.dob))
        if (isNaN(dob.getTime())) continue

        const age = getAgeAtYearEnd(dob, currentYear)
        const birthYear = dob.getFullYear()
        const startAge = getRmdStartAge(birthYear)
        if (age < startAge) continue

        const accountsSnap = await getDocs(collection(db, 'clients', clientId, 'accounts'))
        accountsSnap.forEach((acctDoc) => {
          const account = { ...acctDoc.data(), _id: acctDoc.id } as unknown as Account
          const acctType = String(account.account_type_category || account.product_type || account.account_type || '')
          const taxStatus = String(account.tax_status || '')

          if (!isRmdEligible(acctType, taxStatus)) return

          const balance = parseFloat(String(account.account_value || 0).replace(/[$,]/g, ''))
          if (balance <= 0) return

          const distributed = parseFloat(String(account.rmd_taken || account.rmd_distributed || 0).replace(/[$,]/g, ''))

          const rmd = calculateRmd({
            ownerAge: age,
            priorYearBalance: balance,
            isFirstRmd: age === startAge,
            amountDistributed: distributed,
            systematicRmd: Boolean(account.systematic_rmd),
          })

          records.push({
            clientId,
            client,
            account,
            accountId: acctDoc.id,
            rmd,
            age,
            balance,
          })
        })
      }

      setRmdRecords(records)
      setLoaded(true)
    } catch (err) {
      console.error('Failed to load RMD data:', err)
    } finally {
      setLoading(false)
    }
  }, [currentYear])

  // Sort helper
  const sortRecords = useCallback((list: RmdRecord[]): RmdRecord[] => {
    const urgencyOrder: Record<string, number> = { overdue: 0, urgent: 1, soon: 2, normal: 3, completed: 4 }
    const dir = sortDir === 'asc' ? 1 : -1

    return [...list].sort((a, b) => {
      switch (sortField) {
        case 'name': {
          const nameA = [a.client.first_name, a.client.last_name].filter(Boolean).join(' ').toLowerCase()
          const nameB = [b.client.first_name, b.client.last_name].filter(Boolean).join(' ').toLowerCase()
          return nameA.localeCompare(nameB) * dir
        }
        case 'age': return (a.age - b.age) * dir
        case 'carrier': {
          const cA = String(a.account.carrier || a.account.carrier || '').toLowerCase()
          const cB = String(b.account.carrier || b.account.carrier || '').toLowerCase()
          return cA.localeCompare(cB) * dir
        }
        case 'accountType': {
          const tA = String(a.account.account_type_category || a.account.product_type || '').toLowerCase()
          const tB = String(b.account.account_type_category || b.account.product_type || '').toLowerCase()
          return tA.localeCompare(tB) * dir
        }
        case 'value': return (a.balance - b.balance) * dir
        case 'rmdAmount': return (a.rmd.amount - b.rmd.amount) * dir
        case 'distributed': {
          const dA = parseFloat(String(a.account.rmd_taken || a.account.rmd_distributed || 0).replace(/[$,]/g, ''))
          const dB = parseFloat(String(b.account.rmd_taken || b.account.rmd_distributed || 0).replace(/[$,]/g, ''))
          return (dA - dB) * dir
        }
        case 'remaining': return (a.rmd.remaining - b.rmd.remaining) * dir
        case 'status': return ((urgencyOrder[a.rmd.urgency] ?? 5) - (urgencyOrder[b.rmd.urgency] ?? 5)) * dir
        case 'deadline': return (a.rmd.daysUntilDeadline - b.rmd.daysUntilDeadline) * dir
        default: return 0
      }
    })
  }, [sortField, sortDir])

  // Filter + search + sort
  const filtered = useMemo(() => {
    let list = rmdRecords
    if (statusFilter !== 'all') {
      list = list.filter((r) => {
        if (statusFilter === 'pending') return r.rmd.urgency !== 'completed' && r.rmd.urgency !== 'overdue'
        if (statusFilter === 'overdue') return r.rmd.urgency === 'overdue'
        if (statusFilter === 'completed') return r.rmd.urgency === 'completed'
        return true
      })
    }
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      list = list.filter((r) => {
        const name = [r.client.first_name, r.client.last_name].filter(Boolean).join(' ').toLowerCase()
        return name.includes(term) || String(r.account.carrier || '').toLowerCase().includes(term)
      })
    }
    return sortRecords(list)
  }, [rmdRecords, statusFilter, searchTerm, sortRecords])

  // Summary stats
  const stats = useMemo(() => {
    const s = { total: rmdRecords.length, pending: 0, completed: 0, overdue: 0, totalAmount: 0, pendingAmount: 0 }
    for (const r of rmdRecords) {
      s.totalAmount += r.rmd.amount
      if (r.rmd.urgency === 'completed') s.completed++
      else if (r.rmd.urgency === 'overdue') { s.overdue++; s.pendingAmount += r.rmd.remaining }
      else { s.pending++; s.pendingAmount += r.rmd.remaining }
    }
    return s
  }, [rmdRecords])

  const completionRate = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0

  const selectRecord = (record: RmdRecord) => {
    setSelectedRecord(record)
    setEditDistributed(
      String(parseFloat(String(record.account.rmd_taken || record.account.rmd_distributed || 0).replace(/[$,]/g, '')))
    )
    setEditSystematic(Boolean(record.account.systematic_rmd))
    setSchedule(generateRmdSchedule(record.age, record.balance, 15))
  }

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }

  // Save edits to Firestore
  const handleSave = async () => {
    if (!selectedRecord) return
    setSaving(true)
    try {
      const db = getDb()
      const ref = doc(db, 'clients', selectedRecord.clientId, 'accounts', selectedRecord.accountId)
      await updateDoc(ref, {
        rmd_distributed: parseFloat(editDistributed) || 0,
        systematic_rmd: editSystematic,
        rmd_last_updated: new Date().toISOString(),
      })
      // Refresh data
      await loadRmds()
      // Re-select the record if it still exists
      // The record reference will be new, so deselect for now
      setSelectedRecord(null)
    } catch (err) {
      console.error('Failed to save RMD update:', err)
    } finally {
      setSaving(false)
    }
  }

  // Export to CSV
  const exportCsv = useCallback(() => {
    const headers = ['Client', 'Age', 'Carrier', 'Account Type', 'Value', 'RMD Amount', 'Distributed', 'Remaining', 'Status', 'Deadline']
    const rows = filtered.map((r) => {
      const name = [r.client.first_name, r.client.last_name].filter(Boolean).join(' ')
      const carrier = String(r.account.carrier || r.account.carrier || '')
      const acctType = String(r.account.account_type_category || r.account.product_type || '')
      const dist = parseFloat(String(r.account.rmd_taken || r.account.rmd_distributed || 0).replace(/[$,]/g, ''))
      return [name, String(r.age), carrier, acctType, fmtCurrency(r.balance), fmtCurrency(r.rmd.amount), fmtCurrency(dist), fmtCurrency(r.rmd.remaining), r.rmd.urgency, r.rmd.deadline]
    })
    const csv = [headers.join(','), ...rows.map((r) => r.map((c) => `"${c}"`).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `rmd-center-${currentYear}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }, [filtered, currentYear])

  // ---------------------------------------------------------------------------
  // Initial State — Scan Button
  // ---------------------------------------------------------------------------
  if (!loaded) {
    return (
      <div className="mx-auto max-w-7xl space-y-6">
        <div>
          <p className="mt-1 text-sm text-[var(--text-muted)]">Required Minimum Distribution tracking and management</p>
        </div>
        <div className="flex flex-col items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] py-20">
          <span className="material-icons-outlined text-5xl text-[var(--portal)]">calendar_month</span>
          <h2 className="mt-4 text-lg font-semibold text-[var(--text-primary)]">RMD Center — {currentYear}</h2>
          <p className="mt-2 max-w-md text-center text-sm text-[var(--text-muted)]">
            Scan all client accounts to identify Required Minimum Distribution obligations, track deadlines, and calculate amounts using IRS Uniform Lifetime Tables.
          </p>
          <button
            onClick={loadRmds}
            disabled={loading}
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[var(--portal)] px-6 py-2.5 text-sm font-medium text-white transition-colors hover:brightness-110 disabled:opacity-50"
          >
            <span className="material-icons-outlined text-[18px]">{loading ? 'hourglass_empty' : 'search'}</span>
            {loading ? 'Scanning Accounts...' : 'Scan RMD Obligations'}
          </button>
        </div>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Main View
  // ---------------------------------------------------------------------------
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="mt-1 text-sm text-[var(--text-muted)]">{currentYear} Required Minimum Distributions</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportCsv}
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-medium)] px-4 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            <span className="material-icons-outlined text-[18px]">download</span>
            Export
          </button>
          <button
            onClick={loadRmds}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-medium)] px-4 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-50"
          >
            <span className="material-icons-outlined text-[18px]">refresh</span>
            Refresh
          </button>
        </div>
      </div>

      {/* Summary Dashboard */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
        <SummaryCard label="Total RMDs" value={String(stats.total)} icon="account_balance" color="var(--portal)" />
        <SummaryCard label="Pending" value={String(stats.pending)} icon="pending" color="var(--warning)" subtext={fmtCurrency(stats.pendingAmount)} />
        <SummaryCard label="Completed" value={String(stats.completed)} icon="check_circle" color="var(--success)" />
        <SummaryCard label="Overdue" value={String(stats.overdue)} icon="error" color="var(--error)" />
        <SummaryCard label="Total RMD $" value={fmtCompact(stats.totalAmount)} icon="payments" color="var(--portal)" />
        {/* Completion progress */}
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4">
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-full"
              style={{ backgroundColor: `color-mix(in srgb, var(--success) 15%, transparent)` }}
            >
              <span className="material-icons-outlined text-[20px]" style={{ color: 'var(--success)' }}>donut_large</span>
            </div>
            <div className="flex-1">
              <p className="text-2xl font-bold text-[var(--text-primary)]">{completionRate}%</p>
              <p className="text-xs text-[var(--text-muted)]">Completion</p>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[var(--bg-surface)]">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${completionRate}%`,
                    backgroundColor: completionRate >= 80 ? 'var(--success)' : completionRate >= 50 ? 'var(--warning)' : 'var(--error)',
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-2">
          {(['all', 'pending', 'completed', 'overdue'] as RmdStatus[]).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-all ${
                statusFilter === s
                  ? 'bg-[var(--portal)] text-white'
                  : 'bg-[var(--bg-surface)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
              }`}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        {/* View Toggle */}
        <div className="flex items-center gap-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-0.5">
          <button
            onClick={() => setView('grid')}
            className={`rounded-md p-1.5 transition-all ${viewMode === 'grid' ? 'bg-[var(--portal)] text-white' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'}`}
            title="Table view"
          >
            <span className="material-icons-outlined text-[18px]">view_list</span>
          </button>
          <button
            onClick={() => setView('card')}
            className={`rounded-md p-1.5 transition-all ${viewMode === 'card' ? 'bg-[var(--portal)] text-white' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'}`}
            title="Card view"
          >
            <span className="material-icons-outlined text-[18px]">view_module</span>
          </button>
        </div>

        {/* Search */}
        <div className="relative ml-auto">
          <span className="material-icons-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-[var(--text-muted)]">search</span>
          <input
            type="text"
            placeholder="Search by name or carrier..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] py-2 pl-10 pr-4 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--portal)] transition-colors w-64"
          />
        </div>
      </div>

      {/* Content: Grid + Detail Panel */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content Area */}
        <div className={selectedRecord ? 'lg:col-span-2' : 'lg:col-span-3'}>
          {filtered.length === 0 ? (
            <EmptyState />
          ) : viewMode === 'grid' ? (
            <RmdTable
              records={filtered}
              selectedRecord={selectedRecord}
              onSelect={selectRecord}
              sortField={sortField}
              sortDir={sortDir}
              onSort={handleSort}
            />
          ) : (
            <div className="space-y-3">
              {filtered.map((record, i) => (
                <RmdRow
                  key={`${record.clientId}-${record.accountId}-${i}`}
                  record={record}
                  isSelected={selectedRecord === record}
                  onSelect={() => selectRecord(record)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Detail Panel */}
        {selectedRecord && (
          <div className="space-y-4">
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">RMD Detail</h3>
                <button
                  onClick={() => setSelectedRecord(null)}
                  className="flex h-6 w-6 items-center justify-center rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)]"
                >
                  <span className="material-icons-outlined text-[16px]">close</span>
                </button>
              </div>

              <div className="space-y-3">
                {/* Client link */}
                <div className="flex justify-between items-center">
                  <span className="text-xs text-[var(--text-muted)]">Client</span>
                  <Link
                    href={`/contacts/${selectedRecord.clientId}`}
                    className="text-sm font-medium text-[var(--portal)] hover:underline"
                  >
                    {[selectedRecord.client.first_name, selectedRecord.client.last_name].filter(Boolean).join(' ')}
                  </Link>
                </div>
                <DetailRow label="Age" value={String(selectedRecord.age)} />
                <DetailRow label="Carrier" value={String(selectedRecord.account.carrier || selectedRecord.account.carrier || '—')} />
                <DetailRow label="Account Type" value={String(selectedRecord.account.account_type_category || selectedRecord.account.product_type || '—')} />

                {/* Account link */}
                <div className="flex justify-between items-center">
                  <span className="text-xs text-[var(--text-muted)]">Account</span>
                  <Link
                    href={`/accounts/${selectedRecord.clientId}/${selectedRecord.accountId}`}
                    target="_blank"
                    className="text-xs text-[var(--portal)] hover:underline inline-flex items-center gap-1"
                  >
                    View Account
                    <span className="material-icons-outlined text-[12px]">open_in_new</span>
                  </Link>
                </div>

                <DetailRow label="Account Value" value={fmtCurrency(selectedRecord.balance)} />
                <DetailRow label="Distribution Period" value={`${selectedRecord.rmd.distributionPeriod} years`} />
                <hr className="border-[var(--border-subtle)]" />

                <div className="flex justify-between">
                  <span className="text-xs font-semibold text-[var(--text-muted)]">RMD Amount</span>
                  <span className="text-base font-bold text-[var(--portal)]">{fmtCurrency(selectedRecord.rmd.amount)}</span>
                </div>
                <DetailRow label="Remaining" value={selectedRecord.rmd.satisfied ? 'Satisfied' : fmtCurrency(selectedRecord.rmd.remaining)} />
                <DetailRow label="Deadline" value={selectedRecord.rmd.deadline} />
                <DetailRow label="Days Left" value={String(selectedRecord.rmd.daysUntilDeadline)} />

                <div className="flex justify-between items-center">
                  <span className="text-xs text-[var(--text-muted)]">Status</span>
                  <StatusBadge urgency={selectedRecord.rmd.urgency} />
                </div>
              </div>
            </div>

            {/* Editable Section */}
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">Update RMD</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-[var(--text-muted)] mb-1">Amount Distributed</label>
                  <input
                    type="number"
                    value={editDistributed}
                    onChange={(e) => setEditDistributed(e.target.value)}
                    step="0.01"
                    min="0"
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--portal)] transition-colors"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <label className="text-xs text-[var(--text-muted)]">Systematic RMD</label>
                  <button
                    onClick={() => setEditSystematic(!editSystematic)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      editSystematic ? 'bg-[var(--portal)]' : 'bg-[var(--bg-surface)]'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                        editSystematic ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="w-full rounded-lg bg-[var(--portal)] px-4 py-2 text-sm font-medium text-white transition-colors hover:brightness-110 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>

            {/* 15-Year Projection */}
            {schedule.length > 0 && (
              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  15-Year Projection (4% growth)
                </h3>
                <div className="max-h-80 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-[var(--border-subtle)]">
                        <th className="py-2 text-left text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Year</th>
                        <th className="py-2 text-left text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Age</th>
                        <th className="py-2 text-right text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Balance</th>
                        <th className="py-2 text-right text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Factor</th>
                        <th className="py-2 text-right text-[10px] uppercase tracking-wider text-[var(--text-muted)]">RMD</th>
                        <th className="py-2 text-right text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Cumulative</th>
                      </tr>
                    </thead>
                    <tbody>
                      {schedule.map((row) => (
                        <tr key={row.year} className="border-b border-[var(--border-subtle)]/50 table-row-hover">
                          <td className="py-1.5 text-[var(--text-secondary)]">{row.year}</td>
                          <td className="py-1.5 text-[var(--text-secondary)]">{row.age}</td>
                          <td className="py-1.5 text-right text-[var(--text-secondary)]">{fmtCompact(row.projectedBalance)}</td>
                          <td className="py-1.5 text-right text-[var(--text-muted)]">{row.distributionPeriod.toFixed(1)}</td>
                          <td className="py-1.5 text-right font-medium text-[var(--portal)]">{fmtCompact(row.rmdAmount)}</td>
                          <td className="py-1.5 text-right text-[var(--text-muted)]">{fmtCompact(row.cumulativeDistributed)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Data Table (Grid View)
// ---------------------------------------------------------------------------

function RmdTable({
  records,
  selectedRecord,
  onSelect,
  sortField,
  sortDir,
  onSort,
}: {
  records: RmdRecord[]
  selectedRecord: RmdRecord | null
  onSelect: (r: RmdRecord) => void
  sortField: SortField
  sortDir: SortDir
  onSort: (field: SortField) => void
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)]">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--border-subtle)]">
            <SortableHeader label="Client" field="name" current={sortField} dir={sortDir} onSort={onSort} />
            <SortableHeader label="Age" field="age" current={sortField} dir={sortDir} onSort={onSort} align="center" />
            <SortableHeader label="Carrier" field="carrier" current={sortField} dir={sortDir} onSort={onSort} />
            <SortableHeader label="Type" field="accountType" current={sortField} dir={sortDir} onSort={onSort} />
            <SortableHeader label="Value" field="value" current={sortField} dir={sortDir} onSort={onSort} align="right" />
            <SortableHeader label="RMD Amt" field="rmdAmount" current={sortField} dir={sortDir} onSort={onSort} align="right" />
            <SortableHeader label="Distributed" field="distributed" current={sortField} dir={sortDir} onSort={onSort} align="right" />
            <SortableHeader label="Remaining" field="remaining" current={sortField} dir={sortDir} onSort={onSort} align="right" />
            <SortableHeader label="Status" field="status" current={sortField} dir={sortDir} onSort={onSort} align="center" />
            <SortableHeader label="Deadline" field="deadline" current={sortField} dir={sortDir} onSort={onSort} align="center" />
            <th className="px-3 py-2.5 text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Actions</th>
          </tr>
        </thead>
        <tbody>
          {records.map((record, i) => {
            const name = [record.client.first_name, record.client.last_name].filter(Boolean).join(' ') || 'Unknown'
            const carrier = String(record.account.carrier || record.account.carrier || '—')
            const accountType = String(record.account.account_type_category || record.account.product_type || '—')
            const distributed = parseFloat(String(record.account.rmd_taken || record.account.rmd_distributed || 0).replace(/[$,]/g, ''))
            const isSelected = selectedRecord?.clientId === record.clientId && selectedRecord?.accountId === record.accountId

            return (
              <tr
                key={`${record.clientId}-${record.accountId}-${i}`}
                onClick={() => onSelect(record)}
                className={`cursor-pointer border-b border-[var(--border-subtle)]/50 transition-colors ${
                  isSelected ? 'bg-[var(--portal-glow)]' : 'hover:bg-[var(--bg-card-hover)]'
                }`}
              >
                <td className="px-3 py-2.5">
                  <Link
                    href={`/contacts/${record.clientId}`}
                    onClick={(e) => e.stopPropagation()}
                    className="text-sm font-medium text-[var(--text-primary)] hover:text-[var(--portal)] hover:underline"
                  >
                    {name}
                  </Link>
                </td>
                <td className="px-3 py-2.5 text-center text-[var(--text-secondary)]">{record.age}</td>
                <td className="px-3 py-2.5 text-[var(--text-secondary)]">{carrier}</td>
                <td className="px-3 py-2.5 text-xs text-[var(--text-muted)]">{accountType}</td>
                <td className="px-3 py-2.5 text-right text-[var(--text-secondary)]">{fmtCurrency(record.balance)}</td>
                <td className="px-3 py-2.5 text-right font-medium text-[var(--portal)]">{fmtCurrency(record.rmd.amount)}</td>
                <td className="px-3 py-2.5 text-right text-[var(--text-secondary)]">{fmtCurrency(distributed)}</td>
                <td className="px-3 py-2.5 text-right text-[var(--text-secondary)]">
                  {record.rmd.satisfied ? (
                    <span className="text-emerald-400">Satisfied</span>
                  ) : (
                    fmtCurrency(record.rmd.remaining)
                  )}
                </td>
                <td className="px-3 py-2.5 text-center">
                  <StatusBadge urgency={record.rmd.urgency} />
                </td>
                <td className="px-3 py-2.5 text-center text-xs text-[var(--text-muted)]">{record.rmd.deadline}</td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); onSelect(record) }}
                      className="rounded p-1 text-[var(--text-muted)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]"
                      title="View details"
                    >
                      <span className="material-icons-outlined text-[16px]">visibility</span>
                    </button>
                    <Link
                      href={`/accounts/${record.clientId}/${record.accountId}`}
                      target="_blank"
                      onClick={(e) => e.stopPropagation()}
                      className="rounded p-1 text-[var(--text-muted)] hover:bg-[var(--bg-surface)] hover:text-[var(--portal)]"
                      title="View account detail"
                    >
                      <span className="material-icons-outlined text-[16px]">open_in_new</span>
                    </Link>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Card View Row
// ---------------------------------------------------------------------------

function RmdRow({ record, isSelected, onSelect }: { record: RmdRecord; isSelected: boolean; onSelect: () => void }) {
  const name = [record.client.first_name, record.client.last_name].filter(Boolean).join(' ') || 'Unknown'
  const carrier = String(record.account.carrier || record.account.carrier || '')
  const accountType = String(record.account.account_type_category || record.account.product_type || '')
  const distributed = parseFloat(String(record.account.rmd_taken || record.account.rmd_distributed || 0).replace(/[$,]/g, ''))
  const u = urgencyStyles(record.rmd.urgency)

  return (
    <div
      onClick={onSelect}
      className={`cursor-pointer w-full text-left rounded-lg border p-4 transition-all ${
        isSelected
          ? 'border-[var(--portal)] bg-[var(--portal-glow)]'
          : 'border-[var(--border-subtle)] bg-[var(--bg-card)] hover:border-[var(--portal)]/30'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${u.bg}`}>
            <span className={`material-icons-outlined text-[18px] ${u.text}`}>{u.icon}</span>
          </div>
          <div>
            <Link
              href={`/contacts/${record.clientId}`}
              onClick={(e) => e.stopPropagation()}
              className="text-sm font-medium text-[var(--text-primary)] hover:text-[var(--portal)] hover:underline"
            >
              {name}
            </Link>
            <p className="text-xs text-[var(--text-muted)]">{carrier} &middot; {accountType} &middot; Age {record.age}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-sm font-semibold text-[var(--text-primary)]">{fmtCurrency(record.rmd.amount)}</p>
            <p className={`text-xs font-medium ${u.text}`}>
              {record.rmd.urgency === 'completed' ? 'Satisfied' : `Due ${record.rmd.deadline}`}
            </p>
          </div>
          <StatusBadge urgency={record.rmd.urgency} />
        </div>
      </div>
      <div className="mt-3 grid grid-cols-4 gap-3 border-t border-[var(--border-subtle)] pt-3">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">Value</p>
          <p className="text-sm text-[var(--text-secondary)]">{fmtCompact(record.balance)}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">Distributed</p>
          <p className="text-sm text-[var(--text-secondary)]">{fmtCurrency(distributed)}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">Remaining</p>
          <p className="text-sm text-[var(--text-secondary)]">{record.rmd.satisfied ? 'Satisfied' : fmtCurrency(record.rmd.remaining)}</p>
        </div>
        <div className="flex items-end justify-end">
          <Link
            href={`/accounts/${record.clientId}/${record.accountId}`}
            target="_blank"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 text-xs text-[var(--portal)] hover:underline"
          >
            Account <span className="material-icons-outlined text-[12px]">open_in_new</span>
          </Link>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Shared Sub-Components
// ---------------------------------------------------------------------------

function SortableHeader({
  label,
  field,
  current,
  dir,
  onSort,
  align = 'left',
}: {
  label: string
  field: SortField
  current: SortField
  dir: SortDir
  onSort: (f: SortField) => void
  align?: 'left' | 'center' | 'right'
}) {
  const isActive = current === field
  const alignClass = align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'

  return (
    <th
      onClick={() => onSort(field)}
      className={`cursor-pointer select-none px-3 py-2.5 text-[10px] uppercase tracking-wider transition-colors ${alignClass} ${
        isActive ? 'text-[var(--portal)]' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
      }`}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {isActive && (
          <span className="material-icons-outlined text-[12px]">
            {dir === 'asc' ? 'arrow_upward' : 'arrow_downward'}
          </span>
        )}
      </span>
    </th>
  )
}

function StatusBadge({ urgency }: { urgency: RmdResult['urgency'] }) {
  const s = urgencyStyles(urgency)
  const labels: Record<string, string> = {
    completed: 'Completed',
    normal: 'On Track',
    soon: 'Due Soon',
    urgent: 'Urgent',
    overdue: 'Overdue',
  }

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${s.bg} ${s.text}`}>
      <span className="material-icons-outlined text-[12px]">{s.icon}</span>
      {labels[urgency] || urgency}
    </span>
  )
}

function SummaryCard({ label, value, icon, color, subtext }: { label: string; value: string; icon: string; color: string; subtext?: string }) {
  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full" style={{ backgroundColor: `color-mix(in srgb, ${color} 15%, transparent)` }}>
          <span className="material-icons-outlined text-[20px]" style={{ color }}>{icon}</span>
        </div>
        <div>
          <p className="text-2xl font-bold text-[var(--text-primary)]">{value}</p>
          <p className="text-xs text-[var(--text-muted)]">{label}</p>
          {subtext && <p className="text-xs font-medium" style={{ color }}>{subtext}</p>}
        </div>
      </div>
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-xs text-[var(--text-muted)]">{label}</span>
      <span className="text-sm text-[var(--text-primary)]">{value}</span>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] py-16">
      <span className="material-icons-outlined text-4xl text-[var(--text-muted)]">check_circle</span>
      <p className="mt-3 text-sm text-[var(--text-muted)]">No RMDs match this filter.</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function urgencyStyles(urgency: RmdResult['urgency']) {
  switch (urgency) {
    case 'completed': return { bg: 'bg-emerald-500/15', text: 'text-emerald-400', icon: 'check_circle' }
    case 'normal': return { bg: 'bg-blue-500/15', text: 'text-blue-400', icon: 'schedule' }
    case 'soon': return { bg: 'bg-amber-500/15', text: 'text-amber-400', icon: 'upcoming' }
    case 'urgent': return { bg: 'bg-orange-500/15', text: 'text-orange-400', icon: 'priority_high' }
    case 'overdue': return { bg: 'bg-red-500/15', text: 'text-red-400', icon: 'error' }
  }
}

function getAgeAtYearEnd(dob: Date, year: number): number {
  let age = year - dob.getFullYear()
  const birthdayThisYear = new Date(year, dob.getMonth(), dob.getDate())
  const yearEnd = new Date(year, 11, 31)
  if (birthdayThisYear > yearEnd) age--
  return age
}

function fmtCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(amount)
}

function fmtCompact(amount: number): string {
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(1)}K`
  return fmtCurrency(amount)
}
