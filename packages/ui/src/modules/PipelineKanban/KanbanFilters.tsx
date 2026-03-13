'use client'

import { useState, useMemo, useCallback } from 'react'

/* ─── Types ─── */

export interface PipelineFilters {
  assigned_to?: string
  priority?: string
  search?: string
}

export interface KanbanFiltersProps {
  onFilterChange: (filters: PipelineFilters) => void
  assignees: string[]
}

/* ─── Component ─── */

export function KanbanFilters({ onFilterChange, assignees }: KanbanFiltersProps) {
  const [search, setSearch] = useState('')
  const [assignedTo, setAssignedTo] = useState('')
  const [priority, setPriority] = useState('')

  // Count active filters
  const activeCount = useMemo(() => {
    let count = 0
    if (search) count++
    if (assignedTo) count++
    if (priority) count++
    return count
  }, [search, assignedTo, priority])

  const emitChange = useCallback(
    (overrides: Partial<PipelineFilters>) => {
      const next: PipelineFilters = {
        search: overrides.search !== undefined ? overrides.search : search,
        assigned_to: overrides.assigned_to !== undefined ? overrides.assigned_to : assignedTo,
        priority: overrides.priority !== undefined ? overrides.priority : priority,
      }
      // Strip empty strings to undefined
      if (!next.search) next.search = undefined
      if (!next.assigned_to) next.assigned_to = undefined
      if (!next.priority) next.priority = undefined
      onFilterChange(next)
    },
    [search, assignedTo, priority, onFilterChange]
  )

  const handleSearchChange = useCallback(
    (val: string) => {
      setSearch(val)
      emitChange({ search: val })
    },
    [emitChange]
  )

  const handleAssignedChange = useCallback(
    (val: string) => {
      setAssignedTo(val)
      emitChange({ assigned_to: val })
    },
    [emitChange]
  )

  const handlePriorityChange = useCallback(
    (val: string) => {
      setPriority(val)
      emitChange({ priority: val })
    },
    [emitChange]
  )

  const handleClearAll = useCallback(() => {
    setSearch('')
    setAssignedTo('')
    setPriority('')
    onFilterChange({})
  }, [onFilterChange])

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Search */}
      <div className="relative">
        <span
          className="material-icons-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
          style={{ fontSize: '16px' }}
        >
          search
        </span>
        <input
          type="text"
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="Search by name..."
          className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] py-1.5 pl-8 pr-3 text-xs text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--portal)]"
        />
      </div>

      {/* Assigned To */}
      <select
        value={assignedTo}
        onChange={(e) => handleAssignedChange(e.target.value)}
        className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--portal)]"
      >
        <option value="">All Assignees</option>
        {assignees.map((a) => (
          <option key={a} value={a}>
            {a}
          </option>
        ))}
      </select>

      {/* Priority */}
      <select
        value={priority}
        onChange={(e) => handlePriorityChange(e.target.value)}
        className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--portal)]"
      >
        <option value="">All Priorities</option>
        <option value="HIGH">High</option>
        <option value="MEDIUM">Medium</option>
        <option value="LOW">Low</option>
      </select>

      {/* Active filter count + clear */}
      {activeCount > 0 && (
        <button
          onClick={handleClearAll}
          className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]"
        >
          <span
            className="flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold text-white"
            style={{ background: 'var(--portal)' }}
          >
            {activeCount}
          </span>
          Clear
        </button>
      )}
    </div>
  )
}
