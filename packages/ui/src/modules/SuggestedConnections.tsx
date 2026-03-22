'use client'

import { useState, useCallback } from 'react'

// ---------------------------------------------------------------------------
// TRK-585: Shared SuggestedConnections component
// TRK-586: Multi-select bulk actions
// ---------------------------------------------------------------------------

export interface SuggestionItem {
  id: string
  name: string
  reason: string
  confidence: number
  phone?: string
  email?: string
}

interface SuggestedConnectionsProps {
  suggestions: SuggestionItem[]
  onAction: (item: SuggestionItem) => void | Promise<void>
  actionLabel: string
  actionIcon?: string
  title?: string
}

export function SuggestedConnections({
  suggestions,
  onAction,
  actionLabel,
  actionIcon = 'link',
  title,
}: SuggestedConnectionsProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkRunning, setBulkRunning] = useState(false)
  const [bulkProgress, setBulkProgress] = useState('')

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  // TRK-586: Sequential bulk action (NOT Promise.all — arrayUnion race conditions)
  const handleBulkAction = useCallback(async () => {
    const selected = suggestions.filter((s) => selectedIds.has(s.id))
    if (selected.length === 0) return

    setBulkRunning(true)
    let completed = 0
    for (const item of selected) {
      try {
        await onAction(item)
        completed++
        setBulkProgress(`${completed} of ${selected.length}`)
      } catch {
        // Continue on failure
      }
    }
    setBulkRunning(false)
    setBulkProgress('')
    setSelectedIds(new Set())
  }, [suggestions, selectedIds, onAction])

  if (suggestions.length === 0) return null

  const selectedCount = selectedIds.size

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="material-icons-outlined text-[18px] text-amber-400">lightbulb</span>
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">
          {title || `Suggested (${suggestions.length})`}
        </h3>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {suggestions.map((match) => {
          const isSelected = selectedIds.has(match.id)
          return (
            <div
              key={match.id}
              className={`flex flex-col gap-2 rounded-lg border p-4 transition-colors ${
                isSelected
                  ? 'border-[var(--portal)] bg-[var(--portal)]/5'
                  : 'border-[var(--border-subtle)] bg-[var(--bg-surface)]'
              }`}
            >
              <div className="flex items-center gap-2">
                {/* TRK-586: Checkbox for multi-select */}
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleSelect(match.id)}
                  disabled={bulkRunning}
                  className="h-3.5 w-3.5 shrink-0 rounded border-[var(--border)] accent-[var(--portal)]"
                />
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--portal-glow)] text-xs font-bold text-[var(--portal)]">
                  {match.name.split(' ').map((w) => w.charAt(0)).join('').slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[var(--text-primary)]">{match.name}</p>
                  <p className="text-[10px] text-amber-400 font-medium">{match.reason}</p>
                </div>
              </div>
              {match.phone && (
                <p className="text-xs text-[var(--text-muted)]">{match.phone}</p>
              )}
              <button
                onClick={() => onAction(match)}
                disabled={bulkRunning}
                className="mt-auto inline-flex items-center justify-center gap-1 rounded-md border border-[var(--portal)] h-[30px] px-3 text-xs font-medium text-[var(--portal)] transition-colors hover:bg-[var(--portal)] hover:text-white disabled:opacity-40"
              >
                <span className="material-icons-outlined text-[12px]">{actionIcon}</span>
                {actionLabel}
              </button>
            </div>
          )
        })}
      </div>

      {/* TRK-586: Floating bulk action bar */}
      {selectedCount > 0 && (
        <div className="sticky bottom-0 flex items-center justify-between rounded-lg border border-[var(--portal)] bg-[var(--bg-card)] px-4 py-2.5 shadow-lg">
          <span className="text-sm text-[var(--text-secondary)]">
            {bulkRunning ? bulkProgress : `${selectedCount} selected`}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedIds(new Set())}
              disabled={bulkRunning}
              className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            >
              Clear
            </button>
            <button
              onClick={handleBulkAction}
              disabled={bulkRunning}
              className="inline-flex items-center gap-1.5 rounded-md h-[34px] px-4 text-xs font-medium bg-[var(--portal)] text-white transition-colors hover:brightness-110 disabled:opacity-60"
            >
              <span className="material-icons-outlined text-[14px]">{actionIcon}</span>
              {bulkRunning ? `${bulkProgress}...` : `${actionLabel} All (${selectedCount})`}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
