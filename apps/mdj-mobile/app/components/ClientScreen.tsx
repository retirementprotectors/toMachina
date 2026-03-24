'use client'

import { useState, useCallback } from 'react'
import { getAuth } from 'firebase/auth'

interface ClientResult {
  id: string
  first_name: string
  last_name: string
  email?: string
  phone?: string
  status: string
  account_count: number
}

export function ClientScreen() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ClientResult[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedClient, setSelectedClient] = useState<ClientResult | null>(null)

  const searchClients = useCallback(async (q: string) => {
    const auth = getAuth()
    if (!q.trim() || !auth.currentUser) return
    setLoading(true)
    try {
      const token = await auth.currentUser.getIdToken()
      const res = await fetch(`/api/clients/search?q=${encodeURIComponent(q.trim())}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        if (data.success && Array.isArray(data.data)) {
          setResults(data.data)
        }
      }
    } catch {
      // API not available yet
    } finally {
      setLoading(false)
    }
  }, [])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    searchClients(query)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="px-4 py-3 safe-top bg-[var(--bg-secondary)] border-b border-[var(--border)]">
        <h1 className="text-lg font-bold">
          {selectedClient ? `${selectedClient.first_name} ${selectedClient.last_name}` : 'Clients'}
        </h1>
        {selectedClient ? (
          <button
            onClick={() => setSelectedClient(null)}
            className="text-[var(--mdj-purple)] text-xs font-semibold"
          >
            Back to search
          </button>
        ) : (
          <p className="text-[var(--text-muted)] text-xs">Search and view client details</p>
        )}
      </header>

      <div className="flex-1 overflow-y-auto scroll-smooth">
        {selectedClient ? (
          <ClientDetail client={selectedClient} />
        ) : (
          <>
            {/* Search */}
            <form onSubmit={handleSearch} className="p-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by name, email, or phone..."
                  className="flex-1 px-4 py-3 rounded-xl text-sm
                    bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-primary)]
                    placeholder:text-[var(--text-muted)]
                    focus:outline-none focus:border-[var(--mdj-purple)]"
                />
                <button
                  type="submit"
                  disabled={!query.trim() || loading}
                  className="px-4 py-3 rounded-xl bg-[var(--mdj-purple)] text-white text-sm font-semibold
                    disabled:opacity-30 active:scale-95 transition-transform"
                >
                  {loading ? '...' : 'Go'}
                </button>
              </div>
            </form>

            {/* Results */}
            <div className="px-4 space-y-2">
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-16 rounded-xl bg-[var(--bg-card)] animate-pulse border border-[var(--border)]" />
                ))
              ) : results.length === 0 && query ? (
                <p className="text-center text-[var(--text-muted)] text-sm py-8">
                  No clients found. Try a different search.
                </p>
              ) : results.length === 0 ? (
                <div className="text-center py-16">
                  <div className="w-12 h-12 mx-auto mb-4 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)]
                    flex items-center justify-center text-[var(--text-muted)] text-xl">
                    C
                  </div>
                  <p className="text-[var(--text-secondary)] text-sm font-medium">Search for a client</p>
                  <p className="text-[var(--text-muted)] text-xs mt-1">
                    Or ask MDJ: &ldquo;Look up Henderson&rdquo;
                  </p>
                </div>
              ) : (
                results.map((client) => (
                  <button
                    key={client.id}
                    onClick={() => setSelectedClient(client)}
                    className="w-full flex items-center gap-3 p-4 rounded-xl
                      bg-[var(--bg-card)] border border-[var(--border)] text-left
                      active:bg-[var(--bg-card-hover)] transition-colors"
                  >
                    <div className="w-10 h-10 rounded-full bg-[var(--mdj-purple-glow)]
                      flex items-center justify-center text-[var(--mdj-purple)] text-sm font-bold shrink-0">
                      {client.first_name[0]}{client.last_name[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">
                        {client.first_name} {client.last_name}
                      </p>
                      <p className="text-[var(--text-muted)] text-[11px] truncate">
                        {client.email ?? client.phone ?? `${client.account_count} accounts`}
                      </p>
                    </div>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      client.status === 'active'
                        ? 'bg-green-500/10 text-green-400'
                        : 'bg-yellow-500/10 text-yellow-400'
                    }`}>
                      {client.status}
                    </span>
                  </button>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function ClientDetail({ client }: { client: ClientResult }) {
  return (
    <div className="p-4 space-y-4">
      {/* Client header card */}
      <div className="p-5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] text-center">
        <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-[var(--mdj-purple)] to-[#4c1d95]
          flex items-center justify-center text-white text-xl font-bold mb-3">
          {client.first_name[0]}{client.last_name[0]}
        </div>
        <h2 className="text-lg font-bold">{client.first_name} {client.last_name}</h2>
        {client.email && (
          <p className="text-[var(--text-secondary)] text-xs mt-1">{client.email}</p>
        )}
        {client.phone && (
          <p className="text-[var(--text-muted)] text-xs">{client.phone}</p>
        )}
        <span className={`inline-block mt-2 text-[10px] font-semibold px-3 py-1 rounded-full ${
          client.status === 'active'
            ? 'bg-green-500/10 text-green-400'
            : 'bg-yellow-500/10 text-yellow-400'
        }`}>
          {client.status}
        </span>
      </div>

      {/* Quick action buttons */}
      <div className="grid grid-cols-2 gap-2">
        {client.phone && (
          <a
            href={`tel:${client.phone}`}
            className="flex items-center justify-center gap-2 p-3 rounded-xl
              bg-[var(--bg-card)] border border-[var(--border)]
              text-[var(--text-secondary)] text-xs font-semibold
              active:bg-[var(--bg-card-hover)] transition-colors"
          >
            <span>📞</span> Call
          </a>
        )}
        {client.email && (
          <a
            href={`mailto:${client.email}`}
            className="flex items-center justify-center gap-2 p-3 rounded-xl
              bg-[var(--bg-card)] border border-[var(--border)]
              text-[var(--text-secondary)] text-xs font-semibold
              active:bg-[var(--bg-card-hover)] transition-colors"
          >
            <span>✉️</span> Email
          </a>
        )}
        <button
          className="flex items-center justify-center gap-2 p-3 rounded-xl
            bg-[var(--bg-card)] border border-[var(--border)]
            text-[var(--text-secondary)] text-xs font-semibold
            active:bg-[var(--bg-card-hover)] transition-colors"
        >
          <span>📋</span> Accounts
        </button>
        <button
          className="flex items-center justify-center gap-2 p-3 rounded-xl
            bg-[var(--bg-card)] border border-[var(--border)]
            text-[var(--text-secondary)] text-xs font-semibold
            active:bg-[var(--bg-card-hover)] transition-colors"
        >
          <span>📊</span> Pipeline
        </button>
      </div>

      {/* Ask MDJ about this client */}
      <div className="p-4 rounded-2xl bg-[var(--mdj-purple-glow)] border border-[var(--mdj-purple)]/20">
        <p className="text-xs text-[var(--text-secondary)] mb-2">Ask MDJ about this client:</p>
        <div className="space-y-1.5">
          <SuggestedPrompt text={`What's the status of ${client.first_name}'s accounts?`} />
          <SuggestedPrompt text={`Any pending cases for ${client.first_name} ${client.last_name}?`} />
          <SuggestedPrompt text={`When was the last contact with ${client.first_name}?`} />
        </div>
      </div>
    </div>
  )
}

function SuggestedPrompt({ text }: { text: string }) {
  return (
    <button className="w-full text-left px-3 py-2 rounded-lg
      bg-[var(--bg-card)]/50 text-[var(--text-secondary)] text-xs
      active:bg-[var(--bg-card)] transition-colors">
      &ldquo;{text}&rdquo;
    </button>
  )
}
