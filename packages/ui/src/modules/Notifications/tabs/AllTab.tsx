'use client'

import { useState, useMemo } from 'react'
import { NotificationRow } from '../NotificationRow'
import type { NotificationDoc } from '../NotificationRow'

interface AllTabProps {
  notifications: NotificationDoc[]
  loading: boolean
  onNavigate: (href: string) => void
  onMarkRead: (id: string) => void
}

const PAGE_SIZE = 50

export function AllTab({ notifications, loading, onNavigate, onMarkRead }: AllTabProps) {
  const [limit, setLimit] = useState(PAGE_SIZE)

  const visible = useMemo(() => notifications.slice(0, limit), [notifications, limit])
  const hasMore = notifications.length > limit

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <span className="text-xs text-[var(--text-muted)]">Loading notifications...</span>
      </div>
    )
  }

  if (notifications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <span className="material-icons-outlined text-[var(--text-muted)]" style={{ fontSize: '32px' }}>
          notifications_none
        </span>
        <p className="mt-2 text-xs text-[var(--text-muted)]">No notifications yet</p>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto px-2 py-1">
        <div className="space-y-0.5">
          {visible.map((n) => (
            <NotificationRow
              key={n._id || n.id}
              notification={n}
              onNavigate={onNavigate}
              onMarkRead={onMarkRead}
            />
          ))}
        </div>
        {hasMore && (
          <button
            onClick={() => setLimit((v) => v + PAGE_SIZE)}
            className="mt-2 flex w-full items-center justify-center rounded-md py-2 text-xs font-medium text-[var(--portal)] transition-colors hover:bg-[var(--bg-hover)]"
          >
            Load more ({notifications.length - limit} remaining)
          </button>
        )}
      </div>
    </div>
  )
}
