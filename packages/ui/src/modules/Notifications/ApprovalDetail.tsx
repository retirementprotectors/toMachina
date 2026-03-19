'use client'

import { useState } from 'react'
import { fetchWithAuth } from '../fetchWithAuth'

/* ─── Types ─── */

interface ApprovalItem {
  approval_id: string
  display_label: string
  display_category: string
  current_value: string
  proposed_value: string
  confidence: number
  status: string
}

interface ApprovalBatchDoc {
  _id: string
  batch_id: string
  source_type: string
  entity_name: string
  status: string
  items: ApprovalItem[]
  created_at: string
}

interface ApprovalDetailProps {
  batch: ApprovalBatchDoc
  onBack: () => void
  onExecuted: () => void
}

/* ─── Confidence Badge ─── */

function ConfidenceBadge({ value }: { value: number }) {
  const pct = Math.round(value * 100)
  let color = 'var(--text-muted)'
  if (pct >= 90) color = '#22c55e'
  else if (pct >= 70) color = '#f59e0b'
  else color = '#ef4444'

  return (
    <span className="text-[10px] font-semibold" style={{ color }}>
      {pct}%
    </span>
  )
}

/* ─── Component ─── */

export function ApprovalDetail({ batch, onBack, onExecuted }: ApprovalDetailProps) {
  const [edits, setEdits] = useState<Record<string, string>>({})
  const [executing, setExecuting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const items = batch.items || []

  const updateField = (approvalId: string, value: string) => {
    setEdits((prev) => ({ ...prev, [approvalId]: value }))
  }

  const handleExecute = async () => {
    setExecuting(true)
    setError(null)
    try {
      const res = await fetchWithAuth(`/api/approval/batches/${batch._id || batch.batch_id}/execute`, {
        method: 'POST',
        body: JSON.stringify({ edits }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({ error: 'Execute failed' }))
        throw new Error(json.error || `HTTP ${res.status}`)
      }
      onExecuted()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setError(message)
    } finally {
      setExecuting(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-[var(--border-subtle)] px-4 py-3">
        <button
          onClick={onBack}
          className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
          title="Back to list"
        >
          <span className="material-icons-outlined" style={{ fontSize: '18px' }}>arrow_back</span>
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[var(--text-primary)]">{batch.entity_name}</p>
          <p className="text-[10px] text-[var(--text-muted)]">
            {batch.source_type} &middot; {items.length} field{items.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Fields */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {items.map((item) => {
          const editedValue = edits[item.approval_id] ?? item.proposed_value
          return (
            <div
              key={item.approval_id}
              className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2.5"
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                  {item.display_category}
                </span>
                <ConfidenceBadge value={item.confidence} />
              </div>
              <p className="text-xs font-medium text-[var(--text-secondary)] mb-1">
                {item.display_label}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[9px] text-[var(--text-muted)]">Current</span>
                  <p className="text-xs text-[var(--text-secondary)] truncate">
                    {item.current_value || '(empty)'}
                  </p>
                </div>
                <div>
                  <span className="text-[9px] text-[var(--text-muted)]">Proposed</span>
                  <input
                    type="text"
                    value={editedValue}
                    onChange={(e) => updateField(item.approval_id, e.target.value)}
                    className="w-full rounded border border-[var(--border-subtle)] bg-[var(--bg-card)] px-2 py-1 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--portal)]"
                  />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Actions */}
      <div className="border-t border-[var(--border-subtle)] px-4 py-3 space-y-2">
        {error && (
          <p className="text-xs text-red-400">{error}</p>
        )}
        <div className="flex gap-2">
          <button
            onClick={handleExecute}
            disabled={executing}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-md h-[34px] text-xs font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50"
            style={{ background: 'var(--portal)' }}
          >
            {executing ? 'Executing...' : 'Approve & Execute'}
          </button>
          <button
            onClick={onBack}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-md h-[34px] border border-[var(--border-subtle)] text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)]"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

export type { ApprovalBatchDoc, ApprovalItem }
