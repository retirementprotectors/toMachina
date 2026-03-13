'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { query, where, getDocs, collection, limit, orderBy } from 'firebase/firestore'
import { getDb } from '@tomachina/db'
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

function getFirstName(name: string): string {
  if (!name) return 'User'
  return name.trim().split(/\s+/)[0]
}

/* ─── Search result type ─── */
interface SearchResult {
  id: string
  label: string
  subtitle: string
  type: 'client' | 'account' | 'agent'
  href: string
}

export function TopBar({ user }: TopBarProps) {
  const { signOut } = useAuth()
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const searchRef = useRef<HTMLDivElement>(null)

  /* Close on outside click */
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowResults(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  /* DF-6: Functional type-to-search */
  const handleSearch = useCallback((q: string) => {
    setSearchQuery(q)
    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (!q.trim()) {
      setResults([])
      setShowResults(false)
      return
    }

    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      setShowResults(true)
      try {
        const db = getDb()
        const qLower = q.toLowerCase()
        const found: SearchResult[] = []

        // Search clients by last_name
        const clientQ = query(collection(db, 'clients'), orderBy('last_name'), limit(50))
        const clientSnap = await getDocs(clientQ)
        clientSnap.docs.forEach((d) => {
          const data = d.data()
          const fullName = `${data.first_name || ''} ${data.last_name || ''}`.toLowerCase()
          const email = (data.email || '').toLowerCase()
          if (fullName.includes(qLower) || email.includes(qLower)) {
            found.push({
              id: d.id,
              label: `${data.first_name || ''} ${data.last_name || ''}`.trim(),
              subtitle: [data.city, data.state].filter(Boolean).join(', ') || data.email || '',
              type: 'client',
              href: `/clients/${d.id}`,
            })
          }
        })

        setResults(found.slice(0, 10))
      } catch {
        setResults([])
      } finally {
        setSearching(false)
      }
    }, 300)
  }, [])

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  const handleResultClick = useCallback((result: SearchResult) => {
    setShowResults(false)
    setSearchQuery('')
    setResults([])
    router.push(result.href)
  }, [router])

  /* DF-5: Avatar + first name, clicking navigates to My RPI */
  const handleUserClick = () => {
    router.push('/myrpi')
  }

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
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/prodashx-tm-transparent.png" alt="ProDashX" style={{ height: '32px' }} />
        <PortalSwitcher currentPortal="prodash" />
      </div>

      {/* Center — Global Search (DF-6: Functional) */}
      <div className="hidden flex-1 justify-center px-8 md:flex" ref={searchRef}>
        <div className="relative w-full max-w-md">
          <span className="material-icons-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" style={{ fontSize: '18px' }}>search</span>
          <input
            type="text"
            placeholder="Search contacts, accounts, agents..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            onFocus={() => { if (results.length > 0) setShowResults(true) }}
            className="w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-card)] py-1.5 pl-10 pr-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none transition-colors focus:border-[var(--portal)]"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 rounded border border-[var(--border-medium)] px-1.5 py-0.5 text-[10px] text-[var(--text-muted)]">/</span>

          {/* Search Results Dropdown */}
          {showResults && (
            <div
              className="absolute left-0 top-full z-50 mt-1 w-full rounded-lg border shadow-lg overflow-hidden"
              style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
            >
              {searching && (
                <div className="flex items-center gap-2 px-4 py-3 text-xs text-[var(--text-muted)]">
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[var(--portal)] border-t-transparent" />
                  Searching...
                </div>
              )}
              {!searching && results.length === 0 && searchQuery.trim() && (
                <div className="px-4 py-3 text-xs text-[var(--text-muted)]">
                  No results found for &ldquo;{searchQuery}&rdquo;
                </div>
              )}
              {results.map((r) => (
                <button
                  key={`${r.type}-${r.id}`}
                  onClick={() => handleResultClick(r)}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-[var(--bg-hover)]"
                >
                  <span className="material-icons-outlined text-[16px] text-[var(--text-muted)]">
                    {r.type === 'client' ? 'person' : r.type === 'account' ? 'account_balance' : 'badge'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[var(--text-primary)]">{r.label}</p>
                    <p className="truncate text-xs text-[var(--text-muted)]">{r.subtitle}</p>
                  </div>
                  <span className="rounded-full bg-[var(--bg-surface)] px-2 py-0.5 text-[10px] text-[var(--text-muted)]">
                    {r.type}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right — Notifications + User */}
      <div className="flex items-center gap-2">
        {/* Notification Bell */}
        <button className="relative flex h-8 w-8 items-center justify-center rounded-md text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]">
          <span className="material-icons-outlined" style={{ fontSize: '20px' }}>notifications</span>
          <span className="absolute right-1 top-1 h-2 w-2 rounded-full" style={{ background: 'var(--portal)' }} />
        </button>

        {/* Separator */}
        <div className="mx-1 h-6 w-px bg-[var(--border-subtle)]" />

        {/* User — DF-5: Avatar + first name, click navigates to MyRPI */}
        <button
          onClick={handleUserClick}
          className="flex items-center gap-2 rounded-md px-2 py-1 transition-colors hover:bg-[var(--bg-hover)]"
          title="Go to My RPI"
        >
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
          <span className="hidden text-xs font-medium text-[var(--text-primary)] sm:inline">
            {getFirstName(user.displayName)}
          </span>
        </button>

        {/* Sign Out */}
        <button
          onClick={signOut}
          className="flex h-8 w-8 items-center justify-center rounded-md text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
          title="Sign Out"
        >
          <span className="material-icons-outlined" style={{ fontSize: '18px' }}>logout</span>
        </button>
      </div>
    </header>
  )
}
