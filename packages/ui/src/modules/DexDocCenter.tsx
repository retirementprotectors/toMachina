'use client'

import { useState, useMemo, useCallback } from 'react'
import { query, collection, where, type Query, type DocumentData } from 'firebase/firestore'
import { useCollection } from '@tomachina/db'
import { getDb } from '@tomachina/db/src/firestore'
import { dex } from '@tomachina/core'
import { fetchValidated } from './fetchValidated'

// ============================================================================
// Types
// ============================================================================

interface DexDocCenterProps {
  portal: string
}

interface DexForm {
  _id: string
  form_id?: string
  form_name?: string
  source?: string
  category?: string
  status?: string
  document_type?: string
  notes?: string
  [key: string]: unknown
}

interface DexKit {
  _id: string
  kit_id?: string
  client_id?: string
  client_name?: string
  product_type?: string
  registration_type?: string
  action?: string
  form_count?: number
  status?: string
  created_by?: string
  created_at?: string
  [key: string]: unknown
}

interface DexMapping {
  _id: string
  mapping_id?: string
  form_id?: string
  field_name?: string
  field_type?: string
  data_source?: string
  required?: boolean
  input_type?: string
  label?: string
  help_text?: string
  options?: string[] | string
  validation?: Record<string, unknown> | string
  default_value?: string
  notes?: string
  [key: string]: unknown
}

interface ClientRecord {
  _id: string
  first_name?: string
  last_name?: string
  email?: string
  phone?: string
  client_id?: string
  [key: string]: unknown
}

interface DexPackage {
  _id: string
  package_id?: string
  client_id?: string
  client_name?: string
  client_email?: string
  client_phone?: string
  kit_id?: string
  kit_name?: string
  form_ids?: string[]
  status?: string
  delivery_method?: string
  created_at?: string
  sent_at?: string
  viewed_at?: string
  signed_at?: string
  submitted_at?: string
  completed_at?: string
  docusign_envelope_id?: string
  pdf_storage_ref?: string
  notes?: string
  created_by?: string
  [key: string]: unknown
}

type Tab = 'pipeline' | 'forms' | 'kits' | 'tracker'

// ============================================================================
// Constants
// ============================================================================

const FORM_CATEGORIES = ['All', 'Firm:Client', 'Firm:Account', 'Product:GI', 'Product:Schwab', 'Product:RBC', 'Product:Carrier', 'Disclosure', 'Supporting'] as const
const FORM_STATUSES = ['All', 'ACTIVE', 'TBD', 'N/A'] as const
// Pull all 13 platforms, 7 reg types, 4 actions from core config (single source of truth)
const KIT_PLATFORMS = dex.PLATFORMS
const KIT_REG_TYPES = dex.REGISTRATION_TYPES
const KIT_ACTIONS = dex.ACCOUNT_ACTIONS

const PIPELINE_STAGES_V2 = [
  { key: 'DRAFT', label: 'Draft', icon: 'edit_note', description: 'Kit assembled, not yet filled' },
  { key: 'READY', label: 'Ready', icon: 'picture_as_pdf', description: 'PDF generated, ready to send' },
  { key: 'SENT', label: 'Sent', icon: 'send', description: 'Sent for DocuSign signature' },
  { key: 'SIGNED', label: 'Signed', icon: 'draw', description: 'Client signed documents' },
  { key: 'SUBMITTED', label: 'Submitted', icon: 'upload_file', description: 'Submitted to carrier/custodian' },
  { key: 'COMPLETE', label: 'Complete', icon: 'check_circle', description: 'Fully processed' },
] as const

const DELIVERY_METHODS = ['EMAIL', 'SMS', 'BOTH'] as const

// ============================================================================
// Helpers
// ============================================================================

function formatDate(d?: string | null): string {
  if (!d) return '-'
  try { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) } catch { return d }
}

function formatDateTime(d?: string | null): string {
  if (!d) return '-'
  try { return new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) } catch { return d }
}

function statusStyle(status?: string): { background: string; color: string } {
  const s = (status || '').toUpperCase()
  if (s === 'ACTIVE' || s === 'GENERATED' || s === 'READY' || s === 'COMPLETE' || s === 'SIGNED') return { background: 'var(--success-glow, rgba(34,197,94,0.15))', color: 'var(--success, #22c55e)' }
  if (s === 'TBD' || s === 'NEEDS DATA' || s === 'PENDING' || s === 'DRAFT') return { background: 'var(--warning-glow, rgba(245,158,11,0.15))', color: 'var(--warning, #f59e0b)' }
  if (s === 'SENT' || s === 'VIEWED' || s === 'SUBMITTED') return { background: 'var(--info-glow, rgba(59,130,246,0.15))', color: 'var(--info, #3b82f6)' }
  if (s === 'VOIDED' || s === 'DECLINED') return { background: 'var(--error-glow, rgba(239,68,68,0.15))', color: 'var(--error, #ef4444)' }
  if (s === 'N/A' || s === 'ARCHIVED') return { background: 'var(--muted-glow, rgba(156,163,175,0.15))', color: 'var(--text-muted)' }
  return { background: 'var(--bg-surface)', color: 'var(--text-muted)' }
}

function inputTypeBadge(inputType?: string): { background: string; color: string; label: string } {
  const t = (inputType || 'text').toLowerCase()
  if (t === 'dropdown' || t === 'radio' || t === 'checkboxes') return { background: 'var(--accent-glow, rgba(168,85,247,0.15))', color: 'var(--accent, #a855f7)', label: t }
  if (t === 'date') return { background: 'var(--success-glow, rgba(34,197,94,0.15))', color: 'var(--success, #22c55e)', label: 'date' }
  if (t === 'signature') return { background: 'var(--error-glow, rgba(239,68,68,0.15))', color: 'var(--error, #ef4444)', label: 'signature' }
  if (t === 'ssn' || t === 'phone' || t === 'email') return { background: 'var(--warning-glow, rgba(245,158,11,0.15))', color: 'var(--warning, #f59e0b)', label: t }
  if (t === 'currency' || t === 'percent') return { background: 'var(--info-glow, rgba(14,165,233,0.15))', color: 'var(--info, #0ea5e9)', label: t }
  if (t === 'checkbox') return { background: 'var(--accent-glow, rgba(168,85,247,0.15))', color: 'var(--accent, #a855f7)', label: 'checkbox' }
  if (t === 'textarea') return { background: 'var(--info-glow, rgba(59,130,246,0.15))', color: 'var(--info, #3b82f6)', label: 'textarea' }
  return { background: 'var(--info-glow, rgba(59,130,246,0.15))', color: 'var(--info, #3b82f6)', label: t || 'text' }
}

function parseOptions(options?: string[] | string): string[] {
  if (!options) return []
  if (Array.isArray(options)) return options
  try { const parsed = JSON.parse(options); return Array.isArray(parsed) ? parsed : [] } catch { return options.split(',').map(s => s.trim()).filter(Boolean) }
}

function parseValidation(validation?: Record<string, unknown> | string): Record<string, unknown> {
  if (!validation) return {}
  if (typeof validation === 'object') return validation
  try { return JSON.parse(validation) } catch { return {} }
}

// ============================================================================
// Main Component
// ============================================================================

export function DexDocCenter({ portal }: DexDocCenterProps) {
  const [activeTab, setActiveTab] = useState<Tab>('forms')

  const formsQ = useMemo<Query<DocumentData>>(() => query(collection(getDb(), 'dex_forms')), [])
  const kitsQ = useMemo<Query<DocumentData>>(() => query(collection(getDb(), 'dex_kits')), [])
  const packagesQ = useMemo<Query<DocumentData>>(() => query(collection(getDb(), 'dex_packages')), [])

  const { data: forms, loading: formsLoading } = useCollection<DexForm>(formsQ, 'dex-forms')
  const { data: kits, loading: kitsLoading } = useCollection<DexKit>(kitsQ, 'dex-kits')
  const { data: packages, loading: packagesLoading } = useCollection<DexPackage>(packagesQ, 'dex-packages')

  const loading = formsLoading || kitsLoading || packagesLoading

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'pipeline', label: 'Pipeline', icon: 'route' },
    { key: 'forms', label: 'Form Library', icon: 'library_books' },
    { key: 'kits', label: 'Kit Builder', icon: 'inventory_2' },
    { key: 'tracker', label: 'Tracker', icon: 'track_changes' },
  ]

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">DEX — Document Efficiency Xelerator</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">Automated form kits, compliance tracking, and document workflows</p>
        <div className="mt-8 flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--portal)] border-t-transparent" />
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">DEX — Document Efficiency Xelerator</h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">Automated form kits, compliance tracking, and document workflows</p>
      </div>

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-4">
        <StatCard icon="library_books" label="Forms" value={forms.length} />
        <StatCard icon="check_circle" label="Active" value={forms.filter(f => f.status === 'ACTIVE').length} />
        <StatCard icon="inventory_2" label="Packages" value={packages.length} />
        <StatCard icon="pending" label="In Flight" value={packages.filter(p => p.status === 'SENT' || p.status === 'VIEWED').length} accent />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto border-b border-[var(--border-subtle)]">
        {tabs.map((tab) => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className="flex items-center gap-1.5 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors"
            style={{ borderColor: activeTab === tab.key ? 'var(--portal)' : 'transparent', color: activeTab === tab.key ? 'var(--portal)' : 'var(--text-muted)' }}>
            <span className="material-icons-outlined" style={{ fontSize: '18px' }}>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'pipeline' && <PipelineTab packages={packages} />}
      {activeTab === 'forms' && <FormLibraryTab forms={forms} />}
      {activeTab === 'kits' && <KitBuilderTab />}
      {activeTab === 'tracker' && <TrackerTab packages={packages} />}
    </div>
  )
}

function StatCard({ icon, label, value, accent }: { icon: string; label: string; value: number; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4">
      <div className="flex items-center gap-2">
        <span className="material-icons-outlined" style={{ fontSize: '18px', color: 'var(--portal)' }}>{icon}</span>
        <span className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">{label}</span>
      </div>
      <p className="mt-1 text-2xl font-bold" style={{ color: accent ? 'var(--portal)' : 'var(--text-primary)' }}>{value.toLocaleString()}</p>
    </div>
  )
}

// ============================================================================
// Pipeline Tab — 6-stage pipeline from dex_packages
// ============================================================================

function PipelineTab({ packages }: { packages: DexPackage[] }) {
  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    PIPELINE_STAGES_V2.forEach(s => { counts[s.key] = 0 })
    packages.forEach(p => {
      const status = (p.status || '').toUpperCase()
      if (counts.hasOwnProperty(status)) counts[status]++
    })
    return counts
  }, [packages])

  const voidedCount = packages.filter(p => p.status === 'VOIDED' || p.status === 'DECLINED').length

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">Document Pipeline</h3>
        <p className="mt-0.5 text-xs text-[var(--text-muted)]">Track packages from draft through completion ({packages.length} total)</p>

        <div className="mt-6 flex items-start gap-1">
          {PIPELINE_STAGES_V2.map((stage, i) => (
            <div key={stage.key} className="flex flex-1 items-center">
              <div className="flex flex-1 flex-col items-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3 text-center">
                <span className="flex h-10 w-10 items-center justify-center rounded-full" style={{ background: 'var(--portal-glow)' }}>
                  <span className="material-icons-outlined" style={{ fontSize: '20px', color: 'var(--portal)' }}>{stage.icon}</span>
                </span>
                <p className="mt-1.5 text-xs font-semibold text-[var(--text-primary)]">{stage.label}</p>
                <p className="mt-0.5 text-[10px] text-[var(--text-muted)]">{stage.description}</p>
                <div className="mt-2 rounded-full px-3 py-0.5 text-sm font-bold" style={{ background: 'var(--portal-glow)', color: 'var(--portal)' }}>
                  {stageCounts[stage.key] || 0}
                </div>
              </div>
              {i < PIPELINE_STAGES_V2.length - 1 && (
                <span className="mx-0.5 shrink-0 material-icons-outlined text-[var(--text-muted)]" style={{ fontSize: '18px' }}>arrow_forward</span>
              )}
            </div>
          ))}
        </div>

        {voidedCount > 0 && (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-[var(--error-glow,rgba(239,68,68,0.08))] px-3 py-2 text-xs">
            <span className="material-icons-outlined" style={{ fontSize: '14px', color: 'var(--error, #ef4444)' }}>cancel</span>
            <span className="text-[var(--text-secondary)]">{voidedCount} voided/declined</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================================================
// Form Library Tab — reads from dex_forms + dex_field_mappings
// Builder 71 owns this tab — DO NOT MODIFY
// ============================================================================

function FormLibraryTab({ forms }: { forms: DexForm[] }) {
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('All')
  const [statusFilter, setStatusFilter] = useState('All')
  const [selectedForm, setSelectedForm] = useState<DexForm | null>(null)

  const mappingsQ = useMemo<Query<DocumentData> | null>(() => {
    if (!selectedForm?.form_id) return null
    return query(collection(getDb(), 'dex_field_mappings'), where('form_id', '==', selectedForm.form_id))
  }, [selectedForm?.form_id])
  const { data: mappings, loading: mappingsLoading } = useCollection<DexMapping>(mappingsQ, `dex-mappings-${selectedForm?.form_id || 'none'}`)

  const filtered = useMemo(() => {
    let result = forms
    if (search) { const l = search.toLowerCase(); result = result.filter(f => (f.form_name || '').toLowerCase().includes(l) || (f.form_id || '').toLowerCase().includes(l)) }
    if (categoryFilter !== 'All') result = result.filter(f => f.category === categoryFilter)
    if (statusFilter !== 'All') result = result.filter(f => f.status === statusFilter)
    return result
  }, [forms, search, categoryFilter, statusFilter])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1">
          <span className="material-icons-outlined absolute left-2.5 top-1/2 -translate-y-1/2" style={{ fontSize: '16px', color: 'var(--text-muted)' }}>search</span>
          <input type="text" placeholder="Search forms..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] py-1.5 pl-8 pr-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--portal)] focus:outline-none" />
        </div>
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}
          className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-1.5 text-sm text-[var(--text-primary)] focus:outline-none">
          {FORM_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-1.5 text-sm text-[var(--text-primary)] focus:outline-none">
          {FORM_STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>
      </div>
      <p className="text-xs text-[var(--text-muted)]">Showing {filtered.length} of {forms.length} forms</p>

      <div className="flex gap-4">
        <div className="flex-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center py-12">
              <span className="material-icons-outlined text-4xl text-[var(--text-muted)]">library_books</span>
              <p className="mt-3 text-sm text-[var(--text-muted)]">No forms found. Run the migration script to load form data.</p>
            </div>
          ) : (
            <div className="max-h-[500px] space-y-1.5 overflow-y-auto">
              {filtered.map((form) => (
                <button key={form._id} onClick={() => setSelectedForm(form)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${selectedForm?._id === form._id ? 'bg-[var(--portal-glow)]' : 'hover:bg-[var(--bg-surface)]'}`}>
                  <span className="material-icons-outlined" style={{ fontSize: '18px', color: 'var(--portal)' }}>description</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[var(--text-primary)]">{form.form_name}</p>
                    <p className="text-[10px] text-[var(--text-muted)]">{form.form_id} · {form.source} · {form.category}</p>
                  </div>
                  <span className="rounded-full px-2 py-0.5 text-[9px] font-medium" style={statusStyle(form.status)}>{form.status}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        {selectedForm && (
          <div className="w-80 shrink-0 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4">
            <h4 className="text-sm font-semibold text-[var(--text-primary)]">{selectedForm.form_name}</h4>
            <div className="mt-3 space-y-2 text-xs">
              <div className="flex justify-between"><span className="text-[var(--text-muted)]">ID</span><span className="text-[var(--text-primary)]">{selectedForm.form_id}</span></div>
              <div className="flex justify-between"><span className="text-[var(--text-muted)]">Source</span><span className="text-[var(--text-primary)]">{selectedForm.source}</span></div>
              <div className="flex justify-between"><span className="text-[var(--text-muted)]">Category</span><span className="text-[var(--text-primary)]">{selectedForm.category}</span></div>
              <div className="flex justify-between"><span className="text-[var(--text-muted)]">Status</span><span className="rounded-full px-2 py-0.5 text-[9px] font-medium" style={statusStyle(selectedForm.status)}>{selectedForm.status}</span></div>
              {selectedForm.notes && <p className="text-[var(--text-muted)] italic">{selectedForm.notes}</p>}
            </div>
            <div className="mt-4 border-t border-[var(--border-subtle)] pt-3">
              <h5 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Field Mappings {!mappingsLoading && `(${mappings.length})`}</h5>
              {mappingsLoading ? (
                <div className="mt-2 flex justify-center py-4"><div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--portal)] border-t-transparent" /></div>
              ) : mappings.length === 0 ? (
                <p className="mt-2 text-xs text-[var(--text-muted)]">No field mappings for this form.</p>
              ) : (
                <div className="mt-2 max-h-[350px] space-y-1.5 overflow-y-auto">
                  {mappings.map((m) => {
                    const badge = inputTypeBadge(m.input_type || m.field_type)
                    const opts = parseOptions(m.options)
                    const val = parseValidation(m.validation)
                    return (
                      <div key={m._id} className="rounded-lg bg-[var(--bg-surface)] px-2.5 py-2">
                        <div className="flex items-start gap-1.5">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <p className="truncate text-xs font-medium text-[var(--text-primary)]">{m.label || m.field_name}</p>
                              {m.required && (
                                <span className="shrink-0 rounded px-1 py-px text-[8px] font-bold uppercase" style={{ background: 'var(--error-glow, rgba(239,68,68,0.15))', color: 'var(--error, #ef4444)' }}>req</span>
                              )}
                            </div>
                            <p className="mt-0.5 text-[10px] text-[var(--text-muted)]">{m.data_source}</p>
                          </div>
                          <span className="shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-medium" style={{ background: badge.background, color: badge.color }}>{badge.label}</span>
                        </div>
                        {m.help_text && (
                          <p className="mt-1 text-[10px] italic text-[var(--text-muted)]">{m.help_text}</p>
                        )}
                        {opts.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-0.5">
                            {opts.slice(0, 6).map((opt) => (
                              <span key={opt} className="rounded bg-[var(--bg-card)] px-1.5 py-px text-[9px] text-[var(--text-secondary)]">{opt}</span>
                            ))}
                            {opts.length > 6 && <span className="text-[9px] text-[var(--text-muted)]">+{opts.length - 6} more</span>}
                          </div>
                        )}
                        {(val.min != null || val.max != null || val.minLength != null || val.maxLength != null) && (
                          <div className="mt-1 flex gap-1.5 text-[9px] text-[var(--text-muted)]">
                            {val.min != null && <span>min: {String(val.min)}</span>}
                            {val.max != null && <span>max: {String(val.max)}</span>}
                            {val.minLength != null && <span>minLen: {String(val.minLength)}</span>}
                            {val.maxLength != null && <span>maxLen: {String(val.maxLength)}</span>}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================================================
// KitPreviewStep — Step 4 of the Kit Builder wizard
// ============================================================================

function KitPreviewStep({
  buildResult,
  clientId,
  onBack,
  onContinue,
  stepError,
}: {
  buildResult: Record<string, unknown>
  clientId: string
  onBack: () => void
  onContinue: () => void
  stepError: string | null
}) {
  const layers = buildResult.layers as Record<string, unknown[]> | undefined
  const kitId = buildResult.kit_id ? String(buildResult.kit_id) : ''
  const isPreview = Boolean(buildResult.preview)

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-[var(--text-primary)]">Step 4: Kit Preview</h3>
      <p className="text-xs text-[var(--text-muted)]">
        {isPreview ? 'Preview mode — connect API for live results' : `Kit ${kitId} assembled with ${String(buildResult.form_count)} forms`}
      </p>

      <KitLayersPreview layers={layers} />

      {kitId && !isPreview && (
        <FillKitButton kitId={kitId} clientId={clientId} onFilled={() => {}} />
      )}

      {stepError && (
        <div className="flex items-center gap-2 rounded-lg bg-[rgba(239,68,68,0.08)] px-3 py-2">
          <span className="material-icons-outlined" style={{ fontSize: '16px', color: '#ef4444' }}>error</span>
          <span className="text-xs text-[#ef4444]">{stepError}</span>
        </div>
      )}

      <div className="flex gap-2">
        <button onClick={onBack} className="rounded px-3 py-1.5 text-xs text-[var(--text-muted)]">Back</button>
        <button onClick={onContinue} className="rounded px-4 py-1.5 text-xs font-medium text-white" style={{ background: 'var(--portal)' }}>
          Continue to Generate
        </button>
      </div>
    </div>
  )
}

// ============================================================================
// KitLayersPreview — renders layered form list from build result
// ============================================================================

function KitLayersPreview({ layers }: { layers?: Record<string, unknown[]> }) {
  if (!layers || typeof layers !== 'object') {
    return (
      <div className="rounded-lg bg-[var(--bg-surface)] p-4 text-center text-xs text-[var(--text-muted)]">
        Form layers will appear here when the API is connected.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {Object.entries(layers).map(([layer, layerForms]) => {
        const forms = layerForms as Array<{ form_id: string; form_name: string; field_count?: number; fill_status?: string }>
        return (
          <div key={layer} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">{layer.replace(/_/g, ' ')}</p>
              <span className="text-[10px] text-[var(--text-muted)]">{forms.length} forms</span>
            </div>
            {forms.length === 0 ? (
              <p className="mt-1 text-xs italic text-[var(--text-muted)]">None required</p>
            ) : (
              <div className="mt-2 space-y-1">
                {forms.map((f) => (
                  <div key={f.form_id} className="flex items-center justify-between rounded bg-[var(--bg-card)] px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-[var(--text-primary)]">{f.form_name}</p>
                      <p className="text-[10px] text-[var(--text-muted)]">{f.form_id}{f.field_count != null ? ` · ${f.field_count} fields` : ''}</p>
                    </div>
                    {f.fill_status && (
                      <span className="ml-2 shrink-0 rounded-full px-2 py-0.5 text-[9px] font-medium" style={statusStyle(f.fill_status)}>
                        {f.fill_status}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ============================================================================
// FillKitButton — auto-fill kit fields from client data
// ============================================================================

function FillKitButton({ kitId, clientId, onFilled }: { kitId: string; clientId: string; onFilled: () => void }) {
  const [filling, setFilling] = useState(false)
  const [fillResult, setFillResult] = useState<{ filled: number; total: number } | null>(null)
  const [fillError, setFillError] = useState<string | null>(null)

  const handleFill = async () => {
    setFilling(true)
    setFillError(null)
    try {
      const result = await fetchValidated<Record<string, unknown>>(`/api/dex/kits/${kitId}/fill`, {
        method: 'POST',
        body: JSON.stringify({ client_id: clientId }),
      })
      if (result.success && result.data) {
        setFillResult({ filled: Number(result.data.filled_count || 0), total: Number(result.data.total_fields || 0) })
        onFilled()
      } else {
        setFillError(result.error || 'Auto-fill failed')
      }
    } catch {
      setFillError('Network error during auto-fill')
    } finally {
      setFilling(false)
    }
  }

  if (fillResult) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-[rgba(34,197,94,0.08)] px-3 py-2">
        <span className="material-icons-outlined" style={{ fontSize: '16px', color: '#22c55e' }}>check_circle</span>
        <span className="text-xs text-[#22c55e]">
          Auto-filled {fillResult.filled} of {fillResult.total} fields from client data
        </span>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <button
        onClick={handleFill}
        disabled={filling}
        className="flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-2 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-card)] disabled:opacity-50"
      >
        {filling ? (
          <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[var(--portal)] border-t-transparent" />
        ) : (
          <span className="material-icons-outlined" style={{ fontSize: '16px' }}>auto_fix_high</span>
        )}
        {filling ? 'Auto-filling...' : 'Auto-fill from Client Data'}
      </button>
      {fillError && (
        <p className="text-xs text-[#ef4444]">{fillError}</p>
      )}
    </div>
  )
}

// ============================================================================
// Kit Builder Tab — 5-step wizard with PDF generation + DocuSign (step 5)
// ============================================================================

function KitBuilderTab() {
  const [step, setStep] = useState(1)
  const [clientSearch, setClientSearch] = useState('')
  const [selectedClient, setSelectedClient] = useState<ClientRecord | null>(null)
  const [searchResults, setSearchResults] = useState<ClientRecord[]>([])
  const [searching, setSearching] = useState(false)
  const [platform, setPlatform] = useState('')
  const [regType, setRegType] = useState('')
  const [action, setAction] = useState('')
  const [buildResult, setBuildResult] = useState<Record<string, unknown> | null>(null)
  const [building, setBuilding] = useState(false)

  // Step 4 state: field input for USER INPUT fields
  const [userInputFields, setUserInputFields] = useState<Array<{ mapping_id: string; field_name: string; label: string; input_type: string; help_text: string; required: boolean; options: string[]; value: string }>>([])
  const [userInputValues, setUserInputValues] = useState<Record<string, string>>({})

  // Step 5 state: PDF generation + DocuSign
  const [packageId, setPackageId] = useState<string | null>(null)
  const [pdfGenerated, setPdfGenerated] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [deliveryMethod, setDeliveryMethod] = useState<string>('EMAIL')
  const [pdfResult, setPdfResult] = useState<Record<string, unknown> | null>(null)
  const [docusignResult, setDocusignResult] = useState<Record<string, unknown> | null>(null)
  const [stepError, setStepError] = useState<string | null>(null)

  // Client search with debounced API call instead of loading entire collection
  const handleClientSearch = useCallback(async (searchValue: string) => {
    setClientSearch(searchValue)
    setSelectedClient(null)
    if (searchValue.length < 2) { setSearchResults([]); return }

    setSearching(true)
    try {
      const res = await fetch(`/api/clients?q=${encodeURIComponent(searchValue)}&limit=10`)
      const data = await res.json()
      if (data.success && Array.isArray(data.data)) {
        setSearchResults(data.data.map((c: Record<string, unknown>) => ({ _id: String(c.id || c._id || ''), ...c } as ClientRecord)))
      }
    } catch {
      // Fallback: use Firestore query directly for first/last name prefix match
      const { getDocs, limit: fsLimit } = await import('firebase/firestore')
      const titleCase = searchValue.charAt(0).toUpperCase() + searchValue.slice(1).toLowerCase()
      const lastQ = query(collection(getDb(), 'clients'), where('last_name', '>=', titleCase), where('last_name', '<=', titleCase + '\uf8ff'), fsLimit(10))
      const firstQ = query(collection(getDb(), 'clients'), where('first_name', '>=', titleCase), where('first_name', '<=', titleCase + '\uf8ff'), fsLimit(10))
      const [lastSnap, firstSnap] = await Promise.all([getDocs(lastQ), getDocs(firstQ)])
      const results = new Map<string, ClientRecord>()
      lastSnap.docs.forEach(d => results.set(d.id, { _id: d.id, ...d.data() } as ClientRecord))
      firstSnap.docs.forEach(d => results.set(d.id, { _id: d.id, ...d.data() } as ClientRecord))
      setSearchResults(Array.from(results.values()).slice(0, 10))
    } finally {
      setSearching(false)
    }
  }, [])

  const handleBuild = useCallback(async () => {
    if (!selectedClient || !platform || !regType || !action) return
    setBuilding(true)
    setStepError(null)
    try {
      const result = await fetchValidated<Record<string, unknown>>('/api/dex/kits/build', {
        method: 'POST',
        body: JSON.stringify({ client_id: selectedClient._id, product_type: platform, registration_type: regType, action }),
      })
      if (result.success && result.data) {
        setBuildResult(result.data)
        // Fetch field mappings for USER INPUT fields (Step 4 field input)
        const formIds = (result.data as Record<string, unknown>).form_ids as string[] || []
        if (formIds.length > 0) {
          try {
            const mappingsResult = await fetchValidated<Array<Record<string, unknown>>>(`/api/dex/mappings?form_ids=${formIds.join(',')}&status=USER%20INPUT`)
            if (mappingsResult.success && Array.isArray(mappingsResult.data) && mappingsResult.data.length > 0) {
              const fields = mappingsResult.data.map(m => ({
                mapping_id: String(m.mapping_id || ''),
                field_name: String(m.field_name || ''),
                label: String(m.label || m.field_name || ''),
                input_type: String(m.input_type || 'text'),
                help_text: String(m.help_text || ''),
                required: Boolean(m.required),
                options: parseOptions(m.options as string[] | string),
                value: String(m.default_value || ''),
              }))
              setUserInputFields(fields)
              const initialValues: Record<string, string> = {}
              fields.forEach(f => { initialValues[f.field_name] = f.value })
              setUserInputValues(initialValues)
            }
          } catch { /* No user input fields — skip field input */ }
        }
        setStep(4)
      } else {
        setStepError(result.error || 'Build failed')
      }
    } catch {
      setBuildResult({ preview: true, client_name: `${selectedClient.first_name} ${selectedClient.last_name}`, platform, regType, action })
      setStep(4)
    } finally {
      setBuilding(false)
    }
  }, [selectedClient, platform, regType, action])

  // Step 5: Create package + generate PDF
  const handleGeneratePdf = useCallback(async () => {
    if (!buildResult || !selectedClient) return
    setGenerating(true)
    setStepError(null)
    try {
      // Step A: Create package from kit
      const pkgResult = await fetchValidated<Record<string, unknown>>('/api/dex-pipeline/packages', {
        method: 'POST',
        body: JSON.stringify({
          kit_id: buildResult.kit_id,
          client_id: selectedClient._id,
          client_name: `${selectedClient.first_name || ''} ${selectedClient.last_name || ''}`.trim(),
          client_email: selectedClient.email || '',
          client_phone: selectedClient.phone || '',
          kit_name: `${platform} - ${regType} - ${action}`,
          form_ids: buildResult.form_ids || (buildResult.forms as Array<{ form_id: string }>)?.map(f => f.form_id) || [],
          delivery_method: deliveryMethod,
        }),
      })
      if (!pkgResult.success || !pkgResult.data) { setStepError(pkgResult.error || 'Failed to create package'); setGenerating(false); return }

      const newPackageId = String((pkgResult.data as Record<string, unknown>).package_id)
      setPackageId(newPackageId)

      // Step B: Generate PDF
      const pdfResult = await fetchValidated<Record<string, unknown>>(`/api/dex-pipeline/packages/${newPackageId}/generate-pdf`, {
        method: 'POST',
        body: JSON.stringify({ input: userInputValues }),
      })
      if (!pdfResult.success || !pdfResult.data) { setStepError(pdfResult.error || 'PDF generation failed'); setGenerating(false); return }

      setPdfResult(pdfResult.data)
      setPdfGenerated(true)
    } catch {
      setStepError('Network error during PDF generation')
    } finally {
      setGenerating(false)
    }
  }, [buildResult, selectedClient, platform, regType, action, deliveryMethod])

  // Step 5: Send for DocuSign signature
  const handleSendDocuSign = useCallback(async () => {
    if (!packageId) return
    setSending(true)
    setStepError(null)
    try {
      const result = await fetchValidated<Record<string, unknown>>(`/api/dex-pipeline/packages/${packageId}/send-docusign`, {
        method: 'POST',
      })
      if (!result.success || !result.data) { setStepError(result.error || 'DocuSign send failed'); setSending(false); return }

      setDocusignResult(result.data)
      setSent(true)
    } catch {
      setStepError('Network error sending to DocuSign')
    } finally {
      setSending(false)
    }
  }, [packageId])

  const reset = () => {
    setStep(1); setBuildResult(null); setSelectedClient(null); setClientSearch('')
    setSearchResults([]); setPlatform(''); setRegType(''); setAction('')
    setPackageId(null); setPdfGenerated(false); setSent(false)
    setPdfResult(null); setDocusignResult(null); setStepError(null)
    setDeliveryMethod('EMAIL'); setUserInputFields([]); setUserInputValues({})
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-1">{[1, 2, 3, 4, 5].map((s) => <div key={s} className={`h-1 flex-1 rounded-full ${step >= s ? 'bg-[var(--portal)]' : 'bg-[var(--bg-surface)]'}`} />)}</div>

      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
        {step === 1 && (
          <div>
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Step 1: Select Client</h3>
            <div className="relative mt-3">
              <input type="text" placeholder="Type client name..." value={clientSearch}
                onChange={(e) => handleClientSearch(e.target.value)}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--portal)] focus:outline-none" />
              {searching && <div className="absolute right-3 top-1/2 -translate-y-1/2"><div className="h-3 w-3 animate-spin rounded-full border border-[var(--portal)] border-t-transparent" /></div>}
              {searchResults.length > 0 && !selectedClient && (
                <div className="absolute z-10 mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-card)] shadow-lg">
                  {searchResults.map((c) => (
                    <button key={c._id} onClick={() => { setSelectedClient(c); setClientSearch(`${c.first_name} ${c.last_name}`); setStep(2) }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-[var(--bg-surface)]">
                      <span className="material-icons-outlined" style={{ fontSize: '16px', color: 'var(--portal)' }}>person</span>
                      <span className="text-[var(--text-primary)]">{c.first_name} {c.last_name}</span>
                      <span className="text-xs text-[var(--text-muted)]">{c.email}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {selectedClient && (
              <div className="mt-3 flex items-center gap-2 rounded-lg bg-[var(--bg-surface)] px-3 py-2">
                <span className="material-icons-outlined" style={{ fontSize: '18px', color: 'var(--success)' }}>check_circle</span>
                <span className="text-sm text-[var(--text-primary)]">{selectedClient.first_name} {selectedClient.last_name}</span>
                <button onClick={() => setStep(2)} className="ml-auto rounded px-2 py-1 text-xs font-medium text-white" style={{ background: 'var(--portal)' }}>Next</button>
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div>
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Step 2: Kit Parameters</h3>
            <p className="mt-0.5 text-xs text-[var(--text-muted)]">For {selectedClient?.first_name} {selectedClient?.last_name}</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <div><label className="text-xs font-medium text-[var(--text-muted)]">Platform</label>
                <select value={platform} onChange={(e) => setPlatform(e.target.value)} className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none"><option value="">Select...</option>{KIT_PLATFORMS.map((p) => <option key={p}>{p}</option>)}</select></div>
              <div><label className="text-xs font-medium text-[var(--text-muted)]">Registration</label>
                <select value={regType} onChange={(e) => setRegType(e.target.value)} className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none"><option value="">Select...</option>{KIT_REG_TYPES.map((r) => <option key={r}>{r}</option>)}</select></div>
              <div><label className="text-xs font-medium text-[var(--text-muted)]">Action</label>
                <select value={action} onChange={(e) => setAction(e.target.value)} className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none"><option value="">Select...</option>{KIT_ACTIONS.map((a) => <option key={a}>{a}</option>)}</select></div>
            </div>
            <div className="mt-4 flex gap-2">
              <button onClick={() => setStep(1)} className="rounded px-3 py-1.5 text-xs text-[var(--text-muted)]">Back</button>
              {platform && regType && action && <button onClick={() => setStep(3)} className="rounded px-3 py-1.5 text-xs font-medium text-white" style={{ background: 'var(--portal)' }}>Next</button>}
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Step 3: Review & Build</h3>
            <div className="mt-3 space-y-2 text-sm">
              {[['Client', `${selectedClient?.first_name} ${selectedClient?.last_name}`], ['Platform', platform], ['Registration', regType], ['Action', action]].map(([k, v]) => (
                <div key={k} className="flex justify-between rounded bg-[var(--bg-surface)] px-3 py-2">
                  <span className="text-[var(--text-muted)]">{k}</span><span className="text-[var(--text-primary)]">{v}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 flex gap-2">
              <button onClick={() => setStep(2)} className="rounded px-3 py-1.5 text-xs text-[var(--text-muted)]">Back</button>
              <button onClick={handleBuild} disabled={building} className="rounded px-4 py-1.5 text-xs font-medium text-white disabled:opacity-50" style={{ background: 'var(--portal)' }}>
                {building ? 'Building...' : 'Build Kit'}
              </button>
            </div>
          </div>
        )}

        {step === 4 && buildResult && (
          <div className="space-y-4">
            {/* Kit Preview (from KitPreviewStep) */}
            <KitPreviewStep
              buildResult={buildResult}
              clientId={selectedClient?._id || ''}
              onBack={() => setStep(3)}
              onContinue={() => {
                if (userInputFields.length > 0) {
                  const missing = userInputFields.filter(f => f.required && !userInputValues[f.field_name])
                  if (missing.length > 0) {
                    setStepError(`Missing required fields: ${missing.map(f => f.label).join(', ')}`)
                    return
                  }
                }
                setStepError(null)
                setStep(5)
              }}
              stepError={stepError}
            />

            {/* User Input Fields (if any) */}
            {userInputFields.length > 0 && (
              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  Required Input ({userInputFields.length} field{userInputFields.length !== 1 ? 's' : ''})
                </h4>
                <div className="mt-3 max-h-[300px] space-y-3 overflow-y-auto">
                  {userInputFields.map((field) => (
                    <div key={field.mapping_id} className="rounded-lg bg-[var(--bg-surface)] p-3">
                      <label className="flex items-center gap-1.5 text-xs font-medium text-[var(--text-primary)]">
                        {field.label}
                        {field.required && <span className="rounded px-1 py-px text-[8px] font-bold uppercase text-[var(--error)]" style={{ background: 'var(--error-glow, rgba(239,68,68,0.15))' }}>req</span>}
                      </label>
                      {field.help_text && <p className="mt-0.5 text-[10px] text-[var(--text-muted)]">{field.help_text}</p>}
                      {field.input_type === 'dropdown' || field.input_type === 'radio' ? (
                        <select
                          value={userInputValues[field.field_name] || ''}
                          onChange={(e) => setUserInputValues(prev => ({ ...prev, [field.field_name]: e.target.value }))}
                          className="mt-1.5 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-1.5 text-sm text-[var(--text-primary)] focus:border-[var(--portal)] focus:outline-none">
                          <option value="">Select...</option>
                          {field.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                      ) : field.input_type === 'textarea' ? (
                        <textarea
                          value={userInputValues[field.field_name] || ''}
                          onChange={(e) => setUserInputValues(prev => ({ ...prev, [field.field_name]: e.target.value }))}
                          rows={3}
                          className="mt-1.5 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-1.5 text-sm text-[var(--text-primary)] focus:border-[var(--portal)] focus:outline-none" />
                      ) : (
                        <input
                          type={field.input_type === 'date' ? 'date' : field.input_type === 'email' ? 'email' : field.input_type === 'phone' ? 'tel' : 'text'}
                          value={userInputValues[field.field_name] || ''}
                          onChange={(e) => setUserInputValues(prev => ({ ...prev, [field.field_name]: e.target.value }))}
                          placeholder={field.input_type === 'ssn' ? 'XXX-XX-XXXX' : field.input_type === 'phone' ? '(555) 555-5555' : ''}
                          className="mt-1.5 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-1.5 text-sm text-[var(--text-primary)] focus:border-[var(--portal)] focus:outline-none" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {step === 5 && buildResult && (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">Step 5: Generate & Send</h3>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                {buildResult.preview ? 'Preview mode — connect API for live generation' : `Kit ${buildResult.kit_id} with ${buildResult.form_count} forms`}
              </p>
            </div>

            {/* Kit summary */}
            {buildResult.layers ? (
              <div className="space-y-2">
                {Object.entries(buildResult.layers as Record<string, unknown[]>).map(([layer, layerForms]) => (
                  <div key={layer} className="rounded-lg bg-[var(--bg-surface)] p-3">
                    <p className="text-xs font-semibold uppercase text-[var(--text-muted)]">{layer.replace(/_/g, ' ')}</p>
                    {(layerForms as Array<{ form_name: string; form_id: string }>).map((f) => (
                      <p key={f.form_id} className="mt-1 text-sm text-[var(--text-primary)]">{f.form_name}</p>
                    ))}
                    {(layerForms as unknown[]).length === 0 && <p className="mt-1 text-xs text-[var(--text-muted)]">None</p>}
                  </div>
                ))}
              </div>
            ) : null}

            {/* Delivery method selector */}
            {!pdfGenerated && (
              <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3">
                <label className="text-xs font-medium text-[var(--text-muted)]">Delivery Method</label>
                <div className="mt-2 flex gap-2">
                  {DELIVERY_METHODS.map((m) => (
                    <button key={m} onClick={() => setDeliveryMethod(m)}
                      className="rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
                      style={{
                        background: deliveryMethod === m ? 'var(--portal)' : 'var(--bg-card)',
                        color: deliveryMethod === m ? 'white' : 'var(--text-secondary)',
                        border: `1px solid ${deliveryMethod === m ? 'var(--portal)' : 'var(--border)'}`,
                      }}>
                      {m}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Error display */}
            {stepError && (
              <div className="flex items-center gap-2 rounded-lg bg-[var(--error-glow,rgba(239,68,68,0.08))] px-3 py-2">
                <span className="material-icons-outlined" style={{ fontSize: '16px', color: 'var(--error, #ef4444)' }}>error</span>
                <span className="text-xs text-[var(--error,#ef4444)]">{stepError}</span>
              </div>
            )}

            {/* Generate PDF button */}
            {!pdfGenerated && (
              <button
                onClick={handleGeneratePdf}
                disabled={generating || !!buildResult.preview}
                className="flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
                style={{ background: 'var(--portal)' }}>
                {generating ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Generating PDF...
                  </>
                ) : (
                  <>
                    <span className="material-icons-outlined" style={{ fontSize: '18px' }}>picture_as_pdf</span>
                    Generate PDF
                  </>
                )}
              </button>
            )}

            {/* PDF generated — show result + Send for Signature */}
            {pdfGenerated && pdfResult && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 rounded-lg bg-[var(--success-glow,rgba(34,197,94,0.08))] px-3 py-2">
                  <span className="material-icons-outlined" style={{ fontSize: '16px', color: 'var(--success, #22c55e)' }}>check_circle</span>
                  <span className="text-xs text-[var(--success,#22c55e)]">
                    PDF generated — {String(pdfResult.pdf_page_count)} pages, {String(pdfResult.filled_count)} fields filled
                    {Number(pdfResult.missing_count || 0) > 0 && `, ${String(pdfResult.missing_count)} missing`}
                  </span>
                </div>

                {!sent && (
                  <button
                    onClick={handleSendDocuSign}
                    disabled={sending}
                    className="flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
                    style={{ background: 'var(--portal)' }}>
                    {sending ? (
                      <>
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        Sending to DocuSign...
                      </>
                    ) : (
                      <>
                        <span className="material-icons-outlined" style={{ fontSize: '18px' }}>send</span>
                        Send for Signature ({deliveryMethod})
                      </>
                    )}
                  </button>
                )}
              </div>
            )}

            {/* DocuSign sent confirmation */}
            {sent && docusignResult && (
              <div className="rounded-lg border border-[var(--success,rgba(34,197,94,0.3))] bg-[var(--success-glow,rgba(34,197,94,0.08))] p-4">
                <div className="flex items-center gap-2">
                  <span className="material-icons-outlined" style={{ fontSize: '20px', color: 'var(--success, #22c55e)' }}>mark_email_read</span>
                  <span className="text-sm font-semibold text-[var(--success,#22c55e)]">Sent for Signature</span>
                </div>
                <div className="mt-2 space-y-1 text-xs text-[var(--text-secondary)]">
                  <p>Envelope ID: {String(docusignResult.envelope_id)}</p>
                  <p>Package ID: {String(docusignResult.package_id || packageId)}</p>
                  <p>Delivery: {String(docusignResult.delivery_method || deliveryMethod)}</p>
                </div>
              </div>
            )}

            <button onClick={reset} className="rounded px-3 py-1.5 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)]">
              Build Another Kit
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================================================
// Tracker Tab — reads from dex_packages with full status timeline
// ============================================================================

function TrackerTab({ packages }: { packages: DexPackage[] }) {
  const [statusFilter, setStatusFilter] = useState('All')
  const [selectedPackage, setSelectedPackage] = useState<DexPackage | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionSuccess, setActionSuccess] = useState<string | null>(null)

  const allStatuses = ['All', 'DRAFT', 'READY', 'SENT', 'VIEWED', 'SIGNED', 'SUBMITTED', 'COMPLETE', 'VOIDED', 'DECLINED'] as const

  const filtered = useMemo(() => {
    let result = [...packages]
    if (statusFilter !== 'All') result = result.filter(p => p.status === statusFilter)
    result.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
    return result
  }, [packages, statusFilter])

  const handleGeneratePdf = useCallback(async (pkgId: string) => {
    setActionLoading('pdf')
    setActionError(null)
    setActionSuccess(null)
    try {
      const result = await fetchValidated<Record<string, unknown>>(`/api/dex-pipeline/packages/${pkgId}/generate-pdf`, {
        method: 'POST',
        body: JSON.stringify({ input: {} }),
      })
      if (result.success && result.data) {
        setActionSuccess(`PDF generated — ${String(result.data.pdf_page_count || '?')} pages, ${String(result.data.filled_count || '?')} fields filled`)
      } else {
        setActionError(result.error || 'PDF generation failed')
      }
    } catch {
      setActionError('Network error during PDF generation')
    } finally {
      setActionLoading(null)
    }
  }, [])

  const handleSendDocuSign = useCallback(async (pkgId: string) => {
    setActionLoading('docusign')
    setActionError(null)
    setActionSuccess(null)
    try {
      const result = await fetchValidated<Record<string, unknown>>(`/api/dex-pipeline/packages/${pkgId}/send-docusign`, {
        method: 'POST',
      })
      if (result.success && result.data) {
        setActionSuccess(`Sent to DocuSign — Envelope: ${String(result.data.envelope_id || 'created')}`)
      } else {
        setActionError(result.error || 'DocuSign send failed')
      }
    } catch {
      setActionError('Network error sending to DocuSign')
    } finally {
      setActionLoading(null)
    }
  }, [])

  const handleStatusUpdate = useCallback(async (pkgId: string, newStatus: string) => {
    setActionLoading('status')
    setActionError(null)
    setActionSuccess(null)
    try {
      const result = await fetchValidated<Record<string, unknown>>(`/api/dex-pipeline/packages/${pkgId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      })
      if (result.success) {
        setActionSuccess(`Status updated to ${newStatus}`)
      } else {
        setActionError(result.error || 'Status update failed')
      }
    } catch {
      setActionError('Network error updating status')
    } finally {
      setActionLoading(null)
    }
  }, [])

  // Determine available next status transitions
  const getNextStatuses = (currentStatus?: string): string[] => {
    const s = (currentStatus || '').toUpperCase()
    if (s === 'DRAFT') return ['READY']
    if (s === 'READY') return ['SENT']
    if (s === 'SENT') return ['VIEWED', 'SIGNED']
    if (s === 'VIEWED') return ['SIGNED']
    if (s === 'SIGNED') return ['SUBMITTED']
    if (s === 'SUBMITTED') return ['COMPLETE']
    return []
  }

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex items-center gap-3">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-1.5 text-sm text-[var(--text-primary)] focus:outline-none">
          {allStatuses.map((s) => <option key={s} value={s}>{s === 'All' ? 'All Statuses' : s}</option>)}
        </select>
        <span className="text-xs text-[var(--text-muted)]">{filtered.length} packages</span>
      </div>

      <div className="flex gap-4">
        {/* Package list */}
        <div className="flex-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Document Packages</h3>
          {filtered.length === 0 ? (
            <div className="mt-6 flex flex-col items-center py-12">
              <span className="material-icons-outlined text-4xl text-[var(--text-muted)]">inventory_2</span>
              <p className="mt-3 text-sm text-[var(--text-muted)]">No packages found.</p>
            </div>
          ) : (
            <div className="mt-3 max-h-[500px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border-subtle)] text-left text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
                    <th className="pb-2 pr-3">Client</th>
                    <th className="pb-2 pr-3">Kit</th>
                    <th className="pb-2 pr-3">Status</th>
                    <th className="pb-2 pr-3">Delivery</th>
                    <th className="pb-2">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((pkg) => (
                    <tr key={pkg._id}
                      onClick={() => { setSelectedPackage(pkg); setActionError(null); setActionSuccess(null) }}
                      className={`cursor-pointer border-b border-[var(--border-subtle)] transition-colors ${selectedPackage?._id === pkg._id ? 'bg-[var(--portal-glow)]' : 'hover:bg-[var(--bg-surface)]'}`}>
                      <td className="py-2.5 pr-3 font-medium text-[var(--text-primary)]">{pkg.client_name || '-'}</td>
                      <td className="py-2.5 pr-3 text-[var(--text-secondary)]">{pkg.kit_name || '-'}</td>
                      <td className="py-2.5 pr-3">
                        <span className="rounded-full px-2 py-0.5 text-[10px] font-medium" style={statusStyle(pkg.status)}>{pkg.status}</span>
                      </td>
                      <td className="py-2.5 pr-3 text-xs text-[var(--text-muted)]">{pkg.delivery_method || '-'}</td>
                      <td className="py-2.5 text-xs text-[var(--text-muted)]">{formatDate(pkg.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Package detail panel */}
        {selectedPackage && (
          <div className="w-80 shrink-0 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-[var(--text-primary)]">{selectedPackage.client_name}</h4>
              <span className="rounded-full px-2 py-0.5 text-[9px] font-medium" style={statusStyle(selectedPackage.status)}>{selectedPackage.status}</span>
            </div>
            <p className="mt-0.5 text-[10px] text-[var(--text-muted)]">{selectedPackage.package_id}</p>

            <div className="mt-3 space-y-2 text-xs">
              <div className="flex justify-between"><span className="text-[var(--text-muted)]">Kit</span><span className="text-[var(--text-primary)]">{selectedPackage.kit_name || '-'}</span></div>
              <div className="flex justify-between"><span className="text-[var(--text-muted)]">Delivery</span><span className="text-[var(--text-primary)]">{selectedPackage.delivery_method || '-'}</span></div>
              <div className="flex justify-between"><span className="text-[var(--text-muted)]">Email</span><span className="text-[var(--text-primary)]">{selectedPackage.client_email || '-'}</span></div>
              {selectedPackage.docusign_envelope_id && (
                <div className="flex justify-between"><span className="text-[var(--text-muted)]">Envelope</span><span className="truncate text-[var(--text-primary)]">{selectedPackage.docusign_envelope_id}</span></div>
              )}
            </div>

            {/* Package Actions */}
            <div className="mt-4 border-t border-[var(--border-subtle)] pt-3">
              <h5 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Actions</h5>
              <div className="mt-2 space-y-2">
                {/* Generate PDF — available for DRAFT packages */}
                {(selectedPackage.status === 'DRAFT' || !selectedPackage.pdf_storage_ref) && (
                  <button
                    onClick={() => handleGeneratePdf(selectedPackage.package_id || selectedPackage._id)}
                    disabled={actionLoading === 'pdf'}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-white disabled:opacity-50"
                    style={{ background: 'var(--portal)' }}
                  >
                    {actionLoading === 'pdf' ? (
                      <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    ) : (
                      <span className="material-icons-outlined" style={{ fontSize: '14px' }}>picture_as_pdf</span>
                    )}
                    {actionLoading === 'pdf' ? 'Generating...' : 'Generate PDF'}
                  </button>
                )}

                {/* Send for Signature — available for READY packages */}
                {(selectedPackage.status === 'READY' || selectedPackage.status === 'DRAFT') && (
                  <button
                    onClick={() => handleSendDocuSign(selectedPackage.package_id || selectedPackage._id)}
                    disabled={actionLoading === 'docusign'}
                    className="flex w-full items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-xs font-medium text-[var(--text-secondary)] disabled:opacity-50"
                  >
                    {actionLoading === 'docusign' ? (
                      <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[var(--portal)] border-t-transparent" />
                    ) : (
                      <span className="material-icons-outlined" style={{ fontSize: '14px' }}>send</span>
                    )}
                    {actionLoading === 'docusign' ? 'Sending...' : 'Send for Signature'}
                  </button>
                )}

                {/* Status transition buttons */}
                {getNextStatuses(selectedPackage.status).map((nextStatus) => (
                  <button
                    key={nextStatus}
                    onClick={() => handleStatusUpdate(selectedPackage.package_id || selectedPackage._id, nextStatus)}
                    disabled={actionLoading === 'status'}
                    className="flex w-full items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-xs font-medium text-[var(--text-secondary)] disabled:opacity-50"
                  >
                    {actionLoading === 'status' ? (
                      <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[var(--portal)] border-t-transparent" />
                    ) : (
                      <span className="material-icons-outlined" style={{ fontSize: '14px' }}>arrow_forward</span>
                    )}
                    Move to {nextStatus}
                  </button>
                ))}

                {/* Void button — available for non-terminal statuses */}
                {selectedPackage.status !== 'COMPLETE' && selectedPackage.status !== 'VOIDED' && selectedPackage.status !== 'DECLINED' && (
                  <button
                    onClick={() => handleStatusUpdate(selectedPackage.package_id || selectedPackage._id, 'VOIDED')}
                    disabled={actionLoading === 'status'}
                    className="flex w-full items-center gap-2 rounded-lg border border-[rgba(239,68,68,0.3)] bg-[rgba(239,68,68,0.05)] px-3 py-2 text-xs font-medium text-[#ef4444] disabled:opacity-50"
                  >
                    <span className="material-icons-outlined" style={{ fontSize: '14px' }}>cancel</span>
                    Void Package
                  </button>
                )}
              </div>

              {/* Action feedback */}
              {actionError && (
                <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-[rgba(239,68,68,0.08)] px-2.5 py-1.5">
                  <span className="material-icons-outlined" style={{ fontSize: '14px', color: '#ef4444' }}>error</span>
                  <span className="text-[10px] text-[#ef4444]">{actionError}</span>
                </div>
              )}
              {actionSuccess && (
                <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-[rgba(34,197,94,0.08)] px-2.5 py-1.5">
                  <span className="material-icons-outlined" style={{ fontSize: '14px', color: '#22c55e' }}>check_circle</span>
                  <span className="text-[10px] text-[#22c55e]">{actionSuccess}</span>
                </div>
              )}
            </div>

            {/* Status Timeline */}
            <div className="mt-4 border-t border-[var(--border-subtle)] pt-3">
              <h5 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Timeline</h5>
              <div className="mt-2 space-y-2">
                <TimelineEntry label="Created" date={selectedPackage.created_at} active />
                <TimelineEntry label="Sent" date={selectedPackage.sent_at} active={!!selectedPackage.sent_at} />
                <TimelineEntry label="Viewed" date={selectedPackage.viewed_at} active={!!selectedPackage.viewed_at} />
                <TimelineEntry label="Signed" date={selectedPackage.signed_at} active={!!selectedPackage.signed_at} />
                <TimelineEntry label="Submitted" date={selectedPackage.submitted_at} active={!!selectedPackage.submitted_at} />
                <TimelineEntry label="Completed" date={selectedPackage.completed_at} active={!!selectedPackage.completed_at} />
              </div>
            </div>

            {selectedPackage.notes && (
              <div className="mt-3 border-t border-[var(--border-subtle)] pt-3">
                <p className="text-xs text-[var(--text-muted)] italic">{selectedPackage.notes}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function TimelineEntry({ label, date, active }: { label: string; date?: string | null; active: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full" style={{ background: active ? 'var(--portal-glow)' : 'var(--bg-surface)' }}>
        <div className="h-2 w-2 rounded-full" style={{ background: active ? 'var(--portal)' : 'var(--border)' }} />
      </div>
      <div className="flex flex-1 items-center justify-between">
        <span className="text-xs" style={{ color: active ? 'var(--text-primary)' : 'var(--text-muted)' }}>{label}</span>
        <span className="text-[10px] text-[var(--text-muted)]">{formatDateTime(date)}</span>
      </div>
    </div>
  )
}
