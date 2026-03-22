'use client'

import Link from 'next/link'
import { useAuth, type AuthUser } from '@tomachina/auth'
import { PortalSwitcher } from '@tomachina/ui'
import { InboundCallCard } from '@tomachina/ui/src/modules/CommsModule/InboundCallCard'
import { SmartSearch } from './SmartSearch'

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
    <div className="shrink-0">
      <header
        className="flex h-[60px] items-center justify-between pl-8 pr-6 bg-[var(--bg-card)]"
      >
        {/* Left — Logo + Switcher */}
        <div className="flex items-center gap-3">
          <PortalSwitcher currentPortal="prodash" />
        </div>

        {/* Center — Global Search */}
        <div className="hidden flex-1 justify-center px-8 md:flex">
          <div className="relative w-full max-w-sm">
            <SmartSearch />
          </div>
        </div>

        {/* Right — Inbound Call + Notifications + User */}
        <div className="flex items-center gap-2">
          {/* Inbound Call Notification — null until real Twilio webhook wired */}
          <InboundCallCard call={null} />

          {/* User — clicks to My RPI */}
          <Link
            href="/myrpi"
            className="flex items-center gap-2.5 rounded-lg px-2 py-1 transition-colors hover:bg-[rgba(74,122,181,0.08)] cursor-pointer"
            title="My RPI"
          >
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt={user.displayName}
                className="h-[34px] w-[34px] rounded-full ring-2 ring-[rgba(74,122,181,0.2)]"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div
                className="flex h-[34px] w-[34px] items-center justify-center rounded-full text-xs font-semibold text-white"
                style={{ background: 'var(--portal)' }}
              >
                {getInitials(user.displayName)}
              </div>
            )}
            <div className="hidden flex-col sm:flex">
              <span className="text-sm font-medium text-[var(--text-primary)]">
                {(user.displayName || 'User').split(' ')[0]}
              </span>
            </div>
          </Link>

          {/* Sign Out */}
          <button
            onClick={signOut}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-muted)] transition-colors hover:bg-[rgba(74,122,181,0.08)] hover:text-[var(--text-primary)] cursor-pointer"
            title="Sign Out"
          >
            <span className="material-icons-outlined" style={{ fontSize: '18px' }}>logout</span>
          </button>
        </div>
      </header>
      {/* Accent strip — bottom edge */}
      <div className="h-[3px] w-full" style={{ background: 'var(--portal)' }} />
    </div>
  )
}
