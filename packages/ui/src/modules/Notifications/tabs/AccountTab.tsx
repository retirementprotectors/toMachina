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

  if (!loading && filtered.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <span className="material-icons-outlined text-[var(--text-muted)]" style={{ fontSize: '32px' }}>account_balance_wallet</span>
        <p className="mt-2 text-xs text-[var(--text-muted)]">No account notifications</p>
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
