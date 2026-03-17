'use client'

import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { query, where, getDocs, collection, limit, orderBy, doc, updateDoc, getDoc, arrayUnion, arrayRemove } from 'firebase/firestore'
import { getDb } from '@tomachina/db'
import { getAuth } from 'firebase/auth'
import type { Client } from '@tomachina/core'
import { formatPhone, str } from '../../lib/formatters'
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
  created_via?: 'manual' | 'bulk_import' | 'auto_match' | 'confirmed'
}

interface PotentialMatch {
  id: string
  name: string
  reason: string
  confidence: number
  email?: string
  phone?: string
}

type FilterMode = 'all' | 'needs_review' | 'confirmed'

const RELATIONSHIP_TYPES = [
  'Spouse', 'Child', 'Parent', 'Sibling', 'Referrer', 'Referral', 'Business Partner', 'Other',
]

// Item 1: Inverse relationship mapper for reciprocal connections
const INVERSE_RELATIONSHIPS: Record<string, string> = {
  'Spouse': 'Spouse',
  'Child': 'Parent',
  'Parent': 'Child',
  'Sibling': 'Sibling',
  'Referrer': 'Referral',
  'Referral': 'Referrer',
  'Business Partner': 'Business Partner',
  'Other': 'Other',
}
const getInverseRelationship = (rel: string) => INVERSE_RELATIONSHIPS[rel] || 'Other'

export function ConnectedTab({ client, clientId }: ConnectedTabProps) {
  // Parse connected_contacts from client doc (stored as array of objects)
  const connections: ConnectedPerson[] = useMemo(() => {
    const raw = client.connected_contacts as ConnectedPerson[] | undefined
    if (Array.isArray(raw)) {
      // Sort alphabetically by last name (derived from full name)
      return [...raw].sort((a, b) => {
        const aLast = a.name.split(' ').slice(-1)[0] || ''
        const bLast = b.name.split(' ').slice(-1)[0] || ''
        return aLast.localeCompare(bLast)
      })
    }

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
        created_via: 'manual',
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
          created_via: 'manual',
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
  const [filterMode, setFilterMode] = useState<FilterMode>('all')
  const [potentialMatches, setPotentialMatches] = useState<Map<string, PotentialMatch>>(new Map())
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // FIX-22: Run potential match detection on load
  useEffect(() => {
    let cancelled = false

    async function findMatches() {
      if (connections.length === 0) return

      const db = getDb()
      const matchMap = new Map<string, PotentialMatch>()

      try {
        for (const conn of connections) {
          if (!conn.id) continue // Skip connections without a linked client ID
          const seenIds = new Set<string>([clientId, conn.id])

          // Match by email
          if (conn.email) {
            const emailQ = query(
              collection(db, 'clients'),
              where('email', '==', conn.email),
              limit(5)
            )
            const snap = await getDocs(emailQ)
            snap.docs.forEach((d) => {
              if (!seenIds.has(d.id)) {
                seenIds.add(d.id)
                const data = d.data()
                matchMap.set(conn.id, {
                  id: d.id,
                  name: `${data.first_name || ''} ${data.last_name || ''}`.trim(),
                  reason: 'Same email',
                  confidence: 95,
                  email: data.email as string | undefined,
                  phone: data.phone as string | undefined,
                })
              }
            })
          }

          // Match by phone
          if (conn.phone && !matchMap.has(conn.id)) {
            const phoneQ = query(
              collection(db, 'clients'),
              where('phone', '==', conn.phone),
              limit(5)
            )
            const snap = await getDocs(phoneQ)
            snap.docs.forEach((d) => {
              if (!seenIds.has(d.id)) {
                seenIds.add(d.id)
                const data = d.data()
                matchMap.set(conn.id, {
                  id: d.id,
                  name: `${data.first_name || ''} ${data.last_name || ''}`.trim(),
                  reason: 'Same phone',
                  confidence: 90,
                  email: data.email as string | undefined,
                  phone: data.phone as string | undefined,
                })
              }
            })
          }

          // Match by name similarity (last name)
          if (!matchMap.has(conn.id)) {
            const nameParts = conn.name.trim().split(/\s+/)
            const lastName = nameParts[nameParts.length - 1]
            if (lastName && lastName.length > 1) {
              const nameQ = query(
                collection(db, 'clients'),
                where('last_name', '==', lastName),
                limit(10)
              )
              const snap = await getDocs(nameQ)
              snap.docs.forEach((d) => {
                if (!seenIds.has(d.id)) {
                  const data = d.data()
                  if (conn.name.toLowerCase().includes(String(data.first_name || '').toLowerCase())) {
                    seenIds.add(d.id)
                    matchMap.set(conn.id, {
                      id: d.id,
                      name: `${data.first_name || ''} ${data.last_name || ''}`.trim(),
                      reason: 'Name similarity',
                      confidence: 75,
                      email: data.email as string | undefined,
                      phone: data.phone as string | undefined,
                    })
                  }
                }
              })
            }
          }
        }

        if (!cancelled) {
          setPotentialMatches(matchMap)
        }
      } catch {
        // Silently fail — matching is advisory
      }
    }

    findMatches()
    return () => { cancelled = true }
  }, [connections, clientId])

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
        const qLower = q.toLowerCase()
        const qParts = q.trim().split(/\s+/)
        const searchLast = qParts.length > 1 ? qParts[qParts.length - 1] : qParts[0]

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

        // Priority: same city first
        const clientCity = (client.city || '').toLowerCase()
        results.sort((a, b) => {
          const aMatch = clientCity && (a.city || '').toLowerCase() === clientCity ? -1 : 0
          const bMatch = clientCity && (b.city || '').toLowerCase() === clientCity ? -1 : 0
          return aMatch - bMatch
        })

        setSearchResults(results)
      } catch {
        setSearchResults([])
      } finally {
        setSearching(false)
      }
    }, 300)
  }, [clientId, client.city])

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  const handleLink = useCallback(async (personId: string, personName: string, phone?: string, email?: string) => {
    try {
      const db = getDb()
      const ref = doc(db, 'clients', clientId)

      // Write connection on current client
      await updateDoc(ref, {
        connected_contacts: arrayUnion({
          id: personId,
          name: personName,
          relationship: selectedRelationship,
          phone: phone || '',
          email: email || '',
          created_via: 'manual',
        }),
        updated_at: new Date().toISOString(),
      })

      // Item 1: Write inverse connection on the linked person
      const inverseRelationship = getInverseRelationship(selectedRelationship)
      const inverseConnection: ConnectedPerson = {
        id: clientId,
        name: `${client.first_name || ''} ${client.last_name || ''}`.trim(),
        relationship: inverseRelationship,
        phone: (client.phone as string) || '',
        email: (client.email as string) || '',
        created_via: 'manual',
      }
      await updateDoc(doc(db, 'clients', personId), {
        connected_contacts: arrayUnion(inverseConnection),
        updated_at: new Date().toISOString(),
      })

      setShowSearch(false)
      setSearchQuery('')
      setSearchResults([])
    } catch (err) {
      console.error('Failed to link contact:', err)
    }
  }, [clientId, selectedRelationship, client])

  const handleUnlink = useCallback(async (person: ConnectedPerson) => {
    try {
      const db = getDb()
      const ref = doc(db, 'clients', clientId)

      // Remove from current client
      await updateDoc(ref, {
        connected_contacts: arrayRemove(person),
        updated_at: new Date().toISOString(),
      })

      // Item 2: Remove the inverse connection from the other person's doc.
      // arrayRemove requires exact object match, so read the other doc and filter.
      if (person.id) {
        const otherRef = doc(db, 'clients', person.id)
        const otherSnap = await getDoc(otherRef)
        if (otherSnap.exists()) {
          const otherData = otherSnap.data()
          const otherConnections = otherData.connected_contacts as ConnectedPerson[] | undefined
          if (Array.isArray(otherConnections)) {
            const filtered = otherConnections.filter((c) => c.id !== clientId)
            await updateDoc(otherRef, {
              connected_contacts: filtered,
              updated_at: new Date().toISOString(),
            })
          }
        }
      }
    } catch (err) {
      console.error('Failed to unlink contact:', err)
    }
  }, [clientId])

  // FIX-22: Confirm a potential match — link the connected contact to an existing client record
  const handleConfirmMatch = useCallback(async (connPerson: ConnectedPerson, matchClientId: string) => {
    try {
      const db = getDb()
      const ref = doc(db, 'clients', clientId)

      // Remove old entry and add updated one with the matched ID
      await updateDoc(ref, {
        connected_contacts: arrayRemove(connPerson),
        updated_at: new Date().toISOString(),
      })
      await updateDoc(ref, {
        connected_contacts: arrayUnion({
          ...connPerson,
          id: matchClientId,
          created_via: 'confirmed',
        }),
        updated_at: new Date().toISOString(),
      })

      // Remove from potential matches
      setPotentialMatches((prev) => {
        const next = new Map(prev)
        next.delete(connPerson.id)
        return next
      })
    } catch (err) {
      console.error('Failed to confirm match:', err)
    }
  }, [clientId])

  // FIX-23: Confirm a bulk/auto-created connection
  const handleConfirmConnection = useCallback(async (person: ConnectedPerson) => {
    try {
      const db = getDb()
      const ref = doc(db, 'clients', clientId)

      await updateDoc(ref, {
        connected_contacts: arrayRemove(person),
        updated_at: new Date().toISOString(),
      })
      await updateDoc(ref, {
        connected_contacts: arrayUnion({
          ...person,
          created_via: 'confirmed',
        }),
        updated_at: new Date().toISOString(),
      })
    } catch (err) {
      console.error('Failed to confirm connection:', err)
    }
  }, [clientId])

  // Promote spouse connection to a household
  const handlePromoteToHousehold = useCallback(async (person: ConnectedPerson) => {
    try {
      const auth = getAuth()
      const token = await auth.currentUser?.getIdToken()
      const clientName = [str(client.first_name), str(client.last_name)].filter(Boolean).join(' ')
      const lastName = str(client.last_name) || 'Unknown'

      const res = await fetch('/api/households', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          household_name: `${lastName} Household`,
          primary_contact_id: clientId,
          primary_contact_name: clientName,
          address: str(client.address),
          city: str(client.city),
          state: str(client.state),
          zip: str(client.zip),
          assigned_user_id: str(client.assigned_user_id),
          members: [
            { client_id: clientId, client_name: clientName, role: 'primary', relationship: 'self', added_at: new Date().toISOString() },
            { client_id: person.id, client_name: person.name, role: 'spouse', relationship: 'Spouse', added_at: new Date().toISOString() },
          ],
        }),
      })
      const json = await res.json()
      if (json.success) {
        window.location.reload()
      }
    } catch (err) {
      console.error('Failed to create household:', err)
    }
  }, [client, clientId])

  // FIX-23: Filter connections by review status
  const filteredConnections = useMemo(() => {
    if (filterMode === 'all') return connections
    if (filterMode === 'needs_review') {
      return connections.filter((c) => {
        const via = c.created_via || 'manual'
        const hasPotentialMatch = potentialMatches.has(c.id)
        return hasPotentialMatch || via === 'bulk_import' || via === 'auto_match'
      })
    }
    // confirmed
    return connections.filter((c) => {
      const via = c.created_via || 'manual'
      return via === 'manual' || via === 'confirmed'
    })
  }, [connections, filterMode, potentialMatches])

  // Count needs-review items
  const needsReviewCount = useMemo(() => {
    return connections.filter((c) => {
      const via = c.created_via || 'manual'
      return potentialMatches.has(c.id) || via === 'bulk_import' || via === 'auto_match'
    }).length
  }, [connections, potentialMatches])

  // Helper: get card styling based on source/match status
  //
  // Item 12 (FIX-22): Yellow highlight triggers when: potential match found via
  // email/phone/name similarity from findMatches(). The findMatches() function
  // runs on component mount and checks each connected contact against the clients
  // collection for matches by email (95% confidence), phone (90%), or last name
  // similarity (75%). Results stored in potentialMatches Map.
  //
  // Item 13 (FIX-23): Green highlight triggers when created_via is one of:
  //   - 'bulk_import' — imported via bulk data load
  //   - 'auto_match' — auto-created by matching algorithm
  // These connections need manual review/confirmation before they become 'confirmed'.
  function getCardStyle(person: ConnectedPerson): { border: string; bg: string } {
    // FIX-22: Yellow = potential duplicate match (takes priority)
    if (potentialMatches.has(person.id)) {
      return { border: 'border-yellow-500', bg: 'bg-yellow-500/10' }
    }
    // FIX-23: Green = auto-created via bulk action (bulk_import or auto_match)
    const via = person.created_via || 'manual'
    if (via === 'bulk_import' || via === 'auto_match') {
      return { border: 'border-green-500', bg: 'bg-green-500/10' }
    }
    // Default
    return { border: 'border-[var(--border-subtle)]', bg: 'bg-[var(--bg-card)]' }
  }

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

      {/* FIX-23: Filter toggle */}
      {connections.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--text-muted)]">Show:</span>
          {(['all', 'needs_review', 'confirmed'] as FilterMode[]).map((mode) => {
            const labels: Record<FilterMode, string> = {
              all: 'All',
              needs_review: `Needs Review${needsReviewCount > 0 ? ` (${needsReviewCount})` : ''}`,
              confirmed: 'Confirmed',
            }
            return (
              <button
                key={mode}
                onClick={() => setFilterMode(mode)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  filterMode === mode
                    ? 'bg-[var(--portal)] text-white'
                    : 'bg-[var(--bg-surface)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                }`}
              >
                {labels[mode]}
              </button>
            )
          })}
        </div>
      )}

      {/* Smart search panel */}
      {showSearch && (
        <div className="rounded-lg border border-[var(--portal)]/30 bg-[var(--bg-card)] p-4 space-y-3">
          <div className="flex items-center gap-3">
            {/* Relationship select BEFORE search — FIX-15: appears before confirming link */}
            <select
              value={selectedRelationship}
              onChange={(e) => setSelectedRelationship(e.target.value)}
              className="h-9 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 text-sm text-[var(--text-secondary)]"
            >
              {RELATIONSHIP_TYPES.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
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
          </div>

          {/* FIX-15: Search results with name, email, phone preview */}
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
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[var(--text-primary)]">{r.name}</p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
                      {r.email && (
                        <span className="text-xs text-[var(--text-muted)] truncate">{r.email}</span>
                      )}
                      {r.phone && (
                        <span className="text-xs text-[var(--text-muted)]">{formatPhone(r.phone)}</span>
                      )}
                      {(r.city || r.state) && (
                        <span className="text-xs text-[var(--text-muted)]">
                          {[r.city, r.state].filter(Boolean).join(', ')}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleLink(r.id, r.name, r.phone, r.email)}
                    className="ml-3 shrink-0 rounded-md bg-[var(--portal)] px-3 py-1.5 text-xs font-medium text-white hover:brightness-110"
                  >
                    Link as {selectedRelationship}
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
      {filteredConnections.length === 0 && connections.length === 0 ? (
        <EmptyState icon="people" message="No connected contacts on file. Search and link contacts above." />
      ) : filteredConnections.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10">
          <span className="material-icons-outlined text-3xl text-[var(--text-muted)]">filter_list</span>
          <p className="mt-2 text-sm text-[var(--text-muted)]">No contacts match the selected filter.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {filteredConnections.map((person, i) => {
            const style = getCardStyle(person)
            const match = potentialMatches.get(person.id)
            const via = person.created_via || 'manual'
            const needsConfirmation = via === 'bulk_import' || via === 'auto_match'

            return (
              <div
                key={person.id || `conn-${i}`}
                className={`rounded-lg border ${style.border} ${style.bg} p-4`}
              >
                {/* FIX-22: Potential match badge */}
                {match && (
                  <div className="mb-3 flex items-center justify-between rounded-md bg-yellow-500/15 px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="material-icons-outlined text-[14px] text-yellow-500">warning</span>
                      <span className="text-xs font-medium text-yellow-600">Potential Match Found</span>
                    </div>
                    <button
                      onClick={() => handleConfirmMatch(person, match.id)}
                      className="rounded-md bg-yellow-500 px-2.5 py-1 text-[10px] font-medium text-white hover:bg-yellow-600"
                    >
                      Confirm Match
                    </button>
                  </div>
                )}

                {/* FIX-23: Auto-created banner */}
                {!match && needsConfirmation && (
                  <div className="mb-3 flex items-center justify-between rounded-md bg-green-500/15 px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="material-icons-outlined text-[14px] text-green-500">auto_fix_high</span>
                      <span className="text-xs font-medium text-green-600">Auto-created connection — please review and confirm</span>
                    </div>
                    <button
                      onClick={() => handleConfirmConnection(person)}
                      className="rounded-md bg-green-500 px-2.5 py-1 text-[10px] font-medium text-white hover:bg-green-600"
                    >
                      Confirm
                    </button>
                  </div>
                )}

                {/* FIX-22: Match comparison */}
                {match && (
                  <div className="mb-3 rounded-md border border-yellow-500/30 bg-[var(--bg-surface)] p-3">
                    <p className="text-xs font-medium text-[var(--text-muted)] mb-1.5">Matched to existing client:</p>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-[var(--text-primary)]">{match.name}</p>
                        <p className="text-xs text-[var(--text-muted)]">
                          {match.reason} ({match.confidence}% confidence)
                          {match.email && ` · ${match.email}`}
                        </p>
                      </div>
                      <a
                        href={`/contacts/${match.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-[var(--portal)] hover:underline"
                      >
                        View
                      </a>
                    </div>
                  </div>
                )}

                {/* Card content */}
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
                  <div className="flex items-center gap-2 shrink-0">
                    {/* Promote to Household — shows for Spouse connections when no household exists */}
                    {person.relationship === 'Spouse' && person.id && !client.household_id && (
                      <button
                        onClick={() => handlePromoteToHousehold(person)}
                        className="inline-flex items-center gap-1 rounded-md bg-[var(--portal)]/10 px-2 py-1 text-xs font-medium text-[var(--portal)] transition-colors hover:bg-[var(--portal)]/20"
                        title="Create a household with this spouse"
                      >
                        <span className="material-icons-outlined text-[12px]">home</span>
                        Create Household
                      </button>
                    )}
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
                    <button
                      onClick={() => handleUnlink(person)}
                      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-red-400 transition-colors hover:bg-red-500/10"
                      title="Unlink this contact"
                    >
                      <span className="material-icons-outlined text-[12px]">link_off</span>
                      Unlink
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* TRK-027: Suggested Connections (concept only) */}
      <div className="mt-6 space-y-3">
        <div className="flex items-center gap-2">
          <span className="material-icons-outlined text-[18px] text-amber-400">lightbulb</span>
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Suggested</h3>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { title: 'Same household', desc: 'Shared address', icon: 'home' },
            { title: 'Same last name', desc: `Other "${client.last_name || ''}" contacts`, icon: 'badge' },
            { title: 'Shared carrier accounts', desc: 'Same carrier or policy', icon: 'account_balance' },
          ].map((suggestion) => (
            <div
              key={suggestion.title}
              className="flex flex-col items-center gap-2 rounded-lg border-2 border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 text-center"
            >
              <span className="material-icons-outlined text-[24px] text-[var(--text-muted)]">
                {suggestion.icon}
              </span>
              <p className="text-sm font-medium text-[var(--text-primary)]">{suggestion.title}</p>
              <p className="text-xs text-[var(--text-muted)]">{suggestion.desc}</p>
              <button
                className="mt-1 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 py-1 text-xs font-medium text-[var(--text-muted)] cursor-default opacity-60"
                disabled
              >
                Connect
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
