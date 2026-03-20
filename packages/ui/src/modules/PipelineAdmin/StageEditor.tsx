'use client'

import { fetchWithAuth } from '../fetchWithAuth'
import { useState, useEffect, useMemo } from 'react'
import type { FlowStageDef } from '@tomachina/core'
import { TaskTemplateEditor } from './TaskTemplateEditor'

// ============================================================================
// StageEditor — read-only stage configuration viewer for a pipeline
// ============================================================================

export interface StageEditorProps {
  pipelineKey: string
  apiBase?: string
}

interface StagesResponse {
  success: boolean
  data?: FlowStageDef[]
  error?: string
}

/* ─── Stage Row ─── */

function StageRow({
  stage,
  pipelineKey,
  apiBase,
}: {
  stage: FlowStageDef
  pipelineKey: string
  apiBase: string
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)]">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between px-5 py-3.5"
      >
        <div className="flex items-center gap-3">
          {/* Order number */}
          <span
            className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white"
            style={{ backgroundColor: stage.stage_color || 'var(--portal)' }}
          >
            {stage.stage_order}
          </span>

          {/* Stage info */}
          <div className="text-left">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-[var(--text-primary)]">
                {stage.stage_name}
              </span>

              {/* Gate badge */}
              {stage.gate_enforced && (
                <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-400">
                  <span className="material-icons-outlined" style={{ fontSize: '10px' }}>lock</span>
                  Gated
                </span>
              )}

              {/* Workflow badge */}
              {stage.has_workflow && (
                <span className="inline-flex items-center gap-0.5 rounded-full bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-medium text-blue-400">
                  <span className="material-icons-outlined" style={{ fontSize: '10px' }}>account_tree</span>
                  Workflow
                </span>
              )}
            </div>

            {stage.stage_description && (
              <p className="mt-0.5 text-[10px] text-[var(--text-muted)]">
                {stage.stage_description}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Color swatch */}
          {stage.stage_color && (
            <div
              className="h-4 w-4 rounded-full border border-white/20"
              style={{ backgroundColor: stage.stage_color }}
              title={`Color: ${stage.stage_color}`}
            />
          )}

          {/* Status */}
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
              stage.status === 'active'
                ? 'bg-emerald-500/10 text-emerald-400'
                : 'bg-neutral-500/10 text-neutral-400'
            }`}
          >
            {stage.status}
          </span>

          {/* Expand icon */}
          <span
            className="material-icons-outlined text-[var(--text-muted)] transition-transform"
            style={{
              fontSize: '18px',
              transform: expanded ? 'rotate(0deg)' : 'rotate(-90deg)',
            }}
          >
            expand_more
          </span>
        </div>
      </button>

      {/* Expanded: Task templates */}
      {expanded && (
        <div className="border-t border-[var(--border-subtle)] px-5 pb-4 pt-3">
          <TaskTemplateEditor
            pipelineKey={pipelineKey}
            stageId={stage.stage_id}
            apiBase={apiBase}
          />
        </div>
      )}
    </div>
  )
}

/* ─── Main Component ─── */

export function StageEditor({ pipelineKey, apiBase = '/api' }: StageEditorProps) {
  const [stages, setStages] = useState<FlowStageDef[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function fetchStages() {
      try {
        setLoading(true)
        setError(null)
        const res = await fetchWithAuth(`${apiBase}/flow/pipelines/${pipelineKey}/stages`)
        const json: StagesResponse = await res.json()

        if (cancelled) return

        if (!json.success || !json.data) {
          setError(json.error || 'Failed to load stages')
          return
        }

        setStages(Array.isArray(json.data) ? json.data : [])
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Network error')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchStages()
    return () => { cancelled = true }
  }, [apiBase, pipelineKey])

  const sorted = useMemo(
    () => [...stages].sort((a, b) => a.stage_order - b.stage_order),
    [stages]
  )

  /* ─── Loading ─── */
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--portal)] border-t-transparent" />
      </div>
    )
  }

  /* ─── Error ─── */
  if (error) {
    return (
      <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-[var(--text-secondary)]">
        <div className="flex items-center gap-2">
          <span className="material-icons-outlined text-red-400" style={{ fontSize: '16px' }}>
            error_outline
          </span>
          {error}
        </div>
      </div>
    )
  }

  /* ─── Empty ─── */
  if (sorted.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-card)] py-12">
        <span className="material-icons-outlined text-3xl text-[var(--text-muted)]">
          layers
        </span>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          No stages configured for this pipeline.
        </p>
      </div>
    )
  }

  /* ─── Stage list ─── */
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="material-icons-outlined text-[var(--portal)]" style={{ fontSize: '18px' }}>
            layers
          </span>
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">
            Pipeline Stages
          </h3>
          <span className="text-[10px] text-[var(--text-muted)]">({sorted.length})</span>
        </div>

        {/* Read-only notice */}
        <span
          className="flex items-center gap-1 rounded-full bg-[var(--bg-surface)] px-2.5 py-1 text-[10px] text-[var(--text-muted)]"
          title="Editing coming soon"
        >
          <span className="material-icons-outlined" style={{ fontSize: '12px' }}>visibility</span>
          Read-only
        </span>
      </div>

      <div className="space-y-2">
        {sorted.map((stage) => (
          <StageRow
            key={stage.stage_id}
            stage={stage}
            pipelineKey={pipelineKey}
            apiBase={apiBase}
          />
        ))}
      </div>
    </div>
  )
}
