'use client'

import { useState, useMemo, useEffect } from 'react'
import { query, where, getDocs, collection, limit } from 'firebase/firestore'
import { getDb } from '@tomachina/db'
import type { Client } from '@tomachina/core'

interface PossibleDuplicatesProps {
  client: Client
  clientId: string
}

interface DuplicateMatch {
  id: string
  name: string
  reason: string
  confidence: number
}

/**
 * Collapsible "Possible Duplicates" section.
 * Only renders when there are potential matches.
 * Sits BELOW the header, ABOVE the tabs.
 */
export function PossibleDuplicates({ client, clientId }: PossibleDuplicatesProps) {
  const [matches, setMatches] = useState<DuplicateMatch[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  // Find potential duplicates based on email, phone, last name + DOB
  useEffect(() => {
    let cancelled = false

    async function findDuplicates() {
      const db = getDb()
      const found: DuplicateMatch[] = []
      const seenIds = new Set<string>([clientId])

      try {
        // Match by email
        if (client.email) {
          const emailQ = query(
            collection(db, 'clients'),
            where('email', '==', client.email),
            limit(10)
          )
          const snap = await getDocs(emailQ)
          snap.docs.forEach((doc) => {
            if (!seenIds.has(doc.id)) {
              seenIds.add(doc.id)
              const d = doc.data()
              found.push({
                id: doc.id,
                name: `${d.first_name || ''} ${d.last_name || ''}`.trim(),
                reason: 'Same email',
                confidence: 95,
              })
            }
          })
        }

        // Match by phone
        if (client.phone) {
          const phoneDigits = String(client.phone).replace(/\D/g, '')
          if (phoneDigits.length >= 10) {
            const phoneQ = query(
              collection(db, 'clients'),
              where('phone', '==', client.phone),
              limit(10)
            )
            const snap = await getDocs(phoneQ)
            snap.docs.forEach((doc) => {
              if (!seenIds.has(doc.id)) {
                seenIds.add(doc.id)
                const d = doc.data()
                found.push({
                  id: doc.id,
                  name: `${d.first_name || ''} ${d.last_name || ''}`.trim(),
                  reason: 'Same phone',
                  confidence: 90,
                })
              }
            })
          }
        }

        // Match by last name (lower confidence, but worth flagging)
        if (client.last_name && client.dob) {
          const nameQ = query(
            collection(db, 'clients'),
            where('last_name', '==', client.last_name),
            where('dob', '==', client.dob),
            limit(10)
          )
          const snap = await getDocs(nameQ)
          snap.docs.forEach((doc) => {
            if (!seenIds.has(doc.id)) {
              seenIds.add(doc.id)
              const d = doc.data()
              found.push({
                id: doc.id,
                name: `${d.first_name || ''} ${d.last_name || ''}`.trim(),
                reason: 'Same last name + DOB',
                confidence: 85,
              })
            }
          })
        }

        if (!cancelled) {
          // Sort by confidence descending
          found.sort((a, b) => b.confidence - a.confidence)
          setMatches(found)
        }
      } catch {
        // Silently fail — duplicates are advisory
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    findDuplicates()
    return () => { cancelled = true }
  }, [client.email, client.phone, client.last_name, client.dob, clientId])

  // Don't render if no matches or still loading with none found
  if (loading || matches.length === 0) return null

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleDdup = () => {
    const ids = [clientId, ...Array.from(selected)].join(',')
    window.open(`/ddup?ids=${ids}&type=client`, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/5">
      {/* Collapsed header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-5 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <span className="material-icons-outlined text-[18px] text-amber-400">warning</span>
          <span className="text-sm font-medium text-amber-400">
            Possible Duplicates ({matches.length})
          </span>
        </div>
        <span
          className={`material-icons-outlined text-[18px] text-amber-400 transition-transform duration-200 ${
            expanded ? 'rotate-180' : ''
          }`}
        >
          expand_more
        </span>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-amber-500/20 px-5 pb-4 pt-3">
          <div className="space-y-2">
            {matches.map((match) => (
              <div
                key={match.id}
                className="flex items-center gap-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] p-3"
              >
                <input
                  type="checkbox"
                  checked={selected.has(match.id)}
                  onChange={() => toggleSelect(match.id)}
                  className="h-4 w-4 rounded border-[var(--border)] accent-[var(--portal)]"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--text-primary)]">{match.name}</p>
                  <p className="text-xs text-[var(--text-muted)]">{match.reason}</p>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    match.confidence >= 95
                      ? 'bg-red-500/15 text-red-400'
                      : match.confidence >= 90
                        ? 'bg-amber-500/15 text-amber-400'
                        : 'bg-blue-500/15 text-blue-400'
                  }`}
                >
                  {match.confidence}%
                </span>
                <a
                  href={`/contacts/${match.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-[var(--portal)] hover:underline"
                >
                  View
                </a>
              </div>
            ))}
          </div>

          {selected.size > 0 && (
            <div className="mt-3 flex justify-end">
              <button
                onClick={handleDdup}
                className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-600"
              >
                <span className="material-icons-outlined text-[16px]">merge_type</span>
                Ddup Selected ({selected.size})
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
