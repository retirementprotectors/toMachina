'use client'

/* ─── Types ─── */

interface NotificationDoc {
  _id: string
  id: string
  type: string
  entity_type: 'client' | 'account' | 'approval_batch' | 'household' | 'revenue'
  entity_id: string
  entity_name: string
  summary: string
  fields_changed?: string[]
  source_type: 'user' | 'wire' | 'import' | 'intake' | 'system'
  source_id?: string
  source_label: string
  user_id?: string
  hyperlink: string
  read: boolean
  created_at: string
  portal: string
}

interface NotificationRowProps {
  notification: NotificationDoc
  onNavigate: (href: string) => void
  onMarkRead: (id: string) => void
}

/* ─── Helpers ─── */

const ENTITY_ICONS: Record<string, string> = {
  client: 'person',
  account: 'briefcase',
  approval_batch: 'shield',
  household: 'home',
  revenue: 'payments',
}

function relativeTime(iso: string): string {
  const now = Date.now()
  const then = new Date(iso).getTime()
  const diff = Math.max(0, now - then)

  const seconds = Math.floor(diff / 1000)
  if (seconds < 60) return 'just now'

  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`

  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`

  const months = Math.floor(days / 30)
  return `${months}mo ago`
}

/* ─── Component ─── */

export function NotificationRow({ notification, onNavigate, onMarkRead }: NotificationRowProps) {
  const icon = ENTITY_ICONS[notification.entity_type] || 'info'
  const isUnread = !notification.read

  const handleClick = () => {
    if (isUnread) onMarkRead(notification._id || notification.id)
    onNavigate(notification.hyperlink)
  }

  return (
    <button
      onClick={handleClick}
      className={`
        flex w-full items-start gap-2.5 rounded-lg px-3 py-2.5 text-left transition-colors
        hover:bg-[var(--bg-hover)]
        ${isUnread ? 'bg-[var(--portal-glow)]' : ''}
      `}
    >
      {/* Type icon */}
      <span
        className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-[var(--bg-surface)]"
      >
        <span
          className="material-icons-outlined text-[var(--text-muted)]"
          style={{ fontSize: '14px' }}
        >
          {icon}
        </span>
      </span>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className={`truncate text-sm ${isUnread ? 'font-semibold text-[var(--text-primary)]' : 'font-medium text-[var(--text-secondary)]'}`}>
            {notification.entity_name}
          </span>
          <div className="flex flex-shrink-0 items-center gap-1.5">
            {isUnread && (
              <span className="h-2 w-2 rounded-full" style={{ background: 'var(--portal)' }} />
            )}
            <span className="text-[10px] text-[var(--text-muted)]">
              {relativeTime(notification.created_at)}
            </span>
          </div>
        </div>
        <p className="mt-0.5 truncate text-xs text-[var(--text-muted)]">
          {notification.summary}
        </p>
      </div>
    </button>
  )
}

export type { NotificationDoc }
