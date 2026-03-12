'use client'

import { useState, useMemo, useCallback } from 'react'
import { query, collection, where, type Query, type DocumentData } from 'firebase/firestore'
import { useCollection } from '@tomachina/db'
import { getDb } from '@tomachina/db/src/firestore'

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
  client_id?: string
  [key: string]: unknown
}

type Tab = 'pipeline' | 'forms' | 'kits' | 'tracker'

// ============================================================================
// Constants
// ============================================================================

const FORM_CATEGORIES = ['All', 'Firm:Client', 'Firm:Account', 'Product:GI', 'Product:Schwab', 'Product:RBC', 'Product:Carrier', 'Disclosure', 'Supporting'] as const
const FORM_STATUSES = ['All', 'ACTIVE', 'TBD', 'N/A'] as const
const KIT_PLATFORMS = ['GWM (Schwab)', 'RBC Brokerage', 'VA (Direct)', 'FIA (Direct)', 'VUL (Direct)', 'MF (Direct)', '401k', 'Financial Planning'] as const
const KIT_REG_TYPES = ['Traditional IRA', 'Roth IRA', 'Individual (NQ)', 'Joint WROS', 'Trust', '401k/ERISA'] as const
const KIT_ACTIONS = ['New Account', 'LPOA/Transfer', 'ACAT Transfer', 'Add Money ($10K+)'] as const

const PIPELINE_STAGES = [
  { key: 'intake', label: 'Intake', icon: 'upload_file', description: 'Documents received' },
  { key: 'processing', label: 'Processing', icon: 'document_scanner', description: 'OCR + classification' },
  { key: 'filing', label: 'Filing', icon: 'folder_open', description: 'Routing + storage' },
] as const

// ============================================================================
// Helpers
// ============================================================================

function formatDate(d?: string): string {
  if (!d) return '-'
  try { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) } catch { return d }
}

function statusStyle(status?: string): { background: string; color: string } {
  const s = (status || '').toUpperCase()
  if (s === 'ACTIVE' || s === 'GENERATED' || s === 'READY') return { background: 'rgba(34,197,94,0.15)', color: '#22c55e' }
  if (s === 'TBD' || s === 'NEEDS DATA' || s === 'PENDING') return { background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }
  if (s === 'N/A' || s === 'ARCHIVED') return { background: 'rgba(156,163,175,0.15)', color: '#9ca3af' }
  return { background: 'var(--bg-surface)', color: 'var(--text-muted)' }
}

function inputTypeBadge(inputType?: string): { background: string; color: string; label: string } {
  const t = (inputType || 'text').toLowerCase()
  if (t === 'dropdown' || t === 'radio' || t === 'checkboxes') return { background: 'rgba(168,85,247,0.15)', color: '#a855f7', label: t }
  if (t === 'date') return { background: 'rgba(34,197,94,0.15)', color: '#22c55e', label: 'date' }
  if (t === 'signature') return { background: 'rgba(239,68,68,0.15)', color: '#ef4444', label: 'signature' }
  if (t === 'ssn' || t === 'phone' || t === 'email') return { background: 'rgba(245,158,11,0.15)', color: '#f59e0b', label: t }
  if (t === 'currency' || t === 'percent') return { background: 'rgba(14,165,233,0.15)', color: '#0ea5e9', label: t }
  if (t === 'checkbox') return { background: 'rgba(168,85,247,0.15)', color: '#a855f7', label: 'checkbox' }
  if (t === 'textarea') return { background: 'rgba(59,130,246,0.15)', color: '#3b82f6', label: 'textarea' }
  return { background: 'rgba(59,130,246,0.15)', color: '#3b82f6', label: t || 'text' }
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
  const clientsQ = useMemo<Query<DocumentData>>(() => query(collection(getDb(), 'clients')), [])

  const { data: forms, loading: formsLoading } = useCollection<DexForm>(formsQ, 'dex-forms')
  const { data: kits, loading: kitsLoading } = useCollection<DexKit>(kitsQ, 'dex-kits')
  const { data: clients, loading: clientsLoading } = useCollection<ClientRecord>(clientsQ, 'dex-clients')

  const loading = formsLoading || kitsLoading

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'pipeline', label: 'Pipeline', icon: 'route' },
    { key: 'forms', label: 'Form Library', icon: 'library_books' },
    { key: 'kits', label: 'Kit Builder', icon: 'inventory_2' },
    { key: 'tracker', label: 'Tracker', icon: 'track_changes' },
  ]

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">DEX — Document Center</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">Document efficiency — forms, kits, and compliance</p>
        <div className="mt-8 flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--portal)] border-t-transparent" />
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">DEX — Document Center</h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">Document efficiency — forms, kits, and compliance</p>
      </div>

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-4">
        <StatCard icon="library_books" label="Forms" value={forms.length} />
        <StatCard icon="check_circle" label="Active" value={forms.filter(f => f.status === 'ACTIVE').length} />
        <StatCard icon="inventory_2" label="Kits Generated" value={kits.length} />
        <StatCard icon="pending" label="Pending" value={kits.filter(k => k.status === 'Needs Data').length} accent />
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

      {activeTab === 'pipeline' && <PipelineTab kits={kits} />}
      {activeTab === 'forms' && <FormLibraryTab forms={forms} />}
      {activeTab === 'kits' && <KitBuilderTab clients={clients} />}
      {activeTab === 'tracker' && <TrackerTab kits={kits} />}
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
// Pipeline Tab — reads from dex_kits
// ============================================================================

function PipelineTab({ kits }: { kits: DexKit[] }) {
  const stages = [
    { ...PIPELINE_STAGES[0], count: kits.filter(k => k.status === 'Needs Data').length },
    { ...PIPELINE_STAGES[1], count: kits.filter(k => k.status === 'Ready').length },
    { ...PIPELINE_STAGES[2], count: kits.filter(k => k.status === 'Generated' || k.status === 'Complete').length },
  ]

  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6">
      <h3 className="text-sm font-semibold text-[var(--text-primary)]">Document Pipeline</h3>
      <p className="mt-0.5 text-xs text-[var(--text-muted)]">Track kits from generation through completion</p>
      <div className="mt-6 flex items-start gap-2">
        {stages.map((stage, i) => (
          <div key={stage.key} className="flex flex-1 items-center">
            <div className="flex flex-1 flex-col items-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full" style={{ background: 'var(--portal-glow)' }}>
                <span className="material-icons-outlined" style={{ fontSize: '24px', color: 'var(--portal)' }}>{stage.icon}</span>
              </span>
              <p className="mt-2 text-sm font-semibold text-[var(--text-primary)]">{stage.label}</p>
              <p className="mt-0.5 text-xs text-[var(--text-muted)]">{stage.description}</p>
              <div className="mt-3 rounded-full px-3 py-1 text-sm font-bold" style={{ background: 'var(--portal-glow)', color: 'var(--portal)' }}>{stage.count}</div>
            </div>
            {i < stages.length - 1 && <span className="mx-1 shrink-0 material-icons-outlined text-[var(--text-muted)]" style={{ fontSize: '24px' }}>arrow_forward</span>}
          </div>
        ))}
      </div>
    </div>
  )
}

// ============================================================================
// Form Library Tab — reads from dex_forms + dex_field_mappings
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
                                <span className="shrink-0 rounded px-1 py-px text-[8px] font-bold uppercase" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>req</span>
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
// Kit Builder Tab — 5-step wizard
// ============================================================================

function KitBuilderTab({ clients }: { clients: ClientRecord[] }) {
  const [step, setStep] = useState(1)
  const [clientSearch, setClientSearch] = useState('')
  const [selectedClient, setSelectedClient] = useState<ClientRecord | null>(null)
  const [platform, setPlatform] = useState('')
  const [regType, setRegType] = useState('')
  const [action, setAction] = useState('')
  const [buildResult, setBuildResult] = useState<Record<string, unknown> | null>(null)
  const [building, setBuilding] = useState(false)

  const filteredClients = useMemo(() => {
    if (!clientSearch || clientSearch.length < 2) return []
    const lower = clientSearch.toLowerCase()
    return clients.filter(c => `${c.first_name || ''} ${c.last_name || ''} ${c.email || ''}`.toLowerCase().includes(lower)).slice(0, 10)
  }, [clients, clientSearch])

  const handleBuild = useCallback(async () => {
    if (!selectedClient || !platform || !regType || !action) return
    setBuilding(true)
    try {
      const res = await fetch('/api/dex/kits/build', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: selectedClient._id, product_type: platform, registration_type: regType, action }),
      })
      const data = await res.json()
      if (data.success) { setBuildResult(data.data as Record<string, unknown>); setStep(5) }
    } catch {
      setBuildResult({ preview: true, client_name: `${selectedClient.first_name} ${selectedClient.last_name}`, platform, regType, action })
      setStep(5)
    } finally {
      setBuilding(false)
    }
  }, [selectedClient, platform, regType, action])

  const reset = () => { setStep(1); setBuildResult(null); setSelectedClient(null); setClientSearch(''); setPlatform(''); setRegType(''); setAction('') }

  return (
    <div className="space-y-4">
      <div className="flex gap-1">{[1, 2, 3, 4, 5].map((s) => <div key={s} className={`h-1 flex-1 rounded-full ${step >= s ? 'bg-[var(--portal)]' : 'bg-[var(--bg-surface)]'}`} />)}</div>

      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
        {step === 1 && (
          <div>
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Step 1: Select Client</h3>
            <div className="relative mt-3">
              <input type="text" placeholder="Type client name..." value={clientSearch}
                onChange={(e) => { setClientSearch(e.target.value); setSelectedClient(null) }}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--portal)] focus:outline-none" />
              {filteredClients.length > 0 && !selectedClient && (
                <div className="absolute z-10 mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-card)] shadow-lg">
                  {filteredClients.map((c) => (
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

        {step === 5 && buildResult && (
          <div>
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Kit Generated</h3>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              {buildResult.preview ? 'Preview mode — connect API for live generation' : `Kit ${buildResult.kit_id} with ${buildResult.form_count} forms`}
            </p>
            {buildResult.layers ? (
              <div className="mt-3 space-y-2">
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
            <button onClick={reset} className="mt-4 rounded px-3 py-1.5 text-xs font-medium text-white" style={{ background: 'var(--portal)' }}>Build Another Kit</button>
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================================================
// Tracker Tab — reads from dex_kits
// ============================================================================

function TrackerTab({ kits }: { kits: DexKit[] }) {
  const sorted = useMemo(() => [...kits].sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '')), [kits])

  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
      <h3 className="text-sm font-semibold text-[var(--text-primary)]">Generated Kits</h3>
      {sorted.length === 0 ? (
        <div className="mt-6 flex flex-col items-center py-12">
          <span className="material-icons-outlined text-4xl text-[var(--text-muted)]">inventory_2</span>
          <p className="mt-3 text-sm text-[var(--text-muted)]">No kits generated yet.</p>
        </div>
      ) : (
        <div className="mt-4 max-h-[500px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border-subtle)] text-left text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
                <th className="pb-2 pr-4">Client</th><th className="pb-2 pr-4">Platform</th><th className="pb-2 pr-4">Registration</th><th className="pb-2 pr-4">Forms</th><th className="pb-2 pr-4">Status</th><th className="pb-2">Date</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((kit) => (
                <tr key={kit._id} className="border-b border-[var(--border-subtle)] hover:bg-[var(--bg-surface)]">
                  <td className="py-2.5 pr-4 font-medium text-[var(--text-primary)]">{kit.client_name || '-'}</td>
                  <td className="py-2.5 pr-4 text-[var(--text-secondary)]">{kit.product_type || '-'}</td>
                  <td className="py-2.5 pr-4 text-[var(--text-secondary)]">{kit.registration_type || '-'}</td>
                  <td className="py-2.5 pr-4 text-[var(--text-primary)]">{kit.form_count || 0}</td>
                  <td className="py-2.5 pr-4"><span className="rounded-full px-2 py-0.5 text-[10px] font-medium" style={statusStyle(kit.status)}>{kit.status}</span></td>
                  <td className="py-2.5 text-[var(--text-muted)]">{formatDate(kit.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
