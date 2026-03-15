'use client'

import { useState, useMemo, useCallback } from 'react'
import { query, type Query, type DocumentData } from 'firebase/firestore'
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

interface SendLogRecord {
  _id: string
  send_id?: string
  campaign_id?: string
  contact_id?: string
  channel?: string
  status?: string
  provider?: string
  error_message?: string
  external_id?: string
  created_at?: string
  [key: string]: unknown
}

interface ScheduleRecord {
  _id: string
  schedule_id?: string
  campaign_id?: string
  scheduled_for?: string
  channel?: string
  status?: string
  created_by?: string
  created_at?: string
  result?: Record<string, unknown>
  [key: string]: unknown
}

interface DeliveryEventRecord {
  _id: string
  event_id?: string
  send_job_id?: string
  campaign_id?: string
  recipient_id?: string
  event_type?: string
  channel?: string
  provider?: string
  provider_event_id?: string
  metadata?: Record<string, unknown>
  timestamp?: string
  [key: string]: unknown
}

interface DripSequenceRecord {
  _id: string
  drip_id?: string
  campaign_id?: string
  sequence_name?: string
  description?: string
  steps?: DripStepRecord[]
  fallback_channel?: string
  max_steps?: number
  status?: string
  created_by?: string
  created_at?: string
  updated_at?: string
  [key: string]: unknown
}

interface DripStepRecord {
  step_index: number
  delay_days: number
  channel: string
  template_id: string
  conditions: DripConditionRecord[]
}

interface DripConditionRecord {
  type: string
  action: string
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
const AEP_AFFECTED = ['AEP', 'T65', 'MAPD', 'MED_SUPP', 'MEDICARE']

type Tab = 'campaigns' | 'templates' | 'blocks' | 'builder' | 'schedule' | 'audience' | 'drip' | 'analytics'

const DRIP_CHANNELS = ['email', 'sms', 'call'] as const
const DRIP_CONDITION_TYPES = ['responded', 'opened', 'clicked', 'opted_out'] as const

// Segment condition options for audience builder
const SEGMENT_FIELDS = ['status', 'product_type', 'geography', 'age_range', 'book_of_business', 'division', 'pillar'] as const
const SEGMENT_OPERATORS = ['equals', 'not_equals', 'contains', 'greater_than', 'less_than', 'between'] as const

// Mock scheduled campaigns
const MOCK_SCHEDULED_CAMPAIGNS: { id: string; campaign_name: string; scheduled_for: string; audience_size: number; channel: string; status: string }[] = [
  { id: 'sched-1', campaign_name: 'T65 Birthday Outreach — March Cohort', scheduled_for: '2026-03-18T09:00:00', audience_size: 342, channel: 'email', status: 'Scheduled' },
  { id: 'sched-2', campaign_name: 'MYGA Rate Update — Q1 Refresh', scheduled_for: '2026-03-22T10:30:00', audience_size: 1_087, channel: 'email', status: 'Scheduled' },
  { id: 'sched-3', campaign_name: 'We\'re Your People — Welcome Drip', scheduled_for: '2026-03-25T08:00:00', audience_size: 56, channel: 'sms', status: 'Pending Review' },
]

// Mock analytics fallback (when no real data exists yet)
const MOCK_ANALYTICS = {
  open_rate: 42,
  click_rate: 8.3,
  delivery_rate: 97.5,
  bounce_rate: 2.5,
  top_campaigns: [
    { name: 'T65 Birthday Outreach', sent: 4_210, delivered: 4_105, opened: 1_768, clicked: 349 },
    { name: 'MYGA Rate Update', sent: 2_890, delivered: 2_817, opened: 1_183, clicked: 231 },
    { name: 'AEP Open Enrollment Reminder', sent: 1_560, delivered: 1_521, opened: 639, clicked: 125 },
    { name: 'We\'re Your People — Welcome', sent: 890, delivered: 868, opened: 521, clicked: 178 },
    { name: 'Annuity Maturity Notice', sent: 645, delivered: 629, opened: 264, clicked: 53 },
  ],
}

// Welcome campaign template definition (TRK-117)
const WELCOME_SEQUENCE = {
  name: 'We\'re Your People\u2122 — Welcome Sequence',
  description: 'Pre-built 3-touch welcome sequence for newly acquired clients. Introduces the RPI team, sets expectations, and invites engagement.',
  touches: [
    { day: 0, channel: 'email', label: 'Welcome Email', subject: 'Welcome to the RPI Family — We\'re Your People\u2122', preview: 'Hi {{first_name}}, welcome! We\'re thrilled to have you as part of the RPI family. Your dedicated team is ready to help you navigate your financial future...' },
    { day: 2, channel: 'sms', label: 'Intro SMS', preview: 'Hi {{first_name}}! This is {{agent_name}} from RPI. Just wanted to say welcome \u2014 we\'re here for you. Reply anytime or call us at {{office_phone}}.' },
    { day: 7, channel: 'call', label: 'Check-in Call', preview: 'Scheduled outbound call to {{first_name}} {{last_name}} \u2014 introduce advisor, confirm account details, answer questions.' },
  ],
}

// Segment condition type for audience builder
interface SegmentCondition {
  field: typeof SEGMENT_FIELDS[number]
  operator: typeof SEGMENT_OPERATORS[number]
  value: string
  value2?: string // for 'between' operator
}

interface SegmentGroup {
  logic: 'AND' | 'OR'
  conditions: SegmentCondition[]
}
const DRIP_CONDITION_ACTIONS = ['skip', 'stop', 'switch_channel'] as const

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function statusStyle(status?: string): { background: string; color: string } {
  const s = (status || '').toLowerCase()
  if (s === 'active' || s === 'running') return { background: 'rgba(16,185,129,0.15)', color: '#10b981' }
  if (s === 'draft') return { background: 'rgba(59,130,246,0.15)', color: '#3b82f6' }
  if (s === 'planned' || s === 'scheduled') return { background: 'rgba(168,85,247,0.15)', color: '#a855f7' }
  if (s === 'paused') return { background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }
  if (s === 'completed' || s === 'done' || s === 'sent' || s === 'delivered') return { background: 'rgba(156,163,175,0.15)', color: '#9ca3af' }
  if (s === 'approved') return { background: 'rgba(16,185,129,0.15)', color: '#10b981' }
  if (s === 'in review' || s === 'processing') return { background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }
  if (s === 'failed' || s === 'bounced' || s === 'cancelled') return { background: 'rgba(239,68,68,0.15)', color: '#ef4444' }
  if (s === 'skipped') return { background: 'rgba(107,114,128,0.15)', color: '#6b7280' }
  if (s === 'queued') return { background: 'rgba(59,130,246,0.15)', color: '#3b82f6' }
  return { background: 'var(--bg-surface)', color: 'var(--text-muted)' }
}

function formatDate(d?: string): string {
  if (!d) return '-'
  try { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) }
  catch { return d }
}

function isAepBlackout(date: Date, campaignType: string): boolean {
  const type = campaignType.toUpperCase()
  if (!AEP_AFFECTED.some((t) => type.includes(t))) return false
  const m = date.getMonth() + 1, day = date.getDate()
  return (m === 10 && day >= 1) || m === 11 || (m === 12 && day <= 7)
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

  // Schedule state
  const [scheduleFormOpen, setScheduleFormOpen] = useState(false)
  const [schedCampaignId, setSchedCampaignId] = useState('')
  const [schedDate, setSchedDate] = useState('')
  const [schedTime, setSchedTime] = useState('09:00')

  // Audience builder state
  const [audienceSegments, setAudienceSegments] = useState<SegmentGroup[]>([
    { logic: 'AND', conditions: [{ field: 'status', operator: 'equals', value: 'Active' }] }
  ])
  const [audiencePreviewCount] = useState(1_247)

  // A/B testing state
  const [abTestEnabled, setAbTestEnabled] = useState(false)
  const [abSplit, setAbSplit] = useState(50)

  // Drip builder state
  const [dripName, setDripName] = useState('')
  const [dripDescription, setDripDescription] = useState('')
  const [dripCampaignId, setDripCampaignId] = useState('')
  const [dripFallbackChannel, setDripFallbackChannel] = useState<'email' | 'sms'>('email')
  const [dripSteps, setDripSteps] = useState<DripStepRecord[]>([])
  const [dripSaving, setDripSaving] = useState(false)
  const [dripSaveMessage, setDripSaveMessage] = useState('')

  // --- Derived ---
  const campaignTypes = useMemo(() => {
    const types = new Set<string>()
    campaigns.forEach((c) => { const t = c.type || c.campaign_type; if (t) types.add(t) })
    return ['All', ...Array.from(types).sort()]
  }, [campaigns])

  const filteredCampaigns = useMemo(() => {
    return campaigns.filter((c) => {
      if (campaignStatusFilter !== 'All' && (c.status || '').toLowerCase() !== campaignStatusFilter.toLowerCase()) return false
      if (campaignTypeFilter !== 'All' && (c.type || c.campaign_type || '').toLowerCase() !== campaignTypeFilter.toLowerCase()) return false
      if (campaignSearch) {
        const q = campaignSearch.toLowerCase()
        if (!(c.name || c.campaign_name || '').toLowerCase().includes(q) && !(c.description || '').toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [campaigns, campaignStatusFilter, campaignTypeFilter, campaignSearch])

  const filteredTemplates = useMemo(() => {
    if (!templateSearch) return templates
    const q = templateSearch.toLowerCase()
    return templates.filter((t) =>
      (t.name || t.template_name || '').toLowerCase().includes(q) ||
      (t.channel || '').toLowerCase().includes(q) ||
      (t.campaign_name || t.campaign_id || '').toLowerCase().includes(q)
    )
  }, [templates, templateSearch])

  const filteredBlocks = useMemo(() => {
    return blocks.filter((b) => {
      if (blockTypeFilter !== 'All' && (b.type || b.block_type || '').toLowerCase() !== blockTypeFilter.toLowerCase()) return false
      if (blockStatusFilter !== 'All' && (b.status || '').toLowerCase() !== blockStatusFilter.toLowerCase()) return false
      if (blockPillarFilter !== 'All' && (b.pillar || '').toLowerCase() !== blockPillarFilter.toLowerCase()) return false
      if (blockSearch) {
        const q = blockSearch.toLowerCase()
        if (!(b.name || b.block_name || '').toLowerCase().includes(q) && !(b.content || '').toLowerCase().includes(q) && !(b.block_id || '').toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [blocks, blockTypeFilter, blockStatusFilter, blockPillarFilter, blockSearch])

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    campaigns.forEach((c) => { const s = c.status || 'unknown'; counts[s] = (counts[s] || 0) + 1 })
    return counts
  }, [campaigns])

  const blockStatusCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    blocks.forEach((b) => { const s = b.status || 'unknown'; counts[s] = (counts[s] || 0) + 1 })
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

  const campTemplateCount = useCallback((c: CampaignRecord) => {
    const id = c.campaign_id || c._id
    return templates.filter((t) => t.campaign_id === id).length
  }, [templates])

  const resolveBlock = useCallback((blockId?: string) => {
    if (!blockId) return null
    return blocks.find((b) => b.block_id === blockId || b._id === blockId) || null
  }, [blocks])

  // AEP blackout check for global banner
  const now = new Date()
  const currentMonth = now.getMonth() + 1
  const currentDay = now.getDate()
  const isAepBlackoutNow = (currentMonth === 10 && currentDay >= 1) || currentMonth === 11 || (currentMonth === 12 && currentDay <= 7)

  // Tabs
  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'campaigns', label: 'Campaigns', icon: 'campaign' },
    { key: 'templates', label: 'Templates', icon: 'dashboard_customize' },
    { key: 'blocks', label: 'Content Blocks', icon: 'widgets' },
    { key: 'builder', label: 'Builder', icon: 'construction' },
    { key: 'schedule', label: 'Schedule', icon: 'calendar_month' },
    { key: 'audience', label: 'Audience', icon: 'people' },
    { key: 'drip', label: 'Drip Sequences', icon: 'water_drop' },
    { key: 'analytics', label: 'Analytics', icon: 'insights' },
  ]

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

      {/* Stats */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon="campaign" label="Campaigns" value={campaigns.length} />
        <StatCard icon="dashboard_customize" label="Templates" value={templates.length} />
        <StatCard icon="widgets" label="Content Blocks" value={blocks.length} />
        <StatCard icon="check_circle" label="Approved Blocks" value={blockStatusCounts['Approved'] || blockStatusCounts['approved'] || 0} accent />
      </div>

      {/* Status Pills */}
      {Object.keys(statusCounts).length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {Object.entries(statusCounts).map(([status, count]) => (
            <button key={status} onClick={() => { setActiveTab('campaigns'); setCampaignStatusFilter(status) }}
              className="rounded-full px-3 py-1 text-xs font-medium transition-opacity hover:opacity-80"
              style={statusStyle(status)}>{status}: {count}</button>
          ))}
        </div>
      )}

      {/* AEP Blackout Global Banner (TRK-127) */}
      {isAepBlackoutNow && (
        <div className="mt-4 flex items-center gap-3 rounded-xl border p-4" style={{ background: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.25)' }}>
          <span className="material-icons-outlined" style={{ fontSize: '24px', color: '#ef4444' }}>shield</span>
          <div>
            <p className="text-sm font-semibold" style={{ color: '#ef4444' }}>AEP Blackout Active — Oct 1 through Dec 7</p>
            <p className="mt-0.5 text-xs text-[var(--text-muted)]">
              Medicare marketing campaigns (AEP, T65, MAPD, MedSupp) are blocked during this period. Non-Medicare campaigns are unaffected.
              Scheduling a Medicare campaign will automatically defer delivery to Dec 8.
            </p>
          </div>
        </div>
      )}

      {/* Tab Nav */}
      <div className="mt-6 flex gap-1 overflow-x-auto border-b border-[var(--border-subtle)]">
        {tabs.map((tab) => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className="flex items-center gap-1.5 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors"
            style={{
              borderColor: activeTab === tab.key ? 'var(--portal)' : 'transparent',
              color: activeTab === tab.key ? 'var(--portal)' : 'var(--text-muted)',
            }}>
            <span className="material-icons-outlined" style={{ fontSize: '18px' }}>{tab.icon}</span>{tab.label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {activeTab === 'campaigns' && (
          <CampaignsTab campaigns={filteredCampaigns} campaignTypes={campaignTypes}
            statusFilter={campaignStatusFilter} typeFilter={campaignTypeFilter} search={campaignSearch}
            onStatusFilter={setCampaignStatusFilter} onTypeFilter={setCampaignTypeFilter} onSearch={setCampaignSearch}
            selected={selectedCampaign} onSelect={setSelectedCampaign} campTemplateCount={campTemplateCount}
            abTestEnabled={abTestEnabled} onAbTestEnabled={setAbTestEnabled} abSplit={abSplit} onAbSplit={setAbSplit} />
        )}
        {activeTab === 'templates' && (
          <TemplatesTab templates={filteredTemplates} search={templateSearch} onSearch={setTemplateSearch}
            viewMode={templateViewMode} onViewMode={setTemplateViewMode}
            selected={selectedTemplate} onSelect={setSelectedTemplate} resolveBlock={resolveBlock} />
        )}
        {activeTab === 'blocks' && (
          <BlocksTab blocks={filteredBlocks} totalCount={blocks.length}
            typeFilter={blockTypeFilter} statusFilter={blockStatusFilter} pillarFilter={blockPillarFilter} search={blockSearch}
            onTypeFilter={setBlockTypeFilter} onStatusFilter={setBlockStatusFilter} onPillarFilter={setBlockPillarFilter} onSearch={setBlockSearch} />
        )}
        {activeTab === 'builder' && (
          <BuilderTab campaigns={campaigns} campaignTemplates={campaignTemplates}
            selectedCampaign={builderCampaign} selectedTemplate={builderTemplate}
            onSelectCampaign={setBuilderCampaignId} onSelectTemplate={setBuilderTemplateId}
            resolveBlock={resolveBlock} />
        )}
        {activeTab === 'schedule' && (
          <ScheduleTab
            campaigns={campaigns}
            scheduled={MOCK_SCHEDULED_CAMPAIGNS}
            formOpen={scheduleFormOpen} onFormOpen={setScheduleFormOpen}
            schedCampaignId={schedCampaignId} onSchedCampaignId={setSchedCampaignId}
            schedDate={schedDate} onSchedDate={setSchedDate}
            schedTime={schedTime} onSchedTime={setSchedTime}
          />
        )}
        {activeTab === 'audience' && (
          <AudienceTab
            segments={audienceSegments}
            onSegments={setAudienceSegments}
            previewCount={audiencePreviewCount}
          />
        )}
        {activeTab === 'drip' && (
          <DripTab
            campaigns={campaigns}
            templates={templates}
            portal={portal}
            dripName={dripName} onDripName={setDripName}
            dripDescription={dripDescription} onDripDescription={setDripDescription}
            dripCampaignId={dripCampaignId} onDripCampaignId={setDripCampaignId}
            dripFallbackChannel={dripFallbackChannel} onDripFallbackChannel={setDripFallbackChannel}
            dripSteps={dripSteps} onDripSteps={setDripSteps}
            dripSaving={dripSaving} dripSaveMessage={dripSaveMessage}
            onSave={async () => {
              if (!dripCampaignId || !dripName || dripSteps.length === 0) {
                setDripSaveMessage('Campaign, name, and at least one step are required.')
                return
              }
              setDripSaving(true)
              setDripSaveMessage('')
              try {
                const resp = await fetch('/api/campaign-send/drip/create', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    campaign_id: dripCampaignId,
                    sequence_name: dripName,
                    description: dripDescription,
                    steps: dripSteps,
                    fallback_channel: dripFallbackChannel,
                  }),
                })
                const data = await resp.json()
                if (data.success) {
                  setDripSaveMessage('Drip sequence created successfully.')
                  setDripName('')
                  setDripDescription('')
                  setDripSteps([])
                } else {
                  setDripSaveMessage(`Error: ${data.error || 'Unknown error'}`)
                }
              } catch (err) {
                setDripSaveMessage(`Error: ${String(err)}`)
              } finally {
                setDripSaving(false)
              }
            }}
          />
        )}
        {activeTab === 'analytics' && (
          <AnalyticsTab campaigns={campaigns} portal={portal} />
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Stat Card
// ---------------------------------------------------------------------------

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

function EmptyState({ icon, message }: { icon: string; message: string }) {
  return (
    <div className="mt-4 flex flex-col items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] py-16">
      <span className="material-icons-outlined text-4xl text-[var(--text-muted)]">{icon}</span>
      <p className="mt-3 text-sm text-[var(--text-muted)]">{message}</p>
    </div>
  )
}

function FilterBar({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-center gap-3">{children}</div>
}

function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <input type="text" placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)}
      className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:border-[var(--portal)]" />
  )
}

function SelectFilter({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: readonly string[] }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}
      className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none">
      {options.map((o) => <option key={o}>{o}</option>)}
    </select>
  )
}

// ---------------------------------------------------------------------------
// Campaigns Tab (enhanced with send actions)
// ---------------------------------------------------------------------------

function CampaignsTab({ campaigns, campaignTypes, statusFilter, typeFilter, search, onStatusFilter, onTypeFilter, onSearch, selected, onSelect, campTemplateCount, abTestEnabled, onAbTestEnabled, abSplit, onAbSplit }: {
  campaigns: CampaignRecord[]; campaignTypes: string[]; statusFilter: string; typeFilter: string; search: string
  onStatusFilter: (v: string) => void; onTypeFilter: (v: string) => void; onSearch: (v: string) => void
  selected: CampaignRecord | null; onSelect: (c: CampaignRecord | null) => void; campTemplateCount: (c: CampaignRecord) => number
  abTestEnabled: boolean; onAbTestEnabled: (v: boolean) => void; abSplit: number; onAbSplit: (v: number) => void
}) {
  return (
    <div>
      <FilterBar>
        <SearchInput value={search} onChange={onSearch} placeholder="Search campaigns..." />
        <SelectFilter value={statusFilter} onChange={onStatusFilter} options={CAMPAIGN_STATUSES} />
        <SelectFilter value={typeFilter} onChange={onTypeFilter} options={campaignTypes as unknown as readonly string[]} />
        <span className="text-xs text-[var(--text-muted)]">{campaigns.length} results</span>
      </FilterBar>

      {campaigns.length === 0 ? <EmptyState icon="campaign" message="No campaigns match your filters." /> : (
        <div className="mt-4 space-y-2">
          {campaigns.map((c) => (
            <div key={c._id}>
              <button onClick={() => onSelect(selected?._id === c._id ? null : c)}
                className="flex w-full items-center justify-between rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] px-4 py-3 text-left transition-all hover:border-[var(--border)]"
                style={selected?._id === c._id ? { borderColor: 'var(--portal)' } : undefined}>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-[var(--text-primary)]">{c.name || c.campaign_name || c._id}</p>
                  <p className="text-xs text-[var(--text-muted)]">
                    {[c.type || c.campaign_type, c.division, c.pillar].filter(Boolean).join(' / ') || 'General'}
                    {c.owner && <span> &middot; {c.owner}</span>}
                  </p>
                </div>
                <div className="ml-4 flex shrink-0 items-center gap-3">
                  <span className="text-xs text-[var(--text-muted)]">{campTemplateCount(c)} templates</span>
                  <span className="rounded-full px-2.5 py-0.5 text-xs font-medium" style={statusStyle(c.status)}>{c.status || 'draft'}</span>
                  <span className="material-icons-outlined text-[var(--text-muted)]" style={{ fontSize: '18px' }}>{selected?._id === c._id ? 'expand_less' : 'expand_more'}</span>
                </div>
              </button>
              {selected?._id === c._id && (
                <div className="mt-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5">
                  <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
                    <div><p className="text-xs text-[var(--text-muted)]">Type</p><p className="font-medium text-[var(--text-primary)]">{c.type || c.campaign_type || '-'}</p></div>
                    <div><p className="text-xs text-[var(--text-muted)]">Division</p><p className="font-medium text-[var(--text-primary)]">{c.division || '-'}</p></div>
                    <div><p className="text-xs text-[var(--text-muted)]">Pillar</p><p className="font-medium text-[var(--text-primary)]">{c.pillar || '-'}</p></div>
                    <div><p className="text-xs text-[var(--text-muted)]">Target Count</p><p className="font-medium text-[var(--text-primary)]">{c.target_count?.toLocaleString() || '-'}</p></div>
                    <div><p className="text-xs text-[var(--text-muted)]">Start</p><p className="font-medium text-[var(--text-primary)]">{formatDate(c.start_date)}</p></div>
                    <div><p className="text-xs text-[var(--text-muted)]">End</p><p className="font-medium text-[var(--text-primary)]">{formatDate(c.end_date)}</p></div>
                    <div><p className="text-xs text-[var(--text-muted)]">Trigger</p><p className="font-medium text-[var(--text-primary)]">{c.trigger_type || '-'}</p></div>
                    <div><p className="text-xs text-[var(--text-muted)]">Templates</p><p className="font-medium text-[var(--text-primary)]">{campTemplateCount(c)}</p></div>
                  </div>
                  {c.description && <div className="mt-4"><p className="text-xs text-[var(--text-muted)]">Description</p><p className="mt-1 text-sm text-[var(--text-secondary)]">{c.description}</p></div>}
                  {/* AEP Blackout Warning */}
                  {isAepBlackout(new Date(), c.type || c.campaign_type || '') && (
                    <div className="mt-3 rounded-lg p-3" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
                      <p className="text-xs font-medium" style={{ color: '#ef4444' }}>
                        <span className="material-icons-outlined align-middle" style={{ fontSize: '14px' }}>warning</span>{' '}
                        AEP Blackout Active — Medicare campaigns cannot be sent Oct 1 - Dec 7
                      </p>
                    </div>
                  )}
                  {/* A/B Testing Toggle (TRK-125) */}
                  <div className="mt-4 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="material-icons-outlined" style={{ fontSize: '18px', color: 'var(--portal)' }}>science</span>
                        <span className="text-sm font-medium text-[var(--text-primary)]">A/B Testing</span>
                      </div>
                      <button onClick={() => onAbTestEnabled(!abTestEnabled)}
                        className="relative h-6 w-11 rounded-full transition-colors"
                        style={{ background: abTestEnabled ? 'var(--portal)' : 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                        <div className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform"
                          style={{ transform: abTestEnabled ? 'translateX(22px)' : 'translateX(2px)' }} />
                      </button>
                    </div>
                    {abTestEnabled && (
                      <div className="mt-4">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3">
                            <p className="text-xs font-semibold text-[var(--text-primary)]">Variant A</p>
                            <p className="mt-1 text-[10px] text-[var(--text-muted)]">Original template</p>
                            <div className="mt-2 flex items-center gap-1">
                              <div className="h-1.5 flex-1 rounded-full" style={{ background: 'var(--portal)', opacity: abSplit / 100 }} />
                              <span className="text-xs font-medium text-[var(--portal)]">{abSplit}%</span>
                            </div>
                          </div>
                          <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3">
                            <p className="text-xs font-semibold text-[var(--text-primary)]">Variant B</p>
                            <p className="mt-1 text-[10px] text-[var(--text-muted)]">Select alternate template</p>
                            <div className="mt-2 flex items-center gap-1">
                              <div className="h-1.5 flex-1 rounded-full" style={{ background: '#a855f7', opacity: (100 - abSplit) / 100 }} />
                              <span className="text-xs font-medium" style={{ color: '#a855f7' }}>{100 - abSplit}%</span>
                            </div>
                          </div>
                        </div>
                        <div className="mt-3">
                          <label className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">Split Ratio</label>
                          <input type="range" min={10} max={90} step={5} value={abSplit} onChange={(e) => onAbSplit(parseInt(e.target.value))}
                            className="mt-1 w-full" style={{ accentColor: 'var(--portal)' }} />
                          <div className="flex justify-between text-[10px] text-[var(--text-muted)]">
                            <span>Variant A: {abSplit}%</span>
                            <span>Variant B: {100 - abSplit}%</span>
                          </div>
                        </div>
                        <p className="mt-2 text-[10px] text-[var(--text-muted)]">
                          CONCEPT: Audience will be randomly split. Winner determined by open rate after 24h, then remaining sends go to winning variant.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Send Actions */}
                  <div className="mt-4 flex gap-2">
                    <button className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90" style={{ background: 'var(--portal)' }}>
                      <span className="material-icons-outlined" style={{ fontSize: '14px' }}>send</span> Send Now
                    </button>
                    <button className="flex items-center gap-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-surface)]">
                      <span className="material-icons-outlined" style={{ fontSize: '14px' }}>schedule</span> Schedule
                    </button>
                    <button className="flex items-center gap-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-surface)]">
                      <span className="material-icons-outlined" style={{ fontSize: '14px' }}>science</span> A/B Test
                    </button>
                    <button className="flex items-center gap-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-surface)]">
                      <span className="material-icons-outlined" style={{ fontSize: '14px' }}>content_copy</span> Duplicate
                    </button>
                  </div>
                  <p className="mt-3 text-xs text-[var(--text-muted)]">Created: {formatDate(c.created_at)} &middot; Updated: {formatDate(c.updated_at)}</p>
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
// Templates Tab (enhanced with preview)
// ---------------------------------------------------------------------------

function TemplatesTab({ templates, search, onSearch, viewMode, onViewMode, selected, onSelect, resolveBlock }: {
  templates: TemplateRecord[]; search: string; onSearch: (v: string) => void
  viewMode: 'grid' | 'list'; onViewMode: (v: 'grid' | 'list') => void
  selected: TemplateRecord | null; onSelect: (t: TemplateRecord | null) => void; resolveBlock: (id?: string) => BlockRecord | null
}) {
  const slotKeys = ['subject_block', 'greeting_block', 'intro_block', 'valueprop_block', 'painpoint_block', 'cta_block', 'signature_block', 'compliance_block']

  return (
    <div>
      <FilterBar>
        <SearchInput value={search} onChange={onSearch} placeholder="Search templates..." />
        <div className="flex rounded-lg border border-[var(--border-subtle)]">
          {(['grid', 'list'] as const).map((mode) => (
            <button key={mode} onClick={() => onViewMode(mode)} className="px-3 py-2"
              style={{ background: viewMode === mode ? 'var(--portal-glow)' : 'transparent' }}>
              <span className="material-icons-outlined" style={{ fontSize: '18px', color: viewMode === mode ? 'var(--portal)' : 'var(--text-muted)' }}>
                {mode === 'grid' ? 'grid_view' : 'view_list'}
              </span>
            </button>
          ))}
        </div>
        <span className="text-xs text-[var(--text-muted)]">{templates.length} templates</span>
      </FilterBar>

      {/* Welcome Campaign Template (TRK-117) — "We're Your People" */}
      <div className="mt-4">
        <WelcomeCampaignCard />
      </div>

      {templates.length === 0 ? <EmptyState icon="dashboard_customize" message="No templates found." /> : viewMode === 'grid' ? (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => (
            <button key={t._id} onClick={() => onSelect(selected?._id === t._id ? null : t)}
              className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 text-left transition-all hover:border-[var(--border)]"
              style={selected?._id === t._id ? { borderColor: 'var(--portal)' } : undefined}>
              <div className="flex items-start justify-between">
                <p className="truncate text-sm font-medium text-[var(--text-primary)]">{t.name || t.template_name || t._id}</p>
                <span className="ml-2 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium" style={statusStyle(t.status)}>{t.status || 'draft'}</span>
              </div>
              <p className="mt-1 text-xs text-[var(--text-muted)]">{[t.channel, t.touchpoint].filter(Boolean).join(' / ') || '-'}</p>
              {t.campaign_name && <p className="mt-1 truncate text-xs text-[var(--text-muted)]">Campaign: {t.campaign_name}</p>}
            </button>
          ))}
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          {templates.map((t) => (
            <button key={t._id} onClick={() => onSelect(selected?._id === t._id ? null : t)}
              className="flex w-full items-center justify-between rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] px-4 py-3 text-left transition-all hover:border-[var(--border)]"
              style={selected?._id === t._id ? { borderColor: 'var(--portal)' } : undefined}>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-[var(--text-primary)]">{t.name || t.template_name || t._id}</p>
                <p className="text-xs text-[var(--text-muted)]">{[t.channel, t.touchpoint, t.campaign_name || t.campaign_id].filter(Boolean).join(' / ')}</p>
              </div>
              <span className="ml-4 shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium" style={statusStyle(t.status)}>{t.status || 'draft'}</span>
            </button>
          ))}
        </div>
      )}

      {/* Template Detail */}
      {selected && (
        <div className="mt-4 rounded-xl border border-[var(--portal)] bg-[var(--bg-surface)] p-5">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-semibold text-[var(--text-primary)]">{selected.name || selected.template_name || selected._id}</h3>
              <p className="text-sm text-[var(--text-muted)]">{[selected.channel, selected.touchpoint, selected.touchpoint_day && `Day ${selected.touchpoint_day}`].filter(Boolean).join(' / ')}</p>
            </div>
            <div className="flex items-center gap-2">
              <button className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-white" style={{ background: 'var(--portal)' }}>
                <span className="material-icons-outlined" style={{ fontSize: '14px' }}>send</span> Test Send
              </button>
              <button onClick={() => onSelect(null)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                <span className="material-icons-outlined" style={{ fontSize: '20px' }}>close</span>
              </button>
            </div>
          </div>
          {selected.subject && <div className="mt-4"><p className="text-xs font-medium text-[var(--text-muted)]">Subject</p><p className="mt-1 text-sm text-[var(--text-primary)]">{selected.subject}</p></div>}
          <div className="mt-4">
            <p className="text-xs font-medium text-[var(--text-muted)]">Block Assignments</p>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {slotKeys.map((slot) => {
                const blockId = (selected as Record<string, unknown>)[slot] as string | undefined
                const block = resolveBlock(blockId)
                return (
                  <div key={slot} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] p-2.5">
                    <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">{slot.replace('_block', '')}</p>
                    {block ? <p className="mt-0.5 truncate text-xs text-[var(--text-primary)]">{block.name || block.block_name || block.block_id}</p>
                      : blockId ? <p className="mt-0.5 truncate text-xs text-[var(--text-secondary)]">{blockId}</p>
                      : <p className="mt-0.5 text-xs italic text-[var(--text-muted)]">Empty</p>}
                  </div>
                )
              })}
            </div>
          </div>
          {/* Assembled Preview */}
          {(() => {
            const bodySlots = ['greeting_block', 'intro_block', 'valueprop_block', 'painpoint_block', 'cta_block', 'signature_block', 'compliance_block']
            const parts = bodySlots.map((s) => resolveBlock((selected as Record<string, unknown>)[s] as string | undefined)?.content).filter(Boolean)
            return parts.length > 0 ? (
              <div className="mt-4">
                <p className="text-xs font-medium text-[var(--text-muted)]">Assembled Preview</p>
                <div className="mt-1 max-h-40 overflow-y-auto rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] p-3 text-sm leading-relaxed text-[var(--text-secondary)] whitespace-pre-wrap">
                  {parts.join('\n\n')}
                </div>
              </div>
            ) : null
          })()}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Blocks Tab
// ---------------------------------------------------------------------------

function BlocksTab({ blocks, totalCount, typeFilter, statusFilter, pillarFilter, search, onTypeFilter, onStatusFilter, onPillarFilter, onSearch }: {
  blocks: BlockRecord[]; totalCount: number; typeFilter: string; statusFilter: string; pillarFilter: string; search: string
  onTypeFilter: (v: string) => void; onStatusFilter: (v: string) => void; onPillarFilter: (v: string) => void; onSearch: (v: string) => void
}) {
  return (
    <div>
      <FilterBar>
        <SearchInput value={search} onChange={onSearch} placeholder="Search blocks..." />
        <SelectFilter value={typeFilter} onChange={onTypeFilter} options={BLOCK_TYPES} />
        <SelectFilter value={statusFilter} onChange={onStatusFilter} options={BLOCK_STATUSES} />
        <SelectFilter value={pillarFilter} onChange={onPillarFilter} options={PILLARS} />
        <span className="text-xs text-[var(--text-muted)]">{blocks.length} of {totalCount}</span>
      </FilterBar>

      {blocks.length === 0 ? <EmptyState icon="widgets" message="No content blocks match your filters." /> : (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {blocks.map((b) => (
            <div key={b._id} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 transition-all hover:border-[var(--border)]">
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-[var(--text-primary)]">{b.name || b.block_name || b.block_id || b._id}</p>
                  <p className="mt-0.5 text-xs text-[var(--text-muted)]">{b.block_id || b._id}</p>
                </div>
                <span className="ml-2 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium" style={statusStyle(b.status)}>{b.status || 'draft'}</span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {(b.type || b.block_type) && <span className="rounded bg-[var(--bg-surface)] px-1.5 py-0.5 text-[10px] text-[var(--text-secondary)]">{b.type || b.block_type}</span>}
                {b.channel && <span className="rounded bg-[var(--bg-surface)] px-1.5 py-0.5 text-[10px] text-[var(--text-secondary)]">{b.channel}</span>}
                {b.pillar && <span className="rounded bg-[var(--bg-surface)] px-1.5 py-0.5 text-[10px] text-[var(--text-secondary)]">{b.pillar}</span>}
              </div>
              {b.content && <p className="mt-2 line-clamp-2 text-xs text-[var(--text-muted)]">{b.content}</p>}
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
// Builder Tab (enhanced with audience + send actions)
// ---------------------------------------------------------------------------

function BuilderTab({ campaigns, campaignTemplates, selectedCampaign, selectedTemplate, onSelectCampaign, onSelectTemplate, resolveBlock }: {
  campaigns: CampaignRecord[]; campaignTemplates: TemplateRecord[]
  selectedCampaign: CampaignRecord | null; selectedTemplate: TemplateRecord | null
  onSelectCampaign: (id: string) => void; onSelectTemplate: (id: string) => void
  resolveBlock: (id?: string) => BlockRecord | null
}) {
  const slotLabels = [
    { key: 'subject_block', label: 'Subject' }, { key: 'greeting_block', label: 'Greeting' },
    { key: 'intro_block', label: 'Intro' }, { key: 'valueprop_block', label: 'Value Prop' },
    { key: 'painpoint_block', label: 'Pain Point' }, { key: 'cta_block', label: 'CTA' },
    { key: 'signature_block', label: 'Signature' }, { key: 'compliance_block', label: 'Compliance' },
  ]

  const assembledContent = useMemo(() => {
    if (!selectedTemplate) return null
    const bodySlots = ['greeting_block', 'intro_block', 'valueprop_block', 'painpoint_block', 'cta_block', 'signature_block', 'compliance_block']
    const parts = bodySlots.map((s) => resolveBlock((selectedTemplate as Record<string, unknown>)[s] as string | undefined)?.content).filter(Boolean)
    return parts.length > 0 ? parts.join('\n\n') : null
  }, [selectedTemplate, resolveBlock])

  const campaignType = selectedCampaign?.type || selectedCampaign?.campaign_type || ''
  const showBlackout = selectedCampaign && isAepBlackout(new Date(), campaignType)

  return (
    <div>
      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">Campaign Builder</h3>
        <p className="mt-0.5 text-xs text-[var(--text-muted)]">Select campaign, pick template, preview content, then send or schedule</p>

        {/* Step 1 */}
        <div className="mt-5">
          <label className="text-xs font-medium text-[var(--text-muted)]">1. Select Campaign</label>
          <select value={selectedCampaign?._id || ''} onChange={(e) => { onSelectCampaign(e.target.value); onSelectTemplate('') }}
            className="mt-1 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none">
            <option value="">Choose a campaign...</option>
            {campaigns.map((c) => <option key={c._id} value={c._id}>{c.name || c.campaign_name || c._id} ({c.status || 'draft'})</option>)}
          </select>
        </div>

        {/* AEP Warning */}
        {showBlackout && (
          <div className="mt-3 rounded-lg p-3" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <p className="text-xs font-medium" style={{ color: '#ef4444' }}>
              <span className="material-icons-outlined align-middle" style={{ fontSize: '14px' }}>block</span>{' '}
              AEP Blackout — Medicare campaigns cannot be sent during Oct 1 - Dec 7. Schedule for Dec 8+ or change campaign type.
            </p>
          </div>
        )}

        {/* Step 2 */}
        {selectedCampaign && (
          <div className="mt-4">
            <label className="text-xs font-medium text-[var(--text-muted)]">2. Select Template</label>
            {campaignTemplates.length === 0 ? (
              <p className="mt-1 text-xs italic text-[var(--text-muted)]">No templates linked to this campaign.</p>
            ) : (
              <select value={selectedTemplate?._id || ''} onChange={(e) => onSelectTemplate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none">
                <option value="">Choose a template...</option>
                {campaignTemplates.map((t) => <option key={t._id} value={t._id}>{t.name || t.template_name || t._id} ({t.channel || 'Unknown'} / {t.touchpoint || '-'})</option>)}
              </select>
            )}
          </div>
        )}

        {/* Step 3: Slots */}
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
                        <span className="mt-0.5 inline-block rounded-full px-1.5 py-0.5 text-[9px] font-medium" style={statusStyle(block.status)}>{block.status || 'draft'}</span>
                      </>
                    ) : blockId ? <p className="mt-1 truncate text-xs text-[var(--text-secondary)]">{blockId}</p>
                    : <p className="mt-1 text-xs italic text-[var(--text-muted)]">Not assigned</p>}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Step 4: Preview + Actions */}
        {assembledContent && (
          <div className="mt-5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-[var(--text-muted)]">4. Assembled Preview</label>
              <span className="rounded-full bg-[var(--bg-surface)] px-2 py-0.5 text-[10px] text-[var(--text-muted)]">Merge fields shown as-is</span>
            </div>
            <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 text-sm leading-relaxed text-[var(--text-secondary)] whitespace-pre-wrap">
              {assembledContent}
            </div>

            {/* Send/Schedule Actions */}
            <div className="mt-4 flex flex-wrap gap-2">
              <button className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90" style={{ background: 'var(--portal)' }}
                disabled={!!showBlackout}>
                <span className="material-icons-outlined" style={{ fontSize: '16px' }}>send</span> Send Now
              </button>
              <button className="flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-surface)]">
                <span className="material-icons-outlined" style={{ fontSize: '16px' }}>schedule</span> Schedule Send
              </button>
              <button className="flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-surface)]">
                <span className="material-icons-outlined" style={{ fontSize: '16px' }}>science</span> Test Send
              </button>
            </div>
          </div>
        )}
      </div>

      {/* DND Info */}
      <div className="mt-4 rounded-lg border border-dashed border-[var(--border)] bg-[var(--bg-surface)] p-4 text-center">
        <span className="material-icons-outlined text-2xl text-[var(--text-muted)]">do_not_disturb</span>
        <p className="mt-1 text-xs text-[var(--text-muted)]">
          Sends respect DND flags. Clients with dnd_all, dnd_email, or dnd_sms are automatically excluded.
          Audience is filtered before any messages are queued.
        </p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Drip Tab — Visual drip sequence builder + listing
// ---------------------------------------------------------------------------

function DripTab({ campaigns, templates, portal, dripName, onDripName, dripDescription, onDripDescription,
  dripCampaignId, onDripCampaignId, dripFallbackChannel, onDripFallbackChannel,
  dripSteps, onDripSteps, dripSaving, dripSaveMessage, onSave }: {
  campaigns: CampaignRecord[]; templates: TemplateRecord[]; portal: string
  dripName: string; onDripName: (v: string) => void
  dripDescription: string; onDripDescription: (v: string) => void
  dripCampaignId: string; onDripCampaignId: (v: string) => void
  dripFallbackChannel: 'email' | 'sms'; onDripFallbackChannel: (v: 'email' | 'sms') => void
  dripSteps: DripStepRecord[]; onDripSteps: (v: DripStepRecord[]) => void
  dripSaving: boolean; dripSaveMessage: string
  onSave: () => void
}) {
  const addStep = useCallback(() => {
    const newStep: DripStepRecord = {
      step_index: dripSteps.length,
      delay_days: dripSteps.length === 0 ? 0 : (dripSteps[dripSteps.length - 1]?.delay_days || 0) + 3,
      channel: 'email',
      template_id: '',
      conditions: [],
    }
    onDripSteps([...dripSteps, newStep])
  }, [dripSteps, onDripSteps])

  const removeStep = useCallback((index: number) => {
    const updated = dripSteps.filter((_, i) => i !== index).map((s, i) => ({ ...s, step_index: i }))
    onDripSteps(updated)
  }, [dripSteps, onDripSteps])

  const updateStep = useCallback((index: number, field: string, value: unknown) => {
    const updated = [...dripSteps]
    updated[index] = { ...updated[index], [field]: value }
    onDripSteps(updated)
  }, [dripSteps, onDripSteps])

  const addCondition = useCallback((stepIndex: number) => {
    const updated = [...dripSteps]
    const step = { ...updated[stepIndex] }
    step.conditions = [...step.conditions, { type: 'opened', action: 'skip' }]
    updated[stepIndex] = step
    onDripSteps(updated)
  }, [dripSteps, onDripSteps])

  const removeCondition = useCallback((stepIndex: number, condIndex: number) => {
    const updated = [...dripSteps]
    const step = { ...updated[stepIndex] }
    step.conditions = step.conditions.filter((_, i) => i !== condIndex)
    updated[stepIndex] = step
    onDripSteps(updated)
  }, [dripSteps, onDripSteps])

  const updateCondition = useCallback((stepIndex: number, condIndex: number, field: string, value: string) => {
    const updated = [...dripSteps]
    const step = { ...updated[stepIndex] }
    step.conditions = [...step.conditions]
    step.conditions[condIndex] = { ...step.conditions[condIndex], [field]: value }
    updated[stepIndex] = step
    onDripSteps(updated)
  }, [dripSteps, onDripSteps])

  const moveStep = useCallback((from: number, to: number) => {
    if (to < 0 || to >= dripSteps.length) return
    const updated = [...dripSteps]
    const [moved] = updated.splice(from, 1)
    updated.splice(to, 0, moved)
    onDripSteps(updated.map((s, i) => ({ ...s, step_index: i })))
  }, [dripSteps, onDripSteps])

  // Filter templates for the selected campaign
  const campaignTemplateOptions = useMemo(() => {
    if (!dripCampaignId) return templates
    return templates.filter((t) => t.campaign_id === dripCampaignId || !t.campaign_id)
  }, [templates, dripCampaignId])

  return (
    <div>
      {/* Builder Card */}
      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">Drip Sequence Builder</h3>
        <p className="mt-0.5 text-xs text-[var(--text-muted)]">Create multi-touch campaigns: Day 1 email, Day 3 SMS, Day 7 follow-up, etc.</p>

        {/* Sequence Config */}
        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="text-xs font-medium text-[var(--text-muted)]">Sequence Name</label>
            <input type="text" value={dripName} onChange={(e) => onDripName(e.target.value)} placeholder="e.g., T65 Onboarding Drip"
              className="mt-1 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:border-[var(--portal)]" />
          </div>
          <div>
            <label className="text-xs font-medium text-[var(--text-muted)]">Campaign</label>
            <select value={dripCampaignId} onChange={(e) => onDripCampaignId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none">
              <option value="">Select campaign...</option>
              {campaigns.map((c) => <option key={c._id} value={c.campaign_id || c._id}>{c.name || c.campaign_name || c._id}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-[var(--text-muted)]">Description</label>
            <input type="text" value={dripDescription} onChange={(e) => onDripDescription(e.target.value)} placeholder="Optional description"
              className="mt-1 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:border-[var(--portal)]" />
          </div>
          <div>
            <label className="text-xs font-medium text-[var(--text-muted)]">Fallback Channel</label>
            <select value={dripFallbackChannel} onChange={(e) => onDripFallbackChannel(e.target.value as 'email' | 'sms')}
              className="mt-1 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none">
              <option value="email">Email</option>
              <option value="sms">SMS</option>
            </select>
          </div>
        </div>

        {/* Steps */}
        <div className="mt-6">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-[var(--text-muted)]">Steps ({dripSteps.length})</label>
            <button onClick={addStep}
              className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90"
              style={{ background: 'var(--portal)' }}>
              <span className="material-icons-outlined" style={{ fontSize: '14px' }}>add</span> Add Step
            </button>
          </div>

          {dripSteps.length === 0 ? (
            <div className="mt-3 flex flex-col items-center rounded-lg border border-dashed border-[var(--border)] py-8">
              <span className="material-icons-outlined text-3xl text-[var(--text-muted)]">water_drop</span>
              <p className="mt-2 text-xs text-[var(--text-muted)]">No steps yet. Add a step to build your drip sequence.</p>
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              {dripSteps.map((step, i) => (
                <div key={i} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: 'var(--portal)' }}>{i + 1}</span>
                      <span className="text-sm font-medium text-[var(--text-primary)]">Step {i + 1}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => moveStep(i, i - 1)} disabled={i === 0} className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-30">
                        <span className="material-icons-outlined" style={{ fontSize: '16px' }}>arrow_upward</span>
                      </button>
                      <button onClick={() => moveStep(i, i + 1)} disabled={i === dripSteps.length - 1} className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-30">
                        <span className="material-icons-outlined" style={{ fontSize: '16px' }}>arrow_downward</span>
                      </button>
                      <button onClick={() => removeStep(i)} className="p-1 hover:text-[var(--text-primary)]" style={{ color: '#ef4444' }}>
                        <span className="material-icons-outlined" style={{ fontSize: '16px' }}>delete</span>
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div>
                      <label className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">Delay (days)</label>
                      <input type="number" min="0" value={step.delay_days} onChange={(e) => updateStep(i, 'delay_days', parseInt(e.target.value) || 0)}
                        className="mt-1 w-full rounded border border-[var(--border-subtle)] bg-[var(--bg-card)] px-2 py-1.5 text-sm text-[var(--text-primary)] outline-none" />
                    </div>
                    <div>
                      <label className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">Channel</label>
                      <select value={step.channel} onChange={(e) => updateStep(i, 'channel', e.target.value)}
                        className="mt-1 w-full rounded border border-[var(--border-subtle)] bg-[var(--bg-card)] px-2 py-1.5 text-sm text-[var(--text-primary)] outline-none">
                        {DRIP_CHANNELS.map((ch) => <option key={ch} value={ch}>{ch.toUpperCase()}</option>)}
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">Template</label>
                      <select value={step.template_id} onChange={(e) => updateStep(i, 'template_id', e.target.value)}
                        className="mt-1 w-full rounded border border-[var(--border-subtle)] bg-[var(--bg-card)] px-2 py-1.5 text-sm text-[var(--text-primary)] outline-none">
                        <option value="">Select template...</option>
                        {campaignTemplateOptions.map((t) => (
                          <option key={t._id} value={t.template_id || t._id}>{t.name || t.template_name || t._id} ({t.channel || '?'})</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Conditions */}
                  <div className="mt-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">Conditions ({step.conditions.length})</span>
                      <button onClick={() => addCondition(i)} className="text-xs text-[var(--portal)] hover:underline">+ Add Condition</button>
                    </div>
                    {step.conditions.length > 0 && (
                      <div className="mt-1 space-y-1">
                        {step.conditions.map((cond, ci) => (
                          <div key={ci} className="flex items-center gap-2 rounded bg-[var(--bg-card)] px-2 py-1">
                            <span className="text-xs text-[var(--text-muted)]">If</span>
                            <select value={cond.type} onChange={(e) => updateCondition(i, ci, 'type', e.target.value)}
                              className="rounded border border-[var(--border-subtle)] bg-transparent px-1.5 py-0.5 text-xs text-[var(--text-primary)] outline-none">
                              {DRIP_CONDITION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                            </select>
                            <span className="text-xs text-[var(--text-muted)]">then</span>
                            <select value={cond.action} onChange={(e) => updateCondition(i, ci, 'action', e.target.value)}
                              className="rounded border border-[var(--border-subtle)] bg-transparent px-1.5 py-0.5 text-xs text-[var(--text-primary)] outline-none">
                              {DRIP_CONDITION_ACTIONS.map((a) => <option key={a} value={a}>{a.replace('_', ' ')}</option>)}
                            </select>
                            <button onClick={() => removeCondition(i, ci)} className="ml-auto text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                              <span className="material-icons-outlined" style={{ fontSize: '14px' }}>close</span>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Visual Timeline */}
        {dripSteps.length > 0 && (
          <div className="mt-5">
            <label className="text-xs font-medium text-[var(--text-muted)]">Timeline Preview</label>
            <div className="mt-2 flex items-center gap-1 overflow-x-auto rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-3">
              {dripSteps.map((step, i) => (
                <div key={i} className="flex items-center">
                  {i > 0 && (
                    <div className="mx-1 flex items-center gap-0.5">
                      <div className="h-px w-6" style={{ background: 'var(--border)' }} />
                      <span className="text-[9px] text-[var(--text-muted)]">{step.delay_days - (dripSteps[i - 1]?.delay_days || 0)}d</span>
                      <div className="h-px w-6" style={{ background: 'var(--border)' }} />
                    </div>
                  )}
                  <div className="flex flex-col items-center">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: step.channel === 'sms' ? '#8b5cf6' : 'var(--portal)' }}>
                      <span className="material-icons-outlined" style={{ fontSize: '16px' }}>{step.channel === 'sms' ? 'sms' : 'email'}</span>
                    </div>
                    <span className="mt-0.5 text-[9px] text-[var(--text-muted)]">Day {step.delay_days}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Save */}
        <div className="mt-5 flex items-center gap-3">
          <button onClick={onSave} disabled={dripSaving || !dripName || !dripCampaignId || dripSteps.length === 0}
            className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ background: 'var(--portal)' }}>
            <span className="material-icons-outlined" style={{ fontSize: '16px' }}>save</span>
            {dripSaving ? 'Saving...' : 'Create Drip Sequence'}
          </button>
          {dripSaveMessage && (
            <span className="text-xs" style={{ color: dripSaveMessage.startsWith('Error') ? '#ef4444' : '#22c55e' }}>{dripSaveMessage}</span>
          )}
        </div>
      </div>

      {/* Existing Drip Sequences — loaded from Firestore */}
      <ExistingDripSequences portal={portal} campaigns={campaigns} />
    </div>
  )
}

function ExistingDripSequences({ portal, campaigns }: { portal: string; campaigns: CampaignRecord[] }) {
  const dripQuery = useMemo<Query<DocumentData>>(() => query(collections.dripSequences()), [])
  const { data: dripSequences, loading } = useCollection<DripSequenceRecord>(dripQuery, `c3-drips-${portal}`)

  if (loading) {
    return (
      <div className="mt-6 flex items-center justify-center py-8">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--portal)] border-t-transparent" />
      </div>
    )
  }

  if (dripSequences.length === 0) return null

  return (
    <div className="mt-6 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
      <h3 className="text-sm font-semibold text-[var(--text-primary)]">Existing Drip Sequences ({dripSequences.length})</h3>
      <div className="mt-4 space-y-2">
        {dripSequences.map((seq) => {
          const camp = campaigns.find((c) => c.campaign_id === seq.campaign_id || c._id === seq.campaign_id)
          return (
            <div key={seq._id} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-[var(--text-primary)]">{seq.sequence_name || seq.drip_id || seq._id}</p>
                  <p className="text-xs text-[var(--text-muted)]">
                    Campaign: {camp?.name || camp?.campaign_name || seq.campaign_id || '-'}
                    {seq.description && <span> &middot; {seq.description}</span>}
                  </p>
                </div>
                <span className="rounded-full px-2.5 py-0.5 text-xs font-medium" style={statusStyle(seq.status)}>{seq.status || 'active'}</span>
              </div>
              {/* Step timeline mini */}
              {Array.isArray(seq.steps) && seq.steps.length > 0 && (
                <div className="mt-2 flex items-center gap-1">
                  {seq.steps.map((step, i) => (
                    <div key={i} className="flex items-center">
                      {i > 0 && <div className="mx-0.5 h-px w-4" style={{ background: 'var(--border)' }} />}
                      <div className="flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold text-white"
                        style={{ background: step.channel === 'sms' ? '#8b5cf6' : 'var(--portal)' }}>
                        {i + 1}
                      </div>
                    </div>
                  ))}
                  <span className="ml-2 text-[10px] text-[var(--text-muted)]">{seq.steps.length} steps</span>
                </div>
              )}
              <p className="mt-2 text-[10px] text-[var(--text-muted)]">Created: {formatDate(seq.created_at)}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Analytics Tab (FIXED — reads real campaign_delivery_events + campaign_send_log)
// ---------------------------------------------------------------------------

function AnalyticsTab({ campaigns, portal }: { campaigns: CampaignRecord[]; portal: string }) {
  // Read REAL send log from campaign_send_log collection
  const sendLogQuery = useMemo<Query<DocumentData>>(() => query(collections.campaignSendLog()), [])
  const { data: sendLogs, loading: logLoading } = useCollection<SendLogRecord>(sendLogQuery, `c3-sendlog-${portal}`)

  // Read REAL delivery events from campaign_delivery_events collection
  const deliveryQuery = useMemo<Query<DocumentData>>(() => query(collections.campaignDeliveryEvents()), [])
  const { data: deliveryEvents, loading: eventLoading } = useCollection<DeliveryEventRecord>(deliveryQuery, `c3-events-${portal}`)

  const loading = logLoading || eventLoading

  // Per-campaign metrics built from real send_log + delivery_events
  const campaignMetrics = useMemo(() => {
    const metrics: Record<string, { sent: number; delivered: number; opened: number; clicked: number; bounced: number; skipped: number; failed: number }> = {}

    // Count sends from campaign_send_log
    sendLogs.forEach((log) => {
      const cId = log.campaign_id || ''
      if (!cId) return
      if (!metrics[cId]) metrics[cId] = { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, skipped: 0, failed: 0 }
      const m = metrics[cId]
      const s = (log.status || '').toLowerCase()
      if (s === 'sent' || s === 'processing' || s === 'queued') m.sent++
      else if (s === 'skipped') m.skipped++
      else if (s === 'failed') m.failed++
    })

    // Count delivery events from campaign_delivery_events
    deliveryEvents.forEach((evt) => {
      const cId = evt.campaign_id || ''
      if (!cId) return
      if (!metrics[cId]) metrics[cId] = { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, skipped: 0, failed: 0 }
      const m = metrics[cId]
      const t = (evt.event_type || '').toLowerCase()
      if (t === 'delivered') m.delivered++
      else if (t === 'opened') m.opened++
      else if (t === 'clicked') m.clicked++
      else if (t === 'bounced') m.bounced++
    })

    return metrics
  }, [sendLogs, deliveryEvents])

  // Totals
  const totals = useMemo(() => {
    let sent = 0, delivered = 0, opened = 0, clicked = 0, bounced = 0
    Object.values(campaignMetrics).forEach((m) => {
      sent += m.sent; delivered += m.delivered; opened += m.opened; clicked += m.clicked; bounced += m.bounced
    })
    const safeSent = Math.max(sent, 1)
    const safeDelivered = Math.max(delivered, 1)
    return {
      sent, delivered, opened, clicked, bounced,
      delivery_rate: Math.round((delivered / safeSent) * 100),
      open_rate: Math.round((opened / safeDelivered) * 100),
      click_rate: Math.round((clicked / safeDelivered) * 100),
    }
  }, [campaignMetrics])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--portal)] border-t-transparent" />
      </div>
    )
  }

  return (
    <div>
      {/* Overview Metrics */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        <MetricCard label="Sent" value={totals.sent} icon="send" />
        <MetricCard label="Delivered" value={totals.delivered} icon="mark_email_read" />
        <MetricCard label="Opened" value={totals.opened} icon="drafts" />
        <MetricCard label="Clicked" value={totals.clicked} icon="ads_click" />
        <MetricCard label="Bounced" value={totals.bounced} icon="report" warning />
        <MetricCard label="Open Rate" value={`${totals.open_rate}%`} icon="trending_up" accent />
        <MetricCard label="Click Rate" value={`${totals.click_rate}%`} icon="mouse" accent />
      </div>

      {/* Delivery Funnel */}
      {totals.sent > 0 && (
        <div className="mt-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Delivery Funnel</h3>
          <div className="mt-4 flex items-end gap-2" style={{ height: '120px' }}>
            {[
              { label: 'Sent', value: totals.sent, color: 'var(--portal)' },
              { label: 'Delivered', value: totals.delivered, color: '#22c55e' },
              { label: 'Opened', value: totals.opened, color: '#3b82f6' },
              { label: 'Clicked', value: totals.clicked, color: '#a855f7' },
              { label: 'Bounced', value: totals.bounced, color: '#ef4444' },
            ].map((bar) => {
              const pct = totals.sent > 0 ? Math.max((bar.value / totals.sent) * 100, 4) : 4
              return (
                <div key={bar.label} className="flex flex-1 flex-col items-center justify-end" style={{ height: '100%' }}>
                  <span className="text-xs font-medium text-[var(--text-primary)]">{bar.value.toLocaleString()}</span>
                  <div className="mt-1 w-full rounded-t transition-all" style={{ height: `${pct}%`, minHeight: '4px', background: bar.color }} />
                  <p className="mt-1 text-[10px] text-[var(--text-muted)]">{bar.label}</p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Per-Campaign Table */}
      <div className="mt-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">Campaign Performance</h3>
        {Object.keys(campaignMetrics).length === 0 ? (
          <div className="mt-4">
            <div className="mb-3 flex items-center gap-2 rounded-lg border border-dashed border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2">
              <span className="material-icons-outlined text-sm text-[var(--text-muted)]">info</span>
              <span className="text-xs text-[var(--text-muted)]">CONCEPT DATA — Real metrics appear after first campaign send. These are mock performance targets.</span>
            </div>
            {/* Mock Analytics Cards (TRK-126) */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <MetricCard label="Open Rate" value={`${MOCK_ANALYTICS.open_rate}%`} icon="drafts" accent />
              <MetricCard label="Click Rate" value={`${MOCK_ANALYTICS.click_rate}%`} icon="ads_click" accent />
              <MetricCard label="Delivery Rate" value={`${MOCK_ANALYTICS.delivery_rate}%`} icon="mark_email_read" accent />
              <MetricCard label="Bounce Rate" value={`${MOCK_ANALYTICS.bounce_rate}%`} icon="report" warning />
            </div>
            {/* Mock sparkline-style bars */}
            <div className="mt-4 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4">
              <p className="text-xs font-medium text-[var(--text-muted)]">Performance by Campaign (mock)</p>
              <div className="mt-3 space-y-2">
                {MOCK_ANALYTICS.top_campaigns.map((c) => {
                  const openRate = c.delivered > 0 ? Math.round((c.opened / c.delivered) * 100) : 0
                  return (
                    <div key={c.name} className="flex items-center gap-3">
                      <p className="w-48 truncate text-xs text-[var(--text-primary)]">{c.name}</p>
                      <div className="flex flex-1 items-center gap-2">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--bg-card)]">
                          <div className="h-full rounded-full" style={{ width: `${openRate}%`, background: 'var(--portal)' }} />
                        </div>
                        <span className="w-10 text-right text-xs text-[var(--text-muted)]">{openRate}%</span>
                      </div>
                      <span className="w-16 text-right text-[10px] text-[var(--text-muted)]">{c.sent.toLocaleString()} sent</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-4 max-h-[400px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] text-left text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
                  <th className="pb-2 pr-3">Campaign</th>
                  <th className="pb-2 pr-3">Sent</th>
                  <th className="pb-2 pr-3">Delivered</th>
                  <th className="pb-2 pr-3">Opened</th>
                  <th className="pb-2 pr-3">Clicked</th>
                  <th className="pb-2 pr-3">Bounced</th>
                  <th className="pb-2">Delivery Rate</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(campaignMetrics).map(([cId, m]) => {
                  const camp = campaigns.find((c) => c.campaign_id === cId || c._id === cId)
                  const deliveryRate = m.sent > 0 ? Math.round((m.delivered / m.sent) * 100) : 0
                  const openRate = m.delivered > 0 ? Math.round((m.opened / m.delivered) * 100) : 0
                  return (
                    <tr key={cId} className="border-b border-[var(--border-subtle)]">
                      <td className="py-2 pr-3">
                        <p className="font-medium text-[var(--text-primary)]">{camp?.name || camp?.campaign_name || cId}</p>
                        <p className="text-[10px] text-[var(--text-muted)]">Open rate: {openRate}%</p>
                      </td>
                      <td className="py-2 pr-3 text-[var(--text-secondary)]">{m.sent}</td>
                      <td className="py-2 pr-3 text-[var(--text-secondary)]">{m.delivered}</td>
                      <td className="py-2 pr-3 text-[var(--text-secondary)]">{m.opened}</td>
                      <td className="py-2 pr-3 text-[var(--text-secondary)]">{m.clicked}</td>
                      <td className="py-2 pr-3 text-[var(--text-secondary)]">{m.bounced}</td>
                      <td className="py-2">
                        <div className="flex items-center gap-1.5">
                          <div className="h-1.5 w-12 overflow-hidden rounded-full bg-[var(--bg-surface)]">
                            <div className="h-full rounded-full" style={{ width: `${Math.min(deliveryRate, 100)}%`, background: deliveryRate >= 90 ? '#22c55e' : deliveryRate >= 70 ? '#f59e0b' : '#ef4444' }} />
                          </div>
                          <span className="text-xs text-[var(--text-muted)]">{deliveryRate}%</span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Schedule Tab (TRK-123) — Calendar-style campaign scheduler
// ---------------------------------------------------------------------------

function ScheduleTab({ campaigns, scheduled, formOpen, onFormOpen, schedCampaignId, onSchedCampaignId, schedDate, onSchedDate, schedTime, onSchedTime }: {
  campaigns: CampaignRecord[]
  scheduled: typeof MOCK_SCHEDULED_CAMPAIGNS
  formOpen: boolean; onFormOpen: (v: boolean) => void
  schedCampaignId: string; onSchedCampaignId: (v: string) => void
  schedDate: string; onSchedDate: (v: string) => void
  schedTime: string; onSchedTime: (v: string) => void
}) {
  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Campaign Schedule</h3>
          <p className="mt-0.5 text-xs text-[var(--text-muted)]">View and manage scheduled campaign sends via Cloud Scheduler</p>
        </div>
        <button onClick={() => onFormOpen(!formOpen)}
          className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
          style={{ background: 'var(--portal)' }}>
          <span className="material-icons-outlined" style={{ fontSize: '16px' }}>{formOpen ? 'close' : 'add'}</span>
          {formOpen ? 'Cancel' : 'Schedule New'}
        </button>
      </div>

      {/* Schedule Form (stub) */}
      {formOpen && (
        <div className="mt-4 rounded-xl border border-[var(--portal)] bg-[var(--bg-card)] p-5">
          <h4 className="text-sm font-semibold text-[var(--text-primary)]">New Scheduled Send</h4>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="text-xs font-medium text-[var(--text-muted)]">Campaign</label>
              <select value={schedCampaignId} onChange={(e) => onSchedCampaignId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none">
                <option value="">Select campaign...</option>
                {campaigns.map((c) => (
                  <option key={c._id} value={c._id}>{c.name || c.campaign_name || c._id}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-[var(--text-muted)]">Date</label>
              <input type="date" value={schedDate} onChange={(e) => onSchedDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none" />
            </div>
            <div>
              <label className="text-xs font-medium text-[var(--text-muted)]">Time</label>
              <input type="time" value={schedTime} onChange={(e) => onSchedTime(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none" />
            </div>
          </div>
          {/* AEP check on scheduled date */}
          {schedDate && schedCampaignId && (() => {
            const camp = campaigns.find((c) => c._id === schedCampaignId)
            const type = camp?.type || camp?.campaign_type || ''
            if (isAepBlackout(new Date(schedDate), type)) {
              return (
                <div className="mt-3 rounded-lg p-3" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
                  <p className="text-xs font-medium" style={{ color: '#ef4444' }}>
                    <span className="material-icons-outlined align-middle" style={{ fontSize: '14px' }}>block</span>{' '}
                    This date falls within the AEP Blackout (Oct 1 - Dec 7). Medicare campaigns will be deferred to Dec 8.
                  </p>
                </div>
              )
            }
            return null
          })()}
          <div className="mt-4 flex gap-2">
            <button className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
              style={{ background: 'var(--portal)' }}>
              <span className="material-icons-outlined" style={{ fontSize: '16px' }}>schedule_send</span> Confirm Schedule
            </button>
            <p className="flex items-center text-xs text-[var(--text-muted)]">CONCEPT — Sends via Cloud Scheduler job</p>
          </div>
        </div>
      )}

      {/* Scheduled Campaigns List */}
      <div className="mt-4 space-y-2">
        {scheduled.map((s) => (
          <div key={s.id} className="flex items-center justify-between rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ background: 'var(--portal-glow)' }}>
                <span className="material-icons-outlined" style={{ fontSize: '20px', color: 'var(--portal)' }}>
                  {s.channel === 'sms' ? 'sms' : 'email'}
                </span>
              </div>
              <div>
                <p className="text-sm font-medium text-[var(--text-primary)]">{s.campaign_name}</p>
                <p className="text-xs text-[var(--text-muted)]">
                  {new Date(s.scheduled_for).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                  {' at '}
                  {new Date(s.scheduled_for).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                  {' \u00B7 '}{s.audience_size.toLocaleString()} recipients
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full px-2.5 py-0.5 text-xs font-medium" style={statusStyle(s.status)}>{s.status}</span>
              <button className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                <span className="material-icons-outlined" style={{ fontSize: '18px' }}>more_vert</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Calendar preview */}
      <div className="mt-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
        <h4 className="text-sm font-semibold text-[var(--text-primary)]">March 2026</h4>
        <div className="mt-3 grid grid-cols-7 gap-1 text-center">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
            <div key={d} className="pb-1 text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">{d}</div>
          ))}
          {/* Blank leading days for March 2026 (starts on Sunday) */}
          {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => {
            const hasEvent = [18, 22, 25].includes(day)
            const isToday = day === 15
            return (
              <div key={day} className="relative flex h-8 items-center justify-center rounded-lg text-xs"
                style={{
                  background: hasEvent ? 'var(--portal-glow)' : isToday ? 'rgba(59,130,246,0.1)' : 'transparent',
                  color: hasEvent ? 'var(--portal)' : isToday ? '#3b82f6' : 'var(--text-secondary)',
                  fontWeight: hasEvent || isToday ? 600 : 400,
                }}>
                {day}
                {hasEvent && <div className="absolute bottom-0.5 h-1 w-1 rounded-full" style={{ background: 'var(--portal)' }} />}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Audience Tab (TRK-124) — Segment builder with AND/OR logic
// ---------------------------------------------------------------------------

function AudienceTab({ segments, onSegments, previewCount }: {
  segments: SegmentGroup[]
  onSegments: (v: SegmentGroup[]) => void
  previewCount: number
}) {
  const addCondition = useCallback((groupIndex: number) => {
    const updated = [...segments]
    updated[groupIndex] = {
      ...updated[groupIndex],
      conditions: [...updated[groupIndex].conditions, { field: 'status', operator: 'equals', value: '' }],
    }
    onSegments(updated)
  }, [segments, onSegments])

  const removeCondition = useCallback((groupIndex: number, condIndex: number) => {
    const updated = [...segments]
    const group = { ...updated[groupIndex] }
    group.conditions = group.conditions.filter((_, i) => i !== condIndex)
    updated[groupIndex] = group
    onSegments(updated)
  }, [segments, onSegments])

  const updateCondition = useCallback((groupIndex: number, condIndex: number, field: string, value: string) => {
    const updated = [...segments]
    const group = { ...updated[groupIndex] }
    group.conditions = [...group.conditions]
    group.conditions[condIndex] = { ...group.conditions[condIndex], [field]: value }
    updated[groupIndex] = group
    onSegments(updated)
  }, [segments, onSegments])

  const toggleGroupLogic = useCallback((groupIndex: number) => {
    const updated = [...segments]
    updated[groupIndex] = { ...updated[groupIndex], logic: updated[groupIndex].logic === 'AND' ? 'OR' : 'AND' }
    onSegments(updated)
  }, [segments, onSegments])

  const addGroup = useCallback(() => {
    onSegments([...segments, { logic: 'AND', conditions: [{ field: 'status', operator: 'equals', value: '' }] }])
  }, [segments, onSegments])

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Audience Segmentation Engine</h3>
          <p className="mt-0.5 text-xs text-[var(--text-muted)]">Build targeted segments with AND/OR conditions. Apply to any campaign.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="rounded-xl border border-[var(--portal)] px-4 py-2 text-center" style={{ background: 'var(--portal-glow)' }}>
            <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">Estimated Match</p>
            <p className="text-lg font-bold" style={{ color: 'var(--portal)' }}>{previewCount.toLocaleString()}</p>
            <p className="text-[10px] text-[var(--text-muted)]">clients</p>
          </div>
        </div>
      </div>

      {/* Segment Groups */}
      <div className="mt-5 space-y-4">
        {segments.map((group, gi) => (
          <div key={gi} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-[var(--text-primary)]">Group {gi + 1}</span>
                <button onClick={() => toggleGroupLogic(gi)}
                  className="rounded-full px-2.5 py-0.5 text-[10px] font-bold transition-colors"
                  style={{
                    background: group.logic === 'AND' ? 'rgba(59,130,246,0.15)' : 'rgba(168,85,247,0.15)',
                    color: group.logic === 'AND' ? '#3b82f6' : '#a855f7',
                  }}>
                  {group.logic}
                </button>
              </div>
              <button onClick={() => addCondition(gi)}
                className="flex items-center gap-1 text-xs font-medium text-[var(--portal)] hover:underline">
                <span className="material-icons-outlined" style={{ fontSize: '14px' }}>add</span> Add Condition
              </button>
            </div>

            <div className="mt-3 space-y-2">
              {group.conditions.map((cond, ci) => (
                <div key={ci} className="flex items-center gap-2">
                  {ci > 0 && (
                    <span className="w-10 text-center text-[10px] font-bold"
                      style={{ color: group.logic === 'AND' ? '#3b82f6' : '#a855f7' }}>
                      {group.logic}
                    </span>
                  )}
                  {ci === 0 && <span className="w-10 text-center text-[10px] font-bold text-[var(--text-muted)]">IF</span>}
                  <select value={cond.field} onChange={(e) => updateCondition(gi, ci, 'field', e.target.value)}
                    className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-1.5 text-xs text-[var(--text-primary)] outline-none">
                    {SEGMENT_FIELDS.map((f) => <option key={f} value={f}>{f.replace('_', ' ')}</option>)}
                  </select>
                  <select value={cond.operator} onChange={(e) => updateCondition(gi, ci, 'operator', e.target.value)}
                    className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-1.5 text-xs text-[var(--text-primary)] outline-none">
                    {SEGMENT_OPERATORS.map((o) => <option key={o} value={o}>{o.replace('_', ' ')}</option>)}
                  </select>
                  <input type="text" value={cond.value} onChange={(e) => updateCondition(gi, ci, 'value', e.target.value)}
                    placeholder="Value..."
                    className="flex-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-1.5 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:border-[var(--portal)]" />
                  <button onClick={() => removeCondition(gi, ci)} className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                    <span className="material-icons-outlined" style={{ fontSize: '16px' }}>close</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Add Group + Apply */}
      <div className="mt-4 flex items-center gap-3">
        <button onClick={addGroup}
          className="flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-surface)]">
          <span className="material-icons-outlined" style={{ fontSize: '16px' }}>add_circle_outline</span> Add OR Group
        </button>
        <button className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
          style={{ background: 'var(--portal)' }}>
          <span className="material-icons-outlined" style={{ fontSize: '16px' }}>play_arrow</span> Preview Audience
        </button>
        <button className="flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-surface)]">
          <span className="material-icons-outlined" style={{ fontSize: '16px' }}>save</span> Save Segment
        </button>
      </div>

      {/* Saved Segments (mock) */}
      <div className="mt-6 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
        <h4 className="text-sm font-semibold text-[var(--text-primary)]">Saved Segments</h4>
        <div className="mt-3 space-y-2">
          {[
            { name: 'Active Clients — Health Pillar', count: 1_247, conditions: 3, lastUsed: '2026-03-10' },
            { name: 'T65 Birthday — Next 90 Days', count: 342, conditions: 2, lastUsed: '2026-03-12' },
            { name: 'MYGA Maturities — Q2 2026', count: 89, conditions: 4, lastUsed: '2026-03-08' },
            { name: 'New Acquisitions — DAVID Pipeline', count: 56, conditions: 2, lastUsed: '2026-03-14' },
          ].map((seg) => (
            <div key={seg.name} className="flex items-center justify-between rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-3">
              <div>
                <p className="text-sm font-medium text-[var(--text-primary)]">{seg.name}</p>
                <p className="text-xs text-[var(--text-muted)]">{seg.conditions} conditions &middot; Last used {formatDate(seg.lastUsed)}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold" style={{ color: 'var(--portal)' }}>{seg.count.toLocaleString()}</span>
                <button className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                  <span className="material-icons-outlined" style={{ fontSize: '16px' }}>edit</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <p className="mt-4 text-center text-xs text-[var(--text-muted)]">
        CONCEPT — Segment definitions saved to Firestore. Applied at send time against client collection.
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Welcome Campaign Template Card (TRK-117) — "We're Your People" sequence
// ---------------------------------------------------------------------------

function WelcomeCampaignCard() {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="rounded-xl border-2 border-dashed bg-[var(--bg-card)] p-5" style={{ borderColor: 'var(--portal)' }}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: 'var(--portal-glow)' }}>
            <span className="material-icons-outlined" style={{ fontSize: '22px', color: 'var(--portal)' }}>favorite</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-[var(--text-primary)]">{WELCOME_SEQUENCE.name}</p>
            <p className="text-xs text-[var(--text-muted)]">{WELCOME_SEQUENCE.description}</p>
          </div>
        </div>
        <button onClick={() => setExpanded(!expanded)}
          className="shrink-0 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-card)]">
          {expanded ? 'Collapse' : 'View Sequence'}
        </button>
      </div>

      {expanded && (
        <div className="mt-4">
          {/* Timeline */}
          <div className="flex items-start gap-0">
            {WELCOME_SEQUENCE.touches.map((touch, i) => (
              <div key={i} className="flex items-start">
                {i > 0 && (
                  <div className="mt-4 flex items-center">
                    <div className="h-px w-8" style={{ background: 'var(--border)' }} />
                    <span className="mx-1 text-[9px] text-[var(--text-muted)]">+{touch.day - WELCOME_SEQUENCE.touches[i - 1].day}d</span>
                    <div className="h-px w-8" style={{ background: 'var(--border)' }} />
                  </div>
                )}
                <div className="flex flex-col items-center" style={{ minWidth: '140px' }}>
                  <div className="flex h-8 w-8 items-center justify-center rounded-full text-white"
                    style={{ background: touch.channel === 'sms' ? '#8b5cf6' : touch.channel === 'call' ? '#f59e0b' : 'var(--portal)' }}>
                    <span className="material-icons-outlined" style={{ fontSize: '16px' }}>
                      {touch.channel === 'sms' ? 'sms' : touch.channel === 'call' ? 'phone' : 'email'}
                    </span>
                  </div>
                  <p className="mt-1 text-xs font-medium text-[var(--text-primary)]">{touch.label}</p>
                  <p className="text-[10px] text-[var(--text-muted)]">Day {touch.day}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Touch details */}
          <div className="mt-4 space-y-2">
            {WELCOME_SEQUENCE.touches.map((touch, i) => (
              <div key={i} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold text-white"
                    style={{ background: touch.channel === 'sms' ? '#8b5cf6' : touch.channel === 'call' ? '#f59e0b' : 'var(--portal)' }}>
                    {i + 1}
                  </span>
                  <span className="text-xs font-semibold text-[var(--text-primary)]">{touch.label}</span>
                  <span className="rounded-full bg-[var(--bg-card)] px-1.5 py-0.5 text-[9px] text-[var(--text-muted)]">{touch.channel.toUpperCase()}</span>
                  <span className="text-[9px] text-[var(--text-muted)]">Day {touch.day}</span>
                </div>
                {touch.subject && <p className="mt-1 text-xs font-medium text-[var(--text-secondary)]">Subject: {touch.subject}</p>}
                <p className="mt-1 text-xs italic text-[var(--text-muted)]">{touch.preview}</p>
              </div>
            ))}
          </div>

          <div className="mt-3 flex gap-2">
            <button className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90" style={{ background: 'var(--portal)' }}>
              <span className="material-icons-outlined" style={{ fontSize: '14px' }}>content_copy</span> Use This Sequence
            </button>
            <button className="flex items-center gap-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-surface)]">
              <span className="material-icons-outlined" style={{ fontSize: '14px' }}>edit</span> Customize
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function MetricCard({ label, value, icon, accent, warning }: { label: string; value: number | string; icon: string; accent?: boolean; warning?: boolean }) {
  const color = warning ? '#ef4444' : accent ? 'var(--portal)' : 'var(--text-primary)'
  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-3">
      <div className="flex items-center gap-1.5">
        <span className="material-icons-outlined" style={{ fontSize: '16px', color: 'var(--portal)' }}>{icon}</span>
        <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">{label}</span>
      </div>
      <p className="mt-1 text-xl font-bold" style={{ color }}>{typeof value === 'number' ? value.toLocaleString() : value}</p>
    </div>
  )
}
