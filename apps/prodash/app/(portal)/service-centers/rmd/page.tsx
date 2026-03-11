'use client'

import { useState, useMemo } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { getDb } from '@tomachina/db'
import type { Client, Account, RmdResult, RmdScheduleRow } from '@tomachina/core'
import { calculateRmd, generateRmdSchedule, isRmdEligible, getRmdStartAge } from '@tomachina/core'

// ---------------------------------------------------------------------------
// RMD Center — Required Minimum Distribution tracking + IRS calculation
// ---------------------------------------------------------------------------

type RmdStatus = 'all' | 'pending' | 'completed' | 'overdue'

interface RmdRecord {
  client: Client
  account: Account
  rmd: RmdResult
  age: number
}

export default function RmdCenterPage() {
  const [rmdRecords, setRmdRecords] = useState<RmdRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [statusFilter, setStatusFilter] = useState<RmdStatus>('all')
  const [selectedRecord, setSelectedRecord] = useState<RmdRecord | null>(null)
  const [schedule, setSchedule] = useState<RmdScheduleRow[]>([])
  const [searchTerm, setSearchTerm] = useState('')

  const currentYear = new Date().getFullYear()

  // Scan all clients and their accounts for RMD obligations
  const loadRmds = async () => {
    setLoading(true)
    try {
      const db = getDb()
      const clientsSnap = await getDocs(collection(db, 'clients'))
      const records: RmdRecord[] = []

      for (const clientDoc of clientsSnap.docs) {
        const client = { ...clientDoc.data(), _id: clientDoc.id } as Client
        if (!client.dob) continue
        const dob = new Date(String(client.dob))
        if (isNaN(dob.getTime())) continue

        const age = getAgeAtYearEnd(dob, currentYear)
        const birthYear = dob.getFullYear()
        const startAge = getRmdStartAge(birthYear)
        if (age < startAge) continue

        // Fetch RMD-eligible accounts
        const accountsSnap = await getDocs(collection(db, 'clients', clientDoc.id, 'accounts'))
        accountsSnap.forEach((acctDoc) => {
          const account = { ...acctDoc.data(), _id: acctDoc.id } as Account
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

          records.push({ client, account, rmd, age })
        })
      }

      // Sort: overdue first, then urgent, soon, normal, completed
      const urgencyOrder = { overdue: 0, urgent: 1, soon: 2, normal: 3, completed: 4 }
      records.sort((a, b) => urgencyOrder[a.rmd.urgency] - urgencyOrder[b.rmd.urgency])

      setRmdRecords(records)
      setLoaded(true)
    } catch (err) {
      console.error('Failed to load RMD data:', err)
    } finally {
      setLoading(false)
    }
  }

  // Filter + search
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
        return name.includes(term) || String(r.account.carrier_name || '').toLowerCase().includes(term)
      })
    }
    return list
  }, [rmdRecords, statusFilter, searchTerm])

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

  const selectRecord = (record: RmdRecord) => {
    setSelectedRecord(record)
    const balance = parseFloat(String(record.account.account_value || 0).replace(/[$,]/g, ''))
    setSchedule(generateRmdSchedule(record.age, balance, 15))
  }

  // Initial state — scan button
  if (!loaded) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">RMD Center</h1>
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

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">RMD Center</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">{currentYear} Required Minimum Distributions</p>
        </div>
        <button
          onClick={loadRmds}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-medium)] px-4 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-50"
        >
          <span className="material-icons-outlined text-[18px]">refresh</span>
          Refresh
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <SummaryCard label="Total RMDs" value={stats.total} icon="account_balance" color="var(--portal)" />
        <SummaryCard label="Pending" value={stats.pending} icon="pending" color="var(--warning)" subtext={fmtCurrency(stats.pendingAmount)} />
        <SummaryCard label="Completed" value={stats.completed} icon="check_circle" color="var(--success)" />
        <SummaryCard label="Overdue" value={stats.overdue} icon="error" color="var(--error)" />
      </div>

      {/* Filters + Search */}
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

      <div className="grid gap-6 lg:grid-cols-3">
        {/* RMD List */}
        <div className="lg:col-span-2 space-y-3">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] py-16">
              <span className="material-icons-outlined text-4xl text-[var(--text-muted)]">check_circle</span>
              <p className="mt-3 text-sm text-[var(--text-muted)]">No RMDs match this filter.</p>
            </div>
          ) : (
            filtered.map((record, i) => (
              <RmdRow
                key={`${record.client.client_id || record.client._id}-${record.account.account_id || record.account._id}-${i}`}
                record={record}
                isSelected={selectedRecord === record}
                onSelect={() => selectRecord(record)}
              />
            ))
          )}
        </div>

        {/* Detail Panel */}
        <div className="space-y-4">
          {selectedRecord ? (
            <>
              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">RMD Detail</h3>
                <div className="mt-3 space-y-3">
                  <DetailRow label="Client" value={[selectedRecord.client.first_name, selectedRecord.client.last_name].filter(Boolean).join(' ')} />
                  <DetailRow label="Age" value={String(selectedRecord.age)} />
                  <DetailRow label="Carrier" value={String(selectedRecord.account.carrier_name || selectedRecord.account.carrier || '—')} />
                  <DetailRow label="Account Value" value={fmtCurrency(parseFloat(String(selectedRecord.account.account_value || 0).replace(/[$,]/g, '')))} />
                  <DetailRow label="Distribution Period" value={`${selectedRecord.rmd.distributionPeriod} years`} />
                  <hr className="border-[var(--border-subtle)]" />
                  <div className="flex justify-between">
                    <span className="text-xs font-semibold text-[var(--text-muted)]">RMD Amount</span>
                    <span className="text-base font-bold text-[var(--portal)]">{fmtCurrency(selectedRecord.rmd.amount)}</span>
                  </div>
                  <DetailRow label="Remaining" value={selectedRecord.rmd.satisfied ? 'Satisfied' : fmtCurrency(selectedRecord.rmd.remaining)} />
                  <DetailRow label="Deadline" value={selectedRecord.rmd.deadline} />
                  <DetailRow label="Days Left" value={String(selectedRecord.rmd.daysUntilDeadline)} />
                </div>
              </div>

              {/* Schedule projection */}
              {schedule.length > 0 && (
                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
                  <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                    15-Year Projection (4% growth)
                  </h3>
                  <div className="max-h-80 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-[var(--border-subtle)]">
                          <th className="py-2 text-left text-[var(--text-muted)]">Year</th>
                          <th className="py-2 text-left text-[var(--text-muted)]">Age</th>
                          <th className="py-2 text-right text-[var(--text-muted)]">Balance</th>
                          <th className="py-2 text-right text-[var(--text-muted)]">RMD</th>
                        </tr>
                      </thead>
                      <tbody>
                        {schedule.map((row) => (
                          <tr key={row.year} className="border-b border-[var(--border-subtle)]/50">
                            <td className="py-1.5 text-[var(--text-secondary)]">{row.year}</td>
                            <td className="py-1.5 text-[var(--text-secondary)]">{row.age}</td>
                            <td className="py-1.5 text-right text-[var(--text-secondary)]">{fmtCompact(row.projectedBalance)}</td>
                            <td className="py-1.5 text-right font-medium text-[var(--portal)]">{fmtCompact(row.rmdAmount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-card)] py-16">
              <span className="material-icons-outlined text-3xl text-[var(--text-muted)]">touch_app</span>
              <p className="mt-3 text-sm text-[var(--text-muted)]">Select an RMD record to view details and projections</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function RmdRow({ record, isSelected, onSelect }: { record: RmdRecord; isSelected: boolean; onSelect: () => void }) {
  const name = [record.client.first_name, record.client.last_name].filter(Boolean).join(' ') || 'Unknown'
  const carrier = String(record.account.carrier_name || record.account.carrier || '')
  const u = urgencyStyles(record.rmd.urgency)

  return (
    <button
      onClick={onSelect}
      className={`w-full text-left rounded-lg border p-4 transition-all ${
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
            <p className="text-sm font-medium text-[var(--text-primary)]">{name}</p>
            <p className="text-xs text-[var(--text-muted)]">{carrier} &middot; Age {record.age}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold text-[var(--text-primary)]">{fmtCurrency(record.rmd.amount)}</p>
          <p className={`text-xs font-medium ${u.text}`}>
            {record.rmd.urgency === 'completed' ? 'Satisfied' : `Due ${record.rmd.deadline}`}
          </p>
        </div>
      </div>
    </button>
  )
}

function SummaryCard({ label, value, icon, color, subtext }: { label: string; value: number; icon: string; color: string; subtext?: string }) {
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
