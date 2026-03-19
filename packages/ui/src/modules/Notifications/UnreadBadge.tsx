'use client'

interface UnreadBadgeProps {
  count: number
}

export function UnreadBadge({ count }: UnreadBadgeProps) {
  if (count <= 0) return null

  const label = count > 99 ? '99+' : String(count)

  return (
    <span
      className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold text-white"
      style={{ background: '#ef4444' }}
    >
      {label}
    </span>
  )
}
