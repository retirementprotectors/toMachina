'use client'

import { useState, useMemo } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { getDb } from '@tomachina/db'
import type { Client, Account } from '@tomachina/core'

// ---------------------------------------------------------------------------
// Beni Center — Beneficiary Management & Estate Coordination
// ---------------------------------------------------------------------------

type IssueType = 'all' | 'empty' | 'partial' | 'under' | 'conflict' | 'reactive' | 'ok'

interface BeniRecord {
  clientId: string
  clientName: string
  accountId: string
  accountType: string
  carrierName: string
  productName: string
  primaryBeni: string
  primaryPct: number
  contingentBeni: string
  contingentPct: number
  issueType: Exclude<IssueType, 'all'>
  issueLabel: string
  issueDetail: string
}

interface BeniStats {
  total: number
  empty: number
  partial: number
  under: number
  conflict: number
  reactive: number
  ok: number
}

export default function BeniCenterPage() {
  const [records, setRecords] = useState<BeniRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [filter, setFilter] = useState<IssueType>('all')
  const [searchTerm, setSearchTerm] = useState('')

  const loadBeneficiaries = async () => {
    setLoading(true)
    try {
      const db = getDb()
      const clientsSnap = await getDocs(collection(db, 'clients'))
      const allRecords: BeniRecord[] = []

      for (const clientDoc of clientsSnap.docs) {
        const client = { ...clientDoc.data(), _id: clientDoc.id } as unknown as Client
        const clientId = clientDoc.id
        const clientName = [client.first_name, client.last_name].filter(Boolean).join(' ')
        const spouseName = [client.spouse_first_name, client.spouse_last_name].filter(Boolean).join(' ').toLowerCase()
        const maritalStatus = String(client.marital_status || '').toLowerCase()

        const accountsSnap = await getDocs(collection(db, 'clients', clientDoc.id, 'accounts'))
        for (const acctDoc of accountsSnap.docs) {
          const account = { ...acctDoc.data(), _id: acctDoc.id } as unknown as Account
          const cat = String(account.account_type_category || account.product_type || '').toLowerCase()
          if (cat.includes('medicare')) continue

          allRecords.push(analyzeBeneficiary(account, clientId, clientName, spouseName, maritalStatus))
        }
      }

      // Sort: issues first, ok last
      const order: Record<string, number> = { empty: 0, conflict: 1, reactive: 2, under: 3, partial: 4, ok: 5 }
      allRecords.sort((a, b) => (order[a.issueType] ?? 6) - (order[b.issueType] ?? 6))

      setRecords(allRecords)
      setLoaded(true)
    } catch (err) {
      console.error('Failed to load beneficiary data:', err)
    } finally {
      setLoading(false)
    }
  }

  const stats = useMemo<BeniStats>(() => {
    const s: BeniStats = { total: records.length, empty: 0, partial: 0, under: 0, conflict: 0, reactive: 0, ok: 0 }
    for (const r of records) s[r.issueType]++
    return s
  }, [records])

  const filtered = useMemo(() => {
    let list = records
    if (filter !== 'all') list = list.filter((r) => r.issueType === filter)
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      list = list.filter((r) => r.clientName.toLowerCase().includes(term) || r.carrierName.toLowerCase().includes(term))
    }
    return list
  }, [records, filter, searchTerm])

  const completeness = records.length > 0 ? Math.round((stats.ok / records.length) * 100) : 0

  if (!loaded) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Beni Center</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">Beneficiary management and estate coordination</p>
        </div>
        <div className="flex flex-col items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] py-20">
          <span className="material-icons-outlined text-5xl text-[var(--portal)]">volunteer_activism</span>
          <h2 className="mt-4 text-lg font-semibold text-[var(--text-primary)]">Beneficiary Review</h2>
          <p className="mt-2 max-w-md text-center text-sm text-[var(--text-muted)]">
            Scan all client accounts to identify missing, incomplete, or potentially outdated beneficiary designations.
          </p>
          <button
            onClick={loadBeneficiaries}
            disabled={loading}
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[var(--portal)] px-6 py-2.5 text-sm font-medium text-white transition-colors hover:brightness-110 disabled:opacity-50"
          >
            <span className="material-icons-outlined text-[18px]">{loading ? 'hourglass_empty' : 'search'}</span>
            {loading ? 'Scanning Accounts...' : 'Scan Beneficiary Status'}
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
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Beni Center</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">Beneficiary management and estate coordination</p>
        </div>
        <button
          onClick={loadBeneficiaries}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-medium)] px-4 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-50"
        >
          <span className="material-icons-outlined text-[18px]">refresh</span>
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
          <p className="text-xs uppercase tracking-wider text-[var(--text-muted)]">Completeness</p>
          <div className="mt-2 flex items-end gap-2">
            <span className={`text-3xl font-bold ${completeness >= 80 ? 'text-emerald-400' : completeness >= 50 ? 'text-amber-400' : 'text-red-400'}`}>
              {completeness}%
            </span>
            <span className="mb-1 text-xs text-[var(--text-muted)]">{stats.ok} of {stats.total}</span>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[var(--bg-surface)]">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${completeness}%`,
                backgroundColor: completeness >= 80 ? 'var(--success)' : completeness >= 50 ? 'var(--warning)' : 'var(--error)',
              }}
            />
          </div>
        </div>
        <StatCard label="No Beneficiary" count={stats.empty} icon="report_problem" color="var(--error)" />
        <StatCard label="Incomplete" count={stats.partial + stats.under} icon="warning" color="var(--warning)" />
        <StatCard label="Needs Review" count={stats.conflict + stats.reactive} icon="visibility" color="#60a5fa" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-2">
          {([
            { key: 'all' as IssueType, label: 'All', count: stats.total },
            { key: 'empty' as IssueType, label: 'Empty', count: stats.empty },
            { key: 'partial' as IssueType, label: 'Partial', count: stats.partial },
            { key: 'under' as IssueType, label: 'Under 100%', count: stats.under },
            { key: 'conflict' as IssueType, label: 'Conflict', count: stats.conflict },
            { key: 'reactive' as IssueType, label: 'Reactive', count: stats.reactive },
            { key: 'ok' as IssueType, label: 'Complete', count: stats.ok },
          ]).map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-all ${
                filter === f.key
                  ? 'bg-[var(--portal)] text-white'
                  : 'bg-[var(--bg-surface)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
              }`}
            >
              {f.label}
              <span className={`inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1 text-xs ${
                filter === f.key ? 'bg-white/20 text-white' : 'bg-[var(--bg-card)] text-[var(--text-muted)]'
              }`}>
                {f.count}
              </span>
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

      {/* Records */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] py-16">
          <span className="material-icons-outlined text-4xl text-[var(--text-muted)]">check_circle</span>
          <p className="mt-3 text-sm text-[var(--text-muted)]">No beneficiary records match this filter.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((record, i) => (
            <BeniRow key={`${record.clientId}-${record.accountId}-${i}`} record={record} />
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function BeniRow({ record }: { record: BeniRecord }) {
  const s = issueStyles(record.issueType)
  return (
    <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 transition-colors hover:border-[var(--portal)]/30">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${s.bg}`}>
            <span className={`material-icons-outlined text-[18px] ${s.text}`}>{s.icon}</span>
          </div>
          <div>
            <p className="text-sm font-medium text-[var(--text-primary)]">{record.clientName}</p>
            <p className="text-xs text-[var(--text-muted)]">{record.carrierName} &middot; {record.productName || record.accountType}</p>
          </div>
        </div>
        <div className="text-right">
          <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${s.bg} ${s.text}`}>
            {record.issueLabel}
          </span>
          <p className="mt-1 text-xs text-[var(--text-muted)]">{record.issueDetail}</p>
        </div>
      </div>
      {(record.primaryBeni || record.contingentBeni) && (
        <div className="mt-3 flex gap-6 border-t border-[var(--border-subtle)] pt-3">
          {record.primaryBeni && (
            <div>
              <p className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">Primary</p>
              <p className="text-sm text-[var(--text-primary)]">{record.primaryBeni} ({record.primaryPct}%)</p>
            </div>
          )}
          {record.contingentBeni && (
            <div>
              <p className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">Contingent</p>
              <p className="text-sm text-[var(--text-primary)]">{record.contingentBeni} ({record.contingentPct}%)</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function StatCard({ label, count, icon, color }: { label: string; count: number; icon: string; color: string }) {
  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full" style={{ backgroundColor: `color-mix(in srgb, ${color} 15%, transparent)` }}>
          <span className="material-icons-outlined text-[20px]" style={{ color }}>{icon}</span>
        </div>
        <div>
          <p className="text-2xl font-bold text-[var(--text-primary)]">{count}</p>
          <p className="text-xs text-[var(--text-muted)]">{label}</p>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Beneficiary analysis (ported from PRODASH_BENI_CENTER.gs)
// ---------------------------------------------------------------------------

function analyzeBeneficiary(account: Account, clientId: string, clientName: string, spouseName: string, maritalStatus: string): BeniRecord {
  let primaryBeni = String(account.primary_beneficiary || '').trim()
  let primaryPct = parseFloat(String(account.primary_beneficiary_pct || 0))
  let contingentBeni = String(account.contingent_beneficiary || '').trim()
  let contingentPct = parseFloat(String(account.contingent_beneficiary_pct || 0))

  // Try JSON beneficiaries field
  const raw = account.beneficiaries
  if (raw && typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length > 0) {
        const pri = parsed.find((b: Record<string, unknown>) => String(b.type || '').toLowerCase() === 'primary')
        const con = parsed.find((b: Record<string, unknown>) => String(b.type || '').toLowerCase() === 'contingent')
        if (pri) {
          primaryBeni = String(pri.name || pri.beneficiary_name || primaryBeni)
          primaryPct = parseFloat(String(pri.percentage || pri.pct || primaryPct))
        }
        if (con) {
          contingentBeni = String(con.name || con.beneficiary_name || contingentBeni)
          contingentPct = parseFloat(String(con.percentage || con.pct || contingentPct))
        }
      }
    } catch { /* not valid JSON */ }
  }

  if (isNaN(primaryPct)) primaryPct = 0
  if (isNaN(contingentPct)) contingentPct = 0

  let issueType: Exclude<IssueType, 'all'> = 'ok'
  let issueLabel = 'Complete'
  let issueDetail = 'Primary and contingent designated'

  if (!primaryBeni) {
    issueType = 'empty'
    issueLabel = 'No Beneficiary'
    issueDetail = 'No beneficiary designation on file'
  } else if (primaryPct > 0 && primaryPct < 100) {
    issueType = 'under'
    issueLabel = 'Under 100%'
    issueDetail = `Primary allocation is ${primaryPct}%`
  } else if (!contingentBeni) {
    issueType = 'partial'
    issueLabel = 'No Contingent'
    issueDetail = 'Has primary, missing contingent beneficiary'
  } else if (spouseName && primaryBeni.toLowerCase().includes(spouseName) && (maritalStatus === 'divorced' || maritalStatus === 'widowed')) {
    issueType = 'reactive'
    issueLabel = 'Needs Review'
    issueDetail = `Primary is ${maritalStatus === 'divorced' ? 'ex-' : 'deceased '}spouse`
  }

  return {
    clientId,
    clientName,
    accountId: String(account.account_id || (account as Record<string, unknown>)._id || ''),
    accountType: String(account.account_type_category || account.product_type || ''),
    carrierName: String(account.carrier_name || account.carrier || 'Unknown'),
    productName: String(account.product_name || account.product || ''),
    primaryBeni,
    primaryPct: primaryPct || 100,
    contingentBeni,
    contingentPct,
    issueType,
    issueLabel,
    issueDetail,
  }
}

function issueStyles(issue: string) {
  switch (issue) {
    case 'empty': return { bg: 'bg-red-500/15', text: 'text-red-400', icon: 'report_problem' }
    case 'conflict': return { bg: 'bg-orange-500/15', text: 'text-orange-400', icon: 'sync_problem' }
    case 'reactive': return { bg: 'bg-purple-500/15', text: 'text-purple-400', icon: 'visibility' }
    case 'under': return { bg: 'bg-amber-500/15', text: 'text-amber-400', icon: 'pie_chart' }
    case 'partial': return { bg: 'bg-amber-500/15', text: 'text-amber-400', icon: 'warning' }
    case 'ok': return { bg: 'bg-emerald-500/15', text: 'text-emerald-400', icon: 'check_circle' }
    default: return { bg: 'bg-[var(--bg-surface)]', text: 'text-[var(--text-muted)]', icon: 'help_outline' }
  }
}
