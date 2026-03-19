'use client'

import { useMemo } from 'react'
import { AllTab } from './AllTab'
import type { NotificationDoc } from '../NotificationRow'

const DATA_SOURCE_TYPES = new Set(['wire', 'import', 'intake'])

interface DataTabProps {
  notifications: NotificationDoc[]
  loading: boolean
  onNavigate: (href: string) => void
  onMarkRead: (id: string) => void
}

export function DataTab({ notifications, loading, onNavigate, onMarkRead }: DataTabProps) {
  const filtered = useMemo(
    () => notifications.filter((n) => DATA_SOURCE_TYPES.has(n.source_type)),
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
