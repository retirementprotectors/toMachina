'use client'

import { useMemo } from 'react'
import { AllTab } from './AllTab'
import type { NotificationDoc } from '../NotificationRow'

interface ContactTabProps {
  notifications: NotificationDoc[]
  loading: boolean
  onNavigate: (href: string) => void
  onMarkRead: (id: string) => void
}

export function ContactTab({ notifications, loading, onNavigate, onMarkRead }: ContactTabProps) {
  const filtered = useMemo(
    () => notifications.filter((n) => n.entity_type === 'client'),
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
