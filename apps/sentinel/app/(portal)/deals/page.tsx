'use client'

import { useMemo, useState, useCallback } from 'react'
import { query, type Query, type DocumentData } from 'firebase/firestore'
import { useCollection } from '@tomachina/db'
import { collections } from '@tomachina/db/src/firestore'
import { KanbanBoard, type KanbanColumn, type KanbanCard, Modal } from '@tomachina/ui'

const oppsQuery: Query<DocumentData> = query(collections.opportunities())

interface OpportunityRecord {
  _id: string
  opportunity_id?: string
  name?: string
  opportunity_name?: string
  client_name?: string
  client_id?: string
  agent_name?: string
  stage?: string
  pipeline_stage?: string
  status?: string
  estimated_value?: number
  premium?: number
  product_type?: string
  source?: string
  created_at?: string
  updated_at?: string
  notes?: string
  description?: string
  deal_type?: string
}

/* Pipeline stages for the Kanban board */
const STAGES = [
  { id: 'discovery', title: 'Discovery', color: 'var(--info)' },
  { id: 'qualification', title: 'Qualification', color: '#a78bfa' },
  { id: 'proposal', title: 'Proposal', color: 'var(--warning)' },
  { id: 'negotiation', title: 'Negotiation', color: '#f6ad55' },
  { id: 'closed_won', title: 'Closed Won', color: 'var(--success)' },
  { id: 'closed_lost', title: 'Closed Lost', color: 'var(--error)' },
]

function normalizeStage(stage: string | undefined): string {
  if (!stage) return 'discovery'
  const normalized = stage.toLowerCase().replace(/[\s-]+/g, '_')
  if (normalized.includes('discover') || normalized.includes('prospect')) return 'discovery'
  if (normalized.includes('qualif') || normalized.includes('data_foundation')) return 'qualification'
  if (normalized.includes('propos') || normalized.includes('case_build')) return 'proposal'
  if (normalized.includes('negoti') || (normalized.includes('close') && !normalized.includes('won') && !normalized.includes('lost'))) return 'negotiation'
  if (normalized.includes('won') || normalized.includes('converted')) return 'closed_won'
  if (normalized.includes('lost') || normalized.includes('dead') || normalized.includes('cancel')) return 'closed_lost'
  const match = STAGES.find((s) => s.id === normalized)
  return match ? match.id : 'discovery'
}

function formatCurrency(value: number | undefined): string {
  if (!value || isNaN(value)) return ''
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function relativeTime(dateStr: string | undefined): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`
  return d.toLocaleDateString()
}

export default function DealsPage() {
  const { data: opportunities, loading, error } = useCollection<OpportunityRecord>(oppsQuery, 'sentinel-deals')
  const [selectedDeal, setSelectedDeal] = useState<OpportunityRecord | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)

  const stageStats = useMemo(() => {
    const stats: Record<string, { count: number; value: number }> = {}
    STAGES.forEach((s) => { stats[s.id] = { count: 0, value: 0 } })
    opportunities.forEach((opp) => {
      const stage = normalizeStage(opp.stage || opp.pipeline_stage)
      if (stats[stage]) {
        stats[stage].count++
        stats[stage].value += Number(opp.estimated_value || opp.premium || 0)
      }
    })
    return stats
  }, [opportunities])

  const totalPipelineValue = useMemo(() => {
    return opportunities.reduce((sum, o) => {
      const stage = normalizeStage(o.stage || o.pipeline_stage)
      if (stage !== 'closed_won' && stage !== 'closed_lost') {
        return sum + Number(o.estimated_value || o.premium || 0)
      }
      return sum
    }, 0)
  }, [opportunities])

  const columns: KanbanColumn[] = useMemo(() => {
    return STAGES.map((stage) => {
      const stageOpps = opportunities.filter(
        (opp) => normalizeStage(opp.stage || opp.pipeline_stage) === stage.id
      )

      const cards: KanbanCard[] = stageOpps.map((opp) => {
        const value = opp.estimated_value || opp.premium
        const badges: KanbanCard['badges'] = []
        if (opp.product_type) badges.push({ label: opp.product_type })
        if (opp.source) badges.push({ label: opp.source, color: 'var(--info)' })
        if (opp.deal_type) badges.push({ label: opp.deal_type, color: '#a78bfa' })

        const meta: KanbanCard['meta'] = []
        if (opp.client_name) meta.push({ icon: 'person', text: opp.client_name })
        if (opp.agent_name) meta.push({ icon: 'support_agent', text: opp.agent_name })
        if (value) meta.push({ icon: 'payments', text: formatCurrency(value) })

        return {
          id: opp._id,
          title: opp.opportunity_name || opp.name || `Deal ${opp._id.slice(0, 8)}`,
          subtitle: opp.status && opp.status !== stage.id ? opp.status : undefined,
          badges,
          meta,
          onClick: () => setSelectedDeal(opp),
        }
      })

      return { id: stage.id, title: stage.title, color: stage.color, cards }
    })
  }, [opportunities])

  const handleCloseDeal = useCallback(() => setSelectedDeal(null), [])
  const handleCloseCreate = useCallback(() => setShowCreateModal(false), [])

  if (loading) {
    return (
      <div className="mx-auto max-w-[1400px]">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Deals</h1>
        <div className="mt-8 flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--portal)] border-t-transparent" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="mx-auto max-w-[1400px]">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Deals</h1>
        <div className="mt-6 rounded-xl border border-[var(--error)] bg-[rgba(239,68,68,0.05)] p-6 text-sm text-[var(--text-secondary)]">
          Failed to load deals: {error.message}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-[1400px]">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Deals</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            {opportunities.length} opportunit{opportunities.length !== 1 ? 'ies' : 'y'} &middot; {formatCurrency(totalPipelineValue)} pipeline value
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors"
          style={{ background: 'var(--portal)' }}
        >
          <span className="material-icons-outlined" style={{ fontSize: '18px' }}>add</span>
          New Deal
        </button>
      </div>

      {/* Stage Summary */}
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {STAGES.map((s) => (
          <div key={s.id} className="flex-shrink-0 rounded-lg bg-[var(--bg-card)] px-3 py-2 text-center" style={{ borderLeft: `3px solid ${s.color}` }}>
            <p className="text-xs text-[var(--text-muted)]">{s.title}</p>
            <p className="text-sm font-bold text-[var(--text-primary)]">{stageStats[s.id]?.count || 0}</p>
            {(stageStats[s.id]?.value || 0) > 0 && (
              <p className="text-[10px] text-[var(--text-muted)]">{formatCurrency(stageStats[s.id].value)}</p>
            )}
          </div>
        ))}
      </div>

      <KanbanBoard
        columns={columns}
        emptyMessage="No deals found. Opportunities will appear here once data is synced."
      />

      {/* Deal Detail Modal */}
      {selectedDeal && (
        <Modal open={!!selectedDeal} onClose={handleCloseDeal} title={selectedDeal.opportunity_name || selectedDeal.name || 'Deal Detail'} size="lg">
          <div className="space-y-4">
            {/* Status bar */}
            <div className="flex gap-1">
              {STAGES.map((s) => {
                const isActive = normalizeStage(selectedDeal.stage || selectedDeal.pipeline_stage) === s.id
                return (
                  <div
                    key={s.id}
                    className="flex-1 rounded py-1 text-center text-[10px] font-medium"
                    style={{
                      background: isActive ? s.color : 'var(--bg-surface)',
                      color: isActive ? 'white' : 'var(--text-muted)',
                    }}
                  >
                    {s.title}
                  </div>
                )
              })}
            </div>

            {/* Details */}
            <div className="grid grid-cols-2 gap-4">
              <InfoField label="Deal Value" value={formatCurrency(selectedDeal.estimated_value || selectedDeal.premium) || '-'} />
              <InfoField label="Product Type" value={selectedDeal.product_type || '-'} />
              <InfoField label="Client" value={selectedDeal.client_name || '-'} />
              <InfoField label="Agent/Producer" value={selectedDeal.agent_name || '-'} />
              <InfoField label="Source" value={selectedDeal.source || '-'} />
              <InfoField label="Deal Type" value={selectedDeal.deal_type || '-'} />
              <InfoField label="Created" value={selectedDeal.created_at ? relativeTime(selectedDeal.created_at) : '-'} />
              <InfoField label="Last Updated" value={selectedDeal.updated_at ? relativeTime(selectedDeal.updated_at) : '-'} />
            </div>

            {/* Description */}
            {selectedDeal.description && (
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">Description</p>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">{selectedDeal.description}</p>
              </div>
            )}

            {/* Notes */}
            {selectedDeal.notes && (
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">Notes</p>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">{selectedDeal.notes}</p>
              </div>
            )}

            {/* Document attachment placeholder */}
            <div className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--bg-surface)] p-4 text-center">
              <span className="material-icons-outlined text-xl text-[var(--text-muted)]">attach_file</span>
              <p className="mt-1 text-xs text-[var(--text-muted)]">Attach documents via DEX</p>
            </div>

            {/* Valuation shortcut */}
            <div className="flex justify-end">
              <a
                href="/modules/david-hub"
                className="flex items-center gap-1.5 rounded-lg bg-[var(--bg-surface)] px-3 py-2 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)]"
              >
                <span className="material-icons-outlined" style={{ fontSize: '14px' }}>calculate</span>
                Run Valuation in DAVID HUB
              </a>
            </div>
          </div>
        </Modal>
      )}

      {/* Create Deal Modal */}
      <Modal open={showCreateModal} onClose={handleCloseCreate} title="New Deal" size="md">
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Deal Name</label>
            <input type="text" placeholder="Enter deal name..." className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--portal)]" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Estimated Value ($)</label>
              <input type="number" placeholder="0" className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--portal)]" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Deal Type</label>
              <div className="flex gap-2">
                {['Merger', 'Acquisition', 'Partnership'].map((t) => (
                  <button key={t} className="flex-1 rounded-lg bg-[var(--bg-surface)] py-1.5 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)]">
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Producer/Agent</label>
            <input type="text" placeholder="Search producers..." className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--portal)]" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Notes</label>
            <textarea placeholder="Deal notes..." rows={3} className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--portal)]" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={handleCloseCreate} className="rounded-lg bg-[var(--bg-surface)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)]">Cancel</button>
            <button onClick={handleCloseCreate} className="rounded-lg px-4 py-2 text-sm font-medium text-white" style={{ background: 'var(--portal)' }}>Create Deal</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">{label}</p>
      <p className="mt-0.5 text-sm text-[var(--text-primary)]">{value}</p>
    </div>
  )
}
