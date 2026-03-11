'use client'

import { useState, useMemo } from 'react'
import { query, type Query, type DocumentData } from 'firebase/firestore'
import { useCollection } from '@tomachina/db'
import { collections } from '@tomachina/db/src/firestore'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CommRecord {
  _id: string
  comm_id?: string
  communication_id?: string
  client_id?: string
  channel?: string
  type?: string
  direction?: string
  subject?: string
  body?: string
  status?: string
  sent_at?: string
  created_at?: string
  [key: string]: unknown
}

interface TaskRecord {
  _id: string
  task_id?: string
  client_id?: string
  title?: string
  task_type?: string
  description?: string
  status?: string
  priority?: string
  assigned_to?: string
  due_date?: string
  created_at?: string
  [key: string]: unknown
}

// Pipeline stage constants from ATLAS_Pipeline.gs
const PIPELINE_STAGES = [
  {
    key: 'intake',
    label: 'Intake',
    icon: 'upload_file',
    description: 'Documents received via email, fax, or upload',
    statuses: ['NEW', 'SCANNING', 'QUEUED'],
  },
  {
    key: 'processing',
    label: 'Processing',
    icon: 'document_scanner',
    description: 'OCR extraction, classification, and data parsing',
    statuses: ['EXTRACTING', 'CLASSIFYING'],
  },
  {
    key: 'filing',
    label: 'Filing',
    icon: 'folder_open',
    description: 'Automated routing to client folders and compliance storage',
    statuses: ['APPROVED', 'IMPORTING', 'WRITING', 'COMPLETE'],
  },
] as const

// Form Library Categories from DEX_FormLibrary.gs
const FORM_CATEGORIES = ['All', 'Firm:Client', 'Firm:Account', 'Product:GI', 'Product:Schwab', 'Product:RBC', 'Product:Carrier', 'Disclosure', 'Supporting'] as const
const FORM_STATUSES = ['All', 'ACTIVE', 'TBD', 'N/A'] as const
const KIT_PLATFORMS = [
  'GWM (Schwab)', 'RBC Brokerage', 'VA (Direct)', 'FIA (Direct)',
  'VUL (Direct)', 'MF (Direct)', 'Medicare Advantage', 'Medicare Supplement',
] as const
const KIT_REG_TYPES = ['Traditional IRA', 'Roth IRA', 'Individual (NQ)', 'Joint WROS', 'Trust', '401k/ERISA'] as const
const KIT_ACTIONS = ['New Account', 'LPOA/Transfer', 'ACAT Transfer', 'Add Money'] as const

type Tab = 'pipeline' | 'forms' | 'kits' | 'tracker'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function priorityStyle(priority?: string): { background: string; color: string } {
  const p = (priority || '').toLowerCase()
  if (p === 'high' || p === 'urgent') return { background: 'rgba(239,68,68,0.15)', color: '#ef4444' }
  if (p === 'medium') return { background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }
  if (p === 'low') return { background: 'rgba(34,197,94,0.15)', color: '#22c55e' }
  return { background: 'var(--bg-surface)', color: 'var(--text-muted)' }
}

function taskStatusStyle(status?: string): { background: string; color: string } {
  const s = (status || '').toLowerCase()
  if (s === 'completed' || s === 'done' || s === 'closed') return { background: 'rgba(34,197,94,0.15)', color: '#22c55e' }
  if (s === 'in progress' || s === 'processing') return { background: 'rgba(59,130,246,0.15)', color: '#3b82f6' }
  if (s === 'pending' || s === 'new') return { background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }
  if (s === 'sent' || s === 'viewed') return { background: 'rgba(168,85,247,0.15)', color: '#a855f7' }
  if (s === 'signed' || s === 'submitted') return { background: 'rgba(16,185,129,0.15)', color: '#10b981' }
  return { background: 'var(--bg-surface)', color: 'var(--text-muted)' }
}

function formatDate(d?: string): string {
  if (!d) return '-'
  try {
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  } catch {
    return d
  }
}

// ---------------------------------------------------------------------------
// DexDocCenter Component
// ---------------------------------------------------------------------------

export function DexDocCenter({ portal }: { portal: string }) {
  const commsQuery = useMemo<Query<DocumentData>>(() => query(collections.communications()), [])
  const tasksQuery = useMemo<Query<DocumentData>>(() => query(collections.caseTasks()), [])

  const { data: comms, loading: commsLoading } = useCollection<CommRecord>(commsQuery, `dex-comms-${portal}`)
  const { data: tasks, loading: tasksLoading } = useCollection<TaskRecord>(tasksQuery, `dex-tasks-${portal}`)

  const loading = commsLoading || tasksLoading

  const [activeTab, setActiveTab] = useState<Tab>('pipeline')
  const [formCategoryFilter, setFormCategoryFilter] = useState('All')
  const [formStatusFilter, setFormStatusFilter] = useState('All')
  const [formSearch, setFormSearch] = useState('')
  const [kitPlatform, setKitPlatform] = useState('')
  const [kitRegType, setKitRegType] = useState('')
  const [kitAction, setKitAction] = useState('')

  // --- Derived Data ---
  const docStats = useMemo(() => {
    const docComms = comms.filter((c) => {
      const ch = (c.channel || c.type || '').toLowerCase()
      return ch.includes('doc') || ch.includes('email') || ch.includes('fax')
    })
    const docTasks = tasks.filter((t) => {
      const tt = (t.task_type || t.title || '').toLowerCase()
      return tt.includes('doc') || tt.includes('file') || tt.includes('form') || tt.includes('sign')
    })
    const openTasks = docTasks.filter((t) => {
      const s = (t.status || '').toLowerCase()
      return s !== 'completed' && s !== 'closed' && s !== 'done'
    })

    // Simulate pipeline counts from task statuses
    const intake = docTasks.filter((t) => {
      const s = (t.status || '').toLowerCase()
      return s === 'new' || s === 'pending' || s === 'queued'
    }).length
    const processing = docTasks.filter((t) => {
      const s = (t.status || '').toLowerCase()
      return s === 'in progress' || s === 'processing' || s === 'extracting'
    }).length
    const filed = docTasks.filter((t) => {
      const s = (t.status || '').toLowerCase()
      return s === 'completed' || s === 'done' || s === 'closed' || s === 'filed'
    }).length

    return {
      totalComms: comms.length,
      docComms: docComms.length,
      totalTasks: tasks.length,
      docTasks: docTasks.length,
      openDocTasks: openTasks.length,
      intake,
      processing,
      filed,
    }
  }, [comms, tasks])

  const recentDocTasks = useMemo(() => {
    return tasks
      .filter((t) => {
        const tt = (t.task_type || t.title || '').toLowerCase()
        return tt.includes('doc') || tt.includes('file') || tt.includes('form') || tt.includes('sign')
      })
      .sort((a, b) => {
        const da = a.created_at || ''
        const db = b.created_at || ''
        return db.localeCompare(da)
      })
      .slice(0, 20)
  }, [tasks])

  // --- Tabs ---
  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'pipeline', label: 'Pipeline', icon: 'route' },
    { key: 'forms', label: 'Form Library', icon: 'library_books' },
    { key: 'kits', label: 'Kit Builder', icon: 'inventory_2' },
    { key: 'tracker', label: 'Tracker', icon: 'track_changes' },
  ]

  // --- Loading ---
  if (loading) {
    return (
      <div className="mx-auto max-w-7xl">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">DEX — Document Center</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">Document management, forms, and compliance tracking</p>
        <div className="mt-8 flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--portal)] border-t-transparent" />
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl">
      <h1 className="text-2xl font-bold text-[var(--text-primary)]">DEX — Document Center</h1>
      <p className="mt-1 text-sm text-[var(--text-muted)]">Document management, forms, and compliance tracking</p>

      {/* Summary Stats */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon="email" label="Communications" value={docStats.totalComms} />
        <StatCard icon="description" label="Document-Related" value={docStats.docComms} />
        <StatCard icon="task" label="Doc Tasks" value={docStats.docTasks} />
        <StatCard icon="pending_actions" label="Open Tasks" value={docStats.openDocTasks} accent />
      </div>

      {/* Tab Navigation */}
      <div className="mt-6 flex gap-1 overflow-x-auto border-b border-[var(--border-subtle)]">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className="flex items-center gap-1.5 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors"
            style={{
              borderColor: activeTab === tab.key ? 'var(--portal)' : 'transparent',
              color: activeTab === tab.key ? 'var(--portal)' : 'var(--text-muted)',
            }}
          >
            <span className="material-icons-outlined" style={{ fontSize: '18px' }}>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {activeTab === 'pipeline' && (
          <PipelineTab stats={docStats} />
        )}
        {activeTab === 'forms' && (
          <FormLibraryTab
            categoryFilter={formCategoryFilter}
            statusFilter={formStatusFilter}
            search={formSearch}
            onCategoryFilter={setFormCategoryFilter}
            onStatusFilter={setFormStatusFilter}
            onSearch={setFormSearch}
          />
        )}
        {activeTab === 'kits' && (
          <KitBuilderTab
            platform={kitPlatform}
            regType={kitRegType}
            action={kitAction}
            onPlatform={setKitPlatform}
            onRegType={setKitRegType}
            onAction={setKitAction}
          />
        )}
        {activeTab === 'tracker' && (
          <TrackerTab tasks={recentDocTasks} />
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-Components
// ---------------------------------------------------------------------------

function StatCard({ icon, label, value, accent }: { icon: string; label: string; value: number; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4">
      <div className="flex items-center gap-2">
        <span className="material-icons-outlined" style={{ fontSize: '18px', color: 'var(--portal)' }}>{icon}</span>
        <span className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">{label}</span>
      </div>
      <p className="mt-1 text-2xl font-bold" style={{ color: accent ? 'var(--portal)' : 'var(--text-primary)' }}>
        {value.toLocaleString()}
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Pipeline Tab
// ---------------------------------------------------------------------------

function PipelineTab({ stats }: { stats: { intake: number; processing: number; filed: number } }) {
  const stageData = [
    { ...PIPELINE_STAGES[0], count: stats.intake },
    { ...PIPELINE_STAGES[1], count: stats.processing },
    { ...PIPELINE_STAGES[2], count: stats.filed },
  ]

  return (
    <div>
      {/* Pipeline Visualization */}
      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">Document Pipeline</h3>
        <p className="mt-0.5 text-xs text-[var(--text-muted)]">Track documents from intake through processing to filing</p>

        <div className="mt-6 flex items-start gap-2">
          {stageData.map((stage, i) => (
            <div key={stage.key} className="flex flex-1 items-center">
              <div className="flex flex-1 flex-col items-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 text-center">
                <span
                  className="flex h-12 w-12 items-center justify-center rounded-full"
                  style={{ background: 'var(--portal-glow)' }}
                >
                  <span className="material-icons-outlined" style={{ fontSize: '24px', color: 'var(--portal)' }}>
                    {stage.icon}
                  </span>
                </span>
                <p className="mt-2 text-sm font-semibold text-[var(--text-primary)]">{stage.label}</p>
                <p className="mt-0.5 text-xs text-[var(--text-muted)]">{stage.description}</p>
                <div className="mt-3 rounded-full px-3 py-1 text-sm font-bold" style={{ background: 'var(--portal-glow)', color: 'var(--portal)' }}>
                  {stage.count}
                </div>
                <div className="mt-1 flex flex-wrap justify-center gap-1">
                  {stage.statuses.map((s) => (
                    <span key={s} className="rounded bg-[var(--bg-card)] px-1.5 py-0.5 text-[9px] text-[var(--text-muted)]">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
              {i < stageData.length - 1 && (
                <span className="mx-1 shrink-0 text-[var(--text-muted)]">
                  <span className="material-icons-outlined" style={{ fontSize: '24px' }}>arrow_forward</span>
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Pipeline Info */}
      <div className="mt-4 rounded-lg border border-dashed border-[var(--border)] bg-[var(--bg-surface)] p-4 text-center">
        <span className="material-icons-outlined text-2xl text-[var(--text-muted)]">info</span>
        <p className="mt-1 text-xs text-[var(--text-muted)]">
          Pipeline counts are derived from case task statuses. Full document pipeline collections will provide real-time counts when migrated to Firestore.
        </p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Form Library Tab
// ---------------------------------------------------------------------------

function FormLibraryTab({
  categoryFilter, statusFilter, search,
  onCategoryFilter, onStatusFilter, onSearch,
}: {
  categoryFilter: string
  statusFilter: string
  search: string
  onCategoryFilter: (v: string) => void
  onStatusFilter: (v: string) => void
  onSearch: (v: string) => void
}) {
  // Note: DEX form library data not yet in Firestore — show UI with empty state
  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Search forms..."
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:border-[var(--portal)]"
        />
        <select
          value={categoryFilter}
          onChange={(e) => onCategoryFilter(e.target.value)}
          className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none"
        >
          {FORM_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => onStatusFilter(e.target.value)}
          className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none"
        >
          {FORM_STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>
      </div>

      {/* Empty State — Form data not yet migrated */}
      <div className="mt-6 flex flex-col items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] py-16">
        <span className="material-icons-outlined text-5xl" style={{ color: 'var(--portal)' }}>library_books</span>
        <h3 className="mt-4 text-lg font-semibold text-[var(--text-primary)]">Form Library Ready</h3>
        <p className="mt-2 max-w-md text-center text-sm text-[var(--text-muted)]">
          The DEX form library tracks all carrier forms, disclosures, and compliance documents.
          Forms will appear here when the DEX collections are migrated to Firestore.
        </p>

        {/* Category Preview */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { icon: 'account_circle', label: 'Client Forms', desc: 'COMRA, Client Account' },
            { icon: 'account_balance', label: 'Account Forms', desc: 'TAF, Advisory Agreements' },
            { icon: 'business', label: 'Product Forms', desc: 'Carrier Applications' },
            { icon: 'gavel', label: 'Disclosures', desc: 'CRS, ADV, Privacy' },
          ].map((cat) => (
            <div key={cat.label} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3 text-center">
              <span className="material-icons-outlined" style={{ fontSize: '24px', color: 'var(--portal)' }}>{cat.icon}</span>
              <p className="mt-1 text-xs font-semibold text-[var(--text-primary)]">{cat.label}</p>
              <p className="mt-0.5 text-[10px] text-[var(--text-muted)]">{cat.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Kit Builder Tab
// ---------------------------------------------------------------------------

function KitBuilderTab({
  platform, regType, action, onPlatform, onRegType, onAction,
}: {
  platform: string
  regType: string
  action: string
  onPlatform: (v: string) => void
  onRegType: (v: string) => void
  onAction: (v: string) => void
}) {
  const hasSelection = platform && regType && action

  // Kit layers from DEX_Rules.gs
  const kitLayers = [
    { key: 'firmClient', label: 'Firm: Client', icon: 'person', description: 'Core RPI forms for all clients' },
    { key: 'firmAccount', label: 'Firm: Account', icon: 'account_balance', description: 'Account-level firm forms (TAF, IAA)' },
    { key: 'productClient', label: 'Product', icon: 'category', description: 'Product/carrier-specific forms' },
    { key: 'supporting', label: 'Supporting', icon: 'attach_file', description: 'Trust docs, advisory proposals' },
    { key: 'disclosures', label: 'Disclosures', icon: 'gavel', description: 'Regulatory compliance forms' },
  ]

  return (
    <div>
      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">Kit Builder</h3>
        <p className="mt-0.5 text-xs text-[var(--text-muted)]">
          Assemble document packages based on platform, registration type, and account action
        </p>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="text-xs font-medium text-[var(--text-muted)]">Platform</label>
            <select
              value={platform}
              onChange={(e) => onPlatform(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none"
            >
              <option value="">Select platform...</option>
              {KIT_PLATFORMS.map((p) => <option key={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-[var(--text-muted)]">Registration Type</label>
            <select
              value={regType}
              onChange={(e) => onRegType(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none"
            >
              <option value="">Select type...</option>
              {KIT_REG_TYPES.map((r) => <option key={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-[var(--text-muted)]">Account Action</label>
            <select
              value={action}
              onChange={(e) => onAction(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none"
            >
              <option value="">Select action...</option>
              {KIT_ACTIONS.map((a) => <option key={a}>{a}</option>)}
            </select>
          </div>
        </div>

        {/* Kit Layers Preview */}
        {hasSelection && (
          <div className="mt-5">
            <p className="text-xs font-medium text-[var(--text-muted)]">
              Kit Layers for {platform} / {regType} / {action}
            </p>
            <div className="mt-3 space-y-2">
              {kitLayers.map((layer) => (
                <div
                  key={layer.key}
                  className="flex items-center gap-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-3"
                >
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                    style={{ background: 'var(--portal-glow)' }}
                  >
                    <span className="material-icons-outlined" style={{ fontSize: '18px', color: 'var(--portal)' }}>
                      {layer.icon}
                    </span>
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[var(--text-primary)]">{layer.label}</p>
                    <p className="text-xs text-[var(--text-muted)]">{layer.description}</p>
                  </div>
                  <span className="text-xs italic text-[var(--text-muted)]">Pending migration</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {!hasSelection && (
          <div className="mt-5 rounded-lg border border-dashed border-[var(--border)] bg-[var(--bg-surface)] p-6 text-center">
            <span className="material-icons-outlined text-3xl text-[var(--text-muted)]">inventory_2</span>
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              Select platform, registration type, and account action to generate a document kit.
            </p>
          </div>
        )}
      </div>

      <div className="mt-4 rounded-lg border border-dashed border-[var(--border)] bg-[var(--bg-surface)] p-4 text-center">
        <span className="material-icons-outlined text-2xl text-[var(--text-muted)]">info</span>
        <p className="mt-1 text-xs text-[var(--text-muted)]">
          Kit generation calls the DEX GAS backend. Forms and rules will be available when DEX collections are migrated to Firestore.
        </p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tracker Tab
// ---------------------------------------------------------------------------

function TrackerTab({ tasks }: { tasks: TaskRecord[] }) {
  return (
    <div>
      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">Document Status Tracker</h3>
        <p className="mt-0.5 text-xs text-[var(--text-muted)]">Recent document-related tasks and their current stage</p>

        {tasks.length === 0 ? (
          <div className="mt-6 flex flex-col items-center justify-center py-12">
            <span className="material-icons-outlined text-4xl text-[var(--text-muted)]">track_changes</span>
            <p className="mt-3 text-sm text-[var(--text-muted)]">No document tasks found.</p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">Document-related tasks will appear here when tracked in the system.</p>
          </div>
        ) : (
          <div className="mt-4 max-h-[500px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] text-left text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
                  <th className="pb-2 pr-4">Task</th>
                  <th className="pb-2 pr-4">Type</th>
                  <th className="pb-2 pr-4">Status</th>
                  <th className="pb-2 pr-4">Priority</th>
                  <th className="pb-2 pr-4">Assigned To</th>
                  <th className="pb-2">Date</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((t) => (
                  <tr key={t._id} className="border-b border-[var(--border-subtle)] transition-colors hover:bg-[var(--bg-surface)]">
                    <td className="py-2.5 pr-4">
                      <p className="truncate font-medium text-[var(--text-primary)]" style={{ maxWidth: '200px' }}>
                        {t.title || t._id}
                      </p>
                    </td>
                    <td className="py-2.5 pr-4 text-[var(--text-secondary)]">{t.task_type || '-'}</td>
                    <td className="py-2.5 pr-4">
                      <span className="rounded-full px-2 py-0.5 text-[10px] font-medium" style={taskStatusStyle(t.status)}>
                        {t.status || 'unknown'}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4">
                      {t.priority ? (
                        <span className="rounded-full px-2 py-0.5 text-[10px] font-medium" style={priorityStyle(t.priority)}>
                          {t.priority}
                        </span>
                      ) : '-'}
                    </td>
                    <td className="py-2.5 pr-4 text-[var(--text-secondary)]">{t.assigned_to || '-'}</td>
                    <td className="py-2.5 text-[var(--text-muted)]">{formatDate(t.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
