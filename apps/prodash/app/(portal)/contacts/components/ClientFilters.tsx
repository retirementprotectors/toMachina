'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'

interface ClientFiltersProps {
  search: string
  onSearchChange: (value: string) => void
  statusFilter: string
  onStatusChange: (value: string) => void
  bookFilter: string
  onBookChange: (value: string) => void
  agentFilter: string
  onAgentChange: (value: string) => void
  acfFilter: string
  onAcfChange: (value: string) => void
  totalCount: number
  books: string[]
  agents: string[]
  /** Slot for the column selector button, rendered between filters and count pill */
  columnSelector?: ReactNode
}

const STATUS_OPTIONS = [
  'All',
  'Active',
  'Active - Affiliate (OK to Market)',
  'Active - Affiliate (Do Not Market)',
  'Prospect',
  'Inactive',
  'Inactive - Fired',
  'Inactive - Deceased',
  'Inactive - Complaint',
  'Unknown',
]
const ACF_OPTIONS = ['All', 'Has ACF', 'No ACF']

export function ClientFilters({
  search,
  onSearchChange,
  statusFilter,
  onStatusChange,
  bookFilter,
  onBookChange,
  agentFilter,
  onAgentChange,
  acfFilter,
  onAcfChange,
  totalCount,
  books,
  agents,
  columnSelector,
}: ClientFiltersProps) {
  const [localSearch, setLocalSearch] = useState(search)
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
    bookFilter !== 'All' ||
    agentFilter !== 'All' ||
    acfFilter !== 'All'

  const handleReset = useCallback(() => {
    onStatusChange('All')
    onBookChange('All')
    onAgentChange('All')
    onAcfChange('All')
    handleSearchInput('')
  }, [onStatusChange, onBookChange, onAgentChange, onAcfChange, handleSearchInput])

  // Style for active vs inactive filter dropdown
  const filterSelectClass = (isActive: boolean) =>
    `h-[34px] rounded-md border px-3 text-sm font-medium outline-none transition-all cursor-pointer ${
      isActive
        ? 'border-[var(--portal)] bg-[var(--portal)] text-white'
        : 'border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:border-[var(--portal)] hover:text-[var(--portal)]'
    } focus:border-[var(--portal)]`

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Search */}
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
            className="h-[34px] w-56 rounded-md border border-[var(--border)] bg-[var(--bg-surface)] px-3 pl-9 text-sm font-medium text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none transition-colors focus:border-[var(--portal)]"
          />
        </div>

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
            className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] h-[34px] px-3 text-xs font-medium text-[var(--text-muted)] transition-colors hover:border-[var(--portal)] hover:text-[var(--portal)]"
          >
            <span className="material-icons-outlined text-[14px]">filter_alt_off</span>
            Reset
          </button>
        )}

        {/* Column Selector */}
        {columnSelector}

        {/* Right-side: count pill + New Contact */}
        <div className="ml-auto flex items-center gap-2">
          <span
            className="inline-flex items-center rounded-md border border-[var(--border)] bg-[var(--bg-surface)] h-[34px] px-3 text-sm font-medium text-[var(--portal)]"
          >
            {totalCount.toLocaleString()}
          </span>

          <a
            href="/intake"
            className="inline-flex items-center gap-1.5 rounded-md border border-[var(--portal)] bg-[var(--portal)] h-[34px] px-3 text-sm font-medium text-white transition-colors hover:opacity-90"
            title="New Contact"
          >
            <span className="material-icons-outlined text-[18px]">add</span>
            New
          </a>
        </div>
    </div>
  )
}
