'use client'

import { useMemo } from 'react'
import { AllTab } from './AllTab'
import type { NotificationDoc } from '../NotificationRow'

interface AccountTabProps {
  notifications: NotificationDoc[]
  loading: boolean
  onNavigate: (href: string) => void
  onMarkRead: (id: string) => void
}

export function AccountTab({ notifications, loading, onNavigate, onMarkRead }: AccountTabProps) {
  const filtered = useMemo(
    () => notifications.filter((n) => n.entity_type === 'account'),
    [notifications]
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
