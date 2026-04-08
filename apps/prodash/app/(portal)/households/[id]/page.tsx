'use client'

import React, { use, useState, useMemo, useCallback, useEffect } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useDocument } from '@tomachina/db'
import { doc, getDoc, updateDoc, getFirestore } from 'firebase/firestore'
import { getDb } from '@tomachina/db'
import { getAuth } from 'firebase/auth'
import type { Household, HouseholdMember } from '@tomachina/core'
import { SuggestedConnections, type SuggestionItem } from '@tomachina/ui/src/modules/SuggestedConnections'

// ---------------------------------------------------------------------------
// HOUSEHOLD DETAIL — The household-level view
// ---------------------------------------------------------------------------

type TabKey = 'overview' | 'members' | 'accounts' | 'financials' | 'activity' | 'pipelines'

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: 'overview', label: 'Overview', icon: 'dashboard' },
  { key: 'members', label: 'Members', icon: 'group' },
  { key: 'accounts', label: 'Accounts', icon: 'account_balance' },
  { key: 'financials', label: 'Financials', icon: 'account_balance_wallet' },
  { key: 'activity', label: 'Activity', icon: 'history' },
  { key: 'pipelines', label: 'Pipelines', icon: 'route' },
]

export default function HouseholdDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const { data: household, loading, error } = useDocument<Household>('households', id)
  const [activeTab, setActiveTab] = useState<TabKey>('overview')
  const [ai3Loading, setAi3Loading] = useState(false)
  const [ai3Data, setAi3Data] = useState<Record<string, unknown> | null>(null)
  const [showAi3, setShowAi3] = useState(false)

  const handleAi3 = useCallback(async () => {
    setAi3Loading(true)
    try {
      const auth = getAuth()
      const token = await auth.currentUser?.getIdToken()
      const res = await fetch(`/api/ai3/household/${id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (res.ok) {
        const data = await res.json()
        setAi3Data(data.data || data)
        setShowAi3(true)
      }
    } catch (err) {
      console.error('AI3 error:', err)
    } finally {
      setAi3Loading(false)
    }
  }, [id])

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
        {activeTab === 'overview' && <OverviewTab household={household} householdId={id} />}
        {activeTab === 'members' && <MembersTab household={household} householdId={id} />}
        {activeTab === 'accounts' && <AccountsTab household={household} householdId={id} />}
        {activeTab === 'financials' && <FinancialsTab household={household} householdId={id} />}
        {activeTab === 'activity' && <ActivityTab householdId={id} />}
        {activeTab === 'pipelines' && <PipelinesTab household={household} householdId={id} />}
      </div>

      {/* AI3 Report Modal — TRK-13678 */}
      {showAi3 && ai3Data && (() => { const _d = ai3Data as Record<string, unknown>; const _members = Array.isArray(_d.members) ? _d.members as Record<string, unknown>[] : []; const _opps = Array.isArray(_d.opportunities) ? _d.opportunities as Record<string, unknown>[] : []; const _acts = Array.isArray(_d.action_items) ? _d.action_items as Record<string, unknown>[] : []; return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowAi3(false)} />
          <div className="relative z-10 mx-4 w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--portal)]/15">
                  <span className="material-icons-outlined text-[var(--portal)]" style={{fontSize: 22}}>psychology</span>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-[var(--text-primary)]">AI3 Household Report</h2>
                  <p className="text-xs text-[var(--text-muted)]">{household?.household_name || 'Household'}</p>
                </div>
              </div>
              <button onClick={() => setShowAi3(false)} className="rounded-lg p-2 text-[var(--text-muted)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]">
                <span className="material-icons-outlined" style={{fontSize: 20}}>close</span>
              </button>
            </div>
            {/* Members */}
            {_members.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Member Inventory</h3>
                <div className="overflow-x-auto rounded-lg border border-[var(--border-subtle)]">
                  <table className="w-full text-sm">
                    <thead><tr className="bg-[var(--bg-surface)]">
                      <th className="px-4 py-2 text-left text-xs font-semibold text-[var(--text-muted)]">Name</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-[var(--text-muted)]">Role</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-[var(--text-muted)]">Accounts</th>
                    </tr></thead>
                    <tbody>
                      {_members.map((m: Record<string, unknown>, i: number) => (
                        <tr key={i} className="border-t border-[var(--border-subtle)]">
                          <td className="px-4 py-2 text-[var(--text-primary)]">{String(m.name || m.client_name || '')}</td>
                          <td className="px-4 py-2 text-[var(--text-secondary)]">{String(m.role || '')}</td>
                          <td className="px-4 py-2 text-[var(--text-secondary)]">{String(m.account_count || m.accounts || 0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            {/* Opportunities */}
            {_opps.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Opportunities</h3>
                <div className="space-y-2">
                  {_opps.map((opp: Record<string, unknown>, i: number) => (
                    <div key={i} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3">
                      <p className="text-sm font-medium text-[var(--text-primary)]">{String(opp.title || opp.description || '')}</p>
                      {opp.member ? <p className="text-xs text-[var(--text-muted)] mt-1">For: {String(opp.member)}</p> : null}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {/* Action Items */}
            {_acts.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Action Items</h3>
                <div className="space-y-2">
                  {_acts.map((item: Record<string, unknown>, i: number) => (
                    <div key={i} className="flex items-start gap-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3">
                      <span className="material-icons-outlined text-[var(--portal)] mt-0.5" style={{fontSize: 16}}>task_alt</span>
                      <div>
                        <p className="text-sm text-[var(--text-primary)]">{String(item.title || item.description || '')}</p>
                        {item.member ? <p className="text-xs text-[var(--text-muted)] mt-0.5">Assigned to: {String(item.member)}</p> : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {/* Summary / raw data fallback */}
            {typeof _d.summary === "string" && (
              <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4">
                <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-2">Summary</h3>
                <p className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap">{String(_d.summary)}</p>
              </div>
            )}
          </div>
        </div>
      ); })()}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------

function HouseholdHeader({ household, householdId }: { household: Household; householdId: string }) {
  const name = household.household_name || 'Unknown Household'
  const status = household.household_status || 'Unknown'
  const location = [household.city, household.state].filter(Boolean).join(', ')
  const memberCount = (household.members || []).length
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState(name)
  const [saving, setSaving] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const handleSave = useCallback(async () => {
    if (!editName.trim()) return
    setSaving(true)
    try {
      const auth = getAuth()
      const token = await auth.currentUser?.getIdToken()
      await fetch(`/api/households/${householdId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ household_name: editName.trim() }),
      })
      window.location.reload()
    } catch { /* handled */ }
    setSaving(false)
  }, [editName, householdId])

  const handleDelete = useCallback(async () => {
    setDeleting(true)
    try {
      const auth = getAuth()
      const token = await auth.currentUser?.getIdToken()
      await fetch(`/api/households/${householdId}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      window.location.href = '/households'
    } catch { /* handled */ }
    setDeleting(false)
  }, [householdId])

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

        {/* Action buttons — TRK-584 */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setEditing(true); setEditName(name) }}
            className="inline-flex items-center gap-1.5 rounded-md h-[34px] px-3 text-xs font-medium border border-[var(--border)] text-[var(--text-secondary)] transition-colors hover:border-[var(--portal)] hover:text-[var(--portal)]"
          >
            <span className="material-icons-outlined text-[16px]">edit</span>
            Edit
          </button>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="inline-flex items-center gap-1.5 rounded-md h-[34px] px-3 text-xs font-medium border border-red-400/30 text-red-400 transition-colors hover:bg-red-400/10"
          >
            <span className="material-icons-outlined text-[16px]">delete</span>
            Delete
          </button>
        </div>
      </div>

      {/* Meta chips */}
      <div className="mt-4 flex flex-wrap gap-2">
        {location && <MetaChip icon="location_on" label={location} />}
        <MetaChip icon="group" label={`${memberCount} member${memberCount !== 1 ? 's' : ''}`} />
      </div>

      {/* TRK-584: Edit inline */}
      {editing && (
        <div className="mt-4 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-4 space-y-3">
          <label className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Household Name</label>
          <input
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            className="w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--portal)]"
          />
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={saving || !editName.trim()} className="rounded-md h-[34px] px-4 text-xs font-medium bg-[var(--portal)] text-white hover:brightness-110 disabled:opacity-40">
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button onClick={() => setEditing(false)} className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]">Cancel</button>
          </div>
        </div>
      )}

      {/* TRK-584: Delete confirmation modal (NOT confirm()) */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowDeleteConfirm(false)}>
          <div className="w-full max-w-sm rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-400/10">
                <span className="material-icons-outlined text-red-400" style={{ fontSize: '20px' }}>warning</span>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">Delete Household</h3>
                <p className="text-xs text-[var(--text-muted)]">This cannot be undone.</p>
              </div>
            </div>
            <p className="text-sm text-[var(--text-secondary)] mb-4">
              Are you sure you want to delete <strong>{name}</strong>?
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowDeleteConfirm(false)} className="rounded-md h-[34px] px-4 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)]">Cancel</button>
              <button onClick={handleDelete} disabled={deleting} className="rounded-md h-[34px] px-4 text-xs font-medium bg-red-500 text-white hover:bg-red-600 disabled:opacity-40">
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Overview Tab
// ---------------------------------------------------------------------------

function OverviewTab({ household, householdId }: { household: Household; householdId: string }) {
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
                      href={`/contacts/${m.client_id}?ref=/households/${householdId}`}
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
          (Array.isArray(json.data) ? json.data as Array<Record<string, unknown>> : [])
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

  const handleSetPrimary = useCallback(async (clientId: string, clientName: string) => {
    try {
      const auth = getAuth()
      const token = await auth.currentUser?.getIdToken()
      await fetch(`/api/households/${householdId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          primary_contact_id: clientId,
          primary_contact_name: clientName,
          members: members.map(m => ({
            ...m,
            role: m.client_id === clientId ? 'primary' : (m.role === 'primary' ? 'spouse' : m.role),
          })),
        }),
      })
      window.location.reload()
    } catch {
      // Failed
    }
  }, [householdId, members])

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
                  href={`/contacts/${m.client_id}?ref=/households/${householdId}`}
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
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleSetPrimary(m.client_id, m.client_name || '')}
                  className="rounded p-1 text-[var(--text-muted)] transition-colors hover:bg-[var(--portal)]/15 hover:text-[var(--portal)]"
                  title="Set as primary contact"
                >
                  <span className="material-icons-outlined text-[18px]">star_outline</span>
                </button>
                <button
                  onClick={() => handleRemoveMember(m.client_id)}
                  className="rounded p-1 text-[var(--text-muted)] transition-colors hover:bg-red-500/15 hover:text-red-400"
                  title="Remove from household"
                >
                  <span className="material-icons-outlined text-[18px]">person_remove</span>
                </button>
              </div>
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

        {/* TRK-585: Suggested members from shared component */}
        <HouseholdSuggestions
          household={household}
          householdId={householdId}
          existingMemberIds={members.map(m => m.client_id)}
        />
      </div>
    </SectionCard>
  )
}

/** TRK-585: Household member suggestions using shared SuggestedConnections */
function HouseholdSuggestions({ household, householdId, existingMemberIds }: {
  household: Household; householdId: string; existingMemberIds: string[]
}) {
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (loaded) return
    async function findSuggestions() {
      const { getDocs, collection, query: fsQuery, where, limit: fsLimit } = await import('firebase/firestore')
      const db = getDb()
      const matches = new Map<string, SuggestionItem>()
      const excluded = new Set(existingMemberIds)

      // Get household name for last-name matching
      const hhName = String(household.household_name || '')
      const lastName = hhName.replace(/\s+household$/i, '').trim()

      if (lastName) {
        const titleCase = lastName.charAt(0).toUpperCase() + lastName.slice(1).toLowerCase()
        try {
          const snap = await getDocs(fsQuery(collection(db, 'clients'), where('last_name', '==', titleCase), fsLimit(20)))
          for (const d of snap.docs) {
            if (excluded.has(d.id)) continue
            const data = d.data()
            const name = `${data.first_name || ''} ${data.last_name || ''}`.trim()
            matches.set(d.id, { id: d.id, name, reason: 'Same last name', confidence: 0.7, phone: String(data.phone || ''), email: String(data.email || '') })
          }
        } catch { /* best effort */ }
      }

      setSuggestions(Array.from(matches.values()).slice(0, 6))
      setLoaded(true)
    }
    findSuggestions()
  }, [loaded, household, existingMemberIds])

  const handleAddToHousehold = useCallback(async (item: SuggestionItem) => {
    try {
      const auth = getAuth()
      const token = await auth.currentUser?.getIdToken()
      await fetch(`/api/households/${householdId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ client_id: item.id, client_name: item.name, role: 'other', relationship: 'Other' }),
      })
      window.location.reload()
    } catch { /* handled */ }
  }, [householdId])

  if (!loaded || suggestions.length === 0) return null

  return (
    <div className="mt-4">
      <SuggestedConnections
        suggestions={suggestions}
        onAction={handleAddToHousehold}
        actionLabel="Add to Household"
        actionIcon="group_add"
        title={`Suggested Members (${suggestions.length})`}
      />
    </div>
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
// Accounts Tab
// ---------------------------------------------------------------------------

function AccountsTab({ household, householdId }: { household: Household; householdId: string }) {
  const members = (household.members || []) as HouseholdMember[]
  const [accounts, setAccounts] = useState<Array<Record<string, unknown>>>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadAccounts() {
      const db = getDb()
      const allAccounts: Array<Record<string, unknown>> = []

      for (const member of members) {
        try {
          const { getDocs, collection } = await import('firebase/firestore')
          const snap = await getDocs(collection(db, 'clients', member.client_id, 'accounts'))
          for (const d of snap.docs) {
            allAccounts.push({
              id: d.id,
              ...d.data(),
              _owner_name: member.client_name || member.client_id,
              _owner_client_id: member.client_id,
            })
          }
        } catch {
          // Skip
        }
      }

      // TRK-580: Filter out merged/deleted/terminated accounts
      const EXCLUDED = ['merged', 'deleted', 'terminated']
      const filtered = allAccounts.filter((a) => {
        const s = String(a.status || '').toLowerCase()
        return !EXCLUDED.includes(s) && !a._merged_into
      })
      setAccounts(filtered)
      setLoading(false)
    }
    loadAccounts()
  }, [members])

  if (loading) {
    return (
      <SectionCard title="Household Accounts" icon="account_balance">
        <div className="flex items-center justify-center py-8">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--portal)] border-t-transparent" />
        </div>
      </SectionCard>
    )
  }

  if (accounts.length === 0) {
    return (
      <SectionCard title="Household Accounts" icon="account_balance">
        <p className="text-sm text-[var(--text-muted)]">No accounts found across household members</p>
      </SectionCard>
    )
  }

  return (
    <SectionCard title={`Household Accounts (${accounts.length})`} icon="account_balance">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)]">
              <th className="px-3 py-2 text-left text-xs font-semibold text-[var(--text-muted)]">Owner</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-[var(--text-muted)]">Carrier</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-[var(--text-muted)]">Product</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-[var(--text-muted)]">Type</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-[var(--text-muted)]">Policy #</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-[var(--text-muted)]">Status</th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-[var(--text-muted)]">Premium</th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-[var(--text-muted)]">Face Amount</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((acct) => (
              <tr
                key={String(acct.id)}
                onClick={() => { window.location.href = `/contacts/${acct._owner_client_id}?ref=/households/${householdId}` }}
                className="cursor-pointer border-b border-[var(--border-subtle)] transition-colors hover:bg-[var(--bg-hover)]"
              >
                <td className="px-3 py-2 text-xs text-[var(--portal)] font-medium">{String(acct._owner_name)}</td>
                <td className="px-3 py-2 text-xs text-[var(--text-secondary)]">{String(acct.carrier || acct.carrier || '')}</td>
                <td className="px-3 py-2 text-xs text-[var(--text-secondary)]">{String(acct.product_name || acct.product || '')}</td>
                <td className="px-3 py-2 text-xs text-[var(--text-muted)]">{String(acct.account_type || '')}</td>
                <td className="px-3 py-2 text-xs text-[var(--text-secondary)] font-mono">{String(acct.policy_number || acct.account_number || '')}</td>
                <td className="px-3 py-2"><StatusBadge status={String(acct.status || acct.account_status || '')} /></td>
                <td className="px-3 py-2 text-right text-xs text-[var(--text-primary)]">
                  {acct.premium ? `$${Number(acct.premium).toLocaleString()}` : '\u2014'}
                </td>
                <td className="px-3 py-2 text-right text-xs text-[var(--text-primary)]">
                  {acct.face_amount ? `$${Number(acct.face_amount).toLocaleString()}` : '\u2014'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionCard>
  )
}

// ---------------------------------------------------------------------------
// Activity Tab
// ---------------------------------------------------------------------------

function ActivityTab({ householdId }: { householdId: string }) {
  const [activities, setActivities] = useState<Array<Record<string, unknown>>>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const auth = getAuth()
        const token = await auth.currentUser?.getIdToken()
        const res = await fetch(`/api/activities/household/${householdId}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        })
        const json = await res.json()
        if (json.success) setActivities(json.data || [])
      } catch {
        // Load failed
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [householdId])

  if (loading) {
    return (
      <SectionCard title="Activity Feed" icon="history">
        <div className="flex items-center justify-center py-8">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--portal)] border-t-transparent" />
        </div>
      </SectionCard>
    )
  }

  if (activities.length === 0) {
    return (
      <SectionCard title="Activity Feed" icon="history">
        <p className="text-sm text-[var(--text-muted)]">No recent activity across household members</p>
      </SectionCard>
    )
  }

  return (
    <SectionCard title={`Activity Feed (${activities.length})`} icon="history">
      <div className="space-y-3 max-h-[600px] overflow-y-auto">
        {activities.map((activity, idx) => (
          <div key={String(activity.id || idx)} className="flex items-start gap-3 rounded-lg border border-[var(--border-subtle)] p-3">
            <span className="material-icons-outlined text-[16px] text-[var(--text-muted)] mt-0.5">
              {activity.action === 'CREATE' ? 'add_circle' :
               activity.action === 'UPDATE' ? 'edit' :
               activity.action === 'DELETE' ? 'delete' : 'info'}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-[var(--portal)]">{String(activity.member_name || '')}</span>
                <span className="text-[10px] text-[var(--text-muted)]">
                  {activity.created_at ? new Date(String(activity.created_at)).toLocaleString() : ''}
                </span>
              </div>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5 truncate">
                {String(activity.description || activity.action || '')}
              </p>
            </div>
          </div>
        ))}
      </div>
    </SectionCard>
  )
}

// ---------------------------------------------------------------------------
// Pipelines Tab
// ---------------------------------------------------------------------------

function PipelinesTab({ household, householdId }: { household: Household; householdId: string }) {
  const members = (household.members || []) as HouseholdMember[]
  const [householdPipelines, setHouseholdPipelines] = useState<Array<Record<string, unknown>>>([])
  const [memberPipelines, setMemberPipelines] = useState<Array<Record<string, unknown>>>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const auth = getAuth()
        const token = await auth.currentUser?.getIdToken()
        const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}

        // Fetch household-level pipeline instances
        const hhRes = await fetch(`/api/flow/instances?entity_type=HOUSEHOLD&entity_id=${householdId}`, { headers })
        const hhJson = await hhRes.json()
        if (hhJson.success) setHouseholdPipelines(hhJson.data || [])

        // Fetch member-level pipeline instances
        const memberResults: Array<Record<string, unknown>> = []
        await Promise.all(
          members.map(async (member) => {
            try {
              const mRes = await fetch(`/api/flow/instances?entity_type=CLIENT&entity_id=${member.client_id}`, { headers })
              const mJson = await mRes.json()
              if (mJson.success) {
                for (const inst of (mJson.data || []) as Array<Record<string, unknown>>) {
                  memberResults.push({ ...inst, _member_name: member.client_name || member.client_id })
                }
              }
            } catch {
              // Skip
            }
          })
        )
        setMemberPipelines(memberResults)
      } catch {
        // Load failed
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [householdId, members])

  if (loading) {
    return (
      <SectionCard title="Pipelines" icon="route">
        <div className="flex items-center justify-center py-8">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--portal)] border-t-transparent" />
        </div>
      </SectionCard>
    )
  }

  const hasPipelines = householdPipelines.length > 0 || memberPipelines.length > 0

  if (!hasPipelines) {
    return (
      <SectionCard title="Pipelines" icon="route">
        <p className="text-sm text-[var(--text-muted)]">No active pipelines for this household or its members</p>
      </SectionCard>
    )
  }

  return (
    <div className="space-y-4">
      {householdPipelines.length > 0 && (
        <SectionCard title={`Household Pipelines (${householdPipelines.length})`} icon="home">
          <div className="space-y-2">
            {householdPipelines.map((inst) => (
              <PipelineCard key={String(inst.instance_id || inst.id)} instance={inst} />
            ))}
          </div>
        </SectionCard>
      )}

      {memberPipelines.length > 0 && (
        <SectionCard title={`Member Pipelines (${memberPipelines.length})`} icon="person">
          <div className="space-y-2">
            {memberPipelines.map((inst) => (
              <PipelineCard key={String(inst.instance_id || inst.id)} instance={inst} memberName={String(inst._member_name || '')} />
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  )
}

function PipelineCard({ instance, memberName }: { instance: Record<string, unknown>; memberName?: string }) {
  const status = String(instance.stage_status || 'pending')
  const statusColor = status === 'complete' ? 'text-emerald-400' : status === 'blocked' ? 'text-red-400' : 'text-[var(--text-muted)]'

  return (
    <div className="flex items-center justify-between rounded-lg border border-[var(--border-subtle)] p-3 transition-colors hover:bg-[var(--bg-hover)]">
      <div className="flex items-center gap-3">
        <span className={`material-icons-outlined text-[16px] ${statusColor}`}>
          {status === 'complete' ? 'check_circle' : status === 'blocked' ? 'block' : 'radio_button_checked'}
        </span>
        <div>
          <p className="text-sm font-medium text-[var(--text-primary)]">
            {String(instance.pipeline_name || instance.pipeline_key || '')}
          </p>
          <div className="flex items-center gap-2">
            {memberName && <span className="text-[10px] text-[var(--portal)]">{memberName}</span>}
            <span className="text-[10px] text-[var(--text-muted)]">Stage: {String(instance.current_stage || '')}</span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {instance.priority ? (
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
            String(instance.priority).toUpperCase() === 'HIGH' ? 'bg-red-500/15 text-red-400' : 'bg-[var(--bg-surface)] text-[var(--text-muted)]'
          }`}>
            {String(instance.priority)}
          </span>
        ) : null}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Shared Components
// ---------------------------------------------------------------------------

function BackLink() {
  const searchParams = useSearchParams()
  const ref = searchParams.get('ref')

  if (ref?.startsWith('/contacts/')) {
    return (
      <nav className="flex items-center gap-1.5 text-sm">
        <Link href="/households" className="text-[var(--text-muted)] transition-colors hover:text-[var(--portal)]">
          Households
        </Link>
        <span className="material-icons-outlined text-[14px] text-[var(--text-muted)]">chevron_right</span>
        <Link href={ref} className="inline-flex items-center gap-1 text-[var(--text-muted)] transition-colors hover:text-[var(--portal)]">
          <span className="material-icons-outlined text-[14px]">arrow_back</span>
          Back to Client
        </Link>
      </nav>
    )
  }

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
