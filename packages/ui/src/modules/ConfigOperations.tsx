'use client'

import { useState } from 'react'
import { TableEditor, ChecklistEditor, NumericEditor } from './ConfigRegistry'

/* ═══ Types ═══ */

interface ConfigOperationsProps {
  configData: Record<string, unknown>
  configKey: string
  selectedKey?: string // backward compat alias
  onUpdate: (data: Record<string, unknown>) => void
}

interface StageItem {
  key: string
  label: string
  color: string
  order: number
  statuses: string[]
}

/* ═══ Style Tokens ═══ */

const s = {
  bg: 'var(--bg, #0f1219)',
  surface: 'var(--bg-surface, #1c2333)',
  card: 'var(--bg-card, #161d2d)',
  border: 'var(--border-color, #2a3347)',
  text: 'var(--text-primary, #e2e8f0)',
  textSecondary: 'var(--text-secondary, #94a3b8)',
  textMuted: 'var(--text-muted, #64748b)',
  portal: 'var(--portal, #4a7ab5)',
}

/* ═══ Stage Editor ═══ */

/** Reorderable list of pipeline stages with color pickers and status tags */
export function StageEditor({ stages, onChange }: {
  stages: StageItem[]
  onChange: (stages: StageItem[]) => void
}) {
  const [newLabel, setNewLabel] = useState('')

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= stages.length) return
    const next = [...stages]
    const tmp = next[index]
    next[index] = next[target]
    next[target] = tmp
    onChange(next.map((st, i) => ({ ...st, order: i + 1 })))
  }

  const updateStage = (index: number, field: keyof StageItem, value: unknown) => {
    const next = [...stages]
    next[index] = { ...next[index], [field]: value }
    onChange(next)
  }

  const addStage = () => {
    if (!newLabel.trim()) return
    const key = newLabel.trim().toUpperCase().replace(/\s+/g, '_')
    onChange([...stages, { key, label: newLabel.trim(), color: '#6b7280', order: stages.length + 1, statuses: [] }])
    setNewLabel('')
  }

  const removeStage = (index: number) => {
    onChange(stages.filter((_, i) => i !== index).map((st, i) => ({ ...st, order: i + 1 })))
  }

  return (
    <div className="space-y-3">
      {stages.map((stage, i) => (
        <div key={stage.key} className="flex items-center gap-3 rounded-lg px-3 py-2.5 border"
          style={{ borderColor: s.border, background: s.surface }}>
          {/* Reorder */}
          <div className="flex flex-col gap-0.5">
            <button onClick={() => move(i, -1)} disabled={i === 0} className="disabled:opacity-20">
              <span className="material-icons-outlined" style={{ fontSize: '14px', color: s.textMuted }}>keyboard_arrow_up</span>
            </button>
            <button onClick={() => move(i, 1)} disabled={i === stages.length - 1} className="disabled:opacity-20">
              <span className="material-icons-outlined" style={{ fontSize: '14px', color: s.textMuted }}>keyboard_arrow_down</span>
            </button>
          </div>

          {/* Color picker */}
          <input type="color" value={stage.color} onChange={e => updateStage(i, 'color', e.target.value)}
            className="w-8 h-8 rounded cursor-pointer border-0" style={{ background: 'transparent' }} />

          {/* Label */}
          <input type="text" value={stage.label} onChange={e => updateStage(i, 'label', e.target.value)}
            className="flex-1 rounded border px-2 py-1 text-sm focus:outline-none"
            style={{ borderColor: s.border, background: s.bg, color: s.text }} />

          {/* Key (read-only) */}
          <span className="text-[10px] font-mono px-2 py-0.5 rounded"
            style={{ background: s.card, color: s.textMuted }}>{stage.key}</span>

          {/* Status count badge */}
          <span className="text-[10px] px-1.5 py-0.5 rounded"
            style={{ background: stage.color + '22', color: stage.color }}>
            {stage.statuses.length} statuses
          </span>

          {/* Remove */}
          <button onClick={() => removeStage(i)} className="text-red-400 hover:text-red-300">
            <span className="material-icons-outlined" style={{ fontSize: '16px' }}>close</span>
          </button>
        </div>
      ))}

      {/* Add row */}
      <div className="flex gap-2">
        <input type="text" placeholder="New stage label..." value={newLabel}
          onChange={e => setNewLabel(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') addStage() }}
          className="flex-1 rounded-lg border px-3 py-1.5 text-sm focus:outline-none"
          style={{ borderColor: s.border, background: s.surface, color: s.text }} />
        <button onClick={addStage}
          className="rounded-lg px-3 py-1.5 text-xs font-medium text-white"
          style={{ background: s.portal }}>
          Add Stage
        </button>
      </div>
    </div>
  )
}

/* ═══ Main Component ═══ */

export function ConfigOperations({ configData, configKey, selectedKey, onUpdate }: ConfigOperationsProps) {
  const activeKey = configKey || selectedKey || ''
  const updateField = (field: string, value: unknown) => {
    onUpdate({ ...configData, [field]: value })
  }

  switch (selectedKey) {
    case 'atlas_stages':
      return (
        <div className="space-y-3">
          <p className="text-xs" style={{ color: s.textMuted }}>
            ATLAS pipeline stages — reorder, rename, or change colors. Each stage maps task statuses to a pipeline step.
          </p>
          <StageEditor
            stages={(configData.stages as StageItem[]) || []}
            onChange={stages => updateField('stages', stages)}
          />
        </div>
      )

    case 'content_block_types':
      return (
        <div className="space-y-3">
          <p className="text-xs" style={{ color: s.textMuted }}>
            Content block types with auto-generated ID prefixes. Used by the C3 campaign engine.
          </p>
          <TableEditor
            entries={(configData.types as Record<string, unknown>[]) || []}
            columns={[
              { key: 'name', label: 'Type Name' },
              { key: 'prefix', label: 'ID Prefix' },
              { key: 'description', label: 'Description' },
            ]}
            onUpdate={(i, field, value) => {
              const types = [...((configData.types as Record<string, unknown>[]) || [])]
              types[i] = { ...types[i], [field]: value }
              updateField('types', types)
            }}
            onAdd={() => {
              const types = [...((configData.types as Record<string, unknown>[]) || [])]
              types.push({ name: '', prefix: '', description: '' })
              updateField('types', types)
            }}
            onDelete={i => {
              const types = [...((configData.types as Record<string, unknown>[]) || [])]
              types.splice(i, 1)
              updateField('types', types)
            }}
          />
        </div>
      )

    case 'excluded_statuses':
      return (
        <div className="space-y-3">
          <p className="text-xs" style={{ color: s.textMuted }}>
            Account statuses excluded from display in all account-rendering contexts (contact detail, household detail, accounts page).
          </p>
          <ChecklistEditor
            items={(configData.statuses as string[]) || []}
            onChange={statuses => updateField('statuses', statuses)}
            onAdd={item => {
              const statuses = [...((configData.statuses as string[]) || []), item]
              updateField('statuses', statuses)
            }}
          />
        </div>
      )

    case 'rate_limits':
      return (
        <div className="space-y-3">
          <p className="text-xs" style={{ color: s.textMuted }}>
            API rate limiting per authenticated user. In-memory sliding window.
          </p>
          <NumericEditor
            label="Requests per minute"
            value={(configData.requests_per_minute as number) || 100}
            min={10}
            max={1000}
            onChange={v => updateField('requests_per_minute', v)}
          />
        </div>
      )

    default:
      return (
        <div className="text-center py-8 text-sm" style={{ color: s.textMuted }}>
          <span className="material-icons-outlined block mb-2" style={{ fontSize: '24px' }}>settings</span>
          Unknown operations config: {selectedKey}
        </div>
      )
  }
}
