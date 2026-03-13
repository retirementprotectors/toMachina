'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

interface ClientFiltersProps {
  search: string
  onSearchChange: (value: string) => void
  statusFilter: string
  onStatusChange: (value: string) => void
  accountTypeFilter: string
  onAccountTypeChange: (value: string) => void
  bookFilter: string
  onBookChange: (value: string) => void
  agentFilter: string
  onAgentChange: (value: string) => void
  acfFilter: string
  onAcfChange: (value: string) => void
  totalCount: number
  books: string[]
  agents: string[]
}

const STATUS_OPTIONS = ['All', 'Active', 'Prospect', 'Inactive', 'Deceased']
const ACF_OPTIONS = ['All', 'Has ACF', 'No ACF']

export function ClientFilters({
  search,
  onSearchChange,
  statusFilter,
  onStatusChange,
  accountTypeFilter,
  onAccountTypeChange,
  bookFilter,
  onBookChange,
  agentFilter,
  onAgentChange,
  acfFilter,
  onAcfChange,
  totalCount,
  books,
  agents,
}: ClientFiltersProps) {
  const [localSearch, setLocalSearch] = useState(search)
  const [showColumnPicker, setShowColumnPicker] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleSearchInput = useCallback(
    (value: string) => {
      setLocalSearch(value)
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        onSearchChange(value)
      }, 300)
    },
    [onSearchChange]
  )

  useEffect(() => {
    setLocalSearch(search)
  }, [search])

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  const hasActiveFilters =
    statusFilter !== 'All' ||
    accountTypeFilter !== 'All' ||
    bookFilter !== 'All' ||
    agentFilter !== 'All' ||
    acfFilter !== 'All'

  const handleReset = useCallback(() => {
    onStatusChange('All')
    onAccountTypeChange('All')
    onBookChange('All')
    onAgentChange('All')
    onAcfChange('All')
    handleSearchInput('')
  }, [onStatusChange, onAccountTypeChange, onBookChange, onAgentChange, onAcfChange, handleSearchInput])

  /* PL3-9: All pills rounded-md h-[34px] */
  const filterSelectClass = (isActive: boolean) =>
    `h-[34px] rounded-md border px-3 text-sm outline-none transition-all cursor-pointer ${
      isActive
        ? 'border-[var(--portal)] bg-[var(--portal)]/10 text-[var(--portal)] font-medium'
        : 'border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-secondary)]'
    } focus:border-[var(--portal)]`

  return (
    <div className="space-y-3">
      {/* Row 1: Action Buttons + Search */}
      {/* PL3-8: Removed "Clients" title that announces itself */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          {/* PL1-12/13: + New Contact — just a big + icon, rectangular sharp button */}
          {/* DF-23: New Client button */}
          <button
            className="inline-flex h-[34px] w-[34px] items-center justify-center rounded-md text-white transition-all hover:brightness-110"
            style={{ background: 'var(--portal)' }}
            title="New Contact"
            onClick={() => window.location.href = '/intake'}
          >
            <span className="material-icons-outlined" style={{ fontSize: '20px' }}>add</span>
          </button>

          {/* PL1-15: Columns button — same style */}
          {/* DF-7: Column Selector */}
          <button
            onClick={() => setShowColumnPicker(!showColumnPicker)}
            className={`inline-flex h-[34px] items-center gap-1.5 rounded-md border px-3 text-sm font-medium transition-all ${
              showColumnPicker
                ? 'border-[var(--portal)] text-[var(--portal)]'
                : 'border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--portal)] hover:text-[var(--portal)]'
            }`}
          >
            <span className="material-icons-outlined text-[16px]">view_column</span>
            Columns
          </button>

          {/* PL1-14: Count below the + button */}
          <span
            className="inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-medium"
            style={{
              backgroundColor: 'var(--portal-glow)',
              color: 'var(--portal)',
            }}
          >
            {totalCount.toLocaleString()}
          </span>
        </div>

        <div className="relative">
          <svg
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            placeholder="Search contacts..."
            value={localSearch}
            onChange={(e) => handleSearchInput(e.target.value)}
            className="h-[34px] w-72 rounded-md border border-[var(--border)] bg-[var(--bg-surface)] pl-9 pr-3 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none transition-colors focus:border-[var(--portal)]"
          />
        </div>
      </div>

      {/* Row 2: Filter dropdowns — DF-8: Removed "All Accounts" filter */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Status */}
        <select
          value={statusFilter}
          onChange={(e) => onStatusChange(e.target.value)}
          className={filterSelectClass(statusFilter !== 'All')}
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>
              {opt === 'All' ? 'All Statuses' : opt}
            </option>
          ))}
        </select>

        {/* Books */}
        <select
          value={bookFilter}
          onChange={(e) => onBookChange(e.target.value)}
          className={filterSelectClass(bookFilter !== 'All')}
        >
          <option value="All">All Books</option>
          {books.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>

        {/* Agents */}
        <select
          value={agentFilter}
          onChange={(e) => onAgentChange(e.target.value)}
          className={filterSelectClass(agentFilter !== 'All')}
        >
          <option value="All">All Agents</option>
          {agents.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>

        {/* ACF Status */}
        <select
          value={acfFilter}
          onChange={(e) => onAcfChange(e.target.value)}
          className={filterSelectClass(acfFilter !== 'All')}
        >
          {ACF_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>
              {opt === 'All' ? 'ACF Status' : opt}
            </option>
          ))}
        </select>

        {/* Reset Filters */}
        {hasActiveFilters && (
          <button
            onClick={handleReset}
            className="inline-flex h-[34px] items-center gap-1.5 rounded-md border border-[var(--border)] px-3 text-xs font-medium text-[var(--text-muted)] transition-colors hover:border-[var(--portal)] hover:text-[var(--portal)]"
          >
            <span className="material-icons-outlined text-[14px]">filter_alt_off</span>
            Reset Filters
          </button>
        )}
      </div>

      {/* Column Picker (DF-7) — placeholder toggle panel */}
      {showColumnPicker && (
        <div className="rounded-md border border-[var(--border)] bg-[var(--bg-card)] p-4">
          <p className="text-xs text-[var(--text-muted)]">
            Column configuration coming in Sprint 8. Currently showing default columns.
          </p>
        </div>
      )}
    </div>
  )
}
