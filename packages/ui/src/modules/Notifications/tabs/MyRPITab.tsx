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

  return (
    <AllTab
      notifications={filtered}
      loading={loading}
      onNavigate={onNavigate}
      onMarkRead={onMarkRead}
    />
  )
}
