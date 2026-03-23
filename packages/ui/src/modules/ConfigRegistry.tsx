'use client'

import { useState, useEffect, useCallback } from 'react'
import { fetchValidated } from './fetchValidated'
import { useToast } from '../components/Toast'

/* ═══ Types ═══ */

interface ConfigRegistryProps { portal: string }

interface ConfigMeta {
  key: string
  type: string
  category: string
  entry_count: number
  updated_at: string | null
  _updated_by: string | null
}

interface ConfigData {
  key: string
  type: string
  category: string
  [field: string]: unknown
}

type ConfigCategory = 'data_quality' | 'financial' | 'operations'

/* ═══ Constants ═══ */

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

const CATEGORIES: Array<{ key: ConfigCategory; label: string; icon: string }> = [
  { key: 'data_quality', label: 'Data Quality', icon: 'tune' },
  { key: 'financial', label: 'Financial Tables', icon: 'account_balance' },
  { key: 'operations', label: 'Platform Ops', icon: 'settings' },
]

/* ═══ Shared Editor Primitives ═══ */

/** Slider with label and value display */
export function SliderEditor({ label, value, min, max, onChange }: {
  label: string; value: number; min?: number; max?: number; onChange: (v: number) => void
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium uppercase tracking-wide" style={{ color: s.textMuted }}>{label}</label>
        <span className="text-sm font-bold" style={{ color: s.portal }}>{value}</span>
      </div>
      <input type="range" min={min ?? 0} max={max ?? 100} value={value} onChange={e => onChange(Number(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
        style={{ background: `linear-gradient(to right, var(--portal) ${value}%, ${s.border} ${value}%)` }} />
    </div>
  )
}

/** Searchable two-column table editor */
export function TableEditor({ entries, columns, onUpdate, onAdd, onDelete }: {
  entries: Record<string, unknown>[]
  columns: Array<{ key: string; label: string; editable?: boolean }>
  onUpdate: (index: number, field: string, value: string) => void
  onAdd: () => void
  onDelete: (index: number) => void
}) {
  const [search, setSearch] = useState('')
  const filtered = search
    ? entries.filter(e => columns.some(c => String(e[c.key] || '').toLowerCase().includes(search.toLowerCase())))
    : entries

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <span className="material-icons-outlined absolute left-2 top-1/2 -translate-y-1/2" style={{ fontSize: '16px', color: s.textMuted }}>search</span>
          <input type="text" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full rounded-lg border pl-8 pr-3 py-1.5 text-sm focus:outline-none"
            style={{ borderColor: s.border, background: s.surface, color: s.text }} />
        </div>
        <button onClick={onAdd} className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-white" style={{ background: s.portal }}>
          <span className="material-icons-outlined" style={{ fontSize: '14px' }}>add</span>Add
        </button>
      </div>
      <div className="rounded-lg border overflow-hidden" style={{ borderColor: s.border }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: s.surface }}>
              {columns.map(col => (
                <th key={col.key} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, fontWeight: 600, color: s.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{col.label}</th>
              ))}
              <th style={{ width: 40 }} />
            </tr>
          </thead>
          <tbody>
            {filtered.map((entry, i) => {
              const realIndex = entries.indexOf(entry)
              return (
                <tr key={i} style={{ borderBottom: `1px solid ${s.border}` }}>
                  {columns.map(col => (
                    <td key={col.key} style={{ padding: '4px 12px' }}>
                      {col.editable !== false ? (
                        <input type="text" value={String(entry[col.key] || '')}
                          onChange={e => onUpdate(realIndex, col.key, e.target.value)}
                          className="w-full rounded border px-2 py-1 text-sm focus:outline-none"
                          style={{ borderColor: s.border, background: s.bg, color: s.text }} />
                      ) : (
                        <span style={{ color: s.textSecondary, fontSize: 12 }}>{String(entry[col.key] || '')}</span>
                      )}
                    </td>
                  ))}
                  <td style={{ padding: '4px 8px' }}>
                    <button onClick={() => onDelete(realIndex)} className="text-red-400 hover:text-red-300">
                      <span className="material-icons-outlined" style={{ fontSize: '16px' }}>close</span>
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center py-6 text-sm" style={{ color: s.textMuted }}>
            {search ? 'No matches found' : 'No entries yet'}
          </div>
        )}
      </div>
      <div className="text-[10px]" style={{ color: s.textMuted }}>{filtered.length} of {entries.length} entries</div>
    </div>
  )
}

/** Checklist editor for string arrays */
export function ChecklistEditor({ items, onChange, onAdd }: {
  items: string[]; onChange: (items: string[]) => void; onAdd: (item: string) => void
}) {
  const [newItem, setNewItem] = useState('')
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input type="text" placeholder="Add status..." value={newItem}
          onChange={e => setNewItem(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && newItem.trim()) { onAdd(newItem.trim()); setNewItem('') } }}
          className="flex-1 rounded-lg border px-3 py-1.5 text-sm focus:outline-none"
          style={{ borderColor: s.border, background: s.surface, color: s.text }} />
        <button onClick={() => { if (newItem.trim()) { onAdd(newItem.trim()); setNewItem('') } }}
          className="rounded-lg px-3 py-1.5 text-xs font-medium text-white" style={{ background: s.portal }}>Add</button>
      </div>
      <div className="space-y-1">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: s.surface }}>
            <span className="material-icons-outlined text-emerald-400" style={{ fontSize: '16px' }}>check_circle</span>
            <span className="flex-1 text-sm" style={{ color: s.text }}>{item}</span>
            <button onClick={() => onChange(items.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-300">
              <span className="material-icons-outlined" style={{ fontSize: '14px' }}>close</span>
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Numeric input with label and range */
export function NumericEditor({ label, value, min, max, onChange }: {
  label: string; value: number; min?: number; max?: number; onChange: (v: number) => void
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium uppercase tracking-wide" style={{ color: s.textMuted }}>{label}</label>
      <input type="number" value={value} min={min} max={max}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full rounded-lg border px-3 py-2 text-sm font-mono focus:outline-none"
        style={{ borderColor: s.border, background: s.surface, color: s.text }} />
      {min !== undefined && max !== undefined && (
        <div className="text-[10px]" style={{ color: s.textMuted }}>Range: {min} — {max}</div>
      )}
    </div>
  )
}

/* ═══ Lazy Section Imports ═══ */
// These will be created by Builders 2, 3, 4 in separate files.
// For now, render placeholder sections until the builder files exist.

function SectionPlaceholder({ category }: { category: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16" style={{ color: s.textMuted }}>
      <span className="material-icons-outlined mb-2" style={{ fontSize: '32px' }}>construction</span>
      <p className="text-sm">Config editors for <strong>{category}</strong> coming soon</p>
      <p className="text-[10px] mt-1">Builder will add section component here</p>
    </div>
  )
}

/* ═══ Main Component ═══ */

export function ConfigRegistry({ portal }: ConfigRegistryProps) {
  const { showToast } = useToast()
  const [configs, setConfigs] = useState<ConfigMeta[]>([])
  const [selectedKey, setSelectedKey] = useState<string>('')
  const [configData, setConfigData] = useState<ConfigData | null>(null)
  const [activeCategory, setActiveCategory] = useState<ConfigCategory>('data_quality')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  const loadConfigs = useCallback(async () => {
    setLoading(true)
    try {
      const result = await fetchValidated<ConfigMeta[]>('/api/config')
      if (result.success && result.data) setConfigs(result.data)
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { loadConfigs() }, [loadConfigs])

  const loadConfig = useCallback(async (key: string) => {
    try {
      const result = await fetchValidated<ConfigData>(`/api/config/${key}`)
      if (result.success && result.data) {
        setConfigData(result.data)
        setDirty(false)
      }
    } catch { /* silent */ }
  }, [])

  const saveConfig = useCallback(async () => {
    if (!configData || !selectedKey) return
    setSaving(true)
    try {
      const result = await fetchValidated(`/api/config/${selectedKey}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(configData),
      })
      if (result.success) {
        showToast('Config saved', 'success')
        setDirty(false)
        loadConfigs()
      } else {
        showToast(result.error || 'Save failed', 'error')
      }
    } catch { showToast('Save failed', 'error') }
    finally { setSaving(false) }
  }, [configData, selectedKey, showToast, loadConfigs])

  const selectConfig = (key: string) => {
    setSelectedKey(key)
    loadConfig(key)
  }

  const categoryConfigs = configs.filter(c => c.category === activeCategory)

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-12 rounded-xl" style={{ background: s.surface }} />
        {[1, 2, 3].map(i => <div key={i} className="h-16 rounded-xl" style={{ background: s.surface }} />)}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Stats Bar */}
      <div className="flex items-center gap-5 flex-wrap text-[11px]" style={{ color: s.textMuted }}>
        <span className="material-icons-outlined" style={{ fontSize: '14px', color: s.portal }}>tune</span>
        <span><strong style={{ color: s.textSecondary }}>{configs.length}</strong> configs</span>
        {CATEGORIES.map(cat => (
          <span key={cat.key}><strong style={{ color: s.textSecondary }}>{configs.filter(c => c.category === cat.key).length}</strong> {cat.label.toLowerCase()}</span>
        ))}
      </div>

      {/* Category Tabs */}
      <div className="flex gap-1 rounded-xl border p-1.5 overflow-x-auto" style={{ borderColor: s.border, background: s.card }}>
        {CATEGORIES.map(cat => (
          <button key={cat.key} onClick={() => { setActiveCategory(cat.key); setSelectedKey(''); setConfigData(null) }}
            className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              activeCategory === cat.key ? 'text-white' : 'hover:text-[var(--text-secondary)]'
            }`}
            style={activeCategory === cat.key ? { background: s.portal, color: '#fff' } : { color: s.textMuted }}>
            <span className="material-icons-outlined" style={{ fontSize: '16px' }}>{cat.icon}</span>
            {cat.label}
          </button>
        ))}
      </div>

      {/* Two-Panel Layout */}
      <div className="flex gap-4" style={{ minHeight: 400 }}>
        {/* Left — Config List */}
        <div className="w-64 shrink-0 space-y-1">
          {categoryConfigs.length === 0 ? (
            <div className="text-center py-8 text-sm" style={{ color: s.textMuted }}>
              <span className="material-icons-outlined block mb-2" style={{ fontSize: '24px' }}>inventory_2</span>
              No configs in this category yet.<br />Run the seed script to populate.
            </div>
          ) : categoryConfigs.map(cfg => (
            <button key={cfg.key} onClick={() => selectConfig(cfg.key)}
              className={`w-full text-left rounded-lg px-3 py-2.5 transition-colors ${selectedKey === cfg.key ? 'border' : ''}`}
              style={{
                background: selectedKey === cfg.key ? s.surface : 'transparent',
                borderColor: selectedKey === cfg.key ? s.portal : 'transparent',
              }}>
              <div className="text-sm font-medium" style={{ color: selectedKey === cfg.key ? s.text : s.textSecondary }}>
                {cfg.key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px]" style={{ color: s.textMuted }}>{cfg.type}</span>
                {cfg.entry_count > 0 && <span className="text-[10px]" style={{ color: s.textMuted }}>{cfg.entry_count} entries</span>}
              </div>
            </button>
          ))}
        </div>

        {/* Right — Editor Panel */}
        <div className="flex-1 rounded-xl border p-4" style={{ borderColor: s.border, background: s.card }}>
          {!selectedKey ? (
            <div className="flex flex-col items-center justify-center h-full" style={{ color: s.textMuted }}>
              <span className="material-icons-outlined mb-2" style={{ fontSize: '32px' }}>touch_app</span>
              <p className="text-sm">Select a config to edit</p>
            </div>
          ) : !configData ? (
            <div className="flex items-center justify-center h-full" style={{ color: s.textMuted }}>Loading...</div>
          ) : (
            <div className="space-y-4">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold" style={{ color: s.text }}>
                    {selectedKey.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                  </h3>
                  <div className="flex items-center gap-3 mt-1 text-[10px]" style={{ color: s.textMuted }}>
                    <span className="px-1.5 py-0.5 rounded" style={{ background: s.surface }}>{configData.type}</span>
                    {typeof configData.updated_at === 'string' && <span>Updated: {new Date(configData.updated_at).toLocaleDateString()}</span>}
                  </div>
                </div>
                {dirty && (
                  <button onClick={saveConfig} disabled={saving}
                    className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                    style={{ background: s.portal }}>
                    <span className="material-icons-outlined" style={{ fontSize: '16px' }}>{saving ? 'sync' : 'save'}</span>
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                )}
              </div>

              {/* Section-specific editor — Builders 2/3/4 will replace SectionPlaceholder with real components */}
              <SectionPlaceholder category={activeCategory} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
