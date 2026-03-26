'use client'

import { useMemo } from 'react'
import { AllTab } from './AllTab'
import type { NotificationDoc } from '../NotificationRow'

interface MyRPITabProps {
  notifications: NotificationDoc[]
  loading: boolean
  userId: string
  onNavigate: (href: string) => void
  onMarkRead: (id: string) => void
}

export function MyRPITab({ notifications, loading, userId, onNavigate, onMarkRead }: MyRPITabProps) {
  const filtered = useMemo(
    () => notifications.filter((n) => n.user_id === userId || n.source_id === userId),
    [notifications, userId]
  )

  if (!loading && filtered.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <span className="material-icons-outlined text-[var(--text-muted)]" style={{ fontSize: '32px' }}>account_circle</span>
        <p className="mt-2 text-xs text-[var(--text-muted)]">No MyRPI notifications</p>
      </div>
    )
  }

  return (
    <AllTab
      notifications={filtered}
      loading={loading}
      onNavigate={onNavigate}
      onMarkRead={onMarkRead}
    />
  )
}
