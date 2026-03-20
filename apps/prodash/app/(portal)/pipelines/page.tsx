'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth, useEntitlements } from '@tomachina/auth'
import type { FlowPipelineDef } from '@tomachina/core'
import { fetchWithAuth } from '@tomachina/ui/src/modules/fetchWithAuth'
import { AppWrapper } from '@tomachina/ui'
import { toSlug } from './pipeline-keys'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api'

function isLeaderOrAbove(userLevel: string): boolean {
  return ['LEADER', 'EXECUTIVE', 'OWNER'].includes(userLevel)
}

const PIPELINE_ICONS: Record<string, string> = {
  NBX_INVESTMENTS: 'account_balance',
  NBX_ANNUITY: 'savings',
  NBX_LIFE: 'favorite',
  NBX_MEDICARE_MAPD: 'health_and_safety',
  NBX_MEDICARE_SUPP: 'medical_services',
  SALES_RETIREMENT: 'trending_up',
  SALES_LIFE: 'shield',
  SALES_MEDICARE: 'local_hospital',
  PROSPECT_T65: 'cake',
  PROSPECT_AGE_IN: 'elderly',
  REACTIVE_MEDICARE: 'support_agent',
  REACTIVE_RETIREMENT: 'autorenew',
  SESSION_AGENT_WORKFLOW: 'engineering',
}

export default function PipelinesListPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { ctx, loading: entLoading } = useEntitlements()
  const [loading, setLoading] = useState(true)
  const [pipelines, setPipelines] = useState<FlowPipelineDef[]>([])
  const [instanceCounts, setInstanceCounts] = useState<Record<string, number>>({})

  useEffect(() => {
    if (!user || entLoading) return
    let cancelled = false

    async function load() {
      try {
        const res = await fetchWithAuth(`${API_BASE}/flow/pipelines?portal=PRODASHX&status=active`)
        if (cancelled || res.status === 401) return
        const json = await res.json() as { success: boolean; data?: FlowPipelineDef[] }
        if (cancelled || !json.success || !json.data) return

        const apiData = Array.isArray(json.data) ? json.data : []
        const assignedPipelines = ctx.assignedModules || []
        const visible = isLeaderOrAbove(ctx.userLevel)
          ? apiData
          : apiData.filter(
              (p) =>
                assignedPipelines.includes(p.pipeline_key) ||
                assignedPipelines.includes(`PIPELINE_${p.pipeline_key}`)
            )

        setPipelines(visible)

        // Fetch instance counts in parallel
        const counts: Record<string, number> = {}
        await Promise.all(
          visible.map(async (p) => {
            try {
              const r = await fetchWithAuth(`${API_BASE}/flow/instances?pipeline_key=${p.pipeline_key}`)
              if (r.ok) {
                const j = await r.json() as { data?: unknown[] }
                counts[p.pipeline_key] = j.data?.length || 0
              }
            } catch { /* skip */ }
          })
        )
        if (!cancelled) setInstanceCounts(counts)
      } catch { /* skip */ } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [user, ctx, entLoading])

  if (loading) {
    return (
      <AppWrapper appKey="pipelines">
        <div className="space-y-6 p-2">
          <div className="h-8 w-48 animate-pulse rounded bg-[var(--bg-surface)]" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <div key={n} className="h-32 animate-pulse rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)]" />
            ))}
          </div>
        </div>
      </AppWrapper>
    )
  }

  if (pipelines.length === 0) {
    return (
      <AppWrapper appKey="pipelines">
        <div className="flex h-full items-center justify-center">
          <div className="flex flex-col items-center rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-card)] px-12 py-16">
            <span className="material-icons-outlined text-4xl text-[var(--text-muted)]">view_kanban</span>
            <p className="mt-4 text-sm font-medium text-[var(--text-primary)]">No pipelines assigned</p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">Contact your team leader to get access to pipeline boards.</p>
          </div>
        </div>
      </AppWrapper>
    )
  }

  return (
    <AppWrapper appKey="pipelines">
      <div className="space-y-6 p-2">
        <div>
          <h1 className="text-xl font-bold text-[var(--text-primary)]">Pipelines</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">Select a pipeline to view and manage cases.</p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {pipelines.map((p) => {
            const count = instanceCounts[p.pipeline_key] || 0
            const icon = PIPELINE_ICONS[p.pipeline_key] || p.icon || 'view_kanban'
            return (
              <button
                key={p.pipeline_key}
                onClick={() => router.push(`/pipelines/${toSlug(p.pipeline_key)}`)}
                className="group flex flex-col rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-5 text-left transition-all hover:border-[var(--portal)] hover:shadow-lg"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-lg"
                      style={{ background: 'rgba(var(--portal-rgb, 74, 122, 181), 0.15)' }}
                    >
                      <span className="material-icons-outlined text-[var(--portal)]" style={{ fontSize: '20px' }}>
                        {icon}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[var(--text-primary)] group-hover:text-[var(--portal)]">
                        {p.pipeline_name}
                      </p>
                      <p className="text-xs text-[var(--text-muted)]">{p.domain || p.product_type || ''}</p>
                    </div>
                  </div>
                  <span className="material-icons-outlined text-[var(--text-muted)] opacity-0 transition-opacity group-hover:opacity-100" style={{ fontSize: '18px' }}>
                    arrow_forward
                  </span>
                </div>
                <div className="mt-4 flex items-center gap-4 text-xs text-[var(--text-muted)]">
                  <span className="flex items-center gap-1">
                    <span className="material-icons-outlined" style={{ fontSize: '14px' }}>assignment</span>
                    {count} {count === 1 ? 'case' : 'cases'}
                  </span>
                  {p.default_view && (
                    <span className="flex items-center gap-1">
                      <span className="material-icons-outlined" style={{ fontSize: '14px' }}>view_kanban</span>
                      {p.default_view}
                    </span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </AppWrapper>
  )
}
