'use client'

type AccessStatus = 'connected' | 'pending' | 'expired' | 'not_started'

interface AccessStatusBadgeProps {
  status: AccessStatus
}

const STATUS_CONFIG: Record<AccessStatus, { label: string; bg: string; text: string; icon: string }> = {
  connected: { label: 'Active', bg: 'bg-emerald-500/15', text: 'text-emerald-400', icon: 'check_circle' },
  pending: { label: 'Pending', bg: 'bg-amber-500/15', text: 'text-amber-400', icon: 'schedule' },
  expired: { label: 'Expired', bg: 'bg-red-500/15', text: 'text-red-400', icon: 'error' },
  not_started: { label: 'Not Started', bg: 'bg-gray-500/15', text: 'text-gray-400', icon: 'radio_button_unchecked' },
}

export function AccessStatusBadge({ status }: AccessStatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.not_started

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${config.bg} ${config.text}`}>
      <span className="material-icons-outlined text-[12px]">{config.icon}</span>
      {config.label}
    </span>
  )
}
