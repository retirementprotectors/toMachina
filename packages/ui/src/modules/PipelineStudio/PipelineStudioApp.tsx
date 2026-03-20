'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import type { FlowPipelineDef } from '@tomachina/core'
import PipelineEditor from './PipelineEditor'
import PipelineWizard from './PipelineWizard'
import { fetchWithAuth } from '../fetchWithAuth'

// ============================================================================
// PipelineStudioApp — Full-screen pipeline builder app shell
// Two views: Pipeline List (default) + Pipeline Editor (on select)
// ============================================================================

export interface PipelineStudioProps {
  portal: 'prodashx' | 'riimo' | 'sentinel'
  apiBase?: string
}

type StatusFilter = 'all' | 'active' | 'draft' | 'archived'

interface PipelinesResponse {
  success: boolean
  data?: FlowPipelineDef[]
  error?: string
}

/* --- Status styles --- */

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  active:   { bg: 'bg-emerald-500/10', text: 'text-emerald-400', label: 'Published' },
  draft:    { bg: 'bg-yellow-500/10',  text: 'text-yellow-400',  label: 'Draft' },
  archived: { bg: 'bg-neutral-500/10', text: 'text-neutral-400', label: 'Archived' },
}

/* --- Pipeline Card --- */

const SECTION_STYLES: Record<string, { icon: string; label: string; color: string }> = {
  sales:   { icon: 'storefront',    label: 'Sales',   color: '#4a7ab5' },
  service: { icon: 'support_agent', label: 'Service', color: '#4a7ab5' },
  both:    { icon: 'swap_horiz',    label: 'Both',    color: '#4a7ab5' },
}

function StudioPipelineCard({
  pipeline,
  onClick,
  onSectionChange,
}: {
  pipeline: FlowPipelineDef
  onClick: () => void
  onSectionChange: (pipelineKey: string, section: string) => Promise<void>
}) {
  const status = (pipeline.status || 'draft').toLowerCase()
  const style = STATUS_STYLES[status] || STATUS_STYLES.draft
  const savedSection = (pipeline as FlowPipelineDef & { assigned_section?: string }).assigned_section || ''
  const [localSection, setLocalSection] = useState(savedSection)
  const [saving, setSaving] = useState(false)
  const hasChanged = localSection !== savedSection
  const sectionStyle = SECTION_STYLES[localSection]

  // Sync local state when Firestore data updates
  useEffect(() => {
    setLocalSection(savedSection)
  }, [savedSection])

  // Count stages from metadata if available
  const stageCount = typeof pipeline.stage_count === 'number'
    ? pipeline.stage_count
    : null

  return (
    <div
      className="group w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 text-left transition-all hover:border-[var(--border-medium)] hover:shadow-lg hover:shadow-black/5"
    >
      <div className="flex items-start justify-between">
        <button onClick={onClick} className="flex items-center gap-3">
          <span
            className="flex h-10 w-10 items-center justify-center rounded-lg"
            style={{ backgroundColor: 'var(--portal-glow)' }}
          >
            <span
              className="material-icons-outlined"
              style={{ fontSize: '20px', color: 'var(--portal)' }}
            >
              {pipeline.icon || 'route'}
            </span>
          </span>
          <div>
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">
              {pipeline.pipeline_name}
            </h3>
            {pipeline.domain && (
              <p className="mt-0.5 text-[10px] text-[var(--text-muted)]">
                {pipeline.domain}
                {pipeline.product_type ? ` / ${pipeline.product_type}` : ''}
              </p>
            )}
          </div>
        </button>

        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${style.bg} ${style.text}`}>
          {style.label}
        </span>
      </div>

      {pipeline.description && (
        <p className="mt-3 text-xs text-[var(--text-secondary)] line-clamp-2">
          {pipeline.description}
        </p>
      )}

      {/* Section Assignment */}
      <div className="mt-3 flex items-center gap-2 rounded-md bg-[var(--bg-surface)] px-2.5 py-1.5">
        <span className="material-icons-outlined text-[var(--text-muted)]" style={{ fontSize: '14px' }}>
          {sectionStyle?.icon || 'help_outline'}
        </span>
        <span className="text-[10px] text-[var(--text-muted)]">Section:</span>
        <select
          value={localSection}
          onChange={(e) => {
            e.stopPropagation()
            setLocalSection(e.target.value)
          }}
          onClick={(e) => e.stopPropagation()}
          className="flex-1 rounded border border-[var(--border-subtle)] bg-[var(--bg-card)] px-2 py-0.5 text-[11px] text-[var(--text-primary)] outline-none focus:border-[var(--portal)]"
        >
          <option value="">Unassigned</option>
          <option value="sales">Sales</option>
          <option value="service">Service</option>
          <option value="both">Both</option>
        </select>
        {hasChanged && (
          <button
            onClick={async (e) => {
              e.stopPropagation()
              setSaving(true)
              await onSectionChange(pipeline.pipeline_key, localSection)
              setSaving(false)
            }}
            disabled={saving}
            className="rounded-md px-2.5 py-0.5 text-[10px] font-semibold text-white transition-opacity disabled:opacity-50"
            style={{ background: 'var(--portal)' }}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        )}
      </div>

      <div className="mt-2.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {stageCount !== null && (
            <span className="flex items-center gap-1 text-[10px] text-[var(--text-muted)]">
              <span className="material-icons-outlined" style={{ fontSize: '12px' }}>layers</span>
              {stageCount} stage{stageCount !== 1 ? 's' : ''}
            </span>
          )}
          {pipeline.platform_carrier && (
            <span className="flex items-center gap-1 text-[10px] text-[var(--text-muted)]">
              <span className="material-icons-outlined" style={{ fontSize: '12px' }}>business</span>
              {pipeline.platform_carrier}
            </span>
          )}
        </div>

        <button
          onClick={onClick}
          className="flex items-center gap-1 text-xs font-medium opacity-0 transition-opacity group-hover:opacity-100"
          style={{ color: 'var(--portal)' }}
        >
          Edit
          <span className="material-icons-outlined" style={{ fontSize: '14px' }}>arrow_forward</span>
        </button>
      </div>
    </div>
  )
}

/* --- Create Card --- */

function CreatePipelineCard({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex w-full flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-card)] p-8 text-center transition-all hover:border-[var(--portal)] hover:bg-[var(--bg-surface)]"
    >
      <span
        className="flex h-12 w-12 items-center justify-center rounded-full"
        style={{ backgroundColor: 'var(--portal-glow)' }}
      >
        <span className="material-icons-outlined" style={{ fontSize: '24px', color: 'var(--portal)' }}>
          add
        </span>
      </span>
      <div>
        <p className="text-sm font-semibold text-[var(--text-primary)]">Create New Pipeline</p>
        <p className="mt-0.5 text-[10px] text-[var(--text-muted)]">Design a new workflow from scratch</p>
      </div>
    </button>
  )
}

/* --- Main Component --- */

export default function PipelineStudioApp({
  portal,
  apiBase = '/api',
}: PipelineStudioProps) {
  const [pipelines, setPipelines] = useState<FlowPipelineDef[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<StatusFilter>('all')
  const [selectedPipelineKey, setSelectedPipelineKey] = useState<string | null>(null)
  const [wizardOpen, setWizardOpen] = useState(false)

  /* --- Fetch pipelines --- */
  const fetchPipelines = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetchWithAuth(`${apiBase}/flow/pipelines?portal=${portal.toUpperCase()}`)
      const json: PipelinesResponse = await res.json()

      if (!json.success || !json.data) {
        setError(json.error || 'Failed to load pipelines')
        return
      }

      setPipelines(Array.isArray(json.data) ? json.data : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error')
    } finally {
      setLoading(false)
    }
  }, [apiBase, portal])

  useEffect(() => {
    fetchPipelines()
  }, [fetchPipelines])

  /* --- Filter --- */
  const filtered = pipelines.filter((p) => {
    if (filter === 'all') return true
    return (p.status || 'draft').toLowerCase() === filter
  })

  const counts = {
    all: pipelines.length,
    active: pipelines.filter((p) => (p.status || '').toLowerCase() === 'active').length,
    draft: pipelines.filter((p) => (p.status || 'draft').toLowerCase() === 'draft').length,
    archived: pipelines.filter((p) => (p.status || '').toLowerCase() === 'archived').length,
  }

  /* --- Section assignment handler --- */
  const handleSectionChange = useCallback(async (pipelineKey: string, section: string) => {
    try {
      await fetchWithAuth(`${apiBase}/flow/admin/pipelines/${pipelineKey}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assigned_section: section || null }),
      })
      // Update local state immediately
      setPipelines((prev) =>
        prev.map((p) =>
          p.pipeline_key === pipelineKey
            ? { ...p, assigned_section: section || null } as FlowPipelineDef
            : p
        )
      )
    } catch {
      // Silent — will refresh on next load
    }
  }, [apiBase])

  /* --- Wizard complete handler --- */
  const handleCreate = useCallback((pipelineKey: string) => {
    setWizardOpen(false)
    fetchPipelines().then(() => {
      setSelectedPipelineKey(pipelineKey)
    })
  }, [fetchPipelines])

  /* --- Editor View --- */
  if (selectedPipelineKey) {
    return (
      <PipelineEditor
        pipelineKey={selectedPipelineKey}
        apiBase={apiBase}
        onBack={() => {
          setSelectedPipelineKey(null)
          fetchPipelines()
        }}
      />
    )
  }

  /* --- Loading --- */
  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--portal)] border-t-transparent" />
        </div>
      </div>
    )
  }

  /* --- Error --- */
  if (error) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-6 text-sm text-[var(--text-secondary)]">
          <div className="flex items-center gap-2">
            <span className="material-icons-outlined text-red-400" style={{ fontSize: '18px' }}>
              error_outline
            </span>
            {error}
          </div>
          <button
            onClick={fetchPipelines}
            className="mt-3 text-xs font-medium hover:underline"
            style={{ color: 'var(--portal)' }}
          >
            Try again
          </button>
        </div>
      </div>
    )
  }

  /* --- List View --- */
  return (
    <div className="mx-auto max-w-6xl px-6 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <span
              className="flex h-10 w-10 items-center justify-center rounded-xl"
              style={{ backgroundColor: '#14b8a6', color: '#ffffff' }}
            >
              <span className="material-icons-outlined" style={{ fontSize: '22px' }}>
                route
              </span>
            </span>
            <div>
              <h1 className="text-2xl font-bold text-[var(--text-primary)]">Pipeline Studio</h1>
              <p className="text-sm text-[var(--text-muted)]">
                Design and manage pipeline workflows
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2">
        {(['all', 'active', 'draft', 'archived'] as StatusFilter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              filter === f
                ? 'text-white'
                : 'text-[var(--text-muted)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-secondary)]'
            }`}
            style={filter === f ? { background: 'var(--portal)' } : undefined}
          >
            {f === 'all' ? 'All' : f === 'active' ? 'Published' : f.charAt(0).toUpperCase() + f.slice(1)}
            <span className={`text-[10px] ${filter === f ? 'opacity-75' : ''}`}>
              ({counts[f]})
            </span>
          </button>
        ))}
      </div>

      {/* Pipeline Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <CreatePipelineCard onClick={() => setWizardOpen(true)} />
        {filtered.map((pipeline) => (
          <StudioPipelineCard
            key={pipeline.pipeline_key}
            pipeline={pipeline}
            onClick={() => setSelectedPipelineKey(pipeline.pipeline_key)}
            onSectionChange={handleSectionChange}
          />
        ))}
      </div>

      {/* Empty state for filtered */}
      {filtered.length === 0 && pipelines.length > 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <span className="material-icons-outlined text-3xl text-[var(--text-muted)]">filter_list_off</span>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            No {filter} pipelines found.
          </p>
        </div>
      )}

      {/* Wizard modal */}
      <PipelineWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onCreate={handleCreate}
        apiBase={apiBase}
      />
    </div>
  )
}
