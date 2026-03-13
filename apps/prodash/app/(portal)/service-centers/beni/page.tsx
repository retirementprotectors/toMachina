'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore'
import { getDb } from '@tomachina/db'
import type { Client, Account } from '@tomachina/core'
import {
  analyzeBeneficiary as analyzeAccount,
  summarizeBeneficiaryStatus,
  getRecommendedAction,
  type BeneficiaryAnalysis,
  type BeneficiaryStatusSummary,
  type BeneficiaryIssueType,
} from '@tomachina/core'

// ---------------------------------------------------------------------------
// Beni Center — Beneficiary Management & Estate Coordination
// Full grid/list view, detail panel, inline editing, client links
// ---------------------------------------------------------------------------

type FilterType = 'all' | BeneficiaryIssueType
type ViewMode = 'grid' | 'card'
type SortField = 'name' | 'carrier' | 'accountType' | 'primary' | 'primaryPct' | 'contingent' | 'contingentPct' | 'status'
type SortDir = 'asc' | 'desc'

const VIEW_STORAGE_KEY = 'beni-center-view-mode'

export default function BeniCenterPage() {
  const [records, setRecords] = useState<BeneficiaryAnalysis[]>([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [filter, setFilter] = useState<FilterType>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [sortField, setSortField] = useState<SortField>('status')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [selectedRecord, setSelectedRecord] = useState<BeneficiaryAnalysis | null>(null)

  // Inline edit state
  const [editPrimary, setEditPrimary] = useState('')
  const [editPrimaryPct, setEditPrimaryPct] = useState('')
  const [editContingent, setEditContingent] = useState('')
  const [editContingentPct, setEditContingentPct] = useState('')
  const [saving, setSaving] = useState(false)

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

  const loadBeneficiaries = useCallback(async () => {
    setLoading(true)
    try {
      const db = getDb()
      const clientsSnap = await getDocs(collection(db, 'clients'))
      const allRecords: BeneficiaryAnalysis[] = []

      for (const clientDoc of clientsSnap.docs) {
        const client = { ...clientDoc.data(), _id: clientDoc.id } as unknown as Client
        const clientId = clientDoc.id
        const clientName = [client.first_name, client.last_name].filter(Boolean).join(' ')
        const spouseName = [client.spouse_first_name, client.spouse_last_name].filter(Boolean).join(' ').toLowerCase()
        const maritalStatus = String(client.marital_status || '').toLowerCase()

        const accountsSnap = await getDocs(collection(db, 'clients', clientId, 'accounts'))
        for (const acctDoc of accountsSnap.docs) {
          const account = { ...acctDoc.data(), _id: acctDoc.id } as unknown as Account
          const cat = String(account.account_type_category || account.product_type || '').toLowerCase()
          // Medicare accounts don't have beneficiaries
          if (cat.includes('medicare')) continue

          const analysis = analyzeAccount(
            {
              accountId: acctDoc.id,
              accountType: String(account.account_type_category || account.product_type || ''),
              carrierName: String(account.carrier_name || account.carrier || 'Unknown'),
              productName: String(account.product_name || account.product || ''),
              primaryBeneficiary: String(account.primary_beneficiary || '').trim(),
              primaryBeneficiaryPct: parseFloat(String(account.primary_beneficiary_pct || 0)),
              contingentBeneficiary: String(account.contingent_beneficiary || '').trim(),
              contingentBeneficiaryPct: parseFloat(String(account.contingent_beneficiary_pct || 0)),
              beneficiariesJson: typeof account.beneficiaries === 'string' ? account.beneficiaries : undefined,
            },
            {
              clientId,
              clientName,
              spouseName,
              maritalStatus,
            },
          )

          allRecords.push(analysis)
        }
      }

      setRecords(allRecords)
      setLoaded(true)
    } catch (err) {
      console.error('Failed to load beneficiary data:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  // Summary stats
  const summary = useMemo<BeneficiaryStatusSummary>(
    () => summarizeBeneficiaryStatus(records),
    [records],
  )

  // Sort helper
  const sortRecords = useCallback((list: BeneficiaryAnalysis[]): BeneficiaryAnalysis[] => {
    const issueOrder: Record<string, number> = { empty: 0, conflict: 1, reactive: 2, under: 3, partial: 4, ok: 5 }
    const dir = sortDir === 'asc' ? 1 : -1

    return [...list].sort((a, b) => {
      switch (sortField) {
        case 'name': return a.clientName.localeCompare(b.clientName) * dir
        case 'carrier': return a.carrierName.localeCompare(b.carrierName) * dir
        case 'accountType': return a.accountType.localeCompare(b.accountType) * dir
        case 'primary': {
          const pA = a.primaryBeneficiaries[0]?.name || ''
          const pB = b.primaryBeneficiaries[0]?.name || ''
          return pA.localeCompare(pB) * dir
        }
        case 'primaryPct': return (a.totalPrimaryPct - b.totalPrimaryPct) * dir
        case 'contingent': {
          const cA = a.contingentBeneficiaries[0]?.name || ''
          const cB = b.contingentBeneficiaries[0]?.name || ''
          return cA.localeCompare(cB) * dir
        }
        case 'contingentPct': return (a.totalContingentPct - b.totalContingentPct) * dir
        case 'status': return ((issueOrder[a.issueType] ?? 6) - (issueOrder[b.issueType] ?? 6)) * dir
        default: return 0
      }
    })
  }, [sortField, sortDir])

  // Filter + search + sort
  const filtered = useMemo(() => {
    let list = records
    if (filter !== 'all') list = list.filter((r) => r.issueType === filter)
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      list = list.filter((r) => r.clientName.toLowerCase().includes(term) || r.carrierName.toLowerCase().includes(term))
    }
    return sortRecords(list)
  }, [records, filter, searchTerm, sortRecords])

  // Top carriers with issues
  const topCarrierIssues = useMemo(() => {
    const entries = Object.entries(summary.issuesByCarrier)
    entries.sort((a, b) => b[1] - a[1])
    return entries.slice(0, 5)
  }, [summary])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }

  const selectRecord = (record: BeneficiaryAnalysis) => {
    setSelectedRecord(record)
    setEditPrimary(record.primaryBeneficiaries[0]?.name || '')
    setEditPrimaryPct(String(record.totalPrimaryPct || 100))
    setEditContingent(record.contingentBeneficiaries[0]?.name || '')
    setEditContingentPct(String(record.totalContingentPct || 0))
  }

  // Save edits to Firestore
  const handleSave = async () => {
    if (!selectedRecord) return
    setSaving(true)
    try {
      const db = getDb()
      const ref = doc(db, 'clients', selectedRecord.clientId, 'accounts', selectedRecord.accountId)
      await updateDoc(ref, {
        primary_beneficiary: editPrimary,
        primary_beneficiary_pct: parseFloat(editPrimaryPct) || 0,
        contingent_beneficiary: editContingent,
        contingent_beneficiary_pct: parseFloat(editContingentPct) || 0,
        beneficiary_last_updated: new Date().toISOString(),
      })
      await loadBeneficiaries()
      setSelectedRecord(null)
    } catch (err) {
      console.error('Failed to save beneficiary update:', err)
    } finally {
      setSaving(false)
    }
  }

  // View all accounts for a client
  const clientAccountCount = useMemo(() => {
    if (!selectedRecord) return 0
    return records.filter((r) => r.clientId === selectedRecord.clientId).length
  }, [selectedRecord, records])

  const filterByClient = () => {
    if (!selectedRecord) return
    setSearchTerm([selectedRecord.clientName].filter(Boolean).join(' '))
    setFilter('all')
    setSelectedRecord(null)
  }

  // Export to CSV
  const exportCsv = useCallback(() => {
    const headers = ['Client', 'Carrier', 'Account Type', 'Product', 'Primary Beni', 'Primary %', 'Contingent Beni', 'Contingent %', 'Status', 'Issue Detail', 'Recommended Action']
    const rows = filtered.map((r) => [
      r.clientName,
      r.carrierName,
      r.accountType,
      r.productName,
      r.primaryBeneficiaries[0]?.name || '',
      String(r.totalPrimaryPct),
      r.contingentBeneficiaries[0]?.name || '',
      String(r.totalContingentPct),
      r.issueLabel,
      r.issueDetail,
      r.recommendedAction,
    ])
    const csv = [headers.join(','), ...rows.map((r) => r.map((c) => `"${c}"`).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `beni-center-review.csv`
    a.click()
    URL.revokeObjectURL(url)
  }, [filtered])

  // ---------------------------------------------------------------------------
  // Initial State — Scan Button
  // ---------------------------------------------------------------------------
  if (!loaded) {
    return (
      <div className="mx-auto max-w-7xl space-y-6">
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

  // ---------------------------------------------------------------------------
  // Main View
  // ---------------------------------------------------------------------------
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Beni Center</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">Beneficiary management and estate coordination</p>
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
            onClick={loadBeneficiaries}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-medium)] px-4 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-50"
          >
            <span className="material-icons-outlined text-[18px]">refresh</span>
            Refresh
          </button>
        </div>
      </div>

      {/* Summary Dashboard */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {/* Completeness Card */}
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
          <p className="text-xs uppercase tracking-wider text-[var(--text-muted)]">Completeness</p>
          <div className="mt-2 flex items-end gap-2">
            <span className={`text-3xl font-bold ${summary.completenessRate >= 80 ? 'text-emerald-400' : summary.completenessRate >= 50 ? 'text-amber-400' : 'text-red-400'}`}>
              {summary.completenessRate}%
            </span>
            <span className="mb-1 text-xs text-[var(--text-muted)]">{summary.complete} of {summary.total}</span>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[var(--bg-surface)]">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${summary.completenessRate}%`,
                backgroundColor: summary.completenessRate >= 80 ? 'var(--success)' : summary.completenessRate >= 50 ? 'var(--warning)' : 'var(--error)',
              }}
            />
          </div>
        </div>

        <StatCard label="Total Scanned" count={summary.total} icon="inventory_2" color="var(--portal)" />
        <StatCard label="No Beneficiary" count={summary.empty} icon="report_problem" color="var(--error)" />
        <StatCard label="Incomplete" count={summary.partial + summary.underAllocated} icon="warning" color="var(--warning)" />
        <StatCard label="Needs Review" count={summary.conflict + summary.needsReview} icon="visibility" color="var(--info)" />
      </div>

      {/* Issues by Carrier (compact) */}
      {topCarrierIssues.length > 0 && (
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-5 py-3">
          <div className="flex items-center gap-4 overflow-x-auto">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] shrink-0">Issues by Carrier</span>
            {topCarrierIssues.map(([carrier, count]) => (
              <div key={carrier} className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-[var(--text-secondary)]">{carrier}</span>
                <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[var(--bg-surface)] px-1.5 text-xs font-medium text-[var(--text-primary)]">
                  {count}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-2">
          {([
            { key: 'all' as FilterType, label: 'All', count: summary.total },
            { key: 'empty' as FilterType, label: 'Empty', count: summary.empty },
            { key: 'partial' as FilterType, label: 'Partial', count: summary.partial },
            { key: 'under' as FilterType, label: 'Under 100%', count: summary.underAllocated },
            { key: 'conflict' as FilterType, label: 'Conflict', count: summary.conflict },
            { key: 'reactive' as FilterType, label: 'Reactive', count: summary.needsReview },
            { key: 'ok' as FilterType, label: 'Complete', count: summary.complete },
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
            <div className="flex flex-col items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] py-16">
              <span className="material-icons-outlined text-4xl text-[var(--text-muted)]">check_circle</span>
              <p className="mt-3 text-sm text-[var(--text-muted)]">No beneficiary records match this filter.</p>
            </div>
          ) : viewMode === 'grid' ? (
            <BeniTable
              records={filtered}
              selectedRecord={selectedRecord}
              onSelect={selectRecord}
              sortField={sortField}
              sortDir={sortDir}
              onSort={handleSort}
            />
          ) : (
            <div className="space-y-2">
              {filtered.map((record, i) => (
                <BeniRow
                  key={`${record.clientId}-${record.accountId}-${i}`}
                  record={record}
                  isSelected={selectedRecord?.clientId === record.clientId && selectedRecord?.accountId === record.accountId}
                  onSelect={() => selectRecord(record)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Detail Panel */}
        {selectedRecord && (
          <div className="space-y-4">
            {/* Detail Card */}
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">Beneficiary Detail</h3>
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
                    {selectedRecord.clientName}
                  </Link>
                </div>
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
                <DetailRow label="Carrier" value={selectedRecord.carrierName} />
                <DetailRow label="Account Type" value={selectedRecord.accountType} />
                <DetailRow label="Product" value={selectedRecord.productName || '—'} />

                <hr className="border-[var(--border-subtle)]" />

                {/* Primary Beneficiaries */}
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-1">Primary Beneficiaries</p>
                  {selectedRecord.primaryBeneficiaries.length > 0 ? (
                    selectedRecord.primaryBeneficiaries.map((b, idx) => (
                      <div key={idx} className="flex justify-between items-center py-0.5">
                        <span className="text-sm text-[var(--text-primary)]">{b.name}</span>
                        <span className="text-xs font-medium text-[var(--portal)]">{b.percentage}%</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-red-400">None designated</p>
                  )}
                  <p className="text-[10px] text-[var(--text-muted)] mt-0.5">Total: {selectedRecord.totalPrimaryPct}%</p>
                </div>

                {/* Contingent Beneficiaries */}
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-1">Contingent Beneficiaries</p>
                  {selectedRecord.contingentBeneficiaries.length > 0 ? (
                    selectedRecord.contingentBeneficiaries.map((b, idx) => (
                      <div key={idx} className="flex justify-between items-center py-0.5">
                        <span className="text-sm text-[var(--text-primary)]">{b.name}</span>
                        <span className="text-xs font-medium text-[var(--portal)]">{b.percentage}%</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-amber-400">None designated</p>
                  )}
                  <p className="text-[10px] text-[var(--text-muted)] mt-0.5">Total: {selectedRecord.totalContingentPct}%</p>
                </div>

                <hr className="border-[var(--border-subtle)]" />

                {/* Status + Issue */}
                <div className="flex justify-between items-center">
                  <span className="text-xs text-[var(--text-muted)]">Status</span>
                  <IssueBadge issueType={selectedRecord.issueType} label={selectedRecord.issueLabel} />
                </div>
                <DetailRow label="Issue" value={selectedRecord.issueDetail} />

                {/* Recommended action */}
                <div className="rounded-lg bg-[var(--bg-surface)] p-3 mt-2">
                  <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-1">Recommended Action</p>
                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{selectedRecord.recommendedAction}</p>
                </div>

                {/* View All Accounts button */}
                <button
                  onClick={filterByClient}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--border-medium)] px-4 py-2 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                >
                  <span className="material-icons-outlined text-[14px]">filter_alt</span>
                  View All Accounts ({clientAccountCount})
                </button>
              </div>
            </div>

            {/* Edit Card */}
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">Update Beneficiary</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-[var(--text-muted)] mb-1">Primary Beneficiary</label>
                  <input
                    type="text"
                    value={editPrimary}
                    onChange={(e) => setEditPrimary(e.target.value)}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--portal)] transition-colors"
                    placeholder="Enter primary beneficiary name"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[var(--text-muted)] mb-1">Primary %</label>
                  <input
                    type="number"
                    value={editPrimaryPct}
                    onChange={(e) => setEditPrimaryPct(e.target.value)}
                    min="0"
                    max="100"
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--portal)] transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[var(--text-muted)] mb-1">Contingent Beneficiary</label>
                  <input
                    type="text"
                    value={editContingent}
                    onChange={(e) => setEditContingent(e.target.value)}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--portal)] transition-colors"
                    placeholder="Enter contingent beneficiary name"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[var(--text-muted)] mb-1">Contingent %</label>
                  <input
                    type="number"
                    value={editContingentPct}
                    onChange={(e) => setEditContingentPct(e.target.value)}
                    min="0"
                    max="100"
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--portal)] transition-colors"
                  />
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
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Data Table (Grid View)
// ---------------------------------------------------------------------------

function BeniTable({
  records,
  selectedRecord,
  onSelect,
  sortField,
  sortDir,
  onSort,
}: {
  records: BeneficiaryAnalysis[]
  selectedRecord: BeneficiaryAnalysis | null
  onSelect: (r: BeneficiaryAnalysis) => void
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
            <SortableHeader label="Carrier" field="carrier" current={sortField} dir={sortDir} onSort={onSort} />
            <SortableHeader label="Type" field="accountType" current={sortField} dir={sortDir} onSort={onSort} />
            <SortableHeader label="Primary" field="primary" current={sortField} dir={sortDir} onSort={onSort} />
            <SortableHeader label="%" field="primaryPct" current={sortField} dir={sortDir} onSort={onSort} align="center" />
            <SortableHeader label="Contingent" field="contingent" current={sortField} dir={sortDir} onSort={onSort} />
            <SortableHeader label="%" field="contingentPct" current={sortField} dir={sortDir} onSort={onSort} align="center" />
            <SortableHeader label="Status" field="status" current={sortField} dir={sortDir} onSort={onSort} align="center" />
            <th className="px-3 py-2.5 text-left text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Issue</th>
            <th className="px-3 py-2.5 text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Actions</th>
          </tr>
        </thead>
        <tbody>
          {records.map((record, i) => {
            const isSelected = selectedRecord?.clientId === record.clientId && selectedRecord?.accountId === record.accountId
            const primaryName = record.primaryBeneficiaries[0]?.name || '—'
            const contingentName = record.contingentBeneficiaries[0]?.name || '—'

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
                    {record.clientName || 'Unknown'}
                  </Link>
                </td>
                <td className="px-3 py-2.5 text-[var(--text-secondary)]">{record.carrierName}</td>
                <td className="px-3 py-2.5 text-xs text-[var(--text-muted)]">{record.accountType}</td>
                <td className="px-3 py-2.5 text-[var(--text-secondary)]">{primaryName}</td>
                <td className="px-3 py-2.5 text-center text-xs">
                  <span className={record.totalPrimaryPct === 100 ? 'text-emerald-400' : record.totalPrimaryPct > 0 ? 'text-amber-400' : 'text-red-400'}>
                    {record.totalPrimaryPct > 0 ? `${record.totalPrimaryPct}%` : '—'}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-[var(--text-secondary)]">{contingentName}</td>
                <td className="px-3 py-2.5 text-center text-xs">
                  <span className={record.totalContingentPct === 100 ? 'text-emerald-400' : record.totalContingentPct > 0 ? 'text-amber-400' : 'text-[var(--text-muted)]'}>
                    {record.totalContingentPct > 0 ? `${record.totalContingentPct}%` : '—'}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-center">
                  <IssueBadge issueType={record.issueType} label={record.issueLabel} />
                </td>
                <td className="px-3 py-2.5 text-xs text-[var(--text-muted)] max-w-[160px] truncate" title={record.issueDetail}>
                  {record.issueDetail}
                </td>
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

function BeniRow({ record, isSelected, onSelect }: { record: BeneficiaryAnalysis; isSelected: boolean; onSelect: () => void }) {
  const s = issueStyles(record.issueType)

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
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${s.bg}`}>
            <span className={`material-icons-outlined text-[18px] ${s.text}`}>{s.icon}</span>
          </div>
          <div>
            <Link
              href={`/contacts/${record.clientId}`}
              onClick={(e) => e.stopPropagation()}
              className="text-sm font-medium text-[var(--text-primary)] hover:text-[var(--portal)] hover:underline"
            >
              {record.clientName}
            </Link>
            <p className="text-xs text-[var(--text-muted)]">{record.carrierName} &middot; {record.productName || record.accountType}</p>
          </div>
        </div>
        <div className="text-right">
          <IssueBadge issueType={record.issueType} label={record.issueLabel} />
          <p className="mt-1 text-xs text-[var(--text-muted)]">{record.issueDetail}</p>
        </div>
      </div>
      <div className="mt-3 flex items-end justify-between gap-6 border-t border-[var(--border-subtle)] pt-3">
        <div className="flex gap-6">
          {record.primaryBeneficiaries.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">Primary</p>
              <p className="text-sm text-[var(--text-primary)]">
                {record.primaryBeneficiaries[0].name} ({record.totalPrimaryPct}%)
              </p>
            </div>
          )}
          {record.contingentBeneficiaries.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">Contingent</p>
              <p className="text-sm text-[var(--text-primary)]">
                {record.contingentBeneficiaries[0].name} ({record.totalContingentPct}%)
              </p>
            </div>
          )}
          {record.primaryBeneficiaries.length === 0 && record.contingentBeneficiaries.length === 0 && (
            <p className="text-xs text-red-400">No beneficiaries designated</p>
          )}
        </div>
        <Link
          href={`/accounts/${record.clientId}/${record.accountId}`}
          target="_blank"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1 text-xs text-[var(--portal)] hover:underline shrink-0"
        >
          Account <span className="material-icons-outlined text-[12px]">open_in_new</span>
        </Link>
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

function IssueBadge({ issueType, label }: { issueType: BeneficiaryIssueType; label: string }) {
  const s = issueStyles(issueType)
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${s.bg} ${s.text}`}>
      <span className="material-icons-outlined text-[12px]">{s.icon}</span>
      {label}
    </span>
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

function issueStyles(issue: BeneficiaryIssueType) {
  switch (issue) {
    case 'empty': return { bg: 'bg-red-500/15', text: 'text-red-400', icon: 'report_problem' }
    case 'conflict': return { bg: 'bg-orange-500/15', text: 'text-orange-400', icon: 'sync_problem' }
    case 'reactive': return { bg: 'bg-purple-500/15', text: 'text-purple-400', icon: 'visibility' }
    case 'under': return { bg: 'bg-amber-500/15', text: 'text-amber-400', icon: 'pie_chart' }
    case 'partial': return { bg: 'bg-amber-500/15', text: 'text-amber-400', icon: 'warning' }
    case 'ok': return { bg: 'bg-emerald-500/15', text: 'text-emerald-400', icon: 'check_circle' }
  }
}
