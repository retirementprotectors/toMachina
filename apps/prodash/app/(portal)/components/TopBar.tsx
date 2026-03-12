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
      {/* Left — Portal Logo */}
      <div className="flex items-center gap-2">
        <img src="/prodashx-tm-transparent.png" alt="ProDashX" style={{ height: '32px' }} />
        <PortalSwitcher currentPortal="prodash" />
      </div>

      {/* Center — Global Search Placeholder */}
      <div className="hidden flex-1 justify-center px-8 md:flex">
        <div className="relative w-full max-w-md">
          <span className="material-icons-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" style={{ fontSize: '18px' }}>search</span>
          <input
            type="text"
            placeholder="Search clients, accounts, agents..."
            className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] py-1.5 pl-10 pr-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none transition-colors focus:border-[var(--portal)]"
            readOnly
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 rounded border border-[var(--border-medium)] px-1.5 py-0.5 text-[10px] text-[var(--text-muted)]">/</span>
        </div>
      </div>

      {/* Right — Notifications + User */}
      <div className="flex items-center gap-2">
        {/* Notification Bell */}
        <button className="relative flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]">
          <span className="material-icons-outlined" style={{ fontSize: '20px' }}>notifications</span>
          <span className="absolute right-1 top-1 h-2 w-2 rounded-full" style={{ background: 'var(--portal)' }} />
        </button>

        {/* Separator */}
        <div className="mx-1 h-6 w-px bg-[var(--border-subtle)]" />

        {/* User */}
        <div className="flex items-center gap-2">
          {user.photoURL ? (
            <img
              src={user.photoURL}
              alt={user.displayName}
              className="h-8 w-8 rounded-full ring-2 ring-[var(--border-subtle)]"
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
          <div className="hidden flex-col sm:flex">
            <span className="text-xs font-medium text-[var(--text-primary)]">
              {user.displayName || 'User'}
            </span>
            <span className="text-[10px] text-[var(--text-muted)]">
              {user.email}
            </span>
          </div>
        </div>

        {/* Sign Out */}
        <button
          onClick={signOut}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
          title="Sign Out"
        >
          <span className="material-icons-outlined" style={{ fontSize: '18px' }}>logout</span>
        </button>
      </div>
    </header>
  )
}
