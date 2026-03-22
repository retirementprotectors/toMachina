'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { fetchValidated } from './fetchValidated'

// ---------------------------------------------------------------------------
// IntakeQueue — Admin view of the intake_queue Firestore collection
// Uses API proxy for reads and writes (no direct Firestore access)
// ---------------------------------------------------------------------------

type QueueStatus = 'QUEUED' | 'EXTRACTING' | 'REVIEWING' | 'APPROVED' | 'PARTIAL' | 'REJECTED' | 'WRITING' | 'COMPLETE' | 'ERROR' | 'SKIPPED'

interface QueueItem {
  id: string
  queue_id: string
  source: string
  file_id: string
  file_name: string
  file_type: string
  file_size?: number
  status: QueueStatus
  specialist_name?: string
  document_type?: string
  content_preview?: string
  created_at: string
  updated_at: string
  error_message?: string
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  QUEUED: { bg: 'rgba(245,158,11,0.15)', text: 'rgb(245,158,11)' },
  EXTRACTING: { bg: 'rgba(59,130,246,0.15)', text: 'rgb(59,130,246)' },
  REVIEWING: { bg: 'rgba(168,85,247,0.15)', text: 'rgb(168,85,247)' },
  APPROVED: { bg: 'rgba(34,197,94,0.15)', text: 'rgb(34,197,94)' },
  PARTIAL: { bg: 'rgba(234,179,8,0.15)', text: 'rgb(234,179,8)' },
  REJECTED: { bg: 'rgba(239,68,68,0.15)', text: 'rgb(239,68,68)' },
  WRITING: { bg: 'rgba(59,130,246,0.15)', text: 'rgb(59,130,246)' },
  COMPLETE: { bg: 'rgba(34,197,94,0.15)', text: 'rgb(34,197,94)' },
  ERROR: { bg: 'rgba(239,68,68,0.15)', text: 'rgb(239,68,68)' },
  SKIPPED: { bg: 'rgba(156,163,175,0.15)', text: 'rgb(156,163,175)' },
}

const FILTER_PILLS: { label: string; value: string }[] = [
  { label: 'All', value: 'ALL' },
  { label: 'Queued', value: 'QUEUED' },
  { label: 'Reviewing', value: 'REVIEWING' },
  { label: 'Approved', value: 'APPROVED' },
  { label: 'Rejected', value: 'REJECTED' },
  { label: 'Complete', value: 'COMPLETE' },
  { label: 'Error', value: 'ERROR' },
]

export function IntakeQueue() {
  const [activeFilter, setActiveFilter] = useState('ALL')
  const [selectedItem, setSelectedItem] = useState<QueueItem | null>(null)
  const [updating, setUpdating] = useState(false)
  const [items, setItems] = useState<QueueItem[]>([])
  const [loading, setLoading] = useState(true)

  // Fetch items from API on mount + 15s polling
  const fetchItems = useCallback(async () => {
    try {
      const res = await fetchValidated<QueueItem[]>('/api/intake-queue')
      if (res.success) {
                setItems(res.data || [])
      }
    } catch {
      // Silently fail — items remain stale
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchItems()
    const interval = setInterval(fetchItems, 15000)
    return () => clearInterval(interval)
  }, [fetchItems])

  // Filtered items
  const filtered = useMemo(() => {
    if (activeFilter === 'ALL') return items
    return items.filter((item) => item.status === activeFilter)
  }, [items, activeFilter])

  // Approve/Reject actions via API
  async function handleStatusUpdate(item: QueueItem, newStatus: 'APPROVED' | 'REJECTED') {
    setUpdating(true)
    try {
      const res = await fetchValidated(`/api/intake-queue/${item.id || item.queue_id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      })
      if (res.success) {
        setSelectedItem(null)
        await fetchItems()
      }
    } catch {
      // Error is visible in the UI via status not changing
    }
    setUpdating(false)
  }

  function formatDate(iso: string): string {
    try {
      return new Date(iso).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    } catch {
      return iso
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-lg"
          style={{ background: 'rgba(var(--portal-rgb, 74,122,181), 0.15)' }}
        >
          <span className="material-icons-outlined" style={{ fontSize: 22, color: 'var(--portal)' }}>
            inbox
          </span>
        </div>
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Intake Queue</h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {items.length} item{items.length !== 1 ? 's' : ''} total
          </p>
        </div>
      </div>

      {/* Filter pills */}
      <div className="mb-4 flex flex-wrap gap-2">
        {FILTER_PILLS.map((pill) => {
          const isActive = activeFilter === pill.value
          return (
            <button
              key={pill.value}
              onClick={() => setActiveFilter(pill.value)}
              className="rounded-full px-3 py-1 text-xs font-medium transition-all"
              style={{
                background: isActive ? 'var(--portal)' : 'var(--bg-surface, #1c2333)',
                color: isActive ? '#fff' : 'var(--text-secondary, #94a3b8)',
                border: `1px solid ${isActive ? 'var(--portal)' : 'var(--border-color, #2a3347)'}`,
              }}
            >
              {pill.label}
            </button>
          )
        })}
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <span className="material-icons-outlined animate-spin" style={{ color: 'var(--text-muted)', fontSize: 24 }}>
            progress_activity
          </span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-12 text-center">
          <span className="material-icons-outlined" style={{ fontSize: 48, color: 'var(--text-muted)' }}>inbox</span>
          <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>No items match this filter</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border" style={{ borderColor: 'var(--border-color, #2a3347)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'var(--bg-surface, #1c2333)' }}>
                <th className="px-4 py-3 text-left font-medium" style={{ color: 'var(--text-muted)' }}>File Name</th>
                <th className="px-4 py-3 text-left font-medium" style={{ color: 'var(--text-muted)' }}>Source</th>
                <th className="px-4 py-3 text-left font-medium" style={{ color: 'var(--text-muted)' }}>Status</th>
                <th className="px-4 py-3 text-left font-medium" style={{ color: 'var(--text-muted)' }}>Created</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr
                  key={item.id || item.queue_id}
                  onClick={() => setSelectedItem(item)}
                  className="cursor-pointer transition-colors hover:bg-white/5"
                  style={{ borderTop: '1px solid var(--border-color, #2a3347)' }}
                >
                  <td className="px-4 py-3" style={{ color: 'var(--text-primary)' }}>
                    <span className="font-medium">{item.file_name}</span>
                  </td>
                  <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{item.source}</td>
                  <td className="px-4 py-3">
                    <span
                      className="inline-block rounded-full px-2.5 py-0.5 text-xs font-medium"
                      style={{
                        background: (STATUS_COLORS[item.status] || STATUS_COLORS.QUEUED).bg,
                        color: (STATUS_COLORS[item.status] || STATUS_COLORS.QUEUED).text,
                      }}
                    >
                      {item.status}
                    </span>
                  </td>
                  <td className="px-4 py-3" style={{ color: 'var(--text-muted)' }}>{formatDate(item.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail panel — slide-over from right */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSelectedItem(null)} />
          <div
            className="relative z-10 w-full max-w-md overflow-y-auto border-l shadow-2xl"
            style={{
              background: 'var(--bg-card, #161b26)',
              borderColor: 'var(--border-color, #2a3347)',
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b p-4" style={{ borderColor: 'var(--border-color, #2a3347)' }}>
              <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Item Detail</h3>
              <button onClick={() => setSelectedItem(null)} style={{ color: 'var(--text-muted)' }}>
                <span className="material-icons-outlined" style={{ fontSize: 20 }}>close</span>
              </button>
            </div>

            {/* Fields */}
            <div className="space-y-4 p-4">
              <div>
                <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--text-muted)' }}>File Name</label>
                <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{selectedItem.file_name}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Source</label>
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{selectedItem.source}</p>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Status</label>
                  <span
                    className="inline-block rounded-full px-2.5 py-0.5 text-xs font-medium"
                    style={{
                      background: (STATUS_COLORS[selectedItem.status] || STATUS_COLORS.QUEUED).bg,
                      color: (STATUS_COLORS[selectedItem.status] || STATUS_COLORS.QUEUED).text,
                    }}
                  >
                    {selectedItem.status}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--text-muted)' }}>File Type</label>
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{selectedItem.file_type || 'unknown'}</p>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Created</label>
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{formatDate(selectedItem.created_at)}</p>
                </div>
              </div>
              {selectedItem.content_preview && (
                <div>
                  <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Preview</label>
                  <p className="rounded-lg p-3 text-xs" style={{ background: 'var(--bg-surface, #1c2333)', color: 'var(--text-secondary)' }}>
                    {selectedItem.content_preview}
                  </p>
                </div>
              )}
              {selectedItem.error_message && (
                <div>
                  <label className="mb-1 block text-xs font-medium" style={{ color: 'rgb(239,68,68)' }}>Error</label>
                  <p className="rounded-lg p-3 text-xs" style={{ background: 'rgba(239,68,68,0.1)', color: 'rgb(239,68,68)' }}>
                    {selectedItem.error_message}
                  </p>
                </div>
              )}

              {/* Action buttons — only show for items that can be approved/rejected */}
              {(selectedItem.status === 'QUEUED' || selectedItem.status === 'REVIEWING') && (
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => handleStatusUpdate(selectedItem, 'APPROVED')}
                    disabled={updating}
                    className="flex-1 rounded-lg py-2.5 text-sm font-semibold text-white transition-all disabled:opacity-50"
                    style={{ background: 'rgb(34,197,94)' }}
                  >
                    {updating ? 'Updating...' : 'Approve'}
                  </button>
                  <button
                    onClick={() => handleStatusUpdate(selectedItem, 'REJECTED')}
                    disabled={updating}
                    className="flex-1 rounded-lg py-2.5 text-sm font-semibold text-white transition-all disabled:opacity-50"
                    style={{ background: 'rgb(239,68,68)' }}
                  >
                    {updating ? 'Updating...' : 'Reject'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
