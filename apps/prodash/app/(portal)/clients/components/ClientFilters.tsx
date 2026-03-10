'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

interface ClientFiltersProps {
  search: string
  onSearchChange: (value: string) => void
  statusFilter: string
  onStatusChange: (value: string) => void
  accountTypeFilter: string
  onAccountTypeChange: (value: string) => void
  totalCount: number
}

const STATUS_OPTIONS = ['All', 'Active', 'Prospect', 'Inactive', 'Deceased']
const ACCOUNT_TYPE_OPTIONS = ['All', 'Annuity', 'Life', 'Medicare', 'BD/RIA']

export function ClientFilters({
  search,
  onSearchChange,
  statusFilter,
  onStatusChange,
  accountTypeFilter,
  onAccountTypeChange,
  totalCount,
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

  // Sync external search changes
  useEffect(() => {
    setLocalSearch(search)
  }, [search])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Clients</h1>
        <span
          className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
          style={{
            backgroundColor: 'rgba(61, 138, 143, 0.15)',
            color: 'var(--portal)',
          }}
        >
          {totalCount.toLocaleString()}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-3">
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
            placeholder="Search clients..."
            value={localSearch}
            onChange={(e) => handleSearchInput(e.target.value)}
            className="h-9 w-64 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] pl-9 pr-3 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none transition-colors focus:border-[var(--portal)]"
          />
        </div>

        {/* Status filter */}
        <select
          value={statusFilter}
          onChange={(e) => onStatusChange(e.target.value)}
          className="h-9 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 text-sm text-[var(--text-secondary)] outline-none transition-colors focus:border-[var(--portal)]"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>
              {opt === 'All' ? 'All Statuses' : opt}
            </option>
          ))}
        </select>

        {/* Account type filter */}
        <select
          value={accountTypeFilter}
          onChange={(e) => onAccountTypeChange(e.target.value)}
          className="h-9 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 text-sm text-[var(--text-secondary)] outline-none transition-colors focus:border-[var(--portal)]"
        >
          {ACCOUNT_TYPE_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>
              {opt === 'All' ? 'All Account Types' : opt}
            </option>
          ))}
        </select>

        {/* Add Client (placeholder) */}
        <button
          disabled
          className="h-9 rounded-lg px-4 text-sm font-medium text-white opacity-50 cursor-not-allowed"
          style={{ backgroundColor: 'var(--portal)' }}
          title="Coming soon"
        >
          + Add Client
        </button>
      </div>
    </div>
  )
}
