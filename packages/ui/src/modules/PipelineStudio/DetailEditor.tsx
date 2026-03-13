'use client'

import { useState, useMemo, useCallback } from 'react'
import type {
  FlowPipelineDef,
  FlowStageDef,
  FlowStepDef,
  FlowTaskTemplateDef,
} from '@tomachina/core'
import { BUILT_IN_CHECK_TYPES } from '@tomachina/core'

// ============================================================================
// DetailEditor — Context-sensitive right panel editor
// Renders different forms based on the selected item type
// ============================================================================

export interface DetailEditorProps {
  type: 'pipeline' | 'stage' | 'step' | 'task' | null
  data: FlowPipelineDef | FlowStageDef | FlowStepDef | FlowTaskTemplateDef | null
  onChange: (updated: Record<string, unknown>) => void
  onDelete?: () => void
  /** Steps belonging to the currently selected stage */
  stageSteps?: FlowStepDef[]
  /** Tasks belonging to the currently selected step */
  stepTasks?: FlowTaskTemplateDef[]
  /** Navigate into a sub-item */
  onDrillDown?: (type: 'step' | 'task', id: string) => void
  /** Add sub-item */
  onAddChild?: (type: 'step' | 'task') => void
  /** Delete a sub-item */
  onDeleteChild?: (type: 'step' | 'task', id: string) => void
}

/* --- Constants --- */

const DOMAINS = ['SECURITIES', 'LIFE', 'ANNUITY', 'MEDICARE', 'RETIREMENT', 'LEGACY'] as const
const PORTALS = ['prodashx', 'riimo', 'sentinel'] as const
const EXECUTION_TYPES = ['sequential', 'parallel', 'any_order'] as const
const ROLE_OPTIONS = ['', 'GENERAL', 'INVESTMENT', 'MEDICARE', 'LIFE', 'ANNUITY'] as const
const STAGE_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899', '#64748b',
]

/* --- Shared form field components --- */

function FieldLabel({ label, hint }: { label: string; hint?: string }) {
  return (
    <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
      {label}
      {hint && (
        <span className="ml-1 text-[10px] font-normal text-[var(--text-muted)]">({hint})</span>
      )}
    </label>
  )
}

function TextField({
  label,
  hint,
  value,
  onChange,
  placeholder,
  mono,
}: {
  label: string
  hint?: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  mono?: boolean
}) {
  return (
    <div>
      <FieldLabel label={label} hint={hint} />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--portal)] ${
          mono ? 'font-mono' : ''
        }`}
      />
    </div>
  )
}

function TextareaField({
  label,
  value,
  onChange,
  placeholder,
  rows,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  rows?: number
}) {
  return (
    <div>
      <FieldLabel label={label} />
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows || 3}
        className="w-full resize-none rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--portal)]"
      />
    </div>
  )
}

function SelectField({
  label,
  hint,
  value,
  onChange,
  options,
}: {
  label: string
  hint?: string
  value: string
  onChange: (v: string) => void
  options: readonly string[]
}) {
  return (
    <div>
      <FieldLabel label={label} hint={hint} />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--portal)]"
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt || '(All roles)'}
          </option>
        ))}
      </select>
    </div>
  )
}

function ToggleField({
  label,
  description,
  checked,
  onChange,
}: {
  label: string
  description?: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onChange(!checked)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onChange(!checked) } }}
      className="flex cursor-pointer items-center justify-between rounded-lg bg-[var(--bg-surface)] px-3 py-2.5"
    >
      <div>
        <span className="text-xs font-medium text-[var(--text-primary)]">{label}</span>
        {description && (
          <p className="mt-0.5 text-[10px] text-[var(--text-muted)]">{description}</p>
        )}
      </div>
      <div
        className={`relative h-5 w-9 rounded-full transition-colors ${
          checked ? 'bg-emerald-500' : 'bg-[var(--border-subtle)]'
        }`}
      >
        <div
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
            checked ? 'translate-x-4' : 'translate-x-0.5'
          }`}
        />
      </div>
    </div>
  )
}

/* --- Check Config Editor (key-value pairs) --- */

function CheckConfigEditor({
  configStr,
  onChange,
}: {
  configStr: string
  onChange: (v: string) => void
}) {
  const pairs = useMemo(() => {
    try {
      const parsed = JSON.parse(configStr || '{}')
      return Object.entries(parsed).map(([k, v]) => ({
        key: k,
        value: String(v),
      }))
    } catch {
      return []
    }
  }, [configStr])

  const [localPairs, setLocalPairs] = useState(pairs)

  // Sync if configStr changes externally
  useMemo(() => {
    setLocalPairs(pairs)
  }, [pairs])

  const emitChange = useCallback(
    (updated: Array<{ key: string; value: string }>) => {
      const obj: Record<string, string> = {}
      for (const p of updated) {
        if (p.key.trim()) obj[p.key.trim()] = p.value
      }
      onChange(JSON.stringify(obj))
    },
    [onChange]
  )

  const handleKeyChange = useCallback(
    (index: number, key: string) => {
      const updated = [...localPairs]
      updated[index] = { ...updated[index], key }
      setLocalPairs(updated)
      emitChange(updated)
    },
    [localPairs, emitChange]
  )

  const handleValueChange = useCallback(
    (index: number, value: string) => {
      const updated = [...localPairs]
      updated[index] = { ...updated[index], value }
      setLocalPairs(updated)
      emitChange(updated)
    },
    [localPairs, emitChange]
  )

  const handleAdd = useCallback(() => {
    const updated = [...localPairs, { key: '', value: '' }]
    setLocalPairs(updated)
  }, [localPairs])

  const handleRemove = useCallback(
    (index: number) => {
      const updated = localPairs.filter((_, i) => i !== index)
      setLocalPairs(updated)
      emitChange(updated)
    },
    [localPairs, emitChange]
  )

  return (
    <div>
      <FieldLabel label="Check Config" hint="key-value pairs" />
      <div className="space-y-1.5">
        {localPairs.map((pair, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <input
              type="text"
              value={pair.key}
              onChange={(e) => handleKeyChange(i, e.target.value)}
              placeholder="key"
              className="flex-1 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-1.5 font-mono text-xs text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--portal)]"
            />
            <input
              type="text"
              value={pair.value}
              onChange={(e) => handleValueChange(i, e.target.value)}
              placeholder="value"
              className="flex-1 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-1.5 font-mono text-xs text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--portal)]"
            />
            <button
              onClick={() => handleRemove(i)}
              className="shrink-0 text-[var(--text-muted)] hover:text-red-400"
            >
              <span className="material-icons-outlined" style={{ fontSize: '14px' }}>close</span>
            </button>
          </div>
        ))}
        <button
          onClick={handleAdd}
          className="flex items-center gap-1 text-[10px] font-medium text-[var(--text-muted)] hover:text-[var(--portal)]"
        >
          <span className="material-icons-outlined" style={{ fontSize: '12px' }}>add</span>
          Add field
        </button>
      </div>
    </div>
  )
}

/* --- Collapsible child list (for steps under stage, tasks under step) --- */

function ChildList({
  label,
  icon,
  items,
  nameKey,
  orderKey,
  onItemClick,
  onAdd,
  onDelete,
  renderBadges,
}: {
  label: string
  icon: string
  items: Array<Record<string, unknown>>
  nameKey: string
  orderKey: string
  onItemClick?: (id: string) => void
  onAdd?: () => void
  onDelete?: (id: string) => void
  renderBadges?: (item: Record<string, unknown>) => React.ReactNode
}) {
  const [expanded, setExpanded] = useState(true)
  const sorted = useMemo(
    () => [...items].sort((a, b) => (Number(a[orderKey]) || 0) - (Number(b[orderKey]) || 0)),
    [items, orderKey]
  )

  const idKey = label.toLowerCase() === 'steps' ? 'step_id' : 'task_id'

  return (
    <div className="rounded-lg border border-[var(--border-subtle)]">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between px-3 py-2.5"
      >
        <div className="flex items-center gap-2">
          <span className="material-icons-outlined text-[var(--text-muted)]" style={{ fontSize: '14px' }}>
            {icon}
          </span>
          <span className="text-xs font-medium text-[var(--text-secondary)]">{label}</span>
          <span className="text-[10px] text-[var(--text-muted)]">({sorted.length})</span>
        </div>
        <span
          className="material-icons-outlined text-[var(--text-muted)] transition-transform"
          style={{ fontSize: '14px', transform: expanded ? 'rotate(0deg)' : 'rotate(-90deg)' }}
        >
          expand_more
        </span>
      </button>

      {expanded && (
        <div className="border-t border-[var(--border-subtle)] px-2 pb-2 pt-1.5 space-y-1">
          {sorted.map((item) => {
            const id = String(item[idKey] || '')
            return (
              <div
                key={id}
                className="group flex items-center justify-between rounded-md bg-[var(--bg-surface)] px-2.5 py-2"
              >
                <button
                  onClick={() => onItemClick?.(id)}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-[10px] font-bold text-[var(--text-muted)] bg-[var(--bg-card)]">
                    {Number(item[orderKey]) || '-'}
                  </span>
                  <span className="truncate text-xs text-[var(--text-primary)]">
                    {String(item[nameKey] || 'Untitled')}
                  </span>
                  {renderBadges?.(item)}
                </button>
                {onDelete && (
                  <button
                    onClick={() => onDelete(id)}
                    className="shrink-0 opacity-0 group-hover:opacity-100 text-[var(--text-muted)] hover:text-red-400"
                  >
                    <span className="material-icons-outlined" style={{ fontSize: '14px' }}>delete</span>
                  </button>
                )}
              </div>
            )
          })}

          {sorted.length === 0 && (
            <p className="py-2 text-center text-[10px] text-[var(--text-muted)]">None configured.</p>
          )}

          {onAdd && (
            <button
              onClick={onAdd}
              className="flex w-full items-center justify-center gap-1 rounded-md border border-dashed border-[var(--border-subtle)] py-1.5 text-[10px] font-medium text-[var(--text-muted)] hover:border-[var(--portal)] hover:text-[var(--portal)]"
            >
              <span className="material-icons-outlined" style={{ fontSize: '12px' }}>add</span>
              Add {label.endsWith('s') ? label.slice(0, -1) : label}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/* --- Individual type editors --- */

function PipelineDetail({
  data,
  onChange,
}: {
  data: FlowPipelineDef
  onChange: (updated: Record<string, unknown>) => void
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 pb-2">
        <span className="material-icons-outlined" style={{ fontSize: '16px', color: 'var(--portal)' }}>route</span>
        <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Pipeline</span>
      </div>
      <TextField
        label="Name"
        value={data.pipeline_name || ''}
        onChange={(v) => onChange({ ...data, pipeline_name: v })}
        placeholder="Pipeline name"
      />
      <TextareaField
        label="Description"
        value={data.description || ''}
        onChange={(v) => onChange({ ...data, description: v })}
        placeholder="What does this pipeline do?"
      />
      <div className="grid grid-cols-2 gap-3">
        <SelectField
          label="Domain"
          value={data.domain || ''}
          onChange={(v) => onChange({ ...data, domain: v })}
          options={DOMAINS}
        />
        <SelectField
          label="Portal"
          value={data.portal || ''}
          onChange={(v) => onChange({ ...data, portal: v })}
          options={PORTALS}
        />
      </div>
      <TextField
        label="Icon"
        hint="Material Icon name"
        value={data.icon || ''}
        onChange={(v) => onChange({ ...data, icon: v })}
        placeholder="route"
      />
      <div className="grid grid-cols-2 gap-3">
        <TextField
          label="Product Type"
          value={data.product_type || ''}
          onChange={(v) => onChange({ ...data, product_type: v })}
          placeholder="e.g., FIA, MYGA"
        />
        <TextField
          label="Platform Carrier"
          value={data.platform_carrier || ''}
          onChange={(v) => onChange({ ...data, platform_carrier: v })}
          placeholder="e.g., Signal, Gradient"
        />
      </div>
    </div>
  )
}

function StageDetail({
  data,
  onChange,
  stageSteps,
  onDrillDown,
  onAddChild,
  onDeleteChild,
}: {
  data: FlowStageDef
  onChange: (updated: Record<string, unknown>) => void
  stageSteps?: FlowStepDef[]
  onDrillDown?: (type: 'step' | 'task', id: string) => void
  onAddChild?: (type: 'step' | 'task') => void
  onDeleteChild?: (type: 'step' | 'task', id: string) => void
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 pb-2">
        <span className="material-icons-outlined" style={{ fontSize: '16px', color: 'var(--portal)' }}>layers</span>
        <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Stage</span>
      </div>
      <TextField
        label="Name"
        value={data.stage_name || ''}
        onChange={(v) => onChange({ ...data, stage_name: v })}
        placeholder="Stage name"
      />
      <TextareaField
        label="Description"
        value={data.stage_description || ''}
        onChange={(v) => onChange({ ...data, stage_description: v })}
        placeholder="What happens at this stage?"
        rows={2}
      />

      {/* Color picker */}
      <div>
        <FieldLabel label="Color" />
        <div className="flex flex-wrap gap-2">
          {STAGE_COLORS.map((color) => (
            <button
              key={color}
              onClick={() => onChange({ ...data, stage_color: color })}
              className={`h-7 w-7 rounded-full border-2 transition-transform hover:scale-110 ${
                data.stage_color === color ? 'border-white scale-110' : 'border-transparent'
              }`}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      </div>

      <ToggleField
        label="Gate Enforced"
        description="Require all tasks complete before advancing"
        checked={data.gate_enforced}
        onChange={(v) => onChange({ ...data, gate_enforced: v })}
      />

      {/* Steps list */}
      {stageSteps && (
        <ChildList
          label="Steps"
          icon="checklist"
          items={stageSteps as unknown as Array<Record<string, unknown>>}
          nameKey="step_name"
          orderKey="step_order"
          onItemClick={(id) => onDrillDown?.('step', id)}
          onAdd={() => onAddChild?.('step')}
          onDelete={(id) => onDeleteChild?.('step', id)}
          renderBadges={(item) => (
            <>
              {Boolean(item.gate_enforced) && (
                <span className="material-icons-outlined shrink-0 text-amber-400" style={{ fontSize: '10px' }}>lock</span>
              )}
            </>
          )}
        />
      )}
    </div>
  )
}

function StepDetail({
  data,
  onChange,
  stepTasks,
  onDrillDown,
  onAddChild,
  onDeleteChild,
}: {
  data: FlowStepDef
  onChange: (updated: Record<string, unknown>) => void
  stepTasks?: FlowTaskTemplateDef[]
  onDrillDown?: (type: 'step' | 'task', id: string) => void
  onAddChild?: (type: 'step' | 'task') => void
  onDeleteChild?: (type: 'step' | 'task', id: string) => void
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 pb-2">
        <span className="material-icons-outlined" style={{ fontSize: '16px', color: 'var(--portal)' }}>checklist</span>
        <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Step</span>
      </div>
      <TextField
        label="Name"
        value={data.step_name || ''}
        onChange={(v) => onChange({ ...data, step_name: v })}
        placeholder="Step name"
      />
      <TextareaField
        label="Description"
        value={data.step_description || ''}
        onChange={(v) => onChange({ ...data, step_description: v })}
        placeholder="What does this step accomplish?"
        rows={2}
      />
      <ToggleField
        label="Gate Enforced"
        description="Require all tasks complete before advancing"
        checked={data.gate_enforced}
        onChange={(v) => onChange({ ...data, gate_enforced: v })}
      />
      <SelectField
        label="Execution Type"
        value={data.execution_type || 'sequential'}
        onChange={(v) => onChange({ ...data, execution_type: v })}
        options={EXECUTION_TYPES}
      />

      {/* Tasks list */}
      {stepTasks && (
        <ChildList
          label="Tasks"
          icon="task_alt"
          items={stepTasks as unknown as Array<Record<string, unknown>>}
          nameKey="task_name"
          orderKey="task_order"
          onItemClick={(id) => onDrillDown?.('task', id)}
          onAdd={() => onAddChild?.('task')}
          onDelete={(id) => onDeleteChild?.('task', id)}
          renderBadges={(item) => (
            <div className="flex shrink-0 items-center gap-1">
              {Boolean(item.is_required) && (
                <span className="inline-flex items-center rounded-full bg-red-500/10 px-1 py-0.5 text-[9px] text-red-400">
                  Req
                </span>
              )}
              {Boolean(item.is_system_check) && (
                <span className="inline-flex items-center rounded-full bg-blue-500/10 px-1 py-0.5 text-[9px] text-blue-400">
                  Sys
                </span>
              )}
            </div>
          )}
        />
      )}
    </div>
  )
}

function TaskDetail({
  data,
  onChange,
}: {
  data: FlowTaskTemplateDef
  onChange: (updated: Record<string, unknown>) => void
}) {
  const checkTypes = [...BUILT_IN_CHECK_TYPES] as string[]

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 pb-2">
        <span className="material-icons-outlined" style={{ fontSize: '16px', color: 'var(--portal)' }}>task_alt</span>
        <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Task</span>
      </div>
      <TextField
        label="Name"
        value={data.task_name || ''}
        onChange={(v) => onChange({ ...data, task_name: v })}
        placeholder="Task name"
      />
      <TextareaField
        label="Description"
        value={data.task_description || ''}
        onChange={(v) => onChange({ ...data, task_description: v })}
        placeholder="What must be done?"
        rows={2}
      />
      <ToggleField
        label="Required"
        description="Must be completed to advance"
        checked={data.is_required}
        onChange={(v) => onChange({ ...data, is_required: v })}
      />
      <ToggleField
        label="System Check"
        description="Automated validation instead of manual completion"
        checked={data.is_system_check}
        onChange={(v) => onChange({ ...data, is_system_check: v })}
      />

      {/* System check configuration (visible when toggled on) */}
      {data.is_system_check && (
        <div className="space-y-3 rounded-lg border border-blue-500/20 bg-blue-500/5 p-3">
          <div className="flex items-center gap-1.5">
            <span className="material-icons-outlined text-blue-400" style={{ fontSize: '14px' }}>smart_toy</span>
            <span className="text-xs font-medium text-blue-400">System Check Config</span>
          </div>

          <SelectField
            label="Check Type"
            value={data.check_type || ''}
            onChange={(v) => onChange({ ...data, check_type: v })}
            options={['', ...checkTypes]}
            hint="built-in or custom handler name"
          />

          <CheckConfigEditor
            configStr={data.check_config || '{}'}
            onChange={(v) => onChange({ ...data, check_config: v })}
          />
        </div>
      )}

      <SelectField
        label="Role Applicability"
        hint="empty = all roles"
        value={data.role_applicability || ''}
        onChange={(v) => onChange({ ...data, role_applicability: v })}
        options={ROLE_OPTIONS}
      />

      <TextField
        label="Default Owner"
        hint="email"
        value={data.default_owner || ''}
        onChange={(v) => onChange({ ...data, default_owner: v })}
        placeholder="e.g., nikki@retireprotected.com"
      />
    </div>
  )
}

/* --- Main Component --- */

export default function DetailEditor({
  type,
  data,
  onChange,
  onDelete,
  stageSteps,
  stepTasks,
  onDrillDown,
  onAddChild,
  onDeleteChild,
}: DetailEditorProps) {
  /* --- Empty state --- */
  if (!type || !data) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-center">
        <span className="material-icons-outlined text-4xl text-[var(--text-muted)]">touch_app</span>
        <p className="mt-3 text-sm text-[var(--text-muted)]">Select an item to edit</p>
        <p className="mt-1 text-[10px] text-[var(--text-muted)]">
          Click a stage, step, or task from the left panel
        </p>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      {/* Scrollable form content */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {type === 'pipeline' && (
          <PipelineDetail data={data as FlowPipelineDef} onChange={onChange} />
        )}
        {type === 'stage' && (
          <StageDetail
            data={data as FlowStageDef}
            onChange={onChange}
            stageSteps={stageSteps}
            onDrillDown={onDrillDown}
            onAddChild={onAddChild}
            onDeleteChild={onDeleteChild}
          />
        )}
        {type === 'step' && (
          <StepDetail
            data={data as FlowStepDef}
            onChange={onChange}
            stepTasks={stepTasks}
            onDrillDown={onDrillDown}
            onAddChild={onAddChild}
            onDeleteChild={onDeleteChild}
          />
        )}
        {type === 'task' && (
          <TaskDetail data={data as FlowTaskTemplateDef} onChange={onChange} />
        )}
      </div>

      {/* Delete button */}
      {onDelete && type !== 'pipeline' && (
        <div className="border-t border-[var(--border-subtle)] p-3">
          <button
            onClick={onDelete}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/5"
          >
            <span className="material-icons-outlined" style={{ fontSize: '14px' }}>delete</span>
            Delete {type.charAt(0).toUpperCase() + type.slice(1)}
          </button>
        </div>
      )}
    </div>
  )
}
