'use client'

import { use, useState, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { useDocument } from '@tomachina/db'
import { doc, getDoc, updateDoc, getFirestore } from 'firebase/firestore'
import { getDb } from '@tomachina/db'
import { getAuth } from 'firebase/auth'
import type { Household, HouseholdMember } from '@tomachina/core'

// ---------------------------------------------------------------------------
// HOUSEHOLD DETAIL — The household-level view
// ---------------------------------------------------------------------------

type TabKey = 'overview' | 'members' | 'financials'

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: 'overview', label: 'Overview', icon: 'dashboard' },
  { key: 'members', label: 'Members', icon: 'group' },
  { key: 'financials', label: 'Financials', icon: 'account_balance' },
]

export default function HouseholdDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const { data: household, loading, error } = useDocument<Household>('households', id)
  const [activeTab, setActiveTab] = useState<TabKey>('overview')

  // --- Loading skeleton ---
  if (loading) {
    return (
      <div className="mx-auto max-w-6xl animate-pulse space-y-6">
        <BackLink />
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6">
          <div className="flex items-center gap-5">
            <div className="h-14 w-14 rounded-full bg-[var(--bg-surface)]" />
            <div className="space-y-2">
              <div className="h-7 w-56 rounded bg-[var(--bg-surface)]" />
              <div className="h-4 w-32 rounded bg-[var(--bg-surface)]" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  // --- Error / not found ---
  if (error || !household) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <BackLink />
        <div className="flex flex-col items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] py-20">
          <span className="material-icons-outlined text-5xl text-[var(--text-muted)]">home</span>
          <h2 className="mt-4 text-xl font-semibold text-[var(--text-primary)]">Household not found</h2>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            {error ? 'There was an error loading this household.' : 'No household exists with this ID.'}
          </p>
          <Link
            href="/households"
            className="mt-6 rounded-lg bg-[var(--portal)] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:brightness-110"
          >
            Back to Households
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <BackLink />
      <HouseholdHeader household={household} householdId={id} />

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium whitespace-nowrap transition-all ${
              activeTab === tab.key
                ? 'bg-[var(--portal)] text-white'
                : 'bg-[var(--bg-surface)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)]/80'
            }`}
          >
            <span className="material-icons-outlined text-[16px]">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="min-h-[400px]">
        {activeTab === 'overview' && <OverviewTab household={household} />}
        {activeTab === 'members' && <MembersTab household={household} householdId={id} />}
        {activeTab === 'financials' && <FinancialsTab household={household} householdId={id} />}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------

function HouseholdHeader({ household, householdId: _householdId }: { household: Household; householdId: string }) {
  const name = household.household_name || 'Unknown Household'
  const status = household.household_status || 'Unknown'
  const location = [household.city, household.state].filter(Boolean).join(', ')
  const memberCount = (household.members || []).length
  const acfUrl = household.acf_folder_url as string | undefined
  const initials = name
    .split(' ')
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-5">
          <div
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-lg font-bold text-white"
            style={{ backgroundColor: hashColor(name) }}
          >
            {initials}
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-[var(--text-primary)]">{name}</h1>
              <StatusBadge status={status} />
            </div>
            <p className="mt-0.5 text-sm text-[var(--text-muted)]">
              {memberCount} member{memberCount !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {/* ACF Button */}
          <button
            onClick={() => {
              if (acfUrl) window.open(acfUrl, '_blank', 'noopener,noreferrer')
            }}
            disabled={!acfUrl}
            className={`inline-flex items-center gap-1.5 rounded px-4 py-1.5 text-sm font-medium transition-all ${
              acfUrl
                ? 'bg-[var(--portal)]/15 text-[var(--portal)] hover:bg-[var(--portal)]/25 border border-[var(--portal)]/30'
                : 'bg-[var(--bg-surface)] text-[var(--text-muted)] cursor-not-allowed opacity-50 border border-[var(--border)]'
            }`}
            title={acfUrl ? 'Open Household ACF in Google Drive' : 'No ACF link on file'}
          >
            <span className="material-icons-outlined text-[18px]">folder_open</span>
            ACF
          </button>
        </div>
      </div>

      {/* Meta chips */}
      <div className="mt-4 flex flex-wrap gap-2">
        {location && <MetaChip icon="location_on" label={location} />}
        <MetaChip icon="group" label={`${memberCount} member${memberCount !== 1 ? 's' : ''}`} />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Overview Tab
// ---------------------------------------------------------------------------

function OverviewTab({ household }: { household: Household }) {
  const members = (household.members || []) as HouseholdMember[]
  const financials = household.aggregate_financials

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {/* Members Summary */}
      <SectionCard title="Members" icon="group">
        {members.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">No members</p>
        ) : (
          <div className="space-y-3">
            {members.map(m => (
              <div key={m.client_id} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white"
                    style={{ backgroundColor: hashColor(m.client_name || '') }}
                  >
                    {(m.client_name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <Link
                      href={`/contacts/${m.client_id}`}
                      className="text-sm font-medium text-[var(--text-primary)] hover:text-[var(--portal)]"
                    >
                      {m.client_name || m.client_id}
                    </Link>
                    <p className="text-xs text-[var(--text-muted)] capitalize">{m.role}</p>
                  </div>
                </div>
                <span className="text-xs text-[var(--text-muted)]">{m.relationship}</span>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* Financial Summary */}
      <SectionCard title="Financial Summary" icon="account_balance">
        {!financials || Object.keys(financials).length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">No financial data calculated yet</p>
        ) : (
          <div className="space-y-2">
            <FinRow label="Combined Income" value={financials.combined_income} />
            <FinRow label="Combined Net Worth" value={financials.combined_net_worth} />
            <FinRow label="Investable Assets" value={financials.combined_investable_assets} />
            <FinRow label="Total Accounts" value={financials.total_accounts} plain />
            <FinRow label="Total Premium" value={financials.total_premium} />
            <FinRow label="Total Face Amount" value={financials.total_face_amount} />
            {financials.filing_status && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-[var(--text-muted)]">Filing Status</span>
                <span className="text-sm text-[var(--text-primary)]">{financials.filing_status}</span>
              </div>
            )}
          </div>
        )}
      </SectionCard>

      {/* Address */}
      <SectionCard title="Address" icon="location_on">
        {household.address ? (
          <div className="text-sm text-[var(--text-secondary)]">
            <p>{household.address}</p>
            <p>{[household.city, household.state].filter(Boolean).join(', ')} {household.zip}</p>
          </div>
        ) : (
          <p className="text-sm text-[var(--text-muted)]">No address on file</p>
        )}
      </SectionCard>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Members Tab
// ---------------------------------------------------------------------------

function MembersTab({ household, householdId }: { household: Household; householdId: string }) {
  const members = (household.members || []) as HouseholdMember[]
  const [adding, setAdding] = useState(false)
  const [searchInput, setSearchInput] = useState('')
  const [searchResults, setSearchResults] = useState<Array<{ id: string; name: string; email: string }>>([])
  const [searching, setSearching] = useState(false)

  const handleSearch = useCallback(async (q: string) => {
    setSearchInput(q)
    if (q.length < 2) { setSearchResults([]); return }

    setSearching(true)
    try {
      const auth = getAuth()
      const token = await auth.currentUser?.getIdToken()
      const res = await fetch(`/api/clients?search=${encodeURIComponent(q)}&limit=10`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      const json = await res.json()
      if (json.success) {
        const existingIds = new Set(members.map(m => m.client_id))
        setSearchResults(
          (json.data as Array<Record<string, unknown>>)
            .filter(c => !existingIds.has(c.client_id as string))
            .map(c => ({
              id: (c.client_id || c.id) as string,
              name: `${c.first_name || ''} ${c.last_name || ''}`.trim(),
              email: (c.email as string) || '',
            }))
        )
      }
    } catch {
      // Search failed silently
    } finally {
      setSearching(false)
    }
  }, [members])

  const handleAddMember = useCallback(async (clientId: string, clientName: string) => {
    try {
      const auth = getAuth()
      const token = await auth.currentUser?.getIdToken()
      await fetch(`/api/households/${householdId}/members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ client_id: clientId, role: 'other', relationship: 'Other' }),
      })
      // Reload
      window.location.reload()
    } catch {
      // Add failed
    }
  }, [householdId])

  const handleRemoveMember = useCallback(async (clientId: string) => {
    try {
      const auth = getAuth()
      const token = await auth.currentUser?.getIdToken()
      await fetch(`/api/households/${householdId}/members/${clientId}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      window.location.reload()
    } catch {
      // Remove failed
    }
  }, [householdId])

  return (
    <SectionCard title="Household Members" icon="group">
      <div className="space-y-4">
        {members.map(m => (
          <div key={m.client_id} className="flex items-center justify-between rounded-lg border border-[var(--border-subtle)] p-3">
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white"
                style={{ backgroundColor: hashColor(m.client_name || '') }}
              >
                {(m.client_name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              <div>
                <Link
                  href={`/contacts/${m.client_id}`}
                  className="text-sm font-medium text-[var(--text-primary)] hover:text-[var(--portal)]"
                >
                  {m.client_name || m.client_id}
                </Link>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[var(--text-muted)] capitalize">{m.role}</span>
                  <span className="text-xs text-[var(--text-muted)]">{m.relationship}</span>
                </div>
              </div>
            </div>
            {m.role !== 'primary' && (
              <button
                onClick={() => handleRemoveMember(m.client_id)}
                className="rounded p-1 text-[var(--text-muted)] transition-colors hover:bg-red-500/15 hover:text-red-400"
                title="Remove from household"
              >
                <span className="material-icons-outlined text-[18px]">person_remove</span>
              </button>
            )}
          </div>
        ))}

        {/* Add Member */}
        {adding ? (
          <div className="space-y-2">
            <div className="relative">
              <input
                type="text"
                value={searchInput}
                onChange={e => handleSearch(e.target.value)}
                placeholder="Search contacts to add..."
                autoFocus
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--portal)] focus:outline-none"
              />
              {searching && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--portal)] border-t-transparent" />
                </div>
              )}
            </div>
            {searchResults.length > 0 && (
              <div className="max-h-48 overflow-y-auto rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
                {searchResults.map(r => (
                  <button
                    key={r.id}
                    onClick={() => handleAddMember(r.id, r.name)}
                    className="flex w-full items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-[var(--bg-card)]"
                  >
                    <span className="material-icons-outlined text-[16px] text-[var(--text-muted)]">person_add</span>
                    <div>
                      <p className="text-sm font-medium text-[var(--text-primary)]">{r.name}</p>
                      {r.email && <p className="text-xs text-[var(--text-muted)]">{r.email}</p>}
                    </div>
                  </button>
                ))}
              </div>
            )}
            <button
              onClick={() => { setAdding(false); setSearchInput(''); setSearchResults([]) }}
              className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-[var(--border)] px-4 py-2 text-sm text-[var(--text-muted)] transition-colors hover:border-[var(--portal)] hover:text-[var(--portal)]"
          >
            <span className="material-icons-outlined text-[16px]">person_add</span>
            Add Member
          </button>
        )}
      </div>
    </SectionCard>
  )
}

// ---------------------------------------------------------------------------
// Financials Tab
// ---------------------------------------------------------------------------

function FinancialsTab({ household, householdId }: { household: Household; householdId: string }) {
  const financials = household.aggregate_financials
  const [recalculating, setRecalculating] = useState(false)

  const handleRecalculate = useCallback(async () => {
    setRecalculating(true)
    try {
      const auth = getAuth()
      const token = await auth.currentUser?.getIdToken()
      await fetch(`/api/households/${householdId}/recalculate`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      window.location.reload()
    } catch {
      // Recalculate failed
    } finally {
      setRecalculating(false)
    }
  }, [householdId])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-[var(--text-primary)]">Household Financials</h3>
        <button
          onClick={handleRecalculate}
          disabled={recalculating}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--portal)] px-4 py-2 text-sm font-medium text-white transition-all hover:brightness-110 disabled:opacity-50"
        >
          {recalculating ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : (
            <span className="material-icons-outlined text-[16px]">refresh</span>
          )}
          Recalculate
        </button>
      </div>

      {!financials || Object.keys(financials).length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] py-16">
          <span className="material-icons-outlined text-4xl text-[var(--text-muted)]">calculate</span>
          <p className="mt-2 text-sm text-[var(--text-muted)]">No financial data calculated yet</p>
          <p className="text-xs text-[var(--text-muted)]">Click Recalculate to aggregate member financials</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <FinCard label="Combined Income" value={financials.combined_income} icon="payments" />
          <FinCard label="Combined Net Worth" value={financials.combined_net_worth} icon="account_balance_wallet" />
          <FinCard label="Investable Assets" value={financials.combined_investable_assets} icon="trending_up" />
          <FinCard label="Total Accounts" value={financials.total_accounts} icon="folder_open" plain />
          <FinCard label="Total Premium" value={financials.total_premium} icon="shield" />
          <FinCard label="Total Face Amount" value={financials.total_face_amount} icon="security" />
        </div>
      )}

      {financials?.last_calculated && (
        <p className="text-xs text-[var(--text-muted)]">
          Last calculated: {new Date(financials.last_calculated).toLocaleString()}
        </p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Shared Components
// ---------------------------------------------------------------------------

function BackLink() {
  return (
    <Link
      href="/households"
      className="inline-flex items-center gap-1.5 text-sm text-[var(--text-muted)] transition-colors hover:text-[var(--portal)]"
    >
      <span className="material-icons-outlined text-[18px]">arrow_back</span>
      Back to Households
    </Link>
  )
}

function SectionCard({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
      <div className="mb-4 flex items-center gap-2">
        <span className="material-icons-outlined text-[18px] text-[var(--portal)]">{icon}</span>
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">{title}</h3>
      </div>
      {children}
    </div>
  )
}

function FinRow({ label, value, plain }: { label: string; value?: number; plain?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-[var(--text-muted)]">{label}</span>
      <span className="text-sm font-medium text-[var(--text-primary)]">
        {value != null ? (plain ? value.toLocaleString() : `$${value.toLocaleString()}`) : '—'}
      </span>
    </div>
  )
}

function FinCard({ label, value, icon, plain }: { label: string; value?: number; icon: string; plain?: boolean }) {
  return (
    <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4">
      <div className="flex items-center gap-2">
        <span className="material-icons-outlined text-[16px] text-[var(--text-muted)]">{icon}</span>
        <span className="text-xs text-[var(--text-muted)]">{label}</span>
      </div>
      <p className="mt-2 text-xl font-bold text-[var(--text-primary)]">
        {value != null ? (plain ? value.toLocaleString() : `$${value.toLocaleString()}`) : '—'}
      </p>
    </div>
  )
}

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

function MetaChip({ icon, label }: { icon: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-medium)] px-3 py-1 text-xs text-[var(--text-secondary)]">
      <span className="material-icons-outlined text-[14px] text-[var(--text-muted)]">{icon}</span>
      {label}
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
