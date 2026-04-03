'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

// ---------------------------------------------------------------------------
// Column definition types & config
// ---------------------------------------------------------------------------

export interface ColumnDef {
  key: string
  label: string
  defaultVisible: boolean
}

export const ALL_COLUMNS: ColumnDef[] = [
  { key: 'name', label: 'Contact', defaultVisible: true },
  { key: 'location', label: 'City/State', defaultVisible: true },
  { key: 'phone', label: 'Phone', defaultVisible: true },
  { key: 'email', label: 'Email', defaultVisible: true },
  { key: 'agent', label: 'Agent', defaultVisible: true },
  { key: 'status', label: 'Status', defaultVisible: true },
  { key: 'household', label: 'Household', defaultVisible: true },
  { key: 'accounts', label: 'Accounts', defaultVisible: false },
  { key: 'last_activity', label: 'Last Activity', defaultVisible: true },
  { key: 'age', label: 'Age', defaultVisible: false },
  { key: 'dob', label: 'Date of Birth', defaultVisible: false },
  { key: 'ssn', label: 'SSN (Last 4)', defaultVisible: false },
  { key: 'gender', label: 'Gender', defaultVisible: false },
  { key: 'marital', label: 'Marital Status', defaultVisible: false },
  { key: 'timezone', label: 'Time Zone', defaultVisible: false },
  { key: 'employment', label: 'Employment', defaultVisible: false },
]

/** The 'name' column is always visible and cannot be toggled */
const LOCKED_COLUMN = 'name'

const DEFAULT_ORDER = ALL_COLUMNS.map((c) => c.key)

export function getDefaultVisibleColumns(): Set<string> {
  return new Set(ALL_COLUMNS.filter((c) => c.defaultVisible).map((c) => c.key))
}

export function getDefaultColumnOrder(): string[] {
  return [...DEFAULT_ORDER]
}

// ---------------------------------------------------------------------------
// CCX-011: Preset views
// ---------------------------------------------------------------------------

export const PRESET_VIEWS: Record<string, { label: string; columns: string[] }> = {
  sales: {
    label: 'Sales View',
    columns: ['name', 'phone', 'agent', 'status', 'accounts'],
  },
  service: {
    label: 'Service View',
    columns: ['name', 'email', 'phone', 'status', 'household'],
  },
  full: {
    label: 'Full View',
    columns: [], // empty = all columns
  },
}

const SAVED_VIEWS_KEY = 'rpi-saved-views-contacts'

interface SavedView {
  label: string
  columns: string[]
  order: string[]
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface ColumnSelectorProps {
  visibleColumns: Set<string>
  onChange: (columns: Set<string>) => void
  /** Ordered column keys -- enables drag-to-reorder when provided */
  columnOrder?: string[]
  onOrderChange?: (order: string[]) => void
  /** localStorage key prefix for persisting order */
  storageKey?: string
}

export function ColumnSelector({ visibleColumns, onChange, columnOrder, onOrderChange, storageKey = 'default' }: ColumnSelectorProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [overIdx, setOverIdx] = useState<number | null>(null)
  const [savedViews, setSavedViews] = useState<Record<string, SavedView>>({})
  const [saveViewName, setSaveViewName] = useState('')
  const [showSaveInput, setShowSaveInput] = useState(false)

  const orderedKeys = columnOrder || DEFAULT_ORDER
  const orderedColumns = orderedKeys
    .map((key) => ALL_COLUMNS.find((c) => c.key === key))
    .filter((c): c is ColumnDef => !!c)

  // Load saved views from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SAVED_VIEWS_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, SavedView>
        setSavedViews(parsed)
      }
    } catch { /* */ }
  }, [])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setShowSaveInput(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { setOpen(false); setShowSaveInput(false) }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open])

  // Apply a preset or saved view
  const applyView = useCallback((columns: string[], order?: string[]) => {
    const allKeys = ALL_COLUMNS.map((c) => c.key)
    const cols = columns.length === 0 ? allKeys : columns
    onChange(new Set(cols))
    if (onOrderChange) {
      const viewOrder = cols.filter((k) => allKeys.includes(k))
      const remaining = allKeys.filter((k) => !viewOrder.includes(k))
      const newOrder = order ?? [...viewOrder, ...remaining]
      onOrderChange(newOrder)
      try { localStorage.setItem(`rpi-col-order-${storageKey}`, JSON.stringify(newOrder)) } catch { /* */ }
    }
  }, [onChange, onOrderChange, storageKey])

  const handleSaveView = useCallback(() => {
    const trimmed = saveViewName.trim()
    if (!trimmed) return
    const slug = trimmed.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    const view: SavedView = {
      label: trimmed,
      columns: Array.from(visibleColumns),
      order: orderedKeys,
    }
    const next = { ...savedViews, [slug]: view }
    setSavedViews(next)
    try { localStorage.setItem(SAVED_VIEWS_KEY, JSON.stringify(next)) } catch { /* */ }
    setSaveViewName('')
    setShowSaveInput(false)
  }, [saveViewName, visibleColumns, orderedKeys, savedViews])

  const handleDeleteSavedView = useCallback((slug: string) => {
    const next = { ...savedViews }
    delete next[slug]
    setSavedViews(next)
    try { localStorage.setItem(SAVED_VIEWS_KEY, JSON.stringify(next)) } catch { /* */ }
  }, [savedViews])

  const handleToggle = useCallback(
    (key: string) => {
      if (key === LOCKED_COLUMN) return
      const next = new Set(visibleColumns)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      onChange(next)
    },
    [visibleColumns, onChange]
  )

  const handleReset = useCallback(() => {
    onChange(getDefaultVisibleColumns())
    if (onOrderChange) {
      onOrderChange(getDefaultColumnOrder())
      try { localStorage.setItem(`rpi-col-order-${storageKey}`, JSON.stringify(getDefaultColumnOrder())) } catch { /* */ }
    }
  }, [onChange, onOrderChange, storageKey])

  const isDefault =
    visibleColumns.size === getDefaultVisibleColumns().size &&
    [...visibleColumns].every((k) => getDefaultVisibleColumns().has(k)) &&
    (!columnOrder || columnOrder.join(',') === DEFAULT_ORDER.join(','))

  const canReorder = !!onOrderChange

  // Drag handlers
  const handleDragStart = useCallback((idx: number) => setDragIdx(idx), [])
  const handleDragOver = useCallback((e: React.DragEvent, idx: number) => { e.preventDefault(); setOverIdx(idx) }, [])
  const handleDrop = useCallback((targetIdx: number) => {
    if (dragIdx == null || dragIdx === targetIdx || !onOrderChange) { setDragIdx(null); setOverIdx(null); return }
    const newOrder = [...orderedKeys]
    const [moved] = newOrder.splice(dragIdx, 1)
    newOrder.splice(targetIdx, 0, moved)
    onOrderChange(newOrder)
    try { localStorage.setItem(`rpi-col-order-${storageKey}`, JSON.stringify(newOrder)) } catch { /* */ }
    setDragIdx(null); setOverIdx(null)
  }, [dragIdx, orderedKeys, onOrderChange, storageKey])
  const handleDragEnd = useCallback(() => { setDragIdx(null); setOverIdx(null) }, [])

  const activeCount = visibleColumns.size

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger button */}
      <button
        onClick={() => setOpen((o) => !o)}
        className={`inline-flex items-center gap-1.5 rounded-md border h-[34px] px-3 text-sm font-medium transition-colors ${
          open
            ? 'border-[var(--portal)] bg-[var(--portal)] text-white'
            : 'border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:border-[var(--portal)] hover:text-[var(--portal)]'
        }`}
        title="Select columns"
      >
        <span className="material-icons-outlined text-[18px]">view_column</span>
        <span className="hidden sm:inline">Columns</span>
        {!isDefault && (
          <span
            className="ml-0.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none text-white"
            style={{ backgroundColor: 'var(--portal)' }}
          >
            {activeCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className="absolute right-0 top-full z-50 mt-1.5 w-64 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] shadow-lg"
          style={{ boxShadow: 'var(--shadow-dropdown, 0 4px 24px rgba(0,0,0,.12))' }}
        >
          {/* CCX-011: View switcher */}
          <div className="border-b border-[var(--border)] px-3 py-2">
            <p className="mb-1.5 text-xs font-semibold uppercase text-[var(--text-muted)]">Views</p>
            <div className="flex flex-wrap gap-1">
              {Object.entries(PRESET_VIEWS).map(([key, view]) => (
                <button
                  key={key}
                  onClick={() => applyView(view.columns)}
                  className="rounded-md border border-[var(--border)] px-2 py-1 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:border-[var(--portal)] hover:text-[var(--portal)]"
                >
                  {view.label}
                </button>
              ))}
              {Object.entries(savedViews).map(([slug, view]) => (
                <div key={slug} className="group relative inline-flex">
                  <button
                    onClick={() => applyView(view.columns, view.order)}
                    className="rounded-md border border-[var(--portal)]/40 px-2 py-1 text-xs font-medium text-[var(--portal)] transition-colors hover:border-[var(--portal)] hover:bg-[var(--portal)]/5"
                  >
                    {view.label}
                  </button>
                  <button
                    onClick={() => handleDeleteSavedView(slug)}
                    className="absolute -right-1.5 -top-1.5 hidden h-4 w-4 items-center justify-center rounded-full bg-[var(--bg-surface)] text-[var(--text-muted)] transition-colors hover:text-[var(--error)] group-hover:flex"
                    title="Remove saved view"
                  >
                    <span className="material-icons-outlined text-[11px]">close</span>
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Toggle columns header */}
          <div className="border-b border-[var(--border)] px-3 py-2">
            <p className="text-xs font-semibold uppercase text-[var(--text-muted)]">
              Toggle Columns
            </p>
          </div>

          {/* Column checkboxes with optional drag handles */}
          <div className="max-h-52 overflow-y-auto py-1">
            {orderedColumns.map((col, idx) => {
              const isLocked = col.key === LOCKED_COLUMN
              const isChecked = visibleColumns.has(col.key)
              const isDragging = dragIdx === idx
              const isOver = overIdx === idx && dragIdx !== idx

              return (
                <div
                  key={col.key}
                  draggable={canReorder && !isLocked}
                  onDragStart={() => handleDragStart(idx)}
                  onDragOver={(e) => handleDragOver(e, idx)}
                  onDrop={() => handleDrop(idx)}
                  onDragEnd={handleDragEnd}
                  className={`flex items-center gap-1.5 px-2 py-1.5 text-sm transition-colors ${
                    isLocked ? 'cursor-not-allowed opacity-50'
                    : canReorder ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
                  } ${isDragging ? 'opacity-40' : ''} ${isOver ? 'border-t-2 border-[var(--portal)]' : ''} ${!isLocked && !isDragging ? 'hover:bg-[var(--bg-hover)]' : ''}`}
                >
                  {canReorder && (
                    <span className={`material-icons-outlined text-[14px] ${isLocked ? 'invisible' : 'text-[var(--text-muted)]'}`}>drag_indicator</span>
                  )}
                  <label className={`flex flex-1 items-center gap-2 ${isLocked ? '' : 'cursor-pointer'}`}>
                    <input
                      type="checkbox"
                      checked={isChecked}
                      disabled={isLocked}
                      onChange={() => handleToggle(col.key)}
                      className="h-3.5 w-3.5 rounded border-[var(--border)] accent-[var(--portal)]"
                    />
                    <span className={isChecked ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'}>{col.label}</span>
                  </label>
                  {isLocked && (
                    <span className="material-icons-outlined text-[14px] text-[var(--text-muted)]">lock</span>
                  )}
                </div>
              )
            })}
          </div>

          {/* Footer: Save Custom View + Reset */}
          <div className="space-y-2 border-t border-[var(--border)] px-3 py-2">
            {showSaveInput ? (
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={saveViewName}
                  onChange={(e) => setSaveViewName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSaveView(); if (e.key === 'Escape') setShowSaveInput(false) }}
                  placeholder="View name..."
                  autoFocus
                  className="flex-1 rounded border border-[var(--border)] bg-[var(--bg-surface)] px-2 py-1 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--portal)]"
                />
                <button
                  onClick={handleSaveView}
                  disabled={!saveViewName.trim()}
                  className="rounded bg-[var(--portal)] px-2 py-1 text-xs font-medium text-white transition-opacity disabled:opacity-40"
                >
                  Save
                </button>
                <button
                  onClick={() => { setShowSaveInput(false); setSaveViewName('') }}
                  className="text-xs text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowSaveInput(true)}
                className="flex items-center gap-1 text-xs text-[var(--portal)] transition-colors hover:underline"
              >
                <span className="material-icons-outlined text-[14px]">bookmark_add</span>
                Save Custom View
              </button>
            )}
            {!isDefault && (
              <button
                onClick={handleReset}
                className="text-xs text-[var(--text-muted)] transition-colors hover:text-[var(--portal)] hover:underline"
              >
                Reset to Default
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
