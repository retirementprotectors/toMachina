'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { fetchWithAuth } from './fetchWithAuth'

/* ═══ Types ═══ */

interface FirestoreConfigProps { portal: string }

interface WiringInfo { status: 'full_stack' | 'backend_only' | 'frontend_only' | 'none'; backend: string; frontend: string; backend_endpoints?: number }

interface DocInfo {
  id: string
  fieldCount: number
  typeSummary: Record<string, number>
  updatedAt: string | null
  data: Record<string, unknown>
}

interface CollectionInfo { name: string; count: number; docs: DocInfo[]; wiring?: WiringInfo }

interface HealthData {
  collections: Record<string, number>
  queues: Record<string, number>
  dataGaps: { missing_agent: number; missing_household: number; no_accounts: number }
}

/* ═══ Constants ═══ */

const WIRING_LABELS: Record<string, { label: string; color: string; desc: string }> = {
  full_stack:    { label: 'Full Stack',     color: '#10b981', desc: 'Frontend + Backend wired — changes take immediate effect' },
  backend_only:  { label: 'Backend Only',   color: '#f59e0b', desc: 'API reads/writes this, but no portal UI consumes it yet' },
  frontend_only: { label: 'Frontend Only',  color: '#f59e0b', desc: 'UI references this, but no dedicated API route serves it' },
  none:          { label: 'Not Wired',      color: '#ef4444', desc: 'No code reads this collection — data sits until wired' },
}

const TYPE_COLORS: Record<string, { text: string; bg: string }> = {
  string: { text: 'text-purple-400', bg: 'bg-purple-400/10' },
  boolean: { text: 'text-emerald-400', bg: 'bg-emerald-400/10' },
  number: { text: 'text-cyan-400', bg: 'bg-cyan-400/10' },
  array: { text: 'text-amber-400', bg: 'bg-amber-400/10' },
  object: { text: 'text-pink-400', bg: 'bg-pink-400/10' },
  null: { text: 'text-gray-400', bg: 'bg-gray-400/10' },
}

const FIELD_DEFAULTS: Record<string, unknown> = {
  string: '', number: 0, boolean: false, array: [], object: {},
}

function detectType(value: unknown): string {
  if (value === null || value === undefined) return 'null'
  if (typeof value === 'boolean') return 'boolean'
  if (typeof value === 'number') return 'number'
  if (typeof value === 'string') return 'string'
  if (Array.isArray(value)) return 'array'
  if (typeof value === 'object') return 'object'
  return 'unknown'
}

/* ═══ TRK-508: Type Badge ═══ */

function TypeBadge({ type, count }: { type: string; count: number }) {
  const c = TYPE_COLORS[type] || TYPE_COLORS.null
  return <span className={`inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded ${c.text} ${c.bg}`}>{type} x{count}</span>
}

/* ═══ TRK-513/514/515: Inline Editable Tag ═══ */

function EditableTag({ value, onSave, onRemove }: { value: string; onSave: (v: string) => void; onRemove: () => void }) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(value)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (editing) inputRef.current?.focus() }, [editing])

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={text}
        onChange={e => setText(e.target.value)}
        onBlur={() => { if (text.trim()) onSave(text.trim()); setEditing(false) }}
        onKeyDown={e => { if (e.key === 'Enter') { if (text.trim()) onSave(text.trim()); setEditing(false) } if (e.key === 'Escape') { setText(value); setEditing(false) } }}
        className="rounded-md border border-[var(--portal)] bg-[var(--bg-surface)] px-2 py-1 text-xs font-mono text-[var(--text-primary)] outline-none"
        style={{ minWidth: 80 }}
      />
    )
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-1 text-xs text-[var(--text-secondary)] font-mono hover:border-[var(--border)] transition-colors">
      <span onClick={() => setEditing(true)} className="cursor-pointer">{value}</span>
      <button onClick={onRemove} className="text-[var(--text-muted)] hover:text-red-400 ml-0.5">&times;</button>
    </span>
  )
}

/* ═══ TRK-513: Inline Add Input ═══ */

function InlineAddInput({ onAdd, placeholder }: { onAdd: (v: string) => void; placeholder?: string }) {
  const [active, setActive] = useState(false)
  const [text, setText] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (active) inputRef.current?.focus() }, [active])

  if (!active) {
    return (
      <button onClick={() => setActive(true)} className="inline-flex items-center gap-1 rounded-md border border-dashed border-[var(--border-subtle)] px-2.5 py-1 text-xs text-[var(--text-muted)] hover:border-[var(--portal)] hover:text-[var(--portal)] transition-colors">
        + Add
      </button>
    )
  }

  return (
    <input
      ref={inputRef}
      type="text"
      value={text}
      onChange={e => setText(e.target.value)}
      onBlur={() => { if (text.trim()) { onAdd(text.trim()); setText('') } setActive(false) }}
      onKeyDown={e => { if (e.key === 'Enter' && text.trim()) { onAdd(text.trim()); setText(''); setActive(false) } if (e.key === 'Escape') { setText(''); setActive(false) } }}
      placeholder={placeholder || 'Type + Enter'}
      className="rounded-md border border-[var(--portal)] bg-[var(--bg-surface)] px-2 py-1 text-xs font-mono text-[var(--text-primary)] outline-none"
      style={{ minWidth: 100 }}
    />
  )
}

/* ═══ TRK-516: Collapsible Field Wrapper ═══ */

function CollapsibleField({ fieldName, type, count, collapsed, onToggle, children, onDelete }: {
  fieldName: string; type: string; count?: number; collapsed: boolean; onToggle: () => void; children: React.ReactNode; onDelete?: () => void
}) {
  const c = TYPE_COLORS[type] || TYPE_COLORS.null
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 cursor-pointer group" onClick={onToggle}>
        <span className="material-icons-outlined text-[var(--text-muted)] transition-transform duration-150" style={{ fontSize: '14px', transform: collapsed ? 'none' : 'rotate(90deg)' }}>chevron_right</span>
        <span className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">{fieldName}</span>
        <span className={`text-[9px] px-1 py-0.5 rounded font-mono ${c.text} ${c.bg}`}>{type}{count != null ? `[${count}]` : ''}</span>
        {collapsed && <span className="text-[10px] text-[var(--text-muted)]">({count ?? '...'} items)</span>}
        {onDelete && (
          <button onClick={e => { e.stopPropagation(); onDelete() }} className="ml-auto opacity-0 group-hover:opacity-100 text-[var(--text-muted)] hover:text-red-400 transition-all" title="Remove field">
            <span className="material-icons-outlined" style={{ fontSize: '13px' }}>close</span>
          </button>
        )}
      </div>
      {!collapsed && children}
    </div>
  )
}

/* ═══ TRK-511-516: FieldEditor (all types, full CRUD) ═══ */

function FieldEditor({ fieldName, value, onChange, onDelete, collapsed, onToggleCollapse }: {
  fieldName: string; value: unknown; onChange: (v: unknown) => void; onDelete?: () => void
  collapsed?: boolean; onToggleCollapse?: () => void
}) {
  const type = detectType(value)
  const c = TYPE_COLORS[type] || TYPE_COLORS.null

  // ── Boolean toggle ──
  if (type === 'boolean') {
    return (
      <div className="space-y-1 group">
        <div className="flex items-center gap-1.5">
          <label className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">{fieldName}</label>
          <span className={`text-[9px] px-1 py-0.5 rounded font-mono ${c.text} ${c.bg}`}>bool</span>
          {onDelete && <button onClick={onDelete} className="ml-auto opacity-0 group-hover:opacity-100 text-[var(--text-muted)] hover:text-red-400 transition-all"><span className="material-icons-outlined" style={{ fontSize: '13px' }}>close</span></button>}
        </div>
        <div className="flex items-center gap-2.5">
          <button type="button" role="switch" aria-checked={value as boolean} onClick={() => onChange(!(value as boolean))}
            className="shrink-0 flex items-center rounded-full p-0.5 transition-colors"
            style={{ width: '40px', height: '22px', background: value ? 'var(--portal)' : '#4b5563' }}>
            <span className="rounded-full bg-white shadow-sm transition-all duration-200"
              style={{ width: '18px', height: '18px', marginLeft: value ? '18px' : '0px' }} />
          </button>
          <span className="text-sm text-[var(--text-secondary)]">{value ? 'Enabled' : 'Disabled'}
            <span className={`ml-2 font-mono text-[11px] px-1.5 py-0.5 rounded ${value ? 'text-emerald-400 bg-emerald-400/10' : 'text-gray-400 bg-gray-400/10'}`}>{String(value)}</span>
          </span>
        </div>
      </div>
    )
  }

  // ── String array ── TRK-513
  if (type === 'array' && Array.isArray(value) && (value.length === 0 || value.every(v => typeof v === 'string'))) {
    const arr = value as string[]
    return (
      <CollapsibleField fieldName={fieldName} type="array" count={arr.length} collapsed={!!collapsed} onToggle={() => onToggleCollapse?.()} onDelete={onDelete}>
        <div className="flex flex-wrap gap-1.5 pt-1">
          {arr.map((item, i) => (
            <EditableTag key={i} value={item}
              onSave={v => { const a = [...arr]; a[i] = v; onChange(a) }}
              onRemove={() => { const a = [...arr]; a.splice(i, 1); onChange(a) }}
            />
          ))}
          <InlineAddInput onAdd={v => onChange([...arr, v])} />
        </div>
        {arr.length === 0 && <p className="text-xs text-[var(--text-muted)] italic pt-1">No items. Click + Add to add the first one.</p>}
      </CollapsibleField>
    )
  }

  // ── Object array ── TRK-514
  if (type === 'array' && Array.isArray(value) && value.length > 0 && typeof value[0] === 'object' && value[0] !== null) {
    const items = value as Record<string, unknown>[]
    const keys = Object.keys(items[0])
    const [editCell, setEditCell] = useState<{ row: number; key: string } | null>(null)
    const [editText, setEditText] = useState('')
    const cellRef = useRef<HTMLInputElement>(null)

    useEffect(() => { if (editCell) cellRef.current?.focus() }, [editCell])

    const startEdit = (row: number, key: string, cellVal: unknown) => {
      const display = Array.isArray(cellVal) ? (cellVal as string[]).join(', ') : typeof cellVal === 'object' ? JSON.stringify(cellVal) : String(cellVal ?? '')
      setEditText(display)
      setEditCell({ row, key })
    }

    const commitEdit = () => {
      if (!editCell) return
      const newItems = [...items]
      const original = items[editCell.row][editCell.key]
      if (Array.isArray(original)) {
        newItems[editCell.row] = { ...newItems[editCell.row], [editCell.key]: editText.split(',').map(s => s.trim()).filter(Boolean) }
      } else if (typeof original === 'number') {
        newItems[editCell.row] = { ...newItems[editCell.row], [editCell.key]: parseFloat(editText) || 0 }
      } else {
        newItems[editCell.row] = { ...newItems[editCell.row], [editCell.key]: editText }
      }
      onChange(newItems)
      setEditCell(null)
    }

    return (
      <CollapsibleField fieldName={fieldName} type="array" count={items.length} collapsed={!!collapsed} onToggle={() => onToggleCollapse?.()} onDelete={onDelete}>
        <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden">
          <button onClick={() => { const empty: Record<string, unknown> = {}; for (const k of keys) empty[k] = Array.isArray(items[0][k]) ? [] : ''; onChange([...items, empty]) }}
            className="flex items-center gap-1.5 w-full px-3 py-2 text-xs font-medium text-amber-400 hover:bg-amber-400/5 transition-colors border-b border-[var(--border-subtle)]">
            <span className="material-icons-outlined" style={{ fontSize: '14px' }}>add_circle</span>Add {fieldName.replace(/_/g, ' ')} entry
          </button>
          {keys.length > 0 && (
            <div className="grid gap-3 px-3 py-1.5 border-b border-[var(--border-subtle)] bg-[var(--bg-card)]" style={{ gridTemplateColumns: `repeat(${keys.length}, 1fr) 32px` }}>
              {keys.map(k => <span key={k} className="text-[9px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">{k}</span>)}
              <span />
            </div>
          )}
          {items.map((item, i) => (
            <div key={i} className="grid gap-3 px-3 py-2 border-b border-[var(--border-subtle)] last:border-b-0 hover:bg-[var(--bg-card)] transition-colors items-center" style={{ gridTemplateColumns: `repeat(${keys.length}, 1fr) 32px` }}>
              {keys.map(k => {
                const cellVal = item[k]
                const isEditing = editCell?.row === i && editCell?.key === k
                const isEditableType = typeof cellVal !== 'object' || Array.isArray(cellVal)

                if (isEditing) {
                  return <input key={k} ref={cellRef} type="text" value={editText} onChange={e => setEditText(e.target.value)}
                    onBlur={commitEdit} onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditCell(null) }}
                    className="rounded border border-[var(--portal)] bg-[var(--bg-surface)] px-1.5 py-0.5 text-xs font-mono text-[var(--text-primary)] outline-none" />
                }

                if (Array.isArray(cellVal)) {
                  return (
                    <div key={k} className="flex flex-wrap gap-1 cursor-pointer" onClick={() => isEditableType && startEdit(i, k, cellVal)}>
                      {(cellVal as string[]).map((p, pi) => <span key={pi} className="text-[10px] font-mono text-[var(--text-muted)] bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded px-1.5 py-0.5">{String(p)}</span>)}
                      {(cellVal as string[]).length === 0 && <span className="text-[10px] text-[var(--text-muted)] italic">empty</span>}
                    </div>
                  )
                }

                return (
                  <span key={k} className={`text-xs font-mono truncate ${isEditableType ? 'cursor-pointer hover:text-[var(--portal)]' : ''} text-[var(--text-secondary)]`}
                    onClick={() => isEditableType && startEdit(i, k, cellVal)}>
                    {typeof cellVal === 'object' ? JSON.stringify(cellVal) : String(cellVal ?? '')}
                  </span>
                )
              })}
              <button onClick={() => { const a = [...items]; a.splice(i, 1); onChange(a) }} className="text-[var(--text-muted)] hover:text-red-400 transition-colors" title="Remove row">
                <span className="material-icons-outlined" style={{ fontSize: '14px' }}>close</span>
              </button>
            </div>
          ))}
        </div>
      </CollapsibleField>
    )
  }

  // ── Nested object ── TRK-515
  if (type === 'object' && value !== null && !Array.isArray(value)) {
    const entries = Object.entries(value as Record<string, unknown>)
    const [addingKey, setAddingKey] = useState(false)
    const [newKey, setNewKey] = useState('')
    const [newVal, setNewVal] = useState('')

    return (
      <CollapsibleField fieldName={fieldName} type="object" count={entries.length} collapsed={!!collapsed} onToggle={() => onToggleCollapse?.()} onDelete={onDelete}>
        <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3 space-y-2">
          {entries.map(([k, v]) => {
            const isPrimitive = typeof v !== 'object' || v === null
            return (
              <div key={k} className="flex items-start gap-2 group">
                <span className="text-[10px] font-mono text-[var(--text-muted)] min-w-[100px] pt-1.5">{k}:</span>
                {isPrimitive ? (
                  <input type="text" value={String(v ?? '')}
                    onChange={e => {
                      const obj = { ...(value as Record<string, unknown>) }
                      const orig = obj[k]
                      obj[k] = typeof orig === 'number' ? (parseFloat(e.target.value) || 0) : typeof orig === 'boolean' ? e.target.value === 'true' : e.target.value
                      onChange(obj)
                    }}
                    className="flex-1 rounded border border-[var(--border-subtle)] bg-[var(--bg-card)] px-2 py-1 text-xs font-mono text-[var(--text-primary)] focus:border-[var(--portal)] outline-none" />
                ) : (
                  <span className="flex-1 text-xs font-mono text-[var(--text-secondary)] break-all">{JSON.stringify(v)}</span>
                )}
                <button onClick={() => { const obj = { ...(value as Record<string, unknown>) }; delete obj[k]; onChange(obj) }}
                  className="opacity-0 group-hover:opacity-100 text-[var(--text-muted)] hover:text-red-400 transition-all pt-1">
                  <span className="material-icons-outlined" style={{ fontSize: '13px' }}>close</span>
                </button>
              </div>
            )
          })}
          {entries.length === 0 && <p className="text-xs text-[var(--text-muted)] italic">Empty object. Click + Add Key below.</p>}
          {addingKey ? (
            <div className="flex items-center gap-2 pt-1 border-t border-[var(--border-subtle)]">
              <input type="text" value={newKey} onChange={e => setNewKey(e.target.value)} placeholder="key_name" className="rounded border border-[var(--border-subtle)] bg-[var(--bg-card)] px-2 py-1 text-xs font-mono text-[var(--text-primary)] outline-none" style={{ width: 100 }} />
              <input type="text" value={newVal} onChange={e => setNewVal(e.target.value)} placeholder="value" className="flex-1 rounded border border-[var(--border-subtle)] bg-[var(--bg-card)] px-2 py-1 text-xs font-mono text-[var(--text-primary)] outline-none"
                onKeyDown={e => { if (e.key === 'Enter' && newKey.trim()) { const obj = { ...(value as Record<string, unknown>), [newKey.trim()]: newVal }; onChange(obj); setNewKey(''); setNewVal(''); setAddingKey(false) } }} />
              <button onClick={() => { if (newKey.trim()) { onChange({ ...(value as Record<string, unknown>), [newKey.trim()]: newVal }); setNewKey(''); setNewVal(''); setAddingKey(false) } }}
                className="text-xs font-medium text-[var(--portal)]">Add</button>
              <button onClick={() => { setAddingKey(false); setNewKey(''); setNewVal('') }} className="text-[var(--text-muted)]">
                <span className="material-icons-outlined" style={{ fontSize: '14px' }}>close</span></button>
            </div>
          ) : (
            <button onClick={() => setAddingKey(true)} className="flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-[var(--portal)] transition-colors pt-1">
              <span className="material-icons-outlined" style={{ fontSize: '12px' }}>add</span>Add Key
            </button>
          )}
        </div>
      </CollapsibleField>
    )
  }

  // ── Number ──
  if (type === 'number') {
    return (
      <div className="space-y-1 group">
        <div className="flex items-center gap-1.5">
          <label className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">{fieldName}</label>
          <span className={`text-[9px] px-1 py-0.5 rounded font-mono ${c.text} ${c.bg}`}>num</span>
          {onDelete && <button onClick={onDelete} className="ml-auto opacity-0 group-hover:opacity-100 text-[var(--text-muted)] hover:text-red-400 transition-all"><span className="material-icons-outlined" style={{ fontSize: '13px' }}>close</span></button>}
        </div>
        <input type="number" value={value as number} onChange={e => onChange(parseFloat(e.target.value) || 0)}
          className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm font-mono text-[var(--text-primary)] focus:border-[var(--portal)] focus:outline-none" />
      </div>
    )
  }

  // ── Default: string (safe-stringify objects) ──
  const displayVal = typeof value === 'object' ? JSON.stringify(value) : String(value ?? '')
  return (
    <div className="space-y-1 group">
      <div className="flex items-center gap-1.5">
        <label className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">{fieldName}</label>
        <span className={`text-[9px] px-1 py-0.5 rounded font-mono ${TYPE_COLORS[type]?.text || c.text} ${TYPE_COLORS[type]?.bg || c.bg}`}>{type}</span>
        {onDelete && <button onClick={onDelete} className="ml-auto opacity-0 group-hover:opacity-100 text-[var(--text-muted)] hover:text-red-400 transition-all"><span className="material-icons-outlined" style={{ fontSize: '13px' }}>close</span></button>}
      </div>
      <input type="text" value={displayVal} onChange={e => onChange(e.target.value)}
        className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm font-mono text-[var(--text-primary)] focus:border-[var(--portal)] focus:outline-none" />
    </div>
  )
}

/* ═══ TRK-510/511/512/516: Document Card ═══ */

function DocumentCard({ doc, collectionName, onSave, onDelete }: {
  doc: DocInfo; collectionName: string
  onSave: (coll: string, docId: string, data: Record<string, unknown>, deleteFields?: string[]) => Promise<void>
  onDelete: (coll: string, docId: string) => Promise<void>
}) {
  const [expanded, setExpanded] = useState(false)
  const [editData, setEditData] = useState<Record<string, unknown>>(doc.data)
  const [deletedFields, setDeletedFields] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [collapsedFields, setCollapsedFields] = useState<Set<string>>(new Set())
  const [showAddField, setShowAddField] = useState(false)
  const [newFieldName, setNewFieldName] = useState('')
  const [newFieldType, setNewFieldType] = useState('string')
  const [confirmDelete, setConfirmDelete] = useState(false)

  const handleFieldChange = (field: string, newVal: unknown) => { setEditData(prev => ({ ...prev, [field]: newVal })); setDirty(true) }
  const handleFieldDelete = (field: string) => { setEditData(prev => { const d = { ...prev }; delete d[field]; return d }); setDeletedFields(prev => [...prev, field]); setDirty(true) }
  const handleAddField = () => {
    if (!newFieldName.trim() || !/^[a-z][a-z0-9_]*$/.test(newFieldName.trim())) return
    if (newFieldName.trim() in editData) return
    setEditData(prev => ({ ...prev, [newFieldName.trim()]: FIELD_DEFAULTS[newFieldType] ?? '' }))
    setDirty(true); setNewFieldName(''); setShowAddField(false)
  }
  const handleSave = async () => { setSaving(true); await onSave(collectionName, doc.id, editData, deletedFields.length > 0 ? deletedFields : undefined); setSaving(false); setSaved(true); setDirty(false); setDeletedFields([]); setTimeout(() => setSaved(false), 3000) }
  const handleCancel = () => { setEditData(doc.data); setDeletedFields([]); setDirty(false) }
  const toggleCollapse = (f: string) => setCollapsedFields(prev => { const s = new Set(prev); s.has(f) ? s.delete(f) : s.add(f); return s })

  const entries = Object.entries(editData).filter(([k]) => !k.startsWith('_') && k !== 'created_at' && k !== 'updated_at')
  const simpleFields = entries.filter(([, v]) => typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean')
  const wideFields = entries.filter(([, v]) => Array.isArray(v) || (typeof v === 'object' && v !== null && !Array.isArray(v)))

  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] overflow-hidden">
      <div className="flex items-center justify-between w-full px-4 py-3 hover:bg-[var(--bg-surface)] transition-colors">
        <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-3 text-left flex-1">
          <span className="material-icons-outlined text-[var(--text-muted)] transition-transform duration-200" style={{ fontSize: '18px', transform: expanded ? 'rotate(90deg)' : 'none', color: expanded ? 'var(--portal)' : undefined }}>chevron_right</span>
          <span className="text-sm font-mono font-medium" style={{ color: 'var(--portal)' }}>{doc.id}</span>
          <span className="text-xs text-[var(--text-muted)]">{doc.fieldCount} fields</span>
          {dirty && <span className="text-[10px] font-medium text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded">unsaved</span>}
        </button>
        <div className="flex items-center gap-1.5">
          {Object.entries(doc.typeSummary).map(([t, c]) => <TypeBadge key={t} type={t} count={c} />)}
          {doc.updatedAt && <span className="text-[11px] text-[var(--text-muted)] ml-2">{new Date(doc.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>}
          {/* TRK-510: Delete document */}
          <button onClick={() => setConfirmDelete(true)} className="ml-2 text-[var(--text-muted)] hover:text-red-400 transition-colors" title="Delete document">
            <span className="material-icons-outlined" style={{ fontSize: '16px' }}>delete_outline</span>
          </button>
        </div>
      </div>

      {/* TRK-510: Delete confirmation */}
      {confirmDelete && (
        <div className="px-4 py-3 bg-red-400/5 border-t border-red-400/20 flex items-center gap-3">
          <span className="text-xs text-red-400">Delete document <strong className="font-mono">{doc.id}</strong>? This cannot be undone.</span>
          <button onClick={async () => { await onDelete(collectionName, doc.id); setConfirmDelete(false) }} className="rounded-lg px-3 py-1 text-xs font-medium text-white bg-red-500 hover:bg-red-600 transition-colors">Delete</button>
          <button onClick={() => setConfirmDelete(false)} className="text-xs text-[var(--text-muted)]">Cancel</button>
        </div>
      )}

      {expanded && (
        <div className="border-t border-[var(--border-subtle)] px-5 py-4 space-y-5">
          {/* TRK-511: Add Field */}
          {showAddField ? (
            <div className="flex items-center gap-2 rounded-lg border border-dashed border-[var(--portal)] bg-[var(--bg-surface)] p-3">
              <input type="text" value={newFieldName} onChange={e => setNewFieldName(e.target.value)} placeholder="field_name (snake_case)"
                onKeyDown={e => { if (e.key === 'Enter') handleAddField() }}
                className="flex-1 rounded border border-[var(--border-subtle)] bg-[var(--bg-card)] px-2 py-1.5 text-xs font-mono text-[var(--text-primary)] outline-none focus:border-[var(--portal)]" />
              <select value={newFieldType} onChange={e => setNewFieldType(e.target.value)}
                className="rounded border border-[var(--border-subtle)] bg-[var(--bg-card)] px-2 py-1.5 text-xs text-[var(--text-primary)] outline-none">
                <option value="string">String</option><option value="number">Number</option><option value="boolean">Boolean</option><option value="array">Array</option><option value="object">Object</option>
              </select>
              <button onClick={handleAddField} disabled={!newFieldName.trim()} className="rounded-lg px-3 py-1.5 text-xs font-medium text-white hover:brightness-110 disabled:opacity-50" style={{ background: 'var(--portal)' }}>Create</button>
              <button onClick={() => { setShowAddField(false); setNewFieldName('') }} className="text-[var(--text-muted)]"><span className="material-icons-outlined" style={{ fontSize: '16px' }}>close</span></button>
            </div>
          ) : (
            <button onClick={() => setShowAddField(true)} className="flex items-center gap-1.5 text-xs font-medium text-[var(--portal)] hover:brightness-110 transition-colors">
              <span className="material-icons-outlined" style={{ fontSize: '14px' }}>add_circle</span>Add Field
            </button>
          )}

          {/* Simple fields 2-col */}
          {simpleFields.length > 0 && (
            <div className="grid grid-cols-2 gap-4">
              {simpleFields.map(([key, val]) => (
                <FieldEditor key={key} fieldName={key} value={val} onChange={v => handleFieldChange(key, v)} onDelete={() => handleFieldDelete(key)} />
              ))}
            </div>
          )}

          {/* Wide fields */}
          {wideFields.map(([key, val]) => (
            <FieldEditor key={key} fieldName={key} value={val} onChange={v => handleFieldChange(key, v)} onDelete={() => handleFieldDelete(key)} collapsed={collapsedFields.has(key)} onToggleCollapse={() => toggleCollapse(key)} />
          ))}

          {/* TRK-519: Empty state */}
          {entries.length === 0 && !showAddField && (
            <p className="text-sm text-[var(--text-muted)] text-center py-4">Empty document. Click <button onClick={() => setShowAddField(true)} className="text-[var(--portal)] underline">+ Add Field</button> to start building.</p>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between pt-3 border-t border-[var(--border-subtle)]">
            <div className="flex gap-2">
              <button onClick={handleSave} disabled={saving || !dirty}
                className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors hover:brightness-110 disabled:opacity-50"
                style={{ background: saved ? '#10b981' : 'var(--portal)' }}>
                <span className="material-icons-outlined" style={{ fontSize: '15px' }}>{saved ? 'check' : saving ? 'sync' : 'save'}</span>
                {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Changes'}
              </button>
              {dirty && <button onClick={handleCancel} className="rounded-lg px-4 py-2 text-sm font-medium text-[var(--text-muted)] border border-[var(--border-subtle)] hover:bg-[var(--bg-surface)] transition-colors">Cancel</button>}
            </div>
            <span className="text-[11px] text-[var(--text-muted)]">{doc.updatedAt ? `Updated: ${doc.updatedAt}` : ''}</span>
          </div>
        </div>
      )}
    </div>
  )
}

/* ═══ Main Component ═══ */

export function FirestoreConfig({ portal }: FirestoreConfigProps) {
  const [collections, setCollections] = useState<CollectionInfo[]>([])
  const [health, setHealth] = useState<HealthData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedCollection, setSelectedCollection] = useState('')
  const [showAddDoc, setShowAddDoc] = useState(false)
  const [newDocId, setNewDocId] = useState('')
  const [showAddCollection, setShowAddCollection] = useState(false)
  const [newCollectionName, setNewCollectionName] = useState('')
  const [showDeleteCollection, setShowDeleteCollection] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [collRes, healthRes] = await Promise.all([
        fetchWithAuth('/api/firestore-config/collections'),
        fetchWithAuth('/api/firestore-config/health'),
      ])
      const [collJson, healthJson] = await Promise.all([collRes.json(), healthRes.json()])
      if (collJson.success) {
        setCollections(collJson.data)
        if (!selectedCollection && collJson.data.length > 0) setSelectedCollection(collJson.data[0].name)
      }
      if (healthJson.success) setHealth(healthJson.data)
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [selectedCollection])

  useEffect(() => { loadData() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = async (coll: string, docId: string, data: Record<string, unknown>, deleteFields?: string[]) => {
    try {
      const payload = deleteFields ? { ...data, _delete_fields: deleteFields } : data
      const res = await fetchWithAuth(`/api/firestore-config/${coll}/${docId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      if ((await res.json()).success) loadData()
    } catch { /* silent */ }
  }

  const handleDeleteDoc = async (coll: string, docId: string) => {
    try {
      const res = await fetchWithAuth(`/api/firestore-config/${coll}/${docId}`, { method: 'DELETE' })
      if ((await res.json()).success) loadData()
    } catch { /* silent */ }
  }

  const handleAddDocument = async () => {
    if (!newDocId.trim() || !selectedCollection) return
    await handleSave(selectedCollection, newDocId.trim(), {})
    setNewDocId(''); setShowAddDoc(false)
  }

  const handleAddCollection = async () => {
    const name = newCollectionName.trim().toLowerCase().replace(/\s+/g, '_')
    if (!name || !/^[a-z][a-z0-9_]*$/.test(name)) return
    await handleSave(name, 'default', {})
    setNewCollectionName(''); setShowAddCollection(false); setSelectedCollection(name); loadData()
  }

  const handleDeleteCollection = async () => {
    if (deleteConfirmText !== selectedCollection) return
    try {
      const res = await fetchWithAuth(`/api/firestore-config/${selectedCollection}?confirm=${selectedCollection}`, { method: 'DELETE' })
      if ((await res.json()).success) {
        setShowDeleteCollection(false); setDeleteConfirmText('')
        setSelectedCollection(collections.find(c => c.name !== selectedCollection)?.name || '')
        loadData()
      }
    } catch { /* silent */ }
  }

  const activeColl = collections.find(c => c.name === selectedCollection)
  const wiring = activeColl?.wiring ? WIRING_LABELS[activeColl.wiring.status] : null

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-14 rounded-xl bg-[var(--bg-surface)]" />
        {[1, 2, 3].map(i => <div key={i} className="h-14 rounded-xl bg-[var(--bg-surface)]" />)}
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* ─── TRK-520: Health Dashboard ─── */}
      {health && (
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-5 flex-wrap">
              <div className="flex items-center gap-1.5">
                <span className="material-icons-outlined text-[var(--portal)]" style={{ fontSize: '16px' }}>local_fire_department</span>
                <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">Firestore</span>
              </div>
              {Object.entries(health.collections).map(([name, count]) => {
                const icon = name === 'active_clients' ? 'people' : name === 'households' ? 'home' : name === 'active_accounts' ? 'account_balance' : 'group'
                return (
                  <div key={name} className="flex items-center gap-1.5">
                    <span className="material-icons-outlined text-[var(--text-muted)]" style={{ fontSize: '14px' }}>{icon}</span>
                    <span className="text-sm font-bold text-[var(--text-primary)]">{count === -1 ? '—' : count.toLocaleString()}</span>
                    <span className="text-[10px] text-[var(--text-muted)]">{name.replace(/_/g, ' ')}</span>
                  </div>
                )
              })}
            </div>
            <div className="flex items-center gap-4 flex-wrap">
              {Object.entries(health.queues).map(([name, count]) => (
                <div key={name} className="flex items-center gap-1">
                  <span className={`text-xs font-bold ${count > 0 ? 'text-amber-400' : count === -1 ? 'text-[var(--text-muted)]' : 'text-[var(--text-muted)]'}`}>{count === -1 ? '—' : count}</span>
                  <span className="text-[10px] text-[var(--text-muted)]">{name.replace(/_/g, ' ')}</span>
                </div>
              ))}
              <div className="w-px h-4 bg-[var(--border-subtle)]" />
              {[
                { label: 'No Agent', val: health.dataGaps.missing_agent },
                { label: 'No Household', val: health.dataGaps.missing_household },
                { label: 'No Accounts', val: health.dataGaps.no_accounts },
              ].map(g => (
                <div key={g.label} className="flex items-center gap-1">
                  <span className={`text-xs font-bold ${g.val === -1 ? 'text-[var(--text-muted)]' : g.val > 0 ? 'text-red-400' : 'text-emerald-400'}`}>{g.val === -1 ? '—' : g.val}</span>
                  <span className="text-[10px] text-[var(--text-muted)]">{g.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <hr className="border-[var(--border-subtle)]" />

      {/* ─── TRK-508/517: Collection Picker + Actions ─── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">Collection</label>
            <select value={selectedCollection} onChange={e => setSelectedCollection(e.target.value)}
              className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm font-mono font-medium text-[var(--text-primary)] focus:border-[var(--portal)] focus:outline-none">
              {collections.map(c => <option key={c.name} value={c.name}>{c.name} ({c.count})</option>)}
            </select>
            {/* TRK-508: Wiring badge */}
            {wiring && (
              <div className="flex items-center gap-1.5">
                <span className="inline-block w-2 h-2 rounded-full" style={{ background: wiring.color }} />
                <span className="text-[11px] font-medium" style={{ color: wiring.color }}>{wiring.label}</span>
              </div>
            )}
            {activeColl && (
              <span className="text-xs font-semibold px-2.5 py-1 rounded-lg" style={{ color: 'var(--portal)', background: 'color-mix(in srgb, var(--portal) 15%, transparent)' }}>
                {activeColl.count} {activeColl.count === 1 ? 'document' : 'documents'}
              </span>
            )}
          </div>
          {/* TRK-517: Button reorder — Add Collection | Add Document | Refresh (green) */}
          <div className="flex gap-2">
            <button onClick={() => setShowAddCollection(!showAddCollection)} className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-amber-400 border border-amber-400/30 hover:bg-amber-400/5 transition-colors">
              <span className="material-icons-outlined" style={{ fontSize: '14px' }}>create_new_folder</span>Add Collection
            </button>
            <button onClick={() => setShowAddDoc(!showAddDoc)} className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium border transition-colors" style={{ color: 'var(--portal)', borderColor: 'color-mix(in srgb, var(--portal) 30%, transparent)' }}>
              <span className="material-icons-outlined" style={{ fontSize: '14px' }}>note_add</span>Add Document
            </button>
            <button onClick={loadData} className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-emerald-400 border border-emerald-400/30 hover:bg-emerald-400/5 transition-colors">
              <span className="material-icons-outlined" style={{ fontSize: '14px' }}>refresh</span>Refresh
            </button>
          </div>
        </div>

        {/* TRK-508: Wiring description */}
        {wiring && (
          <p className="text-[11px] text-[var(--text-muted)]" style={{ marginTop: '-8px' }}>
            <span style={{ color: wiring.color }}>{wiring.label}:</span> {wiring.desc}
            {activeColl?.wiring?.backend && <span className="ml-2 font-mono text-[10px]">Backend: {activeColl.wiring.backend}</span>}
            {activeColl?.wiring?.frontend && <span className="ml-2 font-mono text-[10px]">Frontend: {activeColl.wiring.frontend}</span>}
          </p>
        )}

        {/* Add Collection inline */}
        {showAddCollection && (
          <div className="flex items-center gap-2 rounded-xl border border-dashed border-amber-400 bg-[var(--bg-card)] p-3">
            <span className="material-icons-outlined text-amber-400" style={{ fontSize: '16px' }}>create_new_folder</span>
            <input type="text" value={newCollectionName} onChange={e => setNewCollectionName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddCollection()} placeholder="collection_name (snake_case)" autoFocus
              className="flex-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-1.5 text-sm font-mono text-[var(--text-primary)] focus:border-[var(--portal)] outline-none" />
            <button onClick={handleAddCollection} disabled={!newCollectionName.trim()} className="rounded-lg px-3 py-1.5 text-xs font-medium text-amber-400 border border-amber-400/30 bg-amber-400/10 disabled:opacity-50">Create</button>
            <button onClick={() => { setShowAddCollection(false); setNewCollectionName('') }} className="text-[var(--text-muted)]"><span className="material-icons-outlined" style={{ fontSize: '16px' }}>close</span></button>
            <span className="text-[10px] text-amber-400/60">New collections need code to be wired up</span>
          </div>
        )}

        {/* Add Document inline */}
        {showAddDoc && (
          <div className="flex items-center gap-2 rounded-xl border border-dashed bg-[var(--bg-card)] p-3" style={{ borderColor: 'var(--portal)' }}>
            <span className="material-icons-outlined" style={{ fontSize: '16px', color: 'var(--portal)' }}>note_add</span>
            <span className="text-xs text-[var(--text-muted)]">New doc in <strong className="font-mono" style={{ color: 'var(--portal)' }}>{selectedCollection}</strong>:</span>
            <input type="text" value={newDocId} onChange={e => setNewDocId(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddDocument()} placeholder="document_id" autoFocus
              className="flex-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-1.5 text-sm font-mono text-[var(--text-primary)] focus:border-[var(--portal)] outline-none" />
            <button onClick={handleAddDocument} disabled={!newDocId.trim()} className="rounded-lg px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50" style={{ background: 'var(--portal)' }}>Create</button>
            <button onClick={() => { setShowAddDoc(false); setNewDocId('') }} className="text-[var(--text-muted)]"><span className="material-icons-outlined" style={{ fontSize: '16px' }}>close</span></button>
          </div>
        )}

        {/* TRK-509: Delete Collection */}
        {!showDeleteCollection && activeColl && (
          <button onClick={() => setShowDeleteCollection(true)} className="text-[10px] text-[var(--text-muted)] hover:text-red-400 transition-colors">
            Delete this collection...
          </button>
        )}
        {showDeleteCollection && (
          <div className="flex items-center gap-2 rounded-xl border border-red-400/30 bg-red-400/5 p-3">
            <span className="material-icons-outlined text-red-400" style={{ fontSize: '16px' }}>warning</span>
            <span className="text-xs text-red-400">Type <strong className="font-mono">{selectedCollection}</strong> to confirm deletion:</span>
            <input type="text" value={deleteConfirmText} onChange={e => setDeleteConfirmText(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleDeleteCollection()} autoFocus
              className="flex-1 rounded-lg border border-red-400/30 bg-[var(--bg-surface)] px-3 py-1.5 text-sm font-mono text-red-400 outline-none" />
            <button onClick={handleDeleteCollection} disabled={deleteConfirmText !== selectedCollection} className="rounded-lg px-3 py-1.5 text-xs font-medium text-white bg-red-500 disabled:opacity-30">Delete All</button>
            <button onClick={() => { setShowDeleteCollection(false); setDeleteConfirmText('') }} className="text-[var(--text-muted)]"><span className="material-icons-outlined" style={{ fontSize: '16px' }}>close</span></button>
          </div>
        )}

        {/* Document list */}
        {activeColl && activeColl.docs.length > 0 ? (
          <div className="space-y-3">
            {activeColl.docs.map(d => <DocumentCard key={d.id} doc={d} collectionName={activeColl.name} onSave={handleSave} onDelete={handleDeleteDoc} />)}
          </div>
        ) : (
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-8 text-center">
            <span className="material-icons-outlined text-3xl text-[var(--text-muted)]">folder_open</span>
            <p className="mt-2 text-sm text-[var(--text-muted)]">No documents yet. Click &lsquo;Add Document&rsquo; to create the first one.</p>
          </div>
        )}
      </div>
    </div>
  )
}
