'use client'

import { useState, useCallback, useMemo, useEffect } from 'react'
import { query, orderBy, where, type Query, type DocumentData } from 'firebase/firestore'
import { useCollection } from '@tomachina/db'
import { collections } from '@tomachina/db/src/firestore'
import { useToast } from '@tomachina/ui'

/* ─── Types ─── */
interface ClientOption {
  _id: string
  client_id: string
  first_name: string
  last_name: string
  email?: string
  phone?: string
  dob?: string
  zip?: string
  state?: string
  county?: string
}

interface DiscoveryData {
  // Step 1: Client
  client_id: string
  client_name: string
  // Step 2: Financial Goals
  retirement_age: string
  income_needs: string
  risk_tolerance: 'conservative' | 'moderate' | 'aggressive' | ''
  time_horizon: string
  primary_goal: string
  // Step 3: Existing Coverage
  has_life_insurance: boolean
  life_details: string
  has_annuity: boolean
  annuity_details: string
  has_medicare: boolean
  medicare_details: string
  has_investments: boolean
  investment_details: string
  estimated_assets: string
  // Step 4: Health Overview
  general_health: 'excellent' | 'good' | 'fair' | 'poor' | ''
  tobacco_use: boolean
  medications: string
  health_conditions: string
  // Step 5: Review (no additional data)
}

const INITIAL_DATA: DiscoveryData = {
  client_id: '',
  client_name: '',
  retirement_age: '',
  income_needs: '',
  risk_tolerance: '',
  time_horizon: '',
  primary_goal: '',
  has_life_insurance: false,
  life_details: '',
  has_annuity: false,
  annuity_details: '',
  has_medicare: false,
  medicare_details: '',
  has_investments: false,
  investment_details: '',
  estimated_assets: '',
  general_health: '',
  tobacco_use: false,
  medications: '',
  health_conditions: '',
}

const STEPS = [
  { label: 'Client', icon: 'person' },
  { label: 'Financial Goals', icon: 'savings' },
  { label: 'Coverage', icon: 'shield' },
  { label: 'Health', icon: 'favorite' },
  { label: 'Review', icon: 'checklist' },
]

const STORAGE_KEY = 'prodash-discovery-draft'

/* ─── Helpers ─── */
function loadDraft(): DiscoveryData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as DiscoveryData
  } catch { /* noop */ }
  return null
}

function saveDraft(data: DiscoveryData) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch { /* noop */ }
}

function clearDraft() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch { /* noop */ }
}

/* ─── Component ─── */
const clientsQuery: Query<DocumentData> = query(
  collections.clients(),
  where('client_status', 'in', ['Active', 'Active - Internal', 'Active - External', 'Pending']),
  orderBy('last_name')
)

export default function DiscoveryKitPage() {
  const { showToast } = useToast()
  const { data: clients, loading: clientsLoading } = useCollection<ClientOption>(clientsQuery, 'discovery-clients')

  const [step, setStep] = useState(0)
  const [data, setData] = useState<DiscoveryData>(INITIAL_DATA)
  const [clientSearch, setClientSearch] = useState('')
  const [summaryGenerated, setSummaryGenerated] = useState(false)

  // Load draft on mount
  useEffect(() => {
    const draft = loadDraft()
    if (draft) {
      setData(draft)
      if (draft.client_id) {
        showToast('Resumed from saved draft', 'info')
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-save draft on data change
  useEffect(() => {
    if (data.client_id) saveDraft(data)
  }, [data])

  const updateField = useCallback(<K extends keyof DiscoveryData>(key: K, value: DiscoveryData[K]) => {
    setData(prev => ({ ...prev, [key]: value }))
  }, [])

  const filteredClients = useMemo(() => {
    if (!clientSearch) return clients.slice(0, 20)
    const q = clientSearch.toLowerCase()
    return clients.filter(c => {
      const name = `${c.first_name || ''} ${c.last_name || ''}`.toLowerCase()
      return name.includes(q) || (c.email || '').toLowerCase().includes(q)
    }).slice(0, 20)
  }, [clients, clientSearch])

  const selectClient = useCallback((client: ClientOption) => {
    setData(prev => ({
      ...prev,
      client_id: client._id || client.client_id,
      client_name: `${client.first_name} ${client.last_name}`,
    }))
    setClientSearch('')
  }, [])

  const canProceed = useMemo(() => {
    switch (step) {
      case 0: return !!data.client_id
      case 1: return !!data.risk_tolerance && !!data.primary_goal
      case 2: return true // coverage is optional
      case 3: return !!data.general_health
      case 4: return true
      default: return true
    }
  }, [step, data])

  const handleNext = useCallback(() => {
    if (step < STEPS.length - 1) setStep(s => s + 1)
  }, [step])

  const handleBack = useCallback(() => {
    if (step > 0) setStep(s => s - 1)
  }, [step])

  const handleGenerateSummary = useCallback(() => {
    setSummaryGenerated(true)
    showToast('Discovery summary generated', 'success')
  }, [showToast])

  const handleStartNew = useCallback(() => {
    setData(INITIAL_DATA)
    setStep(0)
    setSummaryGenerated(false)
    clearDraft()
    showToast('Started new discovery', 'info')
  }, [showToast])

  /* ─── Step Renderers ─── */
  const renderStep0 = () => (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-[var(--text-primary)]">Select Client</h2>
      {data.client_id ? (
        <div className="flex items-center justify-between rounded-lg border border-[var(--portal)] bg-[var(--portal-glow)] p-4">
          <div className="flex items-center gap-3">
            <span className="material-icons-outlined text-[var(--portal)]" style={{ fontSize: '24px' }}>person</span>
            <div>
              <p className="font-medium text-[var(--text-primary)]">{data.client_name}</p>
              <p className="text-xs text-[var(--text-muted)]">ID: {data.client_id}</p>
            </div>
          </div>
          <button
            onClick={() => updateField('client_id', '')}
            className="text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          >
            Change
          </button>
        </div>
      ) : (
        <div>
          <input
            type="text"
            value={clientSearch}
            onChange={e => setClientSearch(e.target.value)}
            placeholder="Search clients by name or email..."
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] px-4 py-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--portal)] focus:outline-none"
          />
          {clientsLoading ? (
            <div className="mt-3 flex items-center gap-2 text-sm text-[var(--text-muted)]">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--portal)] border-t-transparent" />
              Loading clients...
            </div>
          ) : (
            <div className="mt-2 max-h-64 overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--bg-primary)]">
              {filteredClients.length === 0 ? (
                <div className="px-4 py-6 text-center text-sm text-[var(--text-muted)]">No clients found</div>
              ) : (
                filteredClients.map(c => (
                  <button
                    key={c._id || c.client_id}
                    onClick={() => selectClient(c)}
                    className="flex w-full items-center gap-3 border-b border-[var(--border-subtle)] px-4 py-3 text-left transition-colors hover:bg-[var(--bg-hover)]"
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--bg-surface)] text-xs font-medium text-[var(--text-muted)]">
                      {(c.first_name || '?')[0]}{(c.last_name || '?')[0]}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-[var(--text-primary)]">{c.first_name} {c.last_name}</p>
                      {c.email && <p className="text-xs text-[var(--text-muted)]">{c.email}</p>}
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )

  const renderStep1 = () => (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-[var(--text-primary)]">Financial Goals</h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Target Retirement Age</label>
          <input
            type="number"
            min={50}
            max={80}
            value={data.retirement_age}
            onChange={e => updateField('retirement_age', e.target.value)}
            placeholder="65"
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--portal)] focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Monthly Income Needs</label>
          <input
            type="text"
            value={data.income_needs}
            onChange={e => updateField('income_needs', e.target.value)}
            placeholder="$5,000"
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--portal)] focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Risk Tolerance *</label>
          <div className="flex gap-2">
            {(['conservative', 'moderate', 'aggressive'] as const).map(level => (
              <button
                key={level}
                onClick={() => updateField('risk_tolerance', level)}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm capitalize transition-colors ${
                  data.risk_tolerance === level
                    ? 'border-[var(--portal)] bg-[var(--portal-glow)] text-[var(--portal)]'
                    : 'border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--portal)]'
                }`}
              >
                {level}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Time Horizon</label>
          <input
            type="text"
            value={data.time_horizon}
            onChange={e => updateField('time_horizon', e.target.value)}
            placeholder="10+ years"
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--portal)] focus:outline-none"
          />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Primary Financial Goal *</label>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {[
            { key: 'income', label: 'Retirement Income', icon: 'payments' },
            { key: 'growth', label: 'Asset Growth', icon: 'trending_up' },
            { key: 'protection', label: 'Asset Protection', icon: 'shield' },
            { key: 'legacy', label: 'Legacy Planning', icon: 'family_restroom' },
          ].map(goal => (
            <button
              key={goal.key}
              onClick={() => updateField('primary_goal', goal.key)}
              className={`flex flex-col items-center gap-2 rounded-lg border p-4 transition-colors ${
                data.primary_goal === goal.key
                  ? 'border-[var(--portal)] bg-[var(--portal-glow)]'
                  : 'border-[var(--border)] hover:border-[var(--portal)]'
              }`}
            >
              <span className="material-icons-outlined" style={{
                fontSize: '28px',
                color: data.primary_goal === goal.key ? 'var(--portal)' : 'var(--text-muted)',
              }}>{goal.icon}</span>
              <span className={`text-xs font-medium ${
                data.primary_goal === goal.key ? 'text-[var(--portal)]' : 'text-[var(--text-secondary)]'
              }`}>{goal.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )

  const renderStep2 = () => (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-[var(--text-primary)]">Existing Coverage</h2>
      {[
        { key: 'life_insurance' as const, label: 'Life Insurance', icon: 'shield', hasField: 'has_life_insurance' as const, detailField: 'life_details' as const },
        { key: 'annuity' as const, label: 'Annuity Products', icon: 'savings', hasField: 'has_annuity' as const, detailField: 'annuity_details' as const },
        { key: 'medicare' as const, label: 'Medicare Coverage', icon: 'health_and_safety', hasField: 'has_medicare' as const, detailField: 'medicare_details' as const },
        { key: 'investments' as const, label: 'Investment Accounts', icon: 'trending_up', hasField: 'has_investments' as const, detailField: 'investment_details' as const },
      ].map(item => (
        <div key={item.key} className="rounded-lg border border-[var(--border)] p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-icons-outlined text-[var(--text-muted)]" style={{ fontSize: '20px' }}>{item.icon}</span>
              <span className="text-sm font-medium text-[var(--text-primary)]">{item.label}</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => updateField(item.hasField, true)}
                className={`rounded px-3 py-1 text-xs font-medium ${
                  data[item.hasField] ? 'bg-[var(--portal)] text-white' : 'border border-[var(--border)] text-[var(--text-muted)]'
                }`}
              >Yes</button>
              <button
                onClick={() => { updateField(item.hasField, false); updateField(item.detailField, '') }}
                className={`rounded px-3 py-1 text-xs font-medium ${
                  !data[item.hasField] ? 'bg-[var(--bg-surface)] text-[var(--text-secondary)]' : 'border border-[var(--border)] text-[var(--text-muted)]'
                }`}
              >No</button>
            </div>
          </div>
          {data[item.hasField] && (
            <textarea
              value={data[item.detailField]}
              onChange={e => updateField(item.detailField, e.target.value)}
              placeholder={`Details about existing ${item.label.toLowerCase()}...`}
              rows={2}
              className="mt-3 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--portal)] focus:outline-none"
            />
          )}
        </div>
      ))}
      <div>
        <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Estimated Total Assets</label>
        <input
          type="text"
          value={data.estimated_assets}
          onChange={e => updateField('estimated_assets', e.target.value)}
          placeholder="$500,000"
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--portal)] focus:outline-none"
        />
      </div>
    </div>
  )

  const renderStep3 = () => (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-[var(--text-primary)]">Health Overview</h2>
      <div>
        <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">General Health *</label>
        <div className="flex gap-2">
          {(['excellent', 'good', 'fair', 'poor'] as const).map(h => (
            <button
              key={h}
              onClick={() => updateField('general_health', h)}
              className={`flex-1 rounded-lg border px-3 py-2 text-sm capitalize transition-colors ${
                data.general_health === h
                  ? 'border-[var(--portal)] bg-[var(--portal-glow)] text-[var(--portal)]'
                  : 'border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--portal)]'
              }`}
            >{h}</button>
          ))}
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Tobacco Use</label>
        <div className="flex gap-3">
          <label className="flex items-center gap-1.5 text-sm text-[var(--text-secondary)]">
            <input type="radio" name="tobacco" checked={!data.tobacco_use} onChange={() => updateField('tobacco_use', false)} className="accent-[var(--portal)]" /> No
          </label>
          <label className="flex items-center gap-1.5 text-sm text-[var(--text-secondary)]">
            <input type="radio" name="tobacco" checked={data.tobacco_use} onChange={() => updateField('tobacco_use', true)} className="accent-[var(--portal)]" /> Yes
          </label>
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Current Medications</label>
        <textarea
          value={data.medications}
          onChange={e => updateField('medications', e.target.value)}
          placeholder="List any current medications..."
          rows={3}
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--portal)] focus:outline-none"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Health Conditions</label>
        <textarea
          value={data.health_conditions}
          onChange={e => updateField('health_conditions', e.target.value)}
          placeholder="Any relevant health conditions..."
          rows={3}
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--portal)] focus:outline-none"
        />
      </div>
    </div>
  )

  const renderStep4 = () => (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-[var(--text-primary)]">Review & Generate</h2>

      {/* Client */}
      <div className="rounded-lg border border-[var(--border)] p-4">
        <div className="flex items-center gap-2 text-sm font-medium text-[var(--text-primary)]">
          <span className="material-icons-outlined" style={{ fontSize: '18px' }}>person</span>
          Client
        </div>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">{data.client_name || '—'}</p>
      </div>

      {/* Financial Goals */}
      <div className="rounded-lg border border-[var(--border)] p-4">
        <div className="flex items-center gap-2 text-sm font-medium text-[var(--text-primary)]">
          <span className="material-icons-outlined" style={{ fontSize: '18px' }}>savings</span>
          Financial Goals
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2 text-sm text-[var(--text-secondary)]">
          <div>Risk Tolerance: <span className="capitalize font-medium">{data.risk_tolerance || '—'}</span></div>
          <div>Goal: <span className="capitalize font-medium">{data.primary_goal || '—'}</span></div>
          <div>Retirement Age: <span className="font-medium">{data.retirement_age || '—'}</span></div>
          <div>Income Needs: <span className="font-medium">{data.income_needs || '—'}</span></div>
        </div>
      </div>

      {/* Coverage */}
      <div className="rounded-lg border border-[var(--border)] p-4">
        <div className="flex items-center gap-2 text-sm font-medium text-[var(--text-primary)]">
          <span className="material-icons-outlined" style={{ fontSize: '18px' }}>shield</span>
          Existing Coverage
        </div>
        <div className="mt-2 space-y-1 text-sm text-[var(--text-secondary)]">
          <div>Life Insurance: {data.has_life_insurance ? `Yes — ${data.life_details || 'no details'}` : 'No'}</div>
          <div>Annuity: {data.has_annuity ? `Yes — ${data.annuity_details || 'no details'}` : 'No'}</div>
          <div>Medicare: {data.has_medicare ? `Yes — ${data.medicare_details || 'no details'}` : 'No'}</div>
          <div>Investments: {data.has_investments ? `Yes — ${data.investment_details || 'no details'}` : 'No'}</div>
          {data.estimated_assets && <div>Estimated Assets: <span className="font-medium">{data.estimated_assets}</span></div>}
        </div>
      </div>

      {/* Health */}
      <div className="rounded-lg border border-[var(--border)] p-4">
        <div className="flex items-center gap-2 text-sm font-medium text-[var(--text-primary)]">
          <span className="material-icons-outlined" style={{ fontSize: '18px' }}>favorite</span>
          Health Overview
        </div>
        <div className="mt-2 space-y-1 text-sm text-[var(--text-secondary)]">
          <div>General Health: <span className="capitalize font-medium">{data.general_health || '—'}</span></div>
          <div>Tobacco: {data.tobacco_use ? 'Yes' : 'No'}</div>
          {data.medications && <div>Medications: {data.medications}</div>}
          {data.health_conditions && <div>Conditions: {data.health_conditions}</div>}
        </div>
      </div>

      {/* Generate */}
      {!summaryGenerated ? (
        <button
          onClick={handleGenerateSummary}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--portal)] px-6 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90"
        >
          <span className="material-icons-outlined" style={{ fontSize: '20px' }}>summarize</span>
          Generate Summary
        </button>
      ) : (
        <div className="rounded-lg border-2 border-[var(--portal)] bg-[var(--portal-glow)] p-6 text-center">
          <span className="material-icons-outlined text-4xl text-[var(--portal)]">check_circle</span>
          <p className="mt-2 text-sm font-medium text-[var(--text-primary)]">Discovery summary saved for {data.client_name}</p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            PDF generation will be available when DEX integration is complete.
          </p>
          <button
            onClick={handleStartNew}
            className="mt-4 rounded-lg border border-[var(--border)] px-4 py-2 text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)]"
          >
            Start New Discovery
          </button>
        </div>
      )}
    </div>
  )

  const stepRenderers = [renderStep0, renderStep1, renderStep2, renderStep3, renderStep4]

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-bold text-[var(--text-primary)]">Discovery Kit</h1>
      <p className="mt-1 text-sm text-[var(--text-muted)]">Client discovery questionnaire — collect goals, coverage, and health data.</p>

      {/* ─── Step Indicator ─── */}
      <div className="mt-6 flex items-center gap-1">
        {STEPS.map((s, i) => (
          <div key={i} className="flex flex-1 items-center">
            <button
              onClick={() => i <= step && setStep(i)}
              disabled={i > step}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                i === step
                  ? 'bg-[var(--portal)] text-white'
                  : i < step
                    ? 'bg-[var(--portal-glow)] text-[var(--portal)] hover:opacity-80'
                    : 'text-[var(--text-muted)]'
              }`}
            >
              <span className="material-icons-outlined" style={{ fontSize: '16px' }}>{s.icon}</span>
              <span className="hidden sm:inline">{s.label}</span>
            </button>
            {i < STEPS.length - 1 && (
              <div className={`mx-1 h-px flex-1 ${i < step ? 'bg-[var(--portal)]' : 'bg-[var(--border)]'}`} />
            )}
          </div>
        ))}
      </div>

      {/* ─── Step Content ─── */}
      <div className="mt-6 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6">
        {stepRenderers[step]()}
      </div>

      {/* ─── Navigation ─── */}
      <div className="mt-4 flex items-center justify-between">
        <button
          onClick={handleBack}
          disabled={step === 0}
          className="flex items-center gap-1 rounded-lg border border-[var(--border)] px-4 py-2 text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] disabled:opacity-30"
        >
          <span className="material-icons-outlined" style={{ fontSize: '18px' }}>arrow_back</span>
          Back
        </button>
        <div className="text-xs text-[var(--text-muted)]">
          Step {step + 1} of {STEPS.length}
          {data.client_id && <span className="ml-2">| Draft auto-saved</span>}
        </div>
        {step < STEPS.length - 1 && (
          <button
            onClick={handleNext}
            disabled={!canProceed}
            className="flex items-center gap-1 rounded-lg bg-[var(--portal)] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-30"
          >
            Next
            <span className="material-icons-outlined" style={{ fontSize: '18px' }}>arrow_forward</span>
          </button>
        )}
        {step === STEPS.length - 1 && !summaryGenerated && (
          <div />
        )}
      </div>
    </div>
  )
}
