'use client'

import { useState, useCallback, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { PipelineKanban, AppWrapper } from '@tomachina/ui'
import { useAuth } from '@tomachina/auth'
import { fetchWithAuth } from '@tomachina/ui/src/modules/fetchWithAuth'
import { toPipelineKey } from '../pipeline-keys'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api'

const ACCOUNT_TYPE_CATEGORIES = [
  'Annuity',
  'Life',
  'Medicare',
  'Investments',
  'Banking',
] as const

type AccountTypeCategory = typeof ACCOUNT_TYPE_CATEGORIES[number]

interface Carrier {
  id: string
  carrier_name: string
}

interface NewCaseForm {
  entity_name: string
  account_type_category: AccountTypeCategory | ''
  carrier_id: string
  carrier_name: string
  assigned_to: string
  notes: string
}

const EMPTY_FORM: NewCaseForm = {
  entity_name: '',
  account_type_category: '',
  carrier_id: '',
  carrier_name: '',
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

  // Carrier data fetched once on mount
  const [carriers, setCarriers] = useState<Carrier[]>([])
  const [carriersLoading, setCarriersLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function loadCarriers() {
      setCarriersLoading(true)
      try {
        const res = await fetchWithAuth(`${API_BASE}/carriers`)
        const json = await res.json() as { success: boolean; data?: Carrier[] }
        if (!cancelled && json.success && json.data) {
          const sorted = [...json.data].sort((a, b) =>
            a.carrier_name.localeCompare(b.carrier_name)
          )
          setCarriers(sorted)
        }
      } catch {
        // Carrier load failure is non-fatal — user can still type carrier name
      } finally {
        if (!cancelled) setCarriersLoading(false)
      }
    }
    loadCarriers()
    return () => { cancelled = true }
  }, [])

  const handleCreate = useCallback(async () => {
    if (!form.entity_name.trim() || !form.assigned_to.trim()) {
      setError('Client name and assigned advisor are required.')
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

    setCreating(true)
    setError(null)

    try {
      const entityId = form.entity_name.toLowerCase().replace(/[^a-z0-9]+/g, '-')

      const res = await fetchWithAuth(`${API_BASE}/flow/instances`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pipeline_key: pipelineKey,
          entity_id: entityId,
          entity_name: form.entity_name.trim(),
          entity_type: 'CLIENT',
          assigned_to: form.assigned_to.trim(),
          entity_data: {
            account_type_category: form.account_type_category,
            carrier_id: form.carrier_id,
            carrier_name: form.carrier_name,
            notes: form.notes || '',
            source: 'Manual — ProDashX',
          },
          custom_fields: {
            carrier: form.carrier_name,
            account_type_category: form.account_type_category,
          },
        }),
      })

      const json = await res.json() as { success: boolean; data?: { instance_id: string; tasks_generated: number }; error?: string }

      if (!json.success) {
        setError(json.error || 'Failed to create case.')
        return
      }

      // Success — close modal, refresh board
      setShowModal(false)
      setForm({ ...EMPTY_FORM })
      setRefreshKey((k) => k + 1)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error')
    } finally {
      setCreating(false)
    }
  }, [form, pipelineKey])

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
          <div className="w-full max-w-lg rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-6 py-4">
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
            <div className="space-y-4 px-6 py-5">
              {error && (
                <div className="flex items-center gap-2 rounded-lg bg-[rgba(239,68,68,0.1)] px-3 py-2 text-sm text-[var(--error)]">
                  <span className="material-icons-outlined" style={{ fontSize: '16px' }}>warning</span>
                  {error}
                </div>
              )}

              {/* Client Name */}
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">
                  Client Name <span className="text-[var(--error)]">*</span>
                </label>
                <input
                  type="text"
                  value={form.entity_name}
                  onChange={(e) => updateField('entity_name', e.target.value)}
                  placeholder="Last, First (e.g., Smith, John & Jane)"
                  className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none transition-colors focus:border-[var(--portal)]"
                  autoFocus
                />
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
                        carrier_name: selected?.carrier_name || '',
                      }))
                    }}
                    className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--portal)]"
                    disabled={carriersLoading}
                  >
                    <option value="">
                      {carriersLoading ? 'Loading carriers...' : 'Select carrier...'}
                    </option>
                    {carriers.map((c) => (
                      <option key={c.id} value={c.id}>{c.carrier_name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Assigned Advisor */}
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">
                  Assigned Advisor <span className="text-[var(--error)]">*</span>
                </label>
                <select
                  value={form.assigned_to}
                  onChange={(e) => updateField('assigned_to', e.target.value)}
                  className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--portal)]"
                >
                  <option value="">Select advisor...</option>
                  <option value="angelique@retireprotected.com">Angelique</option>
                  <option value="nikki@retireprotected.com">Nikki</option>
                  <option value="josh@retireprotected.com">Josh</option>
                  <option value="vince@retireprotected.com">Vince</option>
                </select>
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
            <div className="flex items-center justify-end gap-3 border-t border-[var(--border-subtle)] px-6 py-4">
              <button
                onClick={() => setShowModal(false)}
                className="rounded-lg border border-[var(--border-subtle)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={creating}
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
