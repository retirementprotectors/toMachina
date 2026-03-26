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

  if (!loading && filtered.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <span className="material-icons-outlined text-[var(--text-muted)]" style={{ fontSize: '32px' }}>cloud_off</span>
        <p className="mt-2 text-xs text-[var(--text-muted)]">No data notifications</p>
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
