'use client'

import { useMemo } from 'react'
import { query, type Query, type DocumentData } from 'firebase/firestore'
import { useCollection } from '@tomachina/db'
import { collections } from '@tomachina/db/src/firestore'
import { KanbanBoard, type KanbanColumn, type KanbanCard } from '@tomachina/ui'

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
  // Map common stage names
  if (normalized.includes('discover') || normalized.includes('prospect')) return 'discovery'
  if (normalized.includes('qualif') || normalized.includes('data_foundation')) return 'qualification'
  if (normalized.includes('propos') || normalized.includes('case_build')) return 'proposal'
  if (normalized.includes('negoti') || normalized.includes('close') && !normalized.includes('won') && !normalized.includes('lost')) return 'negotiation'
  if (normalized.includes('won') || normalized.includes('converted')) return 'closed_won'
  if (normalized.includes('lost') || normalized.includes('dead') || normalized.includes('cancel')) return 'closed_lost'
  // Check if it matches any stage ID directly
  const match = STAGES.find((s) => s.id === normalized)
  return match ? match.id : 'discovery'
}

function formatCurrency(value: number | undefined): string {
  if (!value || isNaN(value)) return ''
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

export default function DealsPage() {
  const { data: opportunities, loading, error } = useCollection<OpportunityRecord>(oppsQuery, 'sentinel-deals')

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
        }
      })

      return {
        id: stage.id,
        title: stage.title,
        color: stage.color,
        cards,
      }
    })
  }, [opportunities])

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
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Deals</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            {opportunities.length} opportunity{opportunities.length !== 1 ? 'ies' : 'y'} across {STAGES.length} stages
          </p>
        </div>
      </div>

      <KanbanBoard
        columns={columns}
        emptyMessage="No deals found. Opportunities will appear here once data is synced."
      />
    </div>
  )
}
