'use client'

import Link from 'next/link'

interface AccessButtonProps {
  clientId: string
  pendingCount?: number
}

export function AccessButton({ clientId, pendingCount = 0 }: AccessButtonProps) {
  return (
    <Link
      href={`/service-centers/access?clientId=${encodeURIComponent(clientId)}`}
      className="relative inline-flex items-center gap-1.5 rounded-md h-[34px] px-3 text-sm font-medium bg-[var(--bg-surface)] text-[var(--text-secondary)] transition-all hover:bg-[var(--portal)]/15 hover:text-[var(--portal)] border border-[var(--border-subtle)]"
      title="View portal & API access status"
    >
      <span className="material-icons-outlined text-[16px]">security</span>
      Access
      {pendingCount > 0 && (
        <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-white">
          {pendingCount}
        </span>
      )}
    </Link>
  )
}
