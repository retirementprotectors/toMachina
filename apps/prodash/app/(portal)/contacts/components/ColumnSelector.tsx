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
// Component
// ---------------------------------------------------------------------------

interface ColumnSelectorProps {
  visibleColumns: Set<string>
  onChange: (columns: Set<string>) => void
  /** Ordered column keys — enables drag-to-reorder when provided */
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

  const orderedKeys = columnOrder || DEFAULT_ORDER
  const orderedColumns = orderedKeys
    .map((key) => ALL_COLUMNS.find((c) => c.key === key))
    .filter((c): c is ColumnDef => !!c)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open])

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
          className="absolute right-0 top-full z-50 mt-1.5 w-56 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] shadow-lg"
          style={{ boxShadow: 'var(--shadow-dropdown, 0 4px 24px rgba(0,0,0,.12))' }}
        >
          {/* Header */}
          <div className="border-b border-[var(--border)] px-3 py-2">
            <p className="text-xs font-semibold uppercase text-[var(--text-muted)]">
              Toggle Columns
            </p>
          </div>

          {/* Column checkboxes with optional drag handles */}
          <div className="max-h-64 overflow-y-auto py-1">
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

          {/* Reset link */}
          {!isDefault && (
            <div className="border-t border-[var(--border)] px-3 py-2">
              <button
                onClick={handleReset}
                className="text-xs text-[var(--portal)] transition-colors hover:underline"
              >
                Reset to Default
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
