'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import type {
  FlowPipelineDef,
  FlowStageDef,
  FlowStepDef,
  FlowTaskTemplateDef,
} from '@tomachina/core'
import StageList from './StageList'
import DetailEditor from './DetailEditor'
import FlowPreview from './FlowPreview'

// ============================================================================
// PipelineEditor — Three-panel pipeline editor
// Left rail (StageList) + Center (flow overview) + Right (DetailEditor)
// ============================================================================

export interface PipelineEditorProps {
  pipelineKey: string
  apiBase?: string
  onBack: () => void
}

/* --- Types --- */

interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

type SelectionType = 'pipeline' | 'stage' | 'step' | 'task'

interface Selection {
  type: SelectionType
  id: string
}

/* --- Helpers --- */

function generateId(prefix: string): string {
  const ts = Date.now().toString(36)
  const rand = Math.random().toString(36).slice(2, 8)
  return `${prefix}_${ts}_${rand}`
}

/* --- Main Component --- */

export default function PipelineEditor({
  pipelineKey,
  apiBase = '/api',
  onBack,
}: PipelineEditorProps) {
  /* --- State --- */
  const [pipeline, setPipeline] = useState<FlowPipelineDef | null>(null)
  const [stages, setStages] = useState<FlowStageDef[]>([])
  const [steps, setSteps] = useState<Record<string, FlowStepDef[]>>({})
  const [tasks, setTasks] = useState<Record<string, FlowTaskTemplateDef[]>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const [selection, setSelection] = useState<Selection | null>(null)
  const [showPreview, setShowPreview] = useState(false)
  const dirtyRef = useRef(false)

  // Keep ref in sync for beforeunload
  useEffect(() => {
    dirtyRef.current = dirty
  }, [dirty])

  /* --- Warn on unload if dirty --- */
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirtyRef.current) {
        e.preventDefault()
      }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [])

  /* --- Fetch all data --- */
  const fetchAll = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      // Fetch pipeline metadata
      const pipeRes = await fetch(`${apiBase}/flow/pipelines/${pipelineKey}`)
      const pipeJson: ApiResponse<FlowPipelineDef> = await pipeRes.json()
      if (!pipeJson.success || !pipeJson.data) {
        setError(pipeJson.error || 'Failed to load pipeline')
        return
      }
      setPipeline(pipeJson.data)

      // Fetch stages
      const stagesRes = await fetch(`${apiBase}/flow/pipelines/${pipelineKey}/stages`)
      const stagesJson: ApiResponse<FlowStageDef[]> = await stagesRes.json()
      const fetchedStages = stagesJson.data || []
      setStages(fetchedStages)

      // Fetch steps and tasks for each stage
      const stepsMap: Record<string, FlowStepDef[]> = {}
      const tasksMap: Record<string, FlowTaskTemplateDef[]> = {}

      await Promise.all(
        fetchedStages.map(async (stage) => {
          try {
            const stepsRes = await fetch(`${apiBase}/flow/admin/stages/${stage.stage_id}/steps`)
            const stepsJson: ApiResponse<FlowStepDef[]> = await stepsRes.json()
            const fetchedSteps = stepsJson.data || []
            stepsMap[stage.stage_id] = fetchedSteps

            // Fetch tasks for each step
            await Promise.all(
              fetchedSteps.map(async (step) => {
                try {
                  const tasksRes = await fetch(`${apiBase}/flow/admin/steps/${step.step_id}/tasks`)
                  const tasksJson: ApiResponse<FlowTaskTemplateDef[]> = await tasksRes.json()
                  tasksMap[step.step_id] = tasksJson.data || []
                } catch {
                  tasksMap[step.step_id] = []
                }
              })
            )
          } catch {
            stepsMap[stage.stage_id] = []
          }
        })
      )

      setSteps(stepsMap)
      setTasks(tasksMap)
      setDirty(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error')
    } finally {
      setLoading(false)
    }
  }, [apiBase, pipelineKey])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  /* --- Mark dirty helper --- */
  const markDirty = useCallback(() => {
    setDirty(true)
    setSaveError(null)
  }, [])

  /* --- Selection helpers --- */

  const selectedData = useMemo(() => {
    if (!selection) return null
    switch (selection.type) {
      case 'pipeline':
        return pipeline
      case 'stage':
        return stages.find((s) => s.stage_id === selection.id) || null
      case 'step':
        return Object.values(steps).flat().find((s) => s.step_id === selection.id) || null
      case 'task':
        return Object.values(tasks).flat().find((t) => t.task_id === selection.id) || null
      default:
        return null
    }
  }, [selection, pipeline, stages, steps, tasks])

  // Steps for the currently selected stage
  const selectedStageSteps = useMemo(() => {
    if (selection?.type === 'stage') {
      return steps[selection.id] || []
    }
    return undefined
  }, [selection, steps])

  // Tasks for the currently selected step
  const selectedStepTasks = useMemo(() => {
    if (selection?.type === 'step') {
      return tasks[selection.id] || []
    }
    return undefined
  }, [selection, tasks])

  /* --- Update handlers --- */

  const handleDetailChange = useCallback(
    (updated: Record<string, unknown>) => {
      if (!selection) return
      markDirty()

      switch (selection.type) {
        case 'pipeline':
          setPipeline(updated as unknown as FlowPipelineDef)
          break
        case 'stage':
          setStages((prev) =>
            prev.map((s) => (s.stage_id === selection.id ? { ...s, ...updated } as FlowStageDef : s))
          )
          break
        case 'step': {
          setSteps((prev) => {
            const next = { ...prev }
            for (const [stageId, stageSteps] of Object.entries(next)) {
              const idx = stageSteps.findIndex((s) => s.step_id === selection.id)
              if (idx >= 0) {
                next[stageId] = [
                  ...stageSteps.slice(0, idx),
                  { ...stageSteps[idx], ...updated } as FlowStepDef,
                  ...stageSteps.slice(idx + 1),
                ]
                break
              }
            }
            return next
          })
          break
        }
        case 'task': {
          setTasks((prev) => {
            const next = { ...prev }
            for (const [stepId, stepTasks] of Object.entries(next)) {
              const idx = stepTasks.findIndex((t) => t.task_id === selection.id)
              if (idx >= 0) {
                next[stepId] = [
                  ...stepTasks.slice(0, idx),
                  { ...stepTasks[idx], ...updated } as FlowTaskTemplateDef,
                  ...stepTasks.slice(idx + 1),
                ]
                break
              }
            }
            return next
          })
          break
        }
      }
    },
    [selection, markDirty]
  )

  /* --- Stage operations --- */

  const handleAddStage = useCallback(() => {
    const maxOrder = stages.reduce((max, s) => Math.max(max, s.stage_order), 0)
    const newStage: FlowStageDef = {
      pipeline_key: pipelineKey,
      stage_id: generateId('stg'),
      stage_name: `Stage ${maxOrder + 1}`,
      stage_order: maxOrder + 1,
      gate_enforced: false,
      has_workflow: false,
      status: 'active',
    }
    setStages((prev) => [...prev, newStage])
    setSteps((prev) => ({ ...prev, [newStage.stage_id]: [] }))
    setSelection({ type: 'stage', id: newStage.stage_id })
    markDirty()
  }, [stages, pipelineKey, markDirty])

  const handleDeleteStage = useCallback(
    (stageId: string) => {
      setStages((prev) => prev.filter((s) => s.stage_id !== stageId))
      // Clean up steps and tasks for this stage
      setSteps((prev) => {
        const next = { ...prev }
        const removedSteps = next[stageId] || []
        delete next[stageId]
        // Also remove tasks for those steps
        setTasks((prevTasks) => {
          const nextTasks = { ...prevTasks }
          for (const step of removedSteps) {
            delete nextTasks[step.step_id]
          }
          return nextTasks
        })
        return next
      })
      if (selection?.id === stageId) setSelection(null)
      markDirty()
    },
    [selection, markDirty]
  )

  const handleReorderStages = useCallback(
    (reordered: FlowStageDef[]) => {
      setStages(reordered)
      markDirty()
    },
    [markDirty]
  )

  /* --- Add child (step/task) from DetailEditor --- */

  const handleAddChild = useCallback(
    (childType: 'step' | 'task') => {
      if (!selection) return
      markDirty()

      if (childType === 'step' && selection.type === 'stage') {
        const stageSteps = steps[selection.id] || []
        const maxOrder = stageSteps.reduce((max, s) => Math.max(max, s.step_order), 0)
        const newStep: FlowStepDef = {
          pipeline_key: pipelineKey,
          stage_id: selection.id,
          workflow_key: 'default',
          step_id: generateId('stp'),
          step_name: `Step ${maxOrder + 1}`,
          step_order: maxOrder + 1,
          gate_enforced: false,
          status: 'active',
        }
        setSteps((prev) => ({
          ...prev,
          [selection.id]: [...(prev[selection.id] || []), newStep],
        }))
        setTasks((prev) => ({ ...prev, [newStep.step_id]: [] }))
      }

      if (childType === 'task' && selection.type === 'step') {
        const stepTasks = tasks[selection.id] || []
        const maxOrder = stepTasks.reduce((max, t) => Math.max(max, t.task_order), 0)
        // Find the stage_id for this step
        const parentStageId = Object.entries(steps).find(([, stageSteps]) =>
          stageSteps.some((s) => s.step_id === selection.id)
        )?.[0] || ''

        const newTask: FlowTaskTemplateDef = {
          pipeline_key: pipelineKey,
          stage_id: parentStageId,
          step_id: selection.id,
          task_id: generateId('tsk'),
          task_name: `Task ${maxOrder + 1}`,
          task_order: maxOrder + 1,
          is_required: false,
          is_system_check: false,
          status: 'active',
        }
        setTasks((prev) => ({
          ...prev,
          [selection.id]: [...(prev[selection.id] || []), newTask],
        }))
      }
    },
    [selection, steps, tasks, pipelineKey, markDirty]
  )

  /* --- Delete child (step/task) from DetailEditor --- */

  const handleDeleteChild = useCallback(
    (childType: 'step' | 'task', id: string) => {
      markDirty()

      if (childType === 'step') {
        setSteps((prev) => {
          const next = { ...prev }
          for (const [stageId, stageSteps] of Object.entries(next)) {
            const idx = stageSteps.findIndex((s) => s.step_id === id)
            if (idx >= 0) {
              next[stageId] = stageSteps.filter((s) => s.step_id !== id)
              break
            }
          }
          return next
        })
        // Remove tasks for this step
        setTasks((prev) => {
          const next = { ...prev }
          delete next[id]
          return next
        })
        if (selection?.id === id) setSelection(null)
      }

      if (childType === 'task') {
        setTasks((prev) => {
          const next = { ...prev }
          for (const [stepId, stepTasks] of Object.entries(next)) {
            const idx = stepTasks.findIndex((t) => t.task_id === id)
            if (idx >= 0) {
              next[stepId] = stepTasks.filter((t) => t.task_id !== id)
              break
            }
          }
          return next
        })
        if (selection?.id === id) setSelection(null)
      }
    },
    [selection, markDirty]
  )

  /* --- Drill down from DetailEditor --- */

  const handleDrillDown = useCallback(
    (type: 'step' | 'task', id: string) => {
      setSelection({ type, id })
    },
    []
  )

  /* --- Delete selected item --- */

  const handleDeleteSelected = useCallback(() => {
    if (!selection) return

    switch (selection.type) {
      case 'stage':
        handleDeleteStage(selection.id)
        break
      case 'step':
        handleDeleteChild('step', selection.id)
        break
      case 'task':
        handleDeleteChild('task', selection.id)
        break
    }
  }, [selection, handleDeleteStage, handleDeleteChild])

  /* --- Save --- */

  const handleSave = useCallback(
    async (newStatus?: string) => {
      if (!pipeline) return
      try {
        setSaving(true)
        setSaveError(null)

        const pipelineData = newStatus
          ? { ...pipeline, status: newStatus, updated_at: new Date().toISOString() }
          : { ...pipeline, updated_at: new Date().toISOString() }

        // Save pipeline metadata
        const pipeRes = await fetch(`${apiBase}/flow/admin/pipelines/${pipelineKey}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(pipelineData),
        })
        const pipeJson: ApiResponse<unknown> = await pipeRes.json()
        if (!pipeJson.success) {
          setSaveError(pipeJson.error || 'Failed to save pipeline')
          return
        }

        // Save stages (reorder + upsert)
        for (const stage of stages) {
          await fetch(`${apiBase}/flow/admin/stages/${stage.stage_id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(stage),
          })
        }

        // Save steps
        for (const [, stageSteps] of Object.entries(steps)) {
          for (const step of stageSteps) {
            await fetch(`${apiBase}/flow/admin/steps/${step.step_id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(step),
            })
          }
        }

        // Save tasks
        for (const [, stepTasks] of Object.entries(tasks)) {
          for (const task of stepTasks) {
            await fetch(`${apiBase}/flow/admin/tasks/${task.task_id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(task),
            })
          }
        }

        if (newStatus) {
          setPipeline((prev) => prev ? { ...prev, status: newStatus } : prev)
        }
        setDirty(false)
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : 'Save failed')
      } finally {
        setSaving(false)
      }
    },
    [pipeline, stages, steps, tasks, apiBase, pipelineKey]
  )

  /* --- Back with dirty check --- */

  const handleBack = useCallback(() => {
    if (dirty) {
      // Simple browser-based check since we can't use window.confirm per code standards
      // The beforeunload handler protects against accidental closes.
      // For in-app navigation, we just warn via the dirty indicator.
    }
    onBack()
  }, [dirty, onBack])

  /* --- Loading --- */
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[var(--portal)] border-t-transparent" />
          <p className="mt-3 text-sm text-[var(--text-muted)]">Loading pipeline...</p>
        </div>
      </div>
    )
  }

  /* --- Error --- */
  if (error || !pipeline) {
    return (
      <div className="flex h-full items-center justify-center px-6">
        <div className="max-w-md rounded-xl border border-red-500/20 bg-red-500/5 p-6 text-center">
          <span className="material-icons-outlined text-3xl text-red-400">error_outline</span>
          <p className="mt-3 text-sm text-[var(--text-secondary)]">{error || 'Pipeline not found'}</p>
          <button
            onClick={onBack}
            className="mt-4 rounded-lg px-4 py-2 text-xs font-medium text-white"
            style={{ backgroundColor: 'var(--portal)' }}
          >
            Back to list
          </button>
        </div>
      </div>
    )
  }

  const currentStatus = (pipeline.status || 'draft').toLowerCase()

  return (
    <div className="flex h-full flex-col" style={{ minHeight: 'calc(100vh - 80px)' }}>
      {/* Top bar */}
      <div className="flex shrink-0 items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--bg-card)] px-4 py-2.5">
        <div className="flex items-center gap-3">
          <button
            onClick={handleBack}
            className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-surface)] hover:text-[var(--text-secondary)]"
          >
            <span className="material-icons-outlined" style={{ fontSize: '16px' }}>arrow_back</span>
            Back
          </button>
          <div className="h-5 w-px bg-[var(--border-subtle)]" />
          <div className="flex items-center gap-2">
            <span className="material-icons-outlined" style={{ fontSize: '18px', color: 'var(--portal)' }}>
              {pipeline.icon || 'route'}
            </span>
            <span className="text-sm font-semibold text-[var(--text-primary)]">
              {pipeline.pipeline_name}
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                currentStatus === 'active'
                  ? 'bg-emerald-500/10 text-emerald-400'
                  : currentStatus === 'archived'
                  ? 'bg-neutral-500/10 text-neutral-400'
                  : 'bg-yellow-500/10 text-yellow-400'
              }`}
            >
              {currentStatus === 'active' ? 'Published' : currentStatus.charAt(0).toUpperCase() + currentStatus.slice(1)}
            </span>
            {dirty && (
              <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-400">
                Unsaved
              </span>
            )}
          </div>
        </div>

        {/* View toggle */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowPreview(false)}
            className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
              !showPreview ? 'text-white' : 'text-[var(--text-muted)] hover:bg-[var(--bg-surface)]'
            }`}
            style={!showPreview ? { background: 'var(--portal)' } : undefined}
          >
            <span className="material-icons-outlined" style={{ fontSize: '14px' }}>edit</span>
            Editor
          </button>
          <button
            onClick={() => setShowPreview(true)}
            className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
              showPreview ? 'text-white' : 'text-[var(--text-muted)] hover:bg-[var(--bg-surface)]'
            }`}
            style={showPreview ? { background: 'var(--portal)' } : undefined}
          >
            <span className="material-icons-outlined" style={{ fontSize: '14px' }}>account_tree</span>
            Preview
          </button>
        </div>
      </div>

      {/* Preview view */}
      {showPreview ? (
        <div className="flex-1 overflow-auto p-6">
          <FlowPreview
            pipelineKey={pipelineKey}
            stages={stages}
            steps={steps}
            tasks={tasks}
          />
        </div>
      ) : (
        /* Three-panel editor */
        <div className="flex flex-1 overflow-hidden">
          {/* Left rail */}
          <div className="w-60 shrink-0 overflow-hidden border-r border-[var(--border-subtle)] bg-[var(--bg-card)]">
            <StageList
              stages={stages}
              selectedStageId={selection?.type === 'stage' ? selection.id : null}
              onSelectStage={(id) => setSelection({ type: 'stage', id })}
              onAddStage={handleAddStage}
              onReorderStages={handleReorderStages}
              onDeleteStage={handleDeleteStage}
            />
          </div>

          {/* Center panel — compact flow overview */}
          <div className="flex-1 overflow-auto bg-[var(--bg-base)] p-6">
            {/* Pipeline info bar */}
            <div className="mb-6 flex items-center gap-3">
              <button
                onClick={() => setSelection({ type: 'pipeline', id: pipelineKey })}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                  selection?.type === 'pipeline'
                    ? 'border-[var(--portal)] bg-[var(--portal-glow)] text-[var(--text-primary)]'
                    : 'border-[var(--border-subtle)] text-[var(--text-muted)] hover:border-[var(--border-medium)]'
                }`}
              >
                <span className="material-icons-outlined" style={{ fontSize: '14px' }}>settings</span>
                Pipeline Settings
              </button>
              <div className="h-px flex-1 bg-[var(--border-subtle)]" />
              <span className="text-[10px] text-[var(--text-muted)]">
                {stages.length} stages / {Object.values(steps).flat().length} steps / {Object.values(tasks).flat().length} tasks
              </span>
            </div>

            {/* Center: stages as flow boxes */}
            {stages.length > 0 ? (
              <div className="space-y-3">
                {[...stages]
                  .sort((a, b) => a.stage_order - b.stage_order)
                  .map((stage, i) => {
                    const stageSteps = steps[stage.stage_id] || []
                    const isSelected = selection?.type === 'stage' && selection.id === stage.stage_id
                    const totalTasks = stageSteps.reduce(
                      (sum, s) => sum + (tasks[s.step_id] || []).length,
                      0
                    )

                    return (
                      <div key={stage.stage_id}>
                        <button
                          onClick={() => setSelection({ type: 'stage', id: stage.stage_id })}
                          className={`w-full rounded-xl border text-left transition-all ${
                            isSelected
                              ? 'border-[var(--portal)] shadow-lg shadow-black/5'
                              : 'border-[var(--border-subtle)] hover:border-[var(--border-medium)]'
                          } bg-[var(--bg-card)]`}
                        >
                          <div
                            className="h-1 rounded-t-xl"
                            style={{ backgroundColor: stage.stage_color || 'var(--portal)' }}
                          />
                          <div className="flex items-center justify-between px-4 py-3">
                            <div className="flex items-center gap-3">
                              <span
                                className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white"
                                style={{ backgroundColor: stage.stage_color || 'var(--portal)' }}
                              >
                                {stage.stage_order}
                              </span>
                              <div>
                                <span className="text-sm font-semibold text-[var(--text-primary)]">
                                  {stage.stage_name}
                                </span>
                                {stage.stage_description && (
                                  <p className="mt-0.5 text-[10px] text-[var(--text-muted)]">
                                    {stage.stage_description}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-3 text-[10px] text-[var(--text-muted)]">
                              {stage.gate_enforced && (
                                <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-500/10 px-1.5 py-0.5 text-amber-400">
                                  <span className="material-icons-outlined" style={{ fontSize: '10px' }}>lock</span>
                                  Gated
                                </span>
                              )}
                              <span>{stageSteps.length} step{stageSteps.length !== 1 ? 's' : ''}</span>
                              <span>{totalTasks} task{totalTasks !== 1 ? 's' : ''}</span>
                            </div>
                          </div>
                        </button>

                        {/* Arrow between stages */}
                        {i < stages.length - 1 && (
                          <div className="flex justify-center py-1">
                            <span className="material-icons-outlined text-[var(--text-muted)]" style={{ fontSize: '16px' }}>
                              arrow_downward
                            </span>
                          </div>
                        )}
                      </div>
                    )
                  })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <span className="material-icons-outlined text-4xl text-[var(--text-muted)]">layers</span>
                <p className="mt-3 text-sm text-[var(--text-muted)]">No stages yet</p>
                <p className="mt-1 text-[10px] text-[var(--text-muted)]">
                  Click &quot;Add Stage&quot; in the left panel to get started
                </p>
              </div>
            )}
          </div>

          {/* Right panel */}
          <div className="w-80 shrink-0 overflow-hidden border-l border-[var(--border-subtle)] bg-[var(--bg-card)]">
            <DetailEditor
              type={selection?.type || null}
              data={selectedData}
              onChange={handleDetailChange}
              onDelete={selection?.type !== 'pipeline' ? handleDeleteSelected : undefined}
              stageSteps={selectedStageSteps}
              stepTasks={selectedStepTasks}
              onDrillDown={handleDrillDown}
              onAddChild={handleAddChild}
              onDeleteChild={handleDeleteChild}
            />
          </div>
        </div>
      )}

      {/* Bottom bar */}
      <div className="flex shrink-0 items-center justify-between border-t border-[var(--border-subtle)] bg-[var(--bg-card)] px-4 py-2.5">
        <div className="flex items-center gap-2">
          {saveError && (
            <span className="flex items-center gap-1 text-xs text-red-400">
              <span className="material-icons-outlined" style={{ fontSize: '14px' }}>error_outline</span>
              {saveError}
            </span>
          )}
          {!saveError && !dirty && !saving && (
            <span className="flex items-center gap-1 text-xs text-[var(--text-muted)]">
              <span className="material-icons-outlined" style={{ fontSize: '14px' }}>check_circle</span>
              All changes saved
            </span>
          )}
          {!saveError && dirty && !saving && (
            <span className="flex items-center gap-1 text-xs text-amber-400">
              <span className="material-icons-outlined" style={{ fontSize: '14px' }}>warning</span>
              Unsaved changes
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Archive */}
          {currentStatus !== 'archived' && (
            <button
              onClick={() => handleSave('archived')}
              disabled={saving}
              className="flex items-center gap-1 rounded-lg border border-[var(--border-subtle)] px-3 py-1.5 text-xs font-medium text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-surface)] disabled:opacity-50"
            >
              <span className="material-icons-outlined" style={{ fontSize: '14px' }}>archive</span>
              Archive
            </button>
          )}

          {/* Save Draft */}
          <button
            onClick={() => handleSave()}
            disabled={saving || !dirty}
            className="flex items-center gap-1 rounded-lg border border-[var(--border-subtle)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-surface)] disabled:opacity-50"
          >
            {saving ? (
              <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[var(--text-muted)] border-t-transparent" />
            ) : (
              <span className="material-icons-outlined" style={{ fontSize: '14px' }}>save</span>
            )}
            Save Draft
          </button>

          {/* Publish */}
          <button
            onClick={() => handleSave('active')}
            disabled={saving}
            className="flex items-center gap-1 rounded-lg px-4 py-1.5 text-xs font-medium text-white transition-colors disabled:opacity-50"
            style={{ backgroundColor: '#14b8a6' }}
          >
            {saving ? (
              <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <span className="material-icons-outlined" style={{ fontSize: '14px' }}>publish</span>
            )}
            Publish
          </button>
        </div>
      </div>
    </div>
  )
}
