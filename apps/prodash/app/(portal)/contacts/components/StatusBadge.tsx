'use client'

const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  active: { bg: 'rgba(16, 185, 129, 0.15)', text: '#10b981' },
  prospect: { bg: 'rgba(59, 130, 246, 0.15)', text: '#3b82f6' },
  inactive: { bg: 'rgba(107, 114, 128, 0.15)', text: '#9ca3af' },
  deceased: { bg: 'rgba(239, 68, 68, 0.15)', text: '#ef4444' },
}

const DEFAULT_STYLE = { bg: 'rgba(139, 92, 246, 0.15)', text: '#8b5cf6' }

interface StatusBadgeProps {
  status: string
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const normalized = (status || '').toLowerCase().trim()
  const style = STATUS_STYLES[normalized] || DEFAULT_STYLE

  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap"
      style={{ backgroundColor: style.bg, color: style.text }}
    >
      {status || 'Unknown'}
    </span>
  )
}
