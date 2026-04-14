'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { PipelineKanban, AppWrapper, PipelineFieldsForm } from '@tomachina/ui'
import { useAuth } from '@tomachina/auth'
import { ACCOUNT_TYPE_CATEGORIES } from '@tomachina/core'
import type { AccountTypeCategory } from '@tomachina/core'
import { fetchWithAuth } from '@tomachina/ui/src/modules/fetchWithAuth'
import { toPipelineKey } from '../pipeline-keys'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api'

interface Carrier {
  id: string
  display_name: string
  carrier: string
  name: string
}

interface Advisor {
  email: string
  first_name: string
  last_name: string
  is_agent?: boolean
  is_licensed?: boolean
  is_rr?: boolean
  is_iar?: boolean
}

interface ClientOption {
  client_id: string
  first_name: string
  last_name: string
  city?: string
  state?: string
  status?: string
}

interface NewCaseForm {
  entity_name: string
  entity_id: string
  account_type_category: AccountTypeCategory | ''
  carrier_id: string
  carrier: string
  assigned_to: string
  notes: string
}

const EMPTY_FORM: NewCaseForm = {
  entity_name: '',
  entity_id: '',
  account_type_category: '',
  carrier_id: '',
  carrier: '',
  assigned_to: '',
  notes: '',
}

export default function PipelineKanbanPage() {
  const params = useParams<{ key: string }>()
  const router = useRouter()
  const { user } = useAuth()
  const slug = params.key
  const pipelineKey = toPipelineKey(slug)

  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState<NewCaseForm>({ ...EMPTY_FORM })
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  // Pipeline-specific custom_fields — driven by PipelineFieldsForm (RON-OPP-FIELDS-001 PR B)
  const [pipelineCustomFields, setPipelineCustomFields] = useState<Record<string, unknown>>({})
  const [pipelineFieldsValid, setPipelineFieldsValid] = useState(true)

  // Carrier + advisor data fetched once on mount
  const [carriers, setCarriers] = useState<Carrier[]>([])
  const [carriersLoading, setCarriersLoading] = useState(false)
  const [advisors, setAdvisors] = useState<Advisor[]>([])

  // Client typeahead
  const [clientQuery, setClientQuery] = useState('')
  const [clientResults, setClientResults] = useState<ClientOption[]>([])
  const [clientSearching, setClientSearching] = useState(false)
  const [showClientResults, setShowClientResults] = useState(false)
  const clientDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const clientWrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false

    // Fetch carriers and advisors independently — one failure doesn't kill the other
    async function loadCarriers() {
      try {
        const res = await fetchWithAuth(`${API_BASE}/carriers`)
        if (cancelled) return
        const json = await res.json() as { success: boolean; data?: Carrier[] }
        if (!cancelled && json.success && json.data) {
          setCarriers([...json.data].sort((a, b) => (a.display_name || a.name || a.carrier || '').localeCompare(b.display_name || b.name || b.carrier || '')))
        }
      } catch { /* non-fatal */ }
    }

    async function loadAdvisors() {
      try {
        const res = await fetchWithAuth(`${API_BASE}/users`)
        if (cancelled) return
        const json = await res.json() as { success: boolean; data?: Advisor[] }
        if (!cancelled && json.success && json.data) {
          // RDN-DOJO-GAP-04: include `is_agent` — canonical writing-agent flag.
          // Some writing agents (e.g. Vince) have is_agent=true + a valid NPN
          // but no separate is_licensed flag, so the previous filter hid them.
          const qualified = json.data.filter(
            (u) => u.is_agent || u.is_licensed || u.is_rr || u.is_iar
          ).sort((a, b) => a.first_name.localeCompare(b.first_name))
          setAdvisors(qualified)
        }
      } catch { /* non-fatal */ }
    }

    loadCarriers()
    loadAdvisors()
    return () => { cancelled = true }
  }, [])

  // Client typeahead search
  const handleClientSearch = useCallback((value: string) => {
    setClientQuery(value)
    setForm((prev) => ({ ...prev, entity_name: value, entity_id: '' }))
    if (clientDebounceRef.current) clearTimeout(clientDebounceRef.current)
    if (value.length < 2) { setClientResults([]); setShowClientResults(false); return }
    clientDebounceRef.current = setTimeout(async () => {
      setClientSearching(true)
      try {
        const res = await fetchWithAuth(`${API_BASE}/clients?q=${encodeURIComponent(value)}&limit=8`)
        const json = await res.json() as { success: boolean; data?: ClientOption[] }
        if (json.success && json.data) {
          setClientResults(Array.isArray(json.data) ? json.data : [])
          setShowClientResults(true)
        }
      } catch { /* non-fatal */ }
      finally { setClientSearching(false) }
    }, 300)
  }, [])

  const selectClient = useCallback((client: ClientOption) => {
    const displayName = `${client.last_name}, ${client.first_name}`
    setClientQuery(displayName)
    setForm((prev) => ({ ...prev, entity_name: displayName, entity_id: client.client_id }))
    setShowClientResults(false)
    setClientResults([])
  }, [])

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (clientWrapperRef.current && !clientWrapperRef.current.contains(e.target as Node)) {
        setShowClientResults(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleCreate = useCallback(async () => {
    if (!form.entity_id || !form.assigned_to.trim()) {
      setError('Select a client from the list and assign an advisor.')
      return
    }
    if (!form.account_type_category) {
      setError('Account type category is required.')
      return
    }
    if (!form.carrier_id) {
      setError('Carrier is required.')
      return
    }

    if (!pipelineFieldsValid) {
      setError('Complete all required pipeline fields before creating the case.')
      return
    }

    setCreating(true)
    setError(null)

    // Two-step create (RON-OPP-FIELDS-001 PR B, Option B parallel records):
    //   1. POST /api/opportunities → returns the business record id
    //   2. POST /api/flow/instances with opportunity_id linkage
    //   3. If step 2 fails, soft-close the orphan opportunity (DELETE /:id sets stage=closed_lost)
    let createdOpportunityId: string | null = null

    try {
      // ── Step 1: Create the opportunity (business record) ──────────────────
      const oppRes = await fetchWithAuth(`${API_BASE}/opportunities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pipeline: pipelineKey,
          stage: 'open',
          client_id: form.entity_id,
          client_name: form.entity_name.trim(),
          agent_id: form.assigned_to.trim(),
          assignee_id: form.assigned_to.trim(),
          carrier_id: form.carrier_id,
          carrier: form.carrier,
          account_type_category: form.account_type_category,
          custom_fields: pipelineCustomFields,
          notes: form.notes || '',
          value: 0,
          source: 'Manual — ProDashX',
        }),
      })
      const oppJson = (await oppRes.json()) as { success: boolean; data?: { id: string }; error?: string }
      if (!oppJson.success || !oppJson.data?.id) {
        setError(oppJson.error || 'Failed to create opportunity.')
        return
      }
      createdOpportunityId = oppJson.data.id

      // ── Step 2: Create the flow_instance, linked via opportunity_id ───────
      const instRes = await fetchWithAuth(`${API_BASE}/flow/instances`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pipeline_key: pipelineKey,
          entity_id: form.entity_id,
          entity_name: form.entity_name.trim(),
          entity_type: 'CLIENT',
          assigned_to: form.assigned_to.trim(),
          opportunity_id: createdOpportunityId,
          entity_data: {
            account_type_category: form.account_type_category,
            carrier_id: form.carrier_id,
            carrier: form.carrier,
            notes: form.notes || '',
            source: 'Manual — ProDashX',
          },
        }),
      })
      const instJson = (await instRes.json()) as { success: boolean; data?: { instance_id: string; tasks_generated: number }; error?: string }
      if (!instJson.success) {
        // Orphan cleanup: soft-close the opportunity we just created so it
        // doesn't linger in the pipeline as a stageless business record.
        try {
          await fetchWithAuth(`${API_BASE}/opportunities/${encodeURIComponent(createdOpportunityId)}`, { method: 'DELETE' })
        } catch { /* best-effort cleanup; user error message below is the actionable signal */ }
        setError(instJson.error || 'Failed to create case workflow. Opportunity rolled back.')
        return
      }

      // Success — close modal, reset state, refresh board
      setShowModal(false)
      setForm({ ...EMPTY_FORM })
      setPipelineCustomFields({})
      setClientQuery('')
      setClientResults([])
      setRefreshKey((k) => k + 1)
    } catch (err) {
      // Network error or exception — best-effort orphan cleanup if opp landed
      if (createdOpportunityId) {
        try {
          await fetchWithAuth(`${API_BASE}/opportunities/${encodeURIComponent(createdOpportunityId)}`, { method: 'DELETE' })
        } catch { /* swallow — user already sees the network error */ }
      }
      setError(err instanceof Error ? err.message : 'Network error')
    } finally {
      setCreating(false)
    }
  }, [form, pipelineKey, pipelineCustomFields, pipelineFieldsValid])

  const updateField = (field: keyof NewCaseForm, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }))

  return (
    <AppWrapper appKey="pipelines">
      <div className="space-y-4">
        {/* Top bar: Back + New Case */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.push('/pipelines')}
            className="flex items-center gap-1 text-sm text-[var(--text-muted)] transition-colors hover:text-[var(--portal)]"
          >
            <span className="material-icons-outlined text-base">arrow_back</span>
            Back to Pipelines
          </button>

          <button
            onClick={() => { setShowModal(true); setError(null) }}
            className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-all hover:brightness-110"
            style={{ background: 'var(--portal)' }}
          >
            <span className="material-icons-outlined" style={{ fontSize: '18px' }}>add</span>
            New Case
          </button>
        </div>

        <PipelineKanban
          key={refreshKey}
          pipelineKey={pipelineKey}
          portal="prodashx"
          onInstanceClick={(instanceId: string) => {
            router.push(`/pipelines/${slug}/${instanceId}`)
          }}
        />
      </div>

      {/* ─── New Case Modal ─── */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false) }}
        >
          <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] shadow-2xl">
            {/* Header */}
            <div className="flex shrink-0 items-center justify-between border-b border-[var(--border-subtle)] px-6 py-4">
              <div className="flex items-center gap-3">
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-lg"
                  style={{ background: 'rgba(var(--portal-rgb, 74, 122, 181), 0.15)' }}
                >
                  <span className="material-icons-outlined text-[var(--portal)]" style={{ fontSize: '18px' }}>add_circle</span>
                </div>
                <h2 className="text-lg font-bold text-[var(--text-primary)]">New Case</h2>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
              >
                <span className="material-icons-outlined" style={{ fontSize: '22px' }}>close</span>
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
              {error && (
                <div className="flex items-center gap-2 rounded-lg bg-[rgba(239,68,68,0.1)] px-3 py-2 text-sm text-[var(--error)]">
                  <span className="material-icons-outlined" style={{ fontSize: '16px' }}>warning</span>
                  {error}
                </div>
              )}

              {/* Client Lookup */}
              <div ref={clientWrapperRef} className="relative">
                <label className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">
                  Client <span className="text-[var(--error)]">*</span>
                </label>
                <div className="relative">
                  <span className="material-icons-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" style={{ fontSize: '16px' }}>
                    {form.entity_id ? 'check_circle' : 'search'}
                  </span>
                  <input
                    type="text"
                    value={clientQuery}
                    onChange={(e) => handleClientSearch(e.target.value)}
                    onFocus={() => { if (clientResults.length) setShowClientResults(true) }}
                    placeholder="Type last name to search..."
                    className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] py-2.5 pl-9 pr-3 text-sm text-[var(--text-primary)] outline-none transition-colors focus:border-[var(--portal)]"
                    style={form.entity_id ? { borderColor: 'var(--success, #10b981)' } : undefined}
                    autoFocus
                  />
                  {clientSearching && (
                    <span className="material-icons-outlined absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-[var(--text-muted)]" style={{ fontSize: '14px' }}>progress_activity</span>
                  )}
                </div>
                {showClientResults && clientResults.length > 0 && (
                  <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-48 overflow-y-auto rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated,var(--bg-primary))] shadow-lg">
                    {clientResults.map((c) => (
                      <button
                        key={c.client_id}
                        type="button"
                        onClick={() => selectClient(c)}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-[var(--bg-hover,rgba(255,255,255,0.05))]"
                      >
                        <span className="material-icons-outlined text-[var(--text-muted)]" style={{ fontSize: '14px' }}>person</span>
                        <span>
                          <span className="font-medium text-[var(--text-primary)]">{c.last_name}, {c.first_name}</span>
                          {(c.city || c.state) && (
                            <span className="ml-2 text-xs text-[var(--text-muted)]">{[c.city, c.state].filter(Boolean).join(', ')}</span>
                          )}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                {showClientResults && clientResults.length === 0 && clientQuery.length >= 2 && !clientSearching && (
                  <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated,var(--bg-primary))] px-3 py-2 text-xs text-[var(--text-muted)] shadow-lg">
                    No clients found for &ldquo;{clientQuery}&rdquo;
                  </div>
                )}
              </div>

              {/* Account Type Category + Carrier row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">
                    Account Type <span className="text-[var(--error)]">*</span>
                  </label>
                  <select
                    value={form.account_type_category}
                    onChange={(e) => updateField('account_type_category', e.target.value)}
                    className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--portal)]"
                  >
                    <option value="">Select type...</option>
                    {ACCOUNT_TYPE_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">
                    Carrier <span className="text-[var(--error)]">*</span>
                  </label>
                  <select
                    value={form.carrier_id}
                    onChange={(e) => {
                      const selected = carriers.find((c) => c.id === e.target.value)
                      setForm((prev) => ({
                        ...prev,
                        carrier_id: e.target.value,
                        carrier: selected?.display_name || selected?.name || selected?.carrier || '',
                      }))
                    }}
                    className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--portal)]"
                    disabled={carriersLoading}
                  >
                    <option value="">
                      {carriersLoading ? 'Loading carriers...' : 'Select carrier...'}
                    </option>
                    {carriers.map((c) => (
                      <option key={c.id} value={c.id}>{c.display_name || c.name || c.carrier || c.id}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Assigned Agent */}
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">
                  Assigned Agent <span className="text-[var(--error)]">*</span>
                </label>
                <select
                  value={form.assigned_to}
                  onChange={(e) => updateField('assigned_to', e.target.value)}
                  className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--portal)]"
                >
                  <option value="">{advisors.length ? 'Select advisor...' : 'Loading advisors...'}</option>
                  {advisors.map((a) => (
                    <option key={a.email} value={a.email}>
                      {a.first_name} {a.last_name}
                      {a.is_rr && a.is_iar ? ' (RR + IAR)' : a.is_rr ? ' (RR)' : ' (IAR)'}
                    </option>
                  ))}
                </select>
              </div>

              {/* Pipeline-specific custom fields (RON-OPP-FIELDS-001 PR B) */}
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">Pipeline Details</label>
                <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)]/40 p-3">
                  <PipelineFieldsForm
                    pipelineKey={pipelineKey}
                    mode="create"
                    values={pipelineCustomFields}
                    onChange={setPipelineCustomFields}
                    onValidityChange={setPipelineFieldsValid}
                    disabled={creating}
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">Notes</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => updateField('notes', e.target.value)}
                  placeholder="Account details, special instructions, etc."
                  rows={3}
                  className="w-full resize-none rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none transition-colors focus:border-[var(--portal)]"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex shrink-0 items-center justify-end gap-3 border-t border-[var(--border-subtle)] px-6 py-4">
              <button
                onClick={() => setShowModal(false)}
                className="rounded-lg border border-[var(--border-subtle)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={creating || !pipelineFieldsValid}
                className="flex items-center gap-1.5 rounded-lg px-5 py-2 text-sm font-semibold text-white transition-all hover:brightness-110 disabled:opacity-50"
                style={{ background: 'var(--portal)' }}
              >
                {creating ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Creating...
                  </>
                ) : (
                  <>
                    <span className="material-icons-outlined" style={{ fontSize: '16px' }}>check</span>
                    Create Case
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppWrapper>
  )
}
