'use client'

import { useAuth, type AuthUser } from '@tomachina/auth'
import { PortalSwitcher } from '@tomachina/ui'

interface TopBarProps {
  user: AuthUser
}

function getInitials(name: string): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }
  return name[0].toUpperCase()
}

export function TopBar({ user }: TopBarProps) {
  const { signOut } = useAuth()

  return (
    <header
      className="flex h-14 shrink-0 items-center justify-between border-b px-4"
      style={{
        background: 'var(--bg-secondary)',
        borderColor: 'var(--border)',
      }}
    >
      {/* Left — Portal Name */}
      <div className="flex items-center gap-2">
        <span
          className="text-base font-semibold"
          style={{ color: 'var(--portal)' }}
        >
          ProDash
        </span>
        <span className="text-xs text-[var(--text-muted)]">
          toMachina
        </span>
        <PortalSwitcher currentPortal="prodash" />
      </div>

      {/* Right — User */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-[var(--text-secondary)]">
          {user.displayName || user.email}
        </span>

        {/* Avatar */}
        {user.photoURL ? (
          <img
            src={user.photoURL}
            alt={user.displayName}
            className="h-8 w-8 rounded-full"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-white"
            style={{ background: 'var(--portal)' }}
          >
            {getInitials(user.displayName)}
          </div>
        )}

        {/* Sign Out */}
        <button
          onClick={signOut}
          className="flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
        >
          <span className="material-icons-outlined" style={{ fontSize: '16px' }}>
            logout
          </span>
          <span>Sign Out</span>
        </button>
      </div>
    </header>
  )
}
