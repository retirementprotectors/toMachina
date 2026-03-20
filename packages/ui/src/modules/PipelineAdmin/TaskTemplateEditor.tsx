'use client'

import { fetchWithAuth } from '../fetchWithAuth'
import { useState, useEffect, useMemo } from 'react'
import type { FlowTaskTemplateDef } from '@tomachina/core'

// ============================================================================
// TaskTemplateEditor — read-only task template viewer for a pipeline stage
// ============================================================================

export interface TaskTemplateEditorProps {
  pipelineKey: string
  stageId: string
  apiBase?: string
}

interface TaskTemplatesResponse {
  success: boolean
  data?: FlowTaskTemplateDef[]
  error?: string
}

/* ─── Helpers ─── */

function formatCheckConfig(config?: string): string {
  if (!config) return ''
  try {
    const parsed = JSON.parse(config)
    return JSON.stringify(parsed, null, 2)
  } catch {
    return config
  }
}

/* ─── Task Template Row ─── */

function TaskTemplateRow({ template }: { template: FlowTaskTemplateDef }) {
  const [showConfig, setShowConfig] = useState(false)

  return (
    <div className="rounded-lg bg-[var(--bg-card)] px-3 py-2.5">
      <div className="flex items-center gap-3">
        {/* Order */}
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-[10px] font-bold text-[var(--text-muted)] bg-[var(--bg-surface)]">
          {template.task_order}
        </span>

        {/* Task name */}
        <span className="flex-1 text-sm text-[var(--text-primary)]">
          {template.task_name}
        </span>

        {/* Badges */}
        <div className="flex shrink-0 items-center gap-1.5">
          {/* Required */}
          {template.is_required && (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-red-500/10 px-1.5 py-0.5 text-[10px] font-medium text-red-400">
              <span className="material-icons-outlined" style={{ fontSize: '10px' }}>
                star
              </span>
              Required
            </span>
          )}

          {/* System check */}
          {template.is_system_check && (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-medium text-blue-400">
              <span className="material-icons-outlined" style={{ fontSize: '10px' }}>
                smart_toy
              </span>
              {template.check_type || 'System'}
            </span>
          )}

          {/* Role applicability */}
          {template.role_applicability && (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-purple-500/10 px-1.5 py-0.5 text-[10px] font-medium text-purple-400">
              <span className="material-icons-outlined" style={{ fontSize: '10px' }}>
                badge
              </span>
              {template.role_applicability}
            </span>
          )}

          {/* Config expand toggle */}
          {(template.check_config || template.task_description) && (
            <button
              onClick={() => setShowConfig((v) => !v)}
              className="text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
              title="Show details"
            >
              <span className="material-icons-outlined" style={{ fontSize: '16px' }}>
                {showConfig ? 'expand_less' : 'info'}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Expanded: description + config */}
      {showConfig && (
        <div className="mt-2 ml-8 space-y-2">
          {template.task_description && (
            <p className="text-xs text-[var(--text-secondary)]">
              {template.task_description}
            </p>
          )}

          {template.check_config && (
            <div>
              <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
                Check Config
              </span>
              <pre className="mt-1 overflow-x-auto rounded-md bg-[var(--bg-surface)] px-3 py-2 text-[10px] text-[var(--text-secondary)] font-mono">
                {formatCheckConfig(template.check_config)}
              </pre>
            </div>
          )}

          {template.default_owner && (
            <div className="flex items-center gap-1 text-[10px] text-[var(--text-muted)]">
              <span className="material-icons-outlined" style={{ fontSize: '12px' }}>person</span>
              Default owner: {template.default_owner}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ─── Main Component ─── */

export function TaskTemplateEditor({
  pipelineKey,
  stageId,
  apiBase = '/api',
}: TaskTemplateEditorProps) {
  const [templates, setTemplates] = useState<FlowTaskTemplateDef[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function fetchTemplates() {
      try {
        setLoading(true)
        setError(null)
        const res = await fetchWithAuth(
          `${apiBase}/flow/pipelines/${pipelineKey}/stages/${stageId}/tasks`
        )
        const json: TaskTemplatesResponse = await res.json()

        if (cancelled) return

        if (!json.success || !json.data) {
          setError(json.error || 'Failed to load task templates')
          return
        }

        setTemplates(Array.isArray(json.data) ? json.data : [])
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Network error')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchTemplates()
    return () => { cancelled = true }
  }, [apiBase, pipelineKey, stageId])

  const sorted = useMemo(
    () => [...templates].sort((a, b) => a.task_order - b.task_order),
    [templates]
  )

  /* ─── Loading ─── */
  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--portal)] border-t-transparent" />
      </div>
    )
  }

  /* ─── Error ─── */
  if (error) {
    return (
      <div className="rounded-lg bg-red-500/5 px-3 py-2 text-xs text-red-400">
        {error}
      </div>
    )
  }

  /* ─── Empty ─── */
  if (sorted.length === 0) {
    return (
      <div className="py-4 text-center">
        <span className="material-icons-outlined text-xl text-[var(--text-muted)]">
          checklist
        </span>
        <p className="mt-1 text-xs text-[var(--text-muted)]">No task templates for this stage.</p>
      </div>
    )
  }

  /* ─── Template list ─── */
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="material-icons-outlined text-[var(--text-muted)]" style={{ fontSize: '14px' }}>
            checklist
          </span>
          <span className="text-xs font-medium text-[var(--text-secondary)]">
            Task Templates
          </span>
          <span className="text-[10px] text-[var(--text-muted)]">({sorted.length})</span>
        </div>

        {/* Read-only notice */}
        <span
          className="text-[10px] text-[var(--text-muted)]"
          title="Editing coming soon"
        >
          Read-only
        </span>
      </div>

      <div className="space-y-1">
        {sorted.map((template) => (
          <TaskTemplateRow key={template.task_id} template={template} />
        ))}
      </div>
    </div>
  )
}
