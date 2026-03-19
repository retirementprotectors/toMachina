'use client'

import { useState, useMemo } from 'react'
import { query, where, orderBy } from 'firebase/firestore'
import { useCollection } from '@tomachina/db'
import { collections } from '@tomachina/db/src/firestore'
import { ApprovalDetail } from '../ApprovalDetail'
import type { ApprovalBatchDoc } from '../ApprovalDetail'

/* ─── Component ─── */

export function ApprovalsTab() {
  const [selectedBatch, setSelectedBatch] = useState<ApprovalBatchDoc | null>(null)

  const batchesQuery = useMemo(() => {
    return query(
      collections.approvalBatches(),
      where('status', 'in', ['PENDING', 'IN_REVIEW']),
      orderBy('created_at', 'desc')
    )
  }, [])

  const { data: batches, loading } = useCollection<ApprovalBatchDoc>(batchesQuery, 'approval-batches')

  if (selectedBatch) {
    return (
      <ApprovalDetail
        batch={selectedBatch}
        onBack={() => setSelectedBatch(null)}
        onExecuted={() => setSelectedBatch(null)}
      />
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <span className="text-xs text-[var(--text-muted)]">Loading approvals...</span>
      </div>
    )
  }

  if (batches.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <span className="material-icons-outlined text-[var(--text-muted)]" style={{ fontSize: '32px' }}>
          verified
        </span>
        <p className="mt-2 text-xs text-[var(--text-muted)]">No pending approvals</p>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto px-2 py-1">
        <div className="space-y-1">
          {batches.map((batch) => {
            const itemCount = batch.items?.length ?? 0
            return (
              <button
                key={batch._id || batch.batch_id}
                onClick={() => setSelectedBatch(batch)}
                className="flex w-full items-start gap-2.5 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-[var(--bg-hover)]"
              >
                <span className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-[var(--bg-surface)]">
                  <span className="material-icons-outlined text-[var(--text-muted)]" style={{ fontSize: '14px' }}>
                    shield
                  </span>
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-[var(--text-primary)]">
                      {batch.entity_name || 'Unknown'}
                    </span>
                    <span className="flex-shrink-0 rounded bg-[var(--portal-glow)] px-1.5 py-0.5 text-[10px] font-medium" style={{ color: 'var(--portal)' }}>
                      {batch.status}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                    {batch.source_type} &middot; {itemCount} field{itemCount !== 1 ? 's' : ''}
                  </p>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
