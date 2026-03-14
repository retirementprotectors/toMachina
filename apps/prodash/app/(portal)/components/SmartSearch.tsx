'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getAuth } from 'firebase/auth'

interface SearchResult {
  id: string
  type: 'client' | 'account'
  label: string
  sublabel: string
  href: string
}

interface SearchResponse {
  clients: SearchResult[]
  accounts: SearchResult[]
}

export function SmartSearch() {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResponse>({ clients: [], accounts: [] })
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)

  // Flat list of all results for keyboard navigation
  const flatResults: SearchResult[] = [...results.clients, ...results.accounts]
  const totalCount = flatResults.length

  // ========================================================================
  // KEYBOARD SHORTCUT: "/" to focus search
  // ========================================================================

  useEffect(() => {
    function handleGlobalKeydown(e: KeyboardEvent) {
      const target = e.target as HTMLElement
      const tagName = target.tagName.toLowerCase()

      // Don't activate when user is typing in an input, textarea, or contentEditable
      if (tagName === 'input' || tagName === 'textarea' || target.isContentEditable) return

      if (e.key === '/') {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }

    window.addEventListener('keydown', handleGlobalKeydown)
    return () => window.removeEventListener('keydown', handleGlobalKeydown)
  }, [])

  // ========================================================================
  // DEBOUNCED API CALL
  // ========================================================================

  const fetchResults = useCallback(async (searchQuery: string) => {
    if (searchQuery.length < 2) {
      setResults({ clients: [], accounts: [] })
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const auth = getAuth()
      const token = await auth.currentUser?.getIdToken()
      if (!token) {
        setLoading(false)
        return
      }

      const url = `/api/search?q=${encodeURIComponent(searchQuery)}&limit=10`
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!res.ok) {
        setResults({ clients: [], accounts: [] })
        setLoading(false)
        return
      }

      const json = await res.json()
      if (json.success && json.data) {
        setResults(json.data as SearchResponse)
      } else {
        setResults({ clients: [], accounts: [] })
      }
    } catch {
      setResults({ clients: [], accounts: [] })
    } finally {
      setLoading(false)
    }
  }, [])

  const handleInputChange = useCallback(
    (value: string) => {
      setQuery(value)
      setActiveIndex(-1)
      setOpen(true)

      if (debounceRef.current) clearTimeout(debounceRef.current)

      if (!value.trim()) {
        setResults({ clients: [], accounts: [] })
        setLoading(false)
        return
      }

      debounceRef.current = setTimeout(() => {
        fetchResults(value.trim())
      }, 300)
    },
    [fetchResults]
  )

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current)
    }
  }, [])

  // ========================================================================
  // NAVIGATE TO RESULT
  // ========================================================================

  const navigateToResult = useCallback(
    (result: SearchResult) => {
      setOpen(false)
      setQuery('')
      setResults({ clients: [], accounts: [] })
      setActiveIndex(-1)
      inputRef.current?.blur()
      router.push(result.href)
    },
    [router]
  )

  // ========================================================================
  // KEYBOARD NAVIGATION
  // ========================================================================

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        setActiveIndex(-1)
        inputRef.current?.blur()
        return
      }

      if (!open || totalCount === 0) return

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIndex((prev) => (prev < totalCount - 1 ? prev + 1 : 0))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIndex((prev) => (prev > 0 ? prev - 1 : totalCount - 1))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        if (activeIndex >= 0 && activeIndex < totalCount) {
          navigateToResult(flatResults[activeIndex])
        }
      }
    },
    [open, totalCount, activeIndex, flatResults, navigateToResult]
  )

  // ========================================================================
  // BLUR HANDLING (delay to allow click events to fire)
  // ========================================================================

  const handleFocus = useCallback(() => {
    if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current)
    if (query.length >= 2) setOpen(true)
  }, [query])

  const handleBlur = useCallback(() => {
    blurTimeoutRef.current = setTimeout(() => {
      setOpen(false)
      setActiveIndex(-1)
    }, 150)
  }, [])

  // ========================================================================
  // DETERMINE WHAT TO SHOW
  // ========================================================================

  const showDropdown = open && (loading || totalCount > 0 || query.length >= 2)
  const hasQueried = query.length >= 2 && !loading

  // ========================================================================
  // RENDER
  // ========================================================================

  // Track cumulative index offset for grouped sections
  let indexOffset = 0

  return (
    <div className="relative w-full" ref={dropdownRef}>
      {/* Search Input — matches original TopBar styling exactly */}
      <span
        className="material-icons-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
        style={{ fontSize: '18px' }}
      >
        search
      </span>
      <input
        ref={inputRef}
        type="text"
        placeholder="Search clients, accounts, agents..."
        value={query}
        onChange={(e) => handleInputChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        onBlur={handleBlur}
        className="w-full rounded-md border border-[var(--border)] bg-[var(--bg-surface)] py-1.5 pl-10 pr-3 text-sm font-medium text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none transition-all focus:border-[var(--portal)]"
      />
      {!query && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 rounded border border-[var(--border-medium)] px-1.5 py-0.5 text-[10px] text-[var(--text-muted)]">
          /
        </span>
      )}

      {/* Dropdown */}
      {showDropdown && (
        <div className="absolute top-full left-0 mt-1.5 w-full max-h-[400px] overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--bg-card)] shadow-xl z-50">
          {/* Loading State */}
          {loading && (
            <div className="flex items-center gap-2 px-4 py-3 text-xs text-[var(--text-muted)]">
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[var(--portal)] border-t-transparent" />
              Searching...
            </div>
          )}

          {/* Empty state */}
          {hasQueried && totalCount === 0 && (
            <div className="px-4 py-6 text-center text-xs text-[var(--text-muted)]">
              No results for &lsquo;{query}&rsquo;
            </div>
          )}

          {/* Client results */}
          {results.clients.length > 0 && (
            <div>
              <div className="flex items-center gap-2 px-4 py-2 border-b border-[var(--border-subtle)]">
                <span className="material-icons-outlined text-[14px] text-[var(--text-muted)]">people</span>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  Clients
                </span>
                <span className="ml-auto rounded-full bg-[var(--bg-surface)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--text-muted)]">
                  {results.clients.length}
                </span>
              </div>
              {results.clients.map((result, i) => {
                const flatIndex = i
                return (
                  <button
                    key={`client-${result.id}`}
                    type="button"
                    className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors cursor-pointer ${
                      activeIndex === flatIndex
                        ? 'bg-[var(--bg-hover)]'
                        : 'hover:bg-[var(--bg-hover)]'
                    }`}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => navigateToResult(result)}
                    onMouseEnter={() => setActiveIndex(flatIndex)}
                  >
                    <span className="material-icons-outlined text-[18px] text-[var(--text-muted)]">person</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-[var(--text-primary)] truncate">{result.label}</p>
                      <p className="text-xs text-[var(--text-muted)] truncate">{result.sublabel}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          )}

          {/* Account results */}
          {results.accounts.length > 0 && (() => {
            indexOffset = results.clients.length
            return (
              <div>
                <div className="flex items-center gap-2 px-4 py-2 border-b border-[var(--border-subtle)]">
                  <span className="material-icons-outlined text-[14px] text-[var(--text-muted)]">account_balance</span>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                    Accounts
                  </span>
                  <span className="ml-auto rounded-full bg-[var(--bg-surface)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--text-muted)]">
                    {results.accounts.length}
                  </span>
                </div>
                {results.accounts.map((result, i) => {
                  const flatIndex = indexOffset + i
                  return (
                    <button
                      key={`account-${result.id}`}
                      type="button"
                      className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors cursor-pointer ${
                        activeIndex === flatIndex
                          ? 'bg-[var(--bg-hover)]'
                          : 'hover:bg-[var(--bg-hover)]'
                      }`}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => navigateToResult(result)}
                      onMouseEnter={() => setActiveIndex(flatIndex)}
                    >
                      <span className="material-icons-outlined text-[18px] text-[var(--text-muted)]">receipt_long</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-[var(--text-primary)] truncate">{result.label}</p>
                        <p className="text-xs text-[var(--text-muted)] truncate">{result.sublabel}</p>
                      </div>
                    </button>
                  )
                })}
              </div>
            )
          })()}
        </div>
      )}
    </div>
  )
}
