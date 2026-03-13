'use client'

import { useMemo } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { useAuth, type AuthUser } from '@tomachina/auth'
import { PortalSwitcher } from '@tomachina/ui'
import { InboundCallCard, MOCK_INBOUND_CALL } from '@tomachina/ui/src/modules/CommsModule/InboundCallCard'

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

/** Derive a readable page title from the current pathname */
function usePageTitle(): string {
  const pathname = usePathname()
  return useMemo(() => {
    const segments = pathname.split('/').filter(Boolean)
    const last = segments[segments.length - 1] || 'clients'
    // Handle known route patterns
    const titles: Record<string, string> = {
      clients: 'Contacts',
      accounts: 'Accounts',
      intake: 'Quick Intake',
      admin: 'Admin',
      connect: 'RPI Connect',
      pipelines: 'Pipelines',
      modules: 'Modules',
      medicare: 'Medicare',
      life: 'Life',
      annuity: 'Annuity',
      advisory: 'Advisory',
      rmd: 'RMD Center',
      beni: 'Beni Center',
      atlas: 'ATLAS',
      cam: 'CAM',
      dex: 'DEX',
      c3: 'C3',
      'command-center': 'Command Center',
    }
    // Check for known title first, then capitalize
    if (titles[last]) return titles[last]
    // If it looks like an ID (contains numbers or hyphens), use the parent segment
    if (/^[a-f0-9-]{8,}$/.test(last) && segments.length >= 2) {
      const parent = segments[segments.length - 2]
      if (titles[parent]) return titles[parent]
    }
    return last.charAt(0).toUpperCase() + last.slice(1).replace(/-/g, ' ')
  }, [pathname])
}

export function TopBar({ user }: TopBarProps) {
  const { signOut } = useAuth()
  const pageTitle = usePageTitle()

  return (
    <div className="shrink-0">
      <header
        className="flex h-[60px] items-center justify-between pl-8 pr-6 bg-[var(--bg-card)]"
      >
        {/* Left — Logo + Switcher + Page Title */}
        <div className="flex items-center gap-3">
          <PortalSwitcher currentPortal="prodash" />

          {/* Vertical separator */}
          <div className="h-6 w-px bg-[var(--border-subtle)]" />

          {/* Page title */}
          <h1 className="text-page-title hidden sm:block">{pageTitle}</h1>
        </div>

        {/* Center — Global Search */}
        <div className="hidden flex-1 justify-center px-8 md:flex">
          <div className="relative w-full max-w-sm">
            <span className="material-icons-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" style={{ fontSize: '18px' }}>search</span>
            <input
              type="text"
              placeholder="Search clients, accounts, agents..."
              className="w-full rounded-md border border-[var(--border)] bg-[var(--bg-surface)] py-1.5 pl-10 pr-3 text-sm font-medium text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none transition-all focus:border-[var(--portal)]"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 rounded border border-[var(--border-medium)] px-1.5 py-0.5 text-[10px] text-[var(--text-muted)]">/</span>
          </div>
        </div>

        {/* Right — Inbound Call + Notifications + User */}
        <div className="flex items-center gap-2">
          {/* Inbound Call Notification (mock active state) */}
          <InboundCallCard call={MOCK_INBOUND_CALL} />

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
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-muted)] transition-colors hover:bg-[rgba(74,122,181,0.08)] hover:text-[var(--text-primary)]"
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
