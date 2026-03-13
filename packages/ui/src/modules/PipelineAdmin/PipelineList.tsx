'use client'

import { fetchWithAuth } from '../fetchWithAuth'
import { useState, useEffect } from 'react'
import type { FlowPipelineDef } from '@tomachina/core'

// ============================================================================
// PipelineList — pipeline directory grid for admin / portal navigation
// ============================================================================

export interface PipelineListProps {
  portal: 'prodashx' | 'riimo' | 'sentinel'
  apiBase?: string
  onSelectPipeline?: (pipelineKey: string) => void
}

interface PipelinesResponse {
  success: boolean
  data?: FlowPipelineDef[]
  error?: string
}

/* ─── Status config ─── */

const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  active: { bg: 'bg-emerald-500/10', text: 'text-emerald-400' },
  draft: { bg: 'bg-yellow-500/10', text: 'text-yellow-400' },
  archived: { bg: 'bg-neutral-500/10', text: 'text-neutral-400' },
  disabled: { bg: 'bg-red-500/10', text: 'text-red-400' },
}

/* ─── Pipeline Card ─── */

function PipelineCard({
  pipeline,
  onClick,
}: {
  pipeline: FlowPipelineDef
  onClick?: () => void
}) {
  const status = pipeline.status || 'draft'
  const statusStyle = STATUS_STYLES[status.toLowerCase()] || STATUS_STYLES.draft

  return (
    <button
      onClick={onClick}
      className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 text-left transition-colors hover:border-[var(--border-medium)]"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <span
            className="flex h-10 w-10 items-center justify-center rounded-lg"
            style={{ backgroundColor: 'var(--portal-glow)' }}
          >
            <span className="material-icons-outlined" style={{ fontSize: '20px', color: 'var(--portal)' }}>
              {pipeline.icon || 'view_kanban'}
            </span>
          </span>
          <div>
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">
              {pipeline.pipeline_name}
            </h3>
            {pipeline.domain && (
              <p className="mt-0.5 text-[10px] text-[var(--text-muted)]">
                {pipeline.domain}
              </p>
            )}
          </div>
        </div>

        {/* Status badge */}
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${statusStyle.bg} ${statusStyle.text}`}
        >
          {status}
        </span>
      </div>

      {/* Description */}
      {pipeline.description && (
        <p className="mt-3 text-xs text-[var(--text-secondary)] line-clamp-2">
          {pipeline.description}
        </p>
      )}

      {/* Metadata row */}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        {pipeline.product_type && (
          <span className="flex items-center gap-1 text-[10px] text-[var(--text-muted)]">
            <span className="material-icons-outlined" style={{ fontSize: '12px' }}>category</span>
            {pipeline.product_type}
          </span>
        )}
        {pipeline.platform_carrier && (
          <span className="flex items-center gap-1 text-[10px] text-[var(--text-muted)]">
            <span className="material-icons-outlined" style={{ fontSize: '12px' }}>business</span>
            {pipeline.platform_carrier}
          </span>
        )}
      </div>

      {/* Navigate arrow */}
      <div className="mt-3 flex items-center gap-1 text-xs font-medium" style={{ color: 'var(--portal)' }}>
        <span>Open pipeline</span>
        <span className="material-icons-outlined" style={{ fontSize: '14px' }}>
          arrow_forward
        </span>
      </div>
    </button>
  )
}

/* ─── Main Component ─── */

export default function PipelineList({
  portal,
  apiBase = '/api',
  onSelectPipeline,
}: PipelineListProps) {
  const [pipelines, setPipelines] = useState<FlowPipelineDef[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function fetchPipelines() {
      try {
        setLoading(true)
        setError(null)
        const res = await fetchWithAuth(`${apiBase}/flow/pipelines?portal=${portal}`)
        const json: PipelinesResponse = await res.json()

        if (cancelled) return

        if (!json.success || !json.data) {
          setError(json.error || 'Failed to load pipelines')
          return
        }

        setPipelines(json.data)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Network error')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchPipelines()
    return () => { cancelled = true }
  }, [apiBase, portal])

  /* ─── Loading ─── */
  if (loading) {
    return (
      <div className="mx-auto max-w-5xl">
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--portal)] border-t-transparent" />
        </div>
      </div>
    )
  }

  /* ─── Error ─── */
  if (error) {
    return (
      <div className="mx-auto max-w-5xl">
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-6 text-sm text-[var(--text-secondary)]">
          <div className="flex items-center gap-2">
            <span className="material-icons-outlined text-red-400" style={{ fontSize: '18px' }}>
              error_outline
            </span>
            {error}
          </div>
        </div>
      </div>
    )
  }

  /* ─── Empty ─── */
  if (pipelines.length === 0) {
    return (
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-card)] py-16">
          <span className="material-icons-outlined text-4xl text-[var(--text-muted)]">
            view_kanban
          </span>
          <p className="mt-3 text-sm text-[var(--text-muted)]">
            No pipelines configured for this portal.
          </p>
          <p className="mt-1 text-[10px] text-[var(--text-muted)]">
            Pipelines are created from the flow engine configuration.
          </p>
        </div>
      </div>
    )
  }

  /* ─── Grid ─── */
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Pipelines</h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          {pipelines.length} pipeline{pipelines.length !== 1 ? 's' : ''} configured
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {pipelines.map((pipeline) => (
          <PipelineCard
            key={pipeline.pipeline_key}
            pipeline={pipeline}
            onClick={() => onSelectPipeline?.(pipeline.pipeline_key)}
          />
        ))}
      </div>
    </div>
  )
}
