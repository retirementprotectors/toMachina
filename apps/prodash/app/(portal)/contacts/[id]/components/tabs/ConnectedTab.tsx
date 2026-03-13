'use client'

import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { query, where, getDocs, collection, limit, orderBy, doc, updateDoc, arrayUnion } from 'firebase/firestore'
import { getDb } from '@tomachina/db'
import type { Client } from '@tomachina/core'
import { formatPhone, getAge, str } from '../../lib/formatters'
import { EmptyState } from '../../lib/ui-helpers'

interface ConnectedTabProps {
  client: Client
  clientId: string
}

interface ConnectedPerson {
  id: string
  name: string
  relationship: string
  phone?: string
  email?: string
}

const RELATIONSHIP_TYPES = [
  'Spouse', 'Child', 'Parent', 'Sibling', 'Referrer', 'Referral', 'Business Partner', 'Other',
]

export function ConnectedTab({ client, clientId }: ConnectedTabProps) {
  // Parse connected_contacts from client doc (stored as array of objects)
  const connections: ConnectedPerson[] = useMemo(() => {
    const raw = client.connected_contacts as ConnectedPerson[] | undefined
    if (Array.isArray(raw)) return raw

    // Fallback: extract spouse from client fields
    const result: ConnectedPerson[] = []
    const spouseName = [str(client.spouse_first_name), str(client.spouse_last_name)].filter(Boolean).join(' ')
    if (spouseName) {
      result.push({
        id: str(client.spouse_client_id) || '',
        name: spouseName,
        relationship: 'Spouse',
        phone: str(client.spouse_phone),
        email: str(client.spouse_email),
      })
    }

    // Extract children
    for (let i = 1; i <= 6; i++) {
      const name = str(client[`child_${i}_name`])
      if (name) {
        result.push({
          id: '',
          name,
          relationship: 'Child',
        })
      }
    }

    return result
  }, [client])

  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Array<{ id: string; name: string; city?: string; state?: string; phone?: string; email?: string }>>([])
  const [searching, setSearching] = useState(false)
  const [selectedRelationship, setSelectedRelationship] = useState('Spouse')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Smart search with debounce
  const handleSearch = useCallback((q: string) => {
    setSearchQuery(q)
    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (!q.trim()) {
      setSearchResults([])
      return
    }

    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const db = getDb()
        // PL2-4/PL3-3: Fix smart lookup — query by last_name prefix for better Firestore results
        const qLower = q.toLowerCase()
        const qParts = q.trim().split(/\s+/)
        const searchLast = qParts.length > 1 ? qParts[qParts.length - 1] : qParts[0]

        // Use where clause for last_name range query when possible
        let nameQ
        if (searchLast && /^[a-zA-Z]/.test(searchLast)) {
          const startStr = searchLast.charAt(0).toUpperCase() + searchLast.slice(1).toLowerCase()
          const endStr = startStr.slice(0, -1) + String.fromCharCode(startStr.charCodeAt(startStr.length - 1) + 1)
          nameQ = query(
            collection(db, 'clients'),
            where('last_name', '>=', startStr),
            where('last_name', '<', endStr),
            limit(50)
          )
        } else {
          nameQ = query(
            collection(db, 'clients'),
            orderBy('last_name'),
            limit(50)
          )
        }
        const snap = await getDocs(nameQ)

        const results = snap.docs
          .filter((d) => {
            const data = d.data()
            const fullName = `${data.first_name || ''} ${data.last_name || ''}`.toLowerCase()
            const email = (data.email || '').toLowerCase()
            const phone = String(data.phone || '')
            return (
              d.id !== clientId &&
              (fullName.includes(qLower) || email.includes(qLower) || phone.includes(qLower))
            )
          })
          .map((d) => {
            const data = d.data()
            return {
              id: d.id,
              name: `${data.first_name || ''} ${data.last_name || ''}`.trim(),
              city: data.city as string | undefined,
              state: data.state as string | undefined,
              phone: data.phone as string | undefined,
              email: data.email as string | undefined,
            }
          })

        // Priority: same address first
        const clientAddress = str(client.address).toLowerCase()
        results.sort((a, b) => {
          const aMatch = clientAddress && (a.city || '').toLowerCase() === (client.city || '').toLowerCase() ? -1 : 0
          const bMatch = clientAddress && (b.city || '').toLowerCase() === (client.city || '').toLowerCase() ? -1 : 0
          return aMatch - bMatch
        })

        setSearchResults(results)
      } catch {
        setSearchResults([])
      } finally {
        setSearching(false)
      }
    }, 300)
  }, [clientId, client.address, client.city])

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  const handleLink = useCallback(async (personId: string, personName: string) => {
    try {
      const db = getDb()
      const ref = doc(db, 'clients', clientId)
      await updateDoc(ref, {
        connected_contacts: arrayUnion({
          id: personId,
          name: personName,
          relationship: selectedRelationship,
        }),
        updated_at: new Date().toISOString(),
      })
      setShowSearch(false)
      setSearchQuery('')
      setSearchResults([])
    } catch (err) {
      console.error('Failed to link contact:', err)
    }
  }, [clientId, selectedRelationship])

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">
          Connected Contacts ({connections.length})
        </h3>
        <button
          onClick={() => setShowSearch(!showSearch)}
          className="inline-flex items-center gap-1.5 rounded-md h-[34px] bg-[var(--portal)] px-3 text-xs font-medium text-white transition-colors hover:brightness-110"
        >
          <span className="material-icons-outlined text-[14px]">add</span>
          Add Connection
        </button>
      </div>

      {/* Smart search panel */}
      {showSearch && (
        <div className="rounded-lg border border-[var(--portal)]/30 bg-[var(--bg-card)] p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <span className="material-icons-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[16px] text-[var(--text-muted)]">search</span>
              <input
                type="text"
                placeholder="Search by name, email, or phone..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] py-2 pl-9 pr-3 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--portal)]"
                autoFocus
              />
            </div>
            <select
              value={selectedRelationship}
              onChange={(e) => setSelectedRelationship(e.target.value)}
              className="h-9 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 text-sm text-[var(--text-secondary)]"
            >
              {RELATIONSHIP_TYPES.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          {/* Results */}
          {searching && (
            <div className="flex items-center gap-2 py-3 text-xs text-[var(--text-muted)]">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--portal)] border-t-transparent" />
              Searching...
            </div>
          )}

          {searchResults.length > 0 && (
            <div className="max-h-60 overflow-y-auto space-y-1">
              {searchResults.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3 transition-colors hover:border-[var(--portal)]/30"
                >
                  <div>
                    <p className="text-sm font-medium text-[var(--text-primary)]">{r.name}</p>
                    <p className="text-xs text-[var(--text-muted)]">
                      {[r.city, r.state].filter(Boolean).join(', ')}
                      {r.phone && ` · ${formatPhone(r.phone)}`}
                    </p>
                  </div>
                  <button
                    onClick={() => handleLink(r.id, r.name)}
                    className="rounded-lg bg-[var(--portal)] px-3 py-1 text-xs font-medium text-white hover:brightness-110"
                  >
                    Link
                  </button>
                </div>
              ))}
            </div>
          )}

          {searchQuery && !searching && searchResults.length === 0 && (
            <p className="text-xs text-[var(--text-muted)] py-2">No matches found.</p>
          )}
        </div>
      )}

      {/* Connection cards */}
      {connections.length === 0 ? (
        <EmptyState icon="people" message="No connected contacts on file." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {connections.map((person, i) => (
            <div
              key={person.id || `conn-${i}`}
              className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--portal-glow)] text-sm font-bold text-[var(--portal)]">
                  {person.name.split(' ').map((w) => w.charAt(0)).join('').slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-[var(--text-primary)]">{person.name}</p>
                    <span className="rounded-full bg-[var(--bg-surface)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-muted)]">
                      {person.relationship}
                    </span>
                  </div>
                  {person.phone && (
                    <p className="text-xs text-[var(--text-muted)]">{formatPhone(person.phone)}</p>
                  )}
                  {person.email && (
                    <p className="text-xs text-[var(--text-muted)]">{person.email}</p>
                  )}
                </div>
                {person.id && (
                  <a
                    href={`/contacts/${person.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-[var(--portal)] hover:underline"
                  >
                    View
                    <span className="material-icons-outlined text-[12px]">open_in_new</span>
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
