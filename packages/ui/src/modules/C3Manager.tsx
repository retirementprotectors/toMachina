'use client'

import { useState, useMemo, useCallback } from 'react'
import { query, orderBy, type Query, type DocumentData } from 'firebase/firestore'
import { useCollection } from '@tomachina/db'
import { collections } from '@tomachina/db/src/firestore'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CampaignRecord {
  _id: string
  campaign_id?: string
  name?: string
  campaign_name?: string
  description?: string
  status?: string
  type?: string
  campaign_type?: string
  division?: string
  pillar?: string
  trigger_type?: string
  audience?: string
  template_ids?: string[]
  start_date?: string
  end_date?: string
  created_at?: string
  updated_at?: string
  target_count?: number
  frequency?: string
  cadence_series?: string
  owner?: string
  [key: string]: unknown
}

interface TemplateRecord {
  _id: string
  template_id?: string
  name?: string
  template_name?: string
  campaign_id?: string
  campaign_name?: string
  channel?: string
  template_type?: string
  type?: string
  touchpoint?: string
  touchpoint_day?: string
  subject?: string
  body?: string
  status?: string
  subject_block?: string
  greeting_block?: string
  intro_block?: string
  valueprop_block?: string
  painpoint_block?: string
  cta_block?: string
  signature_block?: string
  compliance_block?: string
  created_at?: string
  [key: string]: unknown
}

interface BlockRecord {
  _id: string
  block_id?: string
  name?: string
  block_name?: string
  type?: string
  block_type?: string
  content?: string
  pillar?: string
  channel?: string
  status?: string
  owner?: string
  version?: string
  character_count?: number
  created_at?: string
  updated_at?: string
  [key: string]: unknown
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CAMPAIGN_STATUSES = ['All', 'Draft', 'Planned', 'Active', 'Paused', 'Completed'] as const
const BLOCK_TYPES = [
  'All', 'SubjectLine', 'Greeting', 'Introduction', 'ValueProp',
  'PainPoint', 'CTA', 'Signature', 'Compliance', 'TextTemplate', 'VMScript', 'EmailBody',
] as const
const BLOCK_STATUSES = ['All', 'Draft', 'In Review', 'Approved', 'Archived'] as const
const PILLARS = ['All', 'Health', 'Wealth', 'Legacy', 'Family'] as const

type Tab = 'campaigns' | 'templates' | 'blocks' | 'builder'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function statusStyle(status?: string): { background: string; color: string } {
  const s = (status || '').toLowerCase()
  if (s === 'active' || s === 'running') return { background: 'rgba(16,185,129,0.15)', color: '#10b981' }
  if (s === 'draft') return { background: 'rgba(59,130,246,0.15)', color: '#3b82f6' }
  if (s === 'planned') return { background: 'rgba(168,85,247,0.15)', color: '#a855f7' }
  if (s === 'paused') return { background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }
  if (s === 'completed' || s === 'done') return { background: 'rgba(156,163,175,0.15)', color: '#9ca3af' }
  if (s === 'approved') return { background: 'rgba(16,185,129,0.15)', color: '#10b981' }
  if (s === 'in review') return { background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }
  if (s === 'archived') return { background: 'rgba(107,114,128,0.15)', color: '#6b7280' }
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
// C3Manager Component
// ---------------------------------------------------------------------------

export function C3Manager({ portal }: { portal: string }) {
  const campaignsQuery = useMemo<Query<DocumentData>>(() => query(collections.campaigns()), [])
  const templatesQuery = useMemo<Query<DocumentData>>(() => query(collections.templates()), [])
  const blocksQuery = useMemo<Query<DocumentData>>(() => query(collections.contentBlocks()), [])

  const { data: campaigns, loading: campLoading } = useCollection<CampaignRecord>(campaignsQuery, `c3-campaigns-${portal}`)
  const { data: templates, loading: tplLoading } = useCollection<TemplateRecord>(templatesQuery, `c3-templates-${portal}`)
  const { data: blocks, loading: blkLoading } = useCollection<BlockRecord>(blocksQuery, `c3-blocks-${portal}`)

  const loading = campLoading || tplLoading || blkLoading

  // --- State ---
  const [activeTab, setActiveTab] = useState<Tab>('campaigns')
  const [campaignStatusFilter, setCampaignStatusFilter] = useState('All')
  const [campaignTypeFilter, setCampaignTypeFilter] = useState('All')
  const [campaignSearch, setCampaignSearch] = useState('')
  const [selectedCampaign, setSelectedCampaign] = useState<CampaignRecord | null>(null)
  const [templateSearch, setTemplateSearch] = useState('')
  const [templateViewMode, setTemplateViewMode] = useState<'grid' | 'list'>('grid')
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateRecord | null>(null)
  const [blockTypeFilter, setBlockTypeFilter] = useState('All')
  const [blockStatusFilter, setBlockStatusFilter] = useState('All')
  const [blockPillarFilter, setBlockPillarFilter] = useState('All')
  const [blockSearch, setBlockSearch] = useState('')
  const [builderCampaignId, setBuilderCampaignId] = useState('')
  const [builderTemplateId, setBuilderTemplateId] = useState('')

  // --- Derived Data ---
  const campaignTypes = useMemo(() => {
    const types = new Set<string>()
    campaigns.forEach((c) => {
      const t = c.type || c.campaign_type
      if (t) types.add(t)
    })
    return ['All', ...Array.from(types).sort()]
  }, [campaigns])

  const filteredCampaigns = useMemo(() => {
    return campaigns.filter((c) => {
      if (campaignStatusFilter !== 'All') {
        const s = (c.status || '').toLowerCase()
        if (s !== campaignStatusFilter.toLowerCase()) return false
      }
      if (campaignTypeFilter !== 'All') {
        const t = (c.type || c.campaign_type || '').toLowerCase()
        if (t !== campaignTypeFilter.toLowerCase()) return false
      }
      if (campaignSearch) {
        const q = campaignSearch.toLowerCase()
        const name = (c.name || c.campaign_name || '').toLowerCase()
        const desc = (c.description || '').toLowerCase()
        if (!name.includes(q) && !desc.includes(q)) return false
      }
      return true
    })
  }, [campaigns, campaignStatusFilter, campaignTypeFilter, campaignSearch])

  const filteredTemplates = useMemo(() => {
    if (!templateSearch) return templates
    const q = templateSearch.toLowerCase()
    return templates.filter((t) => {
      const name = (t.name || t.template_name || '').toLowerCase()
      const channel = (t.channel || '').toLowerCase()
      const campaign = (t.campaign_name || t.campaign_id || '').toLowerCase()
      return name.includes(q) || channel.includes(q) || campaign.includes(q)
    })
  }, [templates, templateSearch])

  const filteredBlocks = useMemo(() => {
    return blocks.filter((b) => {
      if (blockTypeFilter !== 'All') {
        const t = (b.type || b.block_type || '').toLowerCase()
        if (t !== blockTypeFilter.toLowerCase()) return false
      }
      if (blockStatusFilter !== 'All') {
        const s = (b.status || '').toLowerCase()
        if (s !== blockStatusFilter.toLowerCase()) return false
      }
      if (blockPillarFilter !== 'All') {
        const p = (b.pillar || '').toLowerCase()
        if (p !== blockPillarFilter.toLowerCase()) return false
      }
      if (blockSearch) {
        const q = blockSearch.toLowerCase()
        const name = (b.name || b.block_name || '').toLowerCase()
        const content = (b.content || '').toLowerCase()
        const id = (b.block_id || '').toLowerCase()
        if (!name.includes(q) && !content.includes(q) && !id.includes(q)) return false
      }
      return true
    })
  }, [blocks, blockTypeFilter, blockStatusFilter, blockPillarFilter, blockSearch])

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    campaigns.forEach((c) => {
      const s = c.status || 'unknown'
      counts[s] = (counts[s] || 0) + 1
    })
    return counts
  }, [campaigns])

  const blockStatusCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    blocks.forEach((b) => {
      const s = b.status || 'unknown'
      counts[s] = (counts[s] || 0) + 1
    })
    return counts
  }, [blocks])

  const builderCampaign = useMemo(() => {
    if (!builderCampaignId) return null
    return campaigns.find((c) => c._id === builderCampaignId || c.campaign_id === builderCampaignId) || null
  }, [campaigns, builderCampaignId])

  const builderTemplate = useMemo(() => {
    if (!builderTemplateId) return null
    return templates.find((t) => t._id === builderTemplateId || t.template_id === builderTemplateId) || null
  }, [templates, builderTemplateId])

  const campaignTemplates = useMemo(() => {
    if (!builderCampaign) return []
    const id = builderCampaign.campaign_id || builderCampaign._id
    return templates.filter((t) => t.campaign_id === id || t.campaign_name === (builderCampaign.name || builderCampaign.campaign_name))
  }, [templates, builderCampaign])

  // Block slots for builder
  const slotLabels = [
    { key: 'subject_block', label: 'Subject' },
    { key: 'greeting_block', label: 'Greeting' },
    { key: 'intro_block', label: 'Introduction' },
    { key: 'valueprop_block', label: 'Value Prop' },
    { key: 'painpoint_block', label: 'Pain Point' },
    { key: 'cta_block', label: 'CTA' },
    { key: 'signature_block', label: 'Signature' },
    { key: 'compliance_block', label: 'Compliance' },
  ]

  // --- Tabs ---
  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'campaigns', label: 'Campaigns', icon: 'campaign' },
    { key: 'templates', label: 'Templates', icon: 'dashboard_customize' },
    { key: 'blocks', label: 'Content Blocks', icon: 'widgets' },
    { key: 'builder', label: 'Builder', icon: 'construction' },
  ]

  // --- Loading ---
  if (loading) {
    return (
      <div className="mx-auto max-w-7xl">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">C3 — Campaign Manager</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">Content, campaigns, and communications</p>
        <div className="mt-8 flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--portal)] border-t-transparent" />
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl">
      <h1 className="text-2xl font-bold text-[var(--text-primary)]">C3 — Campaign Manager</h1>
      <p className="mt-1 text-sm text-[var(--text-muted)]">Content, campaigns, and communications</p>

      {/* Status Dashboard */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon="campaign" label="Campaigns" value={campaigns.length} />
        <StatCard icon="dashboard_customize" label="Templates" value={templates.length} />
        <StatCard icon="widgets" label="Content Blocks" value={blocks.length} />
        <StatCard icon="check_circle" label="Approved Blocks" value={blockStatusCounts['Approved'] || blockStatusCounts['approved'] || 0} accent />
      </div>

      {/* Pipeline Status Pills */}
      {Object.keys(statusCounts).length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {Object.entries(statusCounts).map(([status, count]) => (
            <button
              key={status}
              onClick={() => { setActiveTab('campaigns'); setCampaignStatusFilter(status) }}
              className="rounded-full px-3 py-1 text-xs font-medium transition-opacity hover:opacity-80"
              style={statusStyle(status)}
            >
              {status}: {count}
            </button>
          ))}
        </div>
      )}

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
        {activeTab === 'campaigns' && (
          <CampaignsTab
            campaigns={filteredCampaigns}
            campaignTypes={campaignTypes}
            statusFilter={campaignStatusFilter}
            typeFilter={campaignTypeFilter}
            search={campaignSearch}
            onStatusFilter={setCampaignStatusFilter}
            onTypeFilter={setCampaignTypeFilter}
            onSearch={setCampaignSearch}
            selected={selectedCampaign}
            onSelect={setSelectedCampaign}
            templates={templates}
          />
        )}
        {activeTab === 'templates' && (
          <TemplatesTab
            templates={filteredTemplates}
            search={templateSearch}
            onSearch={setTemplateSearch}
            viewMode={templateViewMode}
            onViewMode={setTemplateViewMode}
            selected={selectedTemplate}
            onSelect={setSelectedTemplate}
            blocks={blocks}
          />
        )}
        {activeTab === 'blocks' && (
          <BlocksTab
            blocks={filteredBlocks}
            totalCount={blocks.length}
            typeFilter={blockTypeFilter}
            statusFilter={blockStatusFilter}
            pillarFilter={blockPillarFilter}
            search={blockSearch}
            onTypeFilter={setBlockTypeFilter}
            onStatusFilter={setBlockStatusFilter}
            onPillarFilter={setBlockPillarFilter}
            onSearch={setBlockSearch}
          />
        )}
        {activeTab === 'builder' && (
          <BuilderTab
            campaigns={campaigns}
            campaignTemplates={campaignTemplates}
            selectedCampaign={builderCampaign}
            selectedTemplate={builderTemplate}
            onSelectCampaign={setBuilderCampaignId}
            onSelectTemplate={setBuilderTemplateId}
            blocks={blocks}
            slotLabels={slotLabels}
          />
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
// Campaigns Tab
// ---------------------------------------------------------------------------

function CampaignsTab({
  campaigns, campaignTypes, statusFilter, typeFilter, search,
  onStatusFilter, onTypeFilter, onSearch, selected, onSelect, templates,
}: {
  campaigns: CampaignRecord[]
  campaignTypes: string[]
  statusFilter: string
  typeFilter: string
  search: string
  onStatusFilter: (v: string) => void
  onTypeFilter: (v: string) => void
  onSearch: (v: string) => void
  selected: CampaignRecord | null
  onSelect: (c: CampaignRecord | null) => void
  templates: TemplateRecord[]
}) {
  const campTemplateCount = useCallback((c: CampaignRecord) => {
    const id = c.campaign_id || c._id
    return templates.filter((t) => t.campaign_id === id).length
  }, [templates])

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Search campaigns..."
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:border-[var(--portal)]"
        />
        <select
          value={statusFilter}
          onChange={(e) => onStatusFilter(e.target.value)}
          className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none"
        >
          {CAMPAIGN_STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>
        <select
          value={typeFilter}
          onChange={(e) => onTypeFilter(e.target.value)}
          className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none"
        >
          {campaignTypes.map((t) => <option key={t}>{t}</option>)}
        </select>
        <span className="text-xs text-[var(--text-muted)]">{campaigns.length} results</span>
      </div>

      {/* Campaign List */}
      {campaigns.length === 0 ? (
        <EmptyState icon="campaign" message="No campaigns match your filters." />
      ) : (
        <div className="mt-4 space-y-2">
          {campaigns.map((c) => (
            <div key={c._id}>
              <button
                onClick={() => onSelect(selected?._id === c._id ? null : c)}
                className="flex w-full items-center justify-between rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] px-4 py-3 text-left transition-all hover:border-[var(--border)]"
                style={selected?._id === c._id ? { borderColor: 'var(--portal)' } : undefined}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-[var(--text-primary)]">
                    {c.name || c.campaign_name || c._id}
                  </p>
                  <p className="text-xs text-[var(--text-muted)]">
                    {[c.type || c.campaign_type, c.division, c.pillar].filter(Boolean).join(' / ') || 'General'}
                    {c.owner && <span> &middot; {c.owner}</span>}
                  </p>
                </div>
                <div className="ml-4 flex shrink-0 items-center gap-3">
                  <span className="text-xs text-[var(--text-muted)]">{campTemplateCount(c)} templates</span>
                  <span className="rounded-full px-2.5 py-0.5 text-xs font-medium" style={statusStyle(c.status)}>
                    {c.status || 'draft'}
                  </span>
                  <span className="material-icons-outlined text-[var(--text-muted)]" style={{ fontSize: '18px' }}>
                    {selected?._id === c._id ? 'expand_less' : 'expand_more'}
                  </span>
                </div>
              </button>
              {/* Campaign Detail */}
              {selected?._id === c._id && (
                <div className="mt-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5">
                  <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
                    <div>
                      <p className="text-xs text-[var(--text-muted)]">Type</p>
                      <p className="font-medium text-[var(--text-primary)]">{c.type || c.campaign_type || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-[var(--text-muted)]">Division</p>
                      <p className="font-medium text-[var(--text-primary)]">{c.division || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-[var(--text-muted)]">Pillar</p>
                      <p className="font-medium text-[var(--text-primary)]">{c.pillar || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-[var(--text-muted)]">Trigger</p>
                      <p className="font-medium text-[var(--text-primary)]">{c.trigger_type || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-[var(--text-muted)]">Start</p>
                      <p className="font-medium text-[var(--text-primary)]">{formatDate(c.start_date)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-[var(--text-muted)]">End</p>
                      <p className="font-medium text-[var(--text-primary)]">{formatDate(c.end_date)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-[var(--text-muted)]">Target Count</p>
                      <p className="font-medium text-[var(--text-primary)]">{c.target_count?.toLocaleString() || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-[var(--text-muted)]">Templates</p>
                      <p className="font-medium text-[var(--text-primary)]">{campTemplateCount(c)}</p>
                    </div>
                  </div>
                  {c.description && (
                    <div className="mt-4">
                      <p className="text-xs text-[var(--text-muted)]">Description</p>
                      <p className="mt-1 text-sm text-[var(--text-secondary)]">{c.description}</p>
                    </div>
                  )}
                  {c.audience && (
                    <div className="mt-3">
                      <p className="text-xs text-[var(--text-muted)]">Audience</p>
                      <p className="mt-1 text-sm text-[var(--text-secondary)]">{c.audience}</p>
                    </div>
                  )}
                  <p className="mt-4 text-xs text-[var(--text-muted)]">
                    Created: {formatDate(c.created_at)} &middot; Updated: {formatDate(c.updated_at)}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Templates Tab
// ---------------------------------------------------------------------------

function TemplatesTab({
  templates, search, onSearch, viewMode, onViewMode, selected, onSelect, blocks,
}: {
  templates: TemplateRecord[]
  search: string
  onSearch: (v: string) => void
  viewMode: 'grid' | 'list'
  onViewMode: (v: 'grid' | 'list') => void
  selected: TemplateRecord | null
  onSelect: (t: TemplateRecord | null) => void
  blocks: BlockRecord[]
}) {
  const resolveBlock = useCallback((blockId?: string) => {
    if (!blockId) return null
    return blocks.find((b) => b.block_id === blockId || b._id === blockId) || null
  }, [blocks])

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Search templates..."
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:border-[var(--portal)]"
        />
        <div className="flex rounded-lg border border-[var(--border-subtle)]">
          <button
            onClick={() => onViewMode('grid')}
            className="px-3 py-2"
            style={{ background: viewMode === 'grid' ? 'var(--portal-glow)' : 'transparent' }}
          >
            <span className="material-icons-outlined" style={{ fontSize: '18px', color: viewMode === 'grid' ? 'var(--portal)' : 'var(--text-muted)' }}>grid_view</span>
          </button>
          <button
            onClick={() => onViewMode('list')}
            className="px-3 py-2"
            style={{ background: viewMode === 'list' ? 'var(--portal-glow)' : 'transparent' }}
          >
            <span className="material-icons-outlined" style={{ fontSize: '18px', color: viewMode === 'list' ? 'var(--portal)' : 'var(--text-muted)' }}>view_list</span>
          </button>
        </div>
        <span className="text-xs text-[var(--text-muted)]">{templates.length} templates</span>
      </div>

      {/* Template List */}
      {templates.length === 0 ? (
        <EmptyState icon="dashboard_customize" message="No templates found." />
      ) : viewMode === 'grid' ? (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => (
            <button
              key={t._id}
              onClick={() => onSelect(selected?._id === t._id ? null : t)}
              className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 text-left transition-all hover:border-[var(--border)]"
              style={selected?._id === t._id ? { borderColor: 'var(--portal)' } : undefined}
            >
              <div className="flex items-start justify-between">
                <p className="truncate text-sm font-medium text-[var(--text-primary)]">
                  {t.name || t.template_name || t._id}
                </p>
                <span className="ml-2 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium" style={statusStyle(t.status)}>
                  {t.status || 'draft'}
                </span>
              </div>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                {[t.channel, t.touchpoint].filter(Boolean).join(' / ') || '-'}
              </p>
              {t.campaign_name && (
                <p className="mt-1 truncate text-xs text-[var(--text-muted)]">Campaign: {t.campaign_name}</p>
              )}
            </button>
          ))}
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          {templates.map((t) => (
            <button
              key={t._id}
              onClick={() => onSelect(selected?._id === t._id ? null : t)}
              className="flex w-full items-center justify-between rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] px-4 py-3 text-left transition-all hover:border-[var(--border)]"
              style={selected?._id === t._id ? { borderColor: 'var(--portal)' } : undefined}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-[var(--text-primary)]">
                  {t.name || t.template_name || t._id}
                </p>
                <p className="text-xs text-[var(--text-muted)]">
                  {[t.channel, t.touchpoint, t.campaign_name || t.campaign_id].filter(Boolean).join(' / ')}
                </p>
              </div>
              <span className="ml-4 shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium" style={statusStyle(t.status)}>
                {t.status || 'draft'}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Template Detail Modal */}
      {selected && (
        <div className="mt-4 rounded-xl border border-[var(--portal)] bg-[var(--bg-surface)] p-5">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-semibold text-[var(--text-primary)]">
                {selected.name || selected.template_name || selected._id}
              </h3>
              <p className="text-sm text-[var(--text-muted)]">
                {[selected.channel, selected.touchpoint, selected.touchpoint_day && `Day ${selected.touchpoint_day}`].filter(Boolean).join(' / ')}
              </p>
            </div>
            <button onClick={() => onSelect(null)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
              <span className="material-icons-outlined" style={{ fontSize: '20px' }}>close</span>
            </button>
          </div>
          {selected.subject && (
            <div className="mt-4">
              <p className="text-xs font-medium text-[var(--text-muted)]">Subject</p>
              <p className="mt-1 text-sm text-[var(--text-primary)]">{selected.subject}</p>
            </div>
          )}
          {/* Block Slots */}
          <div className="mt-4">
            <p className="text-xs font-medium text-[var(--text-muted)]">Block Assignments</p>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                { key: 'subject_block', label: 'Subject' },
                { key: 'greeting_block', label: 'Greeting' },
                { key: 'intro_block', label: 'Intro' },
                { key: 'valueprop_block', label: 'Value Prop' },
                { key: 'painpoint_block', label: 'Pain Point' },
                { key: 'cta_block', label: 'CTA' },
                { key: 'signature_block', label: 'Signature' },
                { key: 'compliance_block', label: 'Compliance' },
              ].map((slot) => {
                const blockId = (selected as Record<string, unknown>)[slot.key] as string | undefined
                const block = resolveBlock(blockId)
                return (
                  <div key={slot.key} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] p-2.5">
                    <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">{slot.label}</p>
                    {block ? (
                      <p className="mt-0.5 truncate text-xs text-[var(--text-primary)]">{block.name || block.block_name || block.block_id}</p>
                    ) : blockId ? (
                      <p className="mt-0.5 truncate text-xs text-[var(--text-secondary)]">{blockId}</p>
                    ) : (
                      <p className="mt-0.5 text-xs italic text-[var(--text-muted)]">Empty</p>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
          {selected.body && (
            <div className="mt-4">
              <p className="text-xs font-medium text-[var(--text-muted)]">Body Preview</p>
              <div className="mt-1 max-h-40 overflow-y-auto rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] p-3 text-sm text-[var(--text-secondary)]">
                {selected.body}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Blocks Tab
// ---------------------------------------------------------------------------

function BlocksTab({
  blocks, totalCount, typeFilter, statusFilter, pillarFilter, search,
  onTypeFilter, onStatusFilter, onPillarFilter, onSearch,
}: {
  blocks: BlockRecord[]
  totalCount: number
  typeFilter: string
  statusFilter: string
  pillarFilter: string
  search: string
  onTypeFilter: (v: string) => void
  onStatusFilter: (v: string) => void
  onPillarFilter: (v: string) => void
  onSearch: (v: string) => void
}) {
  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Search blocks..."
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:border-[var(--portal)]"
        />
        <select
          value={typeFilter}
          onChange={(e) => onTypeFilter(e.target.value)}
          className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none"
        >
          {BLOCK_TYPES.map((t) => <option key={t}>{t}</option>)}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => onStatusFilter(e.target.value)}
          className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none"
        >
          {BLOCK_STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>
        <select
          value={pillarFilter}
          onChange={(e) => onPillarFilter(e.target.value)}
          className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none"
        >
          {PILLARS.map((p) => <option key={p}>{p}</option>)}
        </select>
        <span className="text-xs text-[var(--text-muted)]">{blocks.length} of {totalCount}</span>
      </div>

      {/* Block Grid */}
      {blocks.length === 0 ? (
        <EmptyState icon="widgets" message="No content blocks match your filters." />
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {blocks.map((b) => (
            <div
              key={b._id}
              className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 transition-all hover:border-[var(--border)]"
            >
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-[var(--text-primary)]">
                    {b.name || b.block_name || b.block_id || b._id}
                  </p>
                  <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                    {b.block_id || b._id}
                  </p>
                </div>
                <span className="ml-2 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium" style={statusStyle(b.status)}>
                  {b.status || 'draft'}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {(b.type || b.block_type) && (
                  <span className="rounded bg-[var(--bg-surface)] px-1.5 py-0.5 text-[10px] text-[var(--text-secondary)]">
                    {b.type || b.block_type}
                  </span>
                )}
                {b.channel && (
                  <span className="rounded bg-[var(--bg-surface)] px-1.5 py-0.5 text-[10px] text-[var(--text-secondary)]">
                    {b.channel}
                  </span>
                )}
                {b.pillar && (
                  <span className="rounded bg-[var(--bg-surface)] px-1.5 py-0.5 text-[10px] text-[var(--text-secondary)]">
                    {b.pillar}
                  </span>
                )}
              </div>
              {b.content && (
                <p className="mt-2 line-clamp-2 text-xs text-[var(--text-muted)]">{b.content}</p>
              )}
              <div className="mt-2 flex items-center justify-between text-[10px] text-[var(--text-muted)]">
                {b.owner && <span>Owner: {b.owner}</span>}
                {b.version && <span>v{b.version}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Builder Tab
// ---------------------------------------------------------------------------

function BuilderTab({
  campaigns, campaignTemplates, selectedCampaign, selectedTemplate,
  onSelectCampaign, onSelectTemplate, blocks, slotLabels,
}: {
  campaigns: CampaignRecord[]
  campaignTemplates: TemplateRecord[]
  selectedCampaign: CampaignRecord | null
  selectedTemplate: TemplateRecord | null
  onSelectCampaign: (id: string) => void
  onSelectTemplate: (id: string) => void
  blocks: BlockRecord[]
  slotLabels: { key: string; label: string }[]
}) {
  const resolveBlock = useCallback((blockId?: string) => {
    if (!blockId) return null
    return blocks.find((b) => b.block_id === blockId || b._id === blockId) || null
  }, [blocks])

  // Assembled preview
  const assembledContent = useMemo(() => {
    if (!selectedTemplate) return null
    const bodySlots = ['greeting_block', 'intro_block', 'valueprop_block', 'painpoint_block', 'cta_block', 'signature_block', 'compliance_block']
    const parts: string[] = []
    bodySlots.forEach((slot) => {
      const blockId = (selectedTemplate as Record<string, unknown>)[slot] as string | undefined
      const block = resolveBlock(blockId)
      if (block?.content) parts.push(block.content)
    })
    return parts.length > 0 ? parts.join('\n\n') : null
  }, [selectedTemplate, resolveBlock])

  return (
    <div>
      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">Campaign Builder</h3>
        <p className="mt-0.5 text-xs text-[var(--text-muted)]">Select a campaign, pick a template, and preview the assembled content</p>

        {/* Step 1: Select Campaign */}
        <div className="mt-5">
          <label className="text-xs font-medium text-[var(--text-muted)]">1. Select Campaign</label>
          <select
            value={selectedCampaign?._id || ''}
            onChange={(e) => { onSelectCampaign(e.target.value); onSelectTemplate('') }}
            className="mt-1 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none"
          >
            <option value="">Choose a campaign...</option>
            {campaigns.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name || c.campaign_name || c._id} ({c.status || 'draft'})
              </option>
            ))}
          </select>
        </div>

        {/* Step 2: Select Template */}
        {selectedCampaign && (
          <div className="mt-4">
            <label className="text-xs font-medium text-[var(--text-muted)]">2. Select Template</label>
            {campaignTemplates.length === 0 ? (
              <p className="mt-1 text-xs italic text-[var(--text-muted)]">No templates linked to this campaign.</p>
            ) : (
              <select
                value={selectedTemplate?._id || ''}
                onChange={(e) => onSelectTemplate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none"
              >
                <option value="">Choose a template...</option>
                {campaignTemplates.map((t) => (
                  <option key={t._id} value={t._id}>
                    {t.name || t.template_name || t._id} ({t.channel || 'Unknown'} / {t.touchpoint || '-'})
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        {/* Step 3: Block Slots */}
        {selectedTemplate && (
          <div className="mt-4">
            <label className="text-xs font-medium text-[var(--text-muted)]">3. Content Block Assignments</label>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {slotLabels.map((slot) => {
                const blockId = (selectedTemplate as Record<string, unknown>)[slot.key] as string | undefined
                const block = resolveBlock(blockId)
                return (
                  <div key={slot.key} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3">
                    <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">{slot.label}</p>
                    {block ? (
                      <>
                        <p className="mt-1 truncate text-xs font-medium text-[var(--text-primary)]">{block.name || block.block_name || block.block_id}</p>
                        <span className="mt-0.5 inline-block rounded-full px-1.5 py-0.5 text-[9px] font-medium" style={statusStyle(block.status)}>
                          {block.status || 'draft'}
                        </span>
                      </>
                    ) : blockId ? (
                      <p className="mt-1 truncate text-xs text-[var(--text-secondary)]">{blockId}</p>
                    ) : (
                      <p className="mt-1 text-xs italic text-[var(--text-muted)]">Not assigned</p>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Step 4: Preview */}
        {assembledContent && (
          <div className="mt-5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-[var(--text-muted)]">4. Assembled Preview</label>
              <span className="rounded-full bg-[var(--bg-surface)] px-2 py-0.5 text-[10px] text-[var(--text-muted)]">
                Read-only preview &middot; Send via API
              </span>
            </div>
            <div className="mt-2 max-h-64 overflow-y-auto rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 text-sm leading-relaxed text-[var(--text-secondary)] whitespace-pre-wrap">
              {assembledContent}
            </div>
          </div>
        )}
      </div>

      {/* Builder Help */}
      <div className="mt-4 rounded-lg border border-dashed border-[var(--border)] bg-[var(--bg-surface)] p-4 text-center">
        <span className="material-icons-outlined text-2xl text-[var(--text-muted)]">info</span>
        <p className="mt-1 text-xs text-[var(--text-muted)]">
          Campaign sends are orchestrated through the API. This builder previews assembled content with merge fields intact.
        </p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Shared Helpers
// ---------------------------------------------------------------------------

function EmptyState({ icon, message }: { icon: string; message: string }) {
  return (
    <div className="mt-4 flex flex-col items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] py-16">
      <span className="material-icons-outlined text-4xl text-[var(--text-muted)]">{icon}</span>
      <p className="mt-3 text-sm text-[var(--text-muted)]">{message}</p>
    </div>
  )
}
