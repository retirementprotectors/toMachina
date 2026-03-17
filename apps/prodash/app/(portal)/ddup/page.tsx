'use client'

import { useState, useEffect, useMemo, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { doc, getDoc, updateDoc, setDoc, getDocs, collection, deleteDoc, arrayUnion } from 'firebase/firestore'
import { getDb } from '@tomachina/db'
import Link from 'next/link'

function str(val: unknown): string {
  if (val == null) return ''
  return String(val)
}

interface RecordData {
  id: string
  data: Record<string, unknown>
  path: string
}

// ---------------------------------------------------------------------------
// Field comparison logic
// ---------------------------------------------------------------------------

type MatchType = 'exact' | 'fuzzy' | 'conflict' | 'missing'

function levenshtein(a: string, b: string): number {
  const m = a.length
  const n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  )
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) dp[i][j] = dp[i - 1][j - 1]
      else dp[i][j] = 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1])
    }
  }
  return dp[m][n]
}

function compareFields(a: string, b: string): MatchType {
  const va = a.trim().toLowerCase()
  const vb = b.trim().toLowerCase()

  if (!va && !vb) return 'exact'
  if (!va || !vb) return 'missing'
  if (va === vb) return 'exact'

  // Fuzzy: one contains the other, or Levenshtein distance < 3
  if (va.includes(vb) || vb.includes(va)) return 'fuzzy'
  if (levenshtein(va, vb) < 3) return 'fuzzy'

  return 'conflict'
}

// ---------------------------------------------------------------------------
// Match confidence score
// ---------------------------------------------------------------------------

function calcConfidence(fields: string[], records: RecordData[]): number {
  if (records.length < 2) return 0
  const a = records[0]
  const b = records[1]
  let score = 0
  let total = 0
  for (const field of fields) {
    const va = str(a.data[field])
    const vb = str(b.data[field])
    if (!va && !vb) continue
    total++
    const match = compareFields(va, vb)
    if (match === 'exact') score += 1
    else if (match === 'fuzzy') score += 0.5
  }
  return total > 0 ? Math.round((score / total) * 100) : 0
}

// ---------------------------------------------------------------------------
// Row/cell color classes
// ---------------------------------------------------------------------------

function getRowClass(match: MatchType): string {
  switch (match) {
    case 'exact': return 'bg-green-50 dark:bg-green-900/10'
    case 'fuzzy': return 'bg-yellow-50 dark:bg-yellow-900/10'
    case 'conflict': return 'bg-red-50 dark:bg-red-900/10'
    case 'missing': return 'bg-yellow-50/50 dark:bg-yellow-900/5'
    default: return ''
  }
}

function getCellClass(isWinner: boolean, match: MatchType): string {
  if (isWinner) {
    if (match === 'conflict') return 'bg-[var(--portal)]/10 text-[var(--portal)] font-medium'
    if (match === 'fuzzy') return 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 font-medium'
    return 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 font-medium'
  }
  return 'text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
}

function getMatchIcon(match: MatchType): string {
  switch (match) {
    case 'exact': return 'check_circle'
    case 'fuzzy': return 'change_circle'
    case 'conflict': return 'error'
    case 'missing': return 'remove_circle_outline'
  }
}

function getMatchIconClass(match: MatchType): string {
  switch (match) {
    case 'exact': return 'text-green-500'
    case 'fuzzy': return 'text-yellow-500'
    case 'conflict': return 'text-red-500'
    case 'missing': return 'text-[var(--text-muted)]'
  }
}

// ---------------------------------------------------------------------------
// Merge Confirmation Modal (NOT using alert/confirm — custom modal)
// ---------------------------------------------------------------------------

interface MergeModalProps {
  winnerName: string
  loserName: string
  onConfirm: () => void
  onCancel: () => void
  merging: boolean
}

function MergeModal({ winnerName, loserName, onConfirm, onCancel, merging }: MergeModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-6 shadow-xl">
        <div className="mb-4 flex items-center gap-3">
          <span className="material-icons-outlined text-[24px] text-amber-500">merge_type</span>
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">Confirm Merge</h3>
        </div>
        <p className="mb-4 text-sm text-[var(--text-secondary)]">
          Are you sure you want to merge these records?
        </p>
        <div className="mb-5 space-y-2 rounded-lg bg-[var(--bg-surface)] p-3">
          <div className="flex items-center gap-2 text-sm">
            <span className="material-icons-outlined text-[16px] text-green-500">star</span>
            <span className="text-[var(--text-muted)]">Surviving Record:</span>
            <span className="font-medium text-[var(--text-primary)]">{winnerName}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="material-icons-outlined text-[16px] text-[var(--text-muted)]">archive</span>
            <span className="text-[var(--text-muted)]">Record to Archive:</span>
            <span className="font-medium text-[var(--text-primary)]">{loserName}</span>
          </div>
        </div>
        <p className="mb-5 text-xs text-[var(--text-muted)]">
          The archived record will be marked as merged (not deleted). All selected field values will be written to the surviving record.
        </p>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={merging}
            className="inline-flex items-center gap-1.5 rounded-md h-[34px] px-4 text-sm font-medium border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={merging}
            className="inline-flex items-center gap-1.5 rounded-md h-[34px] px-4 text-sm font-medium bg-[var(--portal)] text-white hover:brightness-110 disabled:opacity-50"
          >
            {merging ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <span className="material-icons-outlined text-[16px]">merge_type</span>
            )}
            Confirm Merge
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Confidence Bar
// ---------------------------------------------------------------------------

function ConfidenceBar({ score }: { score: number }) {
  let colorClass = 'bg-red-500'
  if (score >= 80) colorClass = 'bg-green-500'
  else if (score >= 60) colorClass = 'bg-yellow-500'
  else if (score >= 40) colorClass = 'bg-orange-500'

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-[var(--text-muted)] whitespace-nowrap">Match Confidence</span>
      <div className="flex-1 h-2 rounded-full bg-[var(--bg-surface)] overflow-hidden max-w-[200px]">
        <div
          className={`h-full rounded-full transition-all ${colorClass}`}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className={`text-sm font-bold ${
        score >= 80 ? 'text-green-500' : score >= 60 ? 'text-yellow-500' : 'text-red-500'
      }`}>
        {score}%
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Legend
// ---------------------------------------------------------------------------

function MatchLegend() {
  const items: Array<{ match: MatchType; label: string }> = [
    { match: 'exact', label: 'Exact match' },
    { match: 'fuzzy', label: 'Fuzzy match' },
    { match: 'conflict', label: 'Conflict' },
    { match: 'missing', label: 'Missing' },
  ]

  return (
    <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--text-muted)]">
      <span className="font-medium text-[var(--text-secondary)]">Field match:</span>
      {items.map(({ match, label }) => (
        <span key={match} className="inline-flex items-center gap-1">
          <span className={`material-icons-outlined text-[14px] ${getMatchIconClass(match)}`}>
            {getMatchIcon(match)}
          </span>
          {label}
        </span>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main DeDup content
// ---------------------------------------------------------------------------

function DdupContent() {
  const searchParams = useSearchParams()
  const ids = searchParams.get('ids')?.split(',').filter(Boolean) || []
  const clientIdParam = searchParams.get('clientId')
  const type = searchParams.get('type') || 'client'
  // Support /ddup?clientId=xxx — loads that client record for comparison
  const effectiveIds = clientIdParam && ids.length === 0 ? [clientIdParam] : ids

  const [records, setRecords] = useState<RecordData[]>([])
  const [loading, setLoading] = useState(true)
  const [winnerValues, setWinnerValues] = useState<Record<string, string>>({})
  const [merging, setMerging] = useState(false)
  const [merged, setMerged] = useState(false)
  const [mergedWinnerId, setMergedWinnerId] = useState<string | null>(null)
  const [showMergeModal, setShowMergeModal] = useState(false)
  const [ignoring, setIgnoring] = useState(false)
  const [ignored, setIgnored] = useState(false)
  // TRK-036: For account comparisons, store the parent client's ACF link per record
  const [parentAcfLinks, setParentAcfLinks] = useState<Record<string, string>>({})

  // Load records
  useEffect(() => {
    if (effectiveIds.length === 0) return

    async function loadRecords() {
      const db = getDb()
      const results: RecordData[] = []

      for (const id of effectiveIds) {
        try {
          let ref
          let path: string
          // Items 6-7 (DD-2, FIX-4): Use '::' delimiter for account composite IDs
          // to avoid conflicts with hyphens in Firestore doc IDs (UUID format).
          // Format: clientId::accountId — also supports legacy '-' separator as fallback.
          if (type === 'account' && (id.includes('::') || id.includes('-'))) {
            const sep = id.includes('::') ? '::' : '-'
            const sepIndex = id.indexOf(sep)
            const clientIdPart = id.slice(0, sepIndex)
            const accountId = id.slice(sepIndex + sep.length)
            ref = doc(db, 'clients', clientIdPart, 'accounts', accountId)
            path = `clients/${clientIdPart}/accounts/${accountId}`
          } else {
            ref = doc(db, 'clients', id)
            path = `clients/${id}`
          }
          const snap = await getDoc(ref)
          if (snap.exists()) {
            const data = snap.data() as Record<string, unknown>
            // TRK-042: Skip records that are merged, deleted, terminated, or marked _merged_into
            const clientStatus = str(data.client_status).toLowerCase()
            const status = str(data.status).toLowerCase()
            const excludeStatuses = ['merged', 'deleted', 'terminated']
            if (excludeStatuses.includes(clientStatus) || excludeStatuses.includes(status) || data._merged_into) {
              continue
            }
            results.push({ id: snap.id, data, path })
          }
        } catch {
          // Skip failed loads
        }
      }

      setRecords(results)

      // TRK-036: For account comparisons, load parent client docs to get ACF link
      if (type === 'account') {
        const acfMap: Record<string, string> = {}
        const loadedClients = new Set<string>()
        for (const rec of results) {
          // Extract clientId from the path: clients/{clientId}/accounts/{accountId}
          const parts = rec.path.split('/')
          const parentClientId = parts[1]
          if (!parentClientId || loadedClients.has(parentClientId)) continue
          loadedClients.add(parentClientId)
          try {
            const clientSnap = await getDoc(doc(db, 'clients', parentClientId))
            if (clientSnap.exists()) {
              const clientData = clientSnap.data() as Record<string, unknown>
              const acfUrl = str(clientData.gdrive_folder_url) || str(clientData.acf_link) || str(clientData.acf_url)
              if (acfUrl) {
                // Map each account record ID to the parent's ACF link
                for (const r of results) {
                  if (r.path.startsWith(`clients/${parentClientId}/`)) {
                    acfMap[r.id] = acfUrl
                  }
                }
              }
            }
          } catch {
            // Non-critical
          }
        }
        setParentAcfLinks(acfMap)
      }

      setLoading(false)
    }
    loadRecords()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveIds.join(','), type])

  // All unique fields
  const allFields = useMemo(() => {
    const skip = new Set(['_id', '_migrated_at', '_source', 'created_at', 'updated_at', 'ghl_contact_id', 'ghl_object_id', 'import_source', '_merged_into', '_merged_at'])
    // Logical field order: name → contact → personal → dates → ids → everything else
    const priority: Record<string, number> = {
      first_name: 1, last_name: 2, full_name: 3, preferred_name: 4,
      phone: 10, mobile_phone: 11, home_phone: 12, work_phone: 13, email: 14, secondary_email: 15,
      address: 20, address_line_1: 21, address_line_2: 22, city: 23, state: 24, zip: 25, county: 26,
      date_of_birth: 30, dob: 31, gender: 32, ssn: 33, ssn_last4: 34,
      medicare_id: 40, medicare_part_a_date: 41, medicare_part_b_date: 42,
      dl_number: 50, dl_state: 51, dl_issue_date: 52, dl_expiration: 53,
      agent: 60, book_of_business: 61, source: 62, client_status: 63, classification: 64,
      client_id: 90, account_id: 91, policy_number: 92, account_number: 93,
    }
    const fields = new Set<string>()
    for (const rec of records) {
      for (const key of Object.keys(rec.data)) {
        if (!skip.has(key)) fields.add(key)
      }
    }
    return Array.from(fields).sort((a, b) => {
      const pa = priority[a] ?? 100
      const pb = priority[b] ?? 100
      if (pa !== pb) return pa - pb
      return a.localeCompare(b)
    })
  }, [records])

  // Per-field match types
  const fieldMatches = useMemo(() => {
    const result: Record<string, MatchType> = {}
    if (records.length < 2) return result
    for (const field of allFields) {
      const va = str(records[0].data[field])
      const vb = str(records[1].data[field])
      result[field] = compareFields(va, vb)
    }
    return result
  }, [records, allFields])

  // Confidence score
  const confidence = useMemo(() => calcConfidence(allFields, records), [allFields, records])

  const winnerId = records[0]?.id || ''

  useEffect(() => {
    if (records.length === 0) return
    const defaults: Record<string, string> = {}
    for (const field of allFields) {
      defaults[field] = winnerId
    }
    setWinnerValues(defaults)
  }, [records, allFields, winnerId])

  const handleSelectWinner = useCallback((field: string, recordId: string) => {
    setWinnerValues((prev) => ({ ...prev, [field]: recordId }))
  }, [])

  // Ignore match
  const handleIgnore = useCallback(async () => {
    if (records.length < 2 || ignoring) return
    setIgnoring(true)
    try {
      const db = getDb()
      const pairKey = [records[0].id, records[1].id].sort().join('__')
      await setDoc(doc(db, 'ddup_ignored', pairKey), {
        record_a_id: records[0].id,
        record_b_id: records[1].id,
        type,
        ignored_at: new Date().toISOString(),
      })
      setIgnored(true)
    } catch {
      // swallow — non-critical
    } finally {
      setIgnoring(false)
    }
  }, [records, type, ignoring])

  // Merge (after confirmation modal)
  const handleMerge = useCallback(async () => {
    if (records.length < 2 || merging) return
    setMerging(true)

    try {
      const db = getDb()
      const winner = records[0]
      const mergedData: Record<string, unknown> = { ...winner.data }

      for (const [field, selectedId] of Object.entries(winnerValues)) {
        const sourceRecord = records.find((r) => r.id === selectedId)
        if (sourceRecord && sourceRecord.data[field] != null) {
          mergedData[field] = sourceRecord.data[field]
        }
      }

      mergedData.updated_at = new Date().toISOString()

      await updateDoc(doc(db, winner.path), mergedData)

      // Archive losers and move associated records
      for (let i = 1; i < records.length; i++) {
        const loser = records[i]
        const loserId = loser.id
        const statusField = type === 'client' ? 'client_status' : 'status'

        await updateDoc(doc(db, loser.path), {
          [statusField]: 'merged',
          _merged_into: winner.id,
          _merged_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })

        // Item 5 (FIX-21): Move child collections from loser to winner
        if (type === 'client') {
          // 1. Move accounts subcollection
          try {
            const loserAccounts = await getDocs(collection(db, 'clients', loserId, 'accounts'))
            for (const accountDoc of loserAccounts.docs) {
              await setDoc(doc(db, 'clients', winner.id, 'accounts', accountDoc.id), accountDoc.data())
              await deleteDoc(accountDoc.ref)
            }
          } catch {
            // Non-critical — accounts may not exist
          }

          // 2. Merge connected_contacts from loser into winner
          const loserConnected = loser.data.connected_contacts as Array<Record<string, unknown>> | undefined
          if (Array.isArray(loserConnected) && loserConnected.length > 0) {
            try {
              await updateDoc(doc(db, winner.path), {
                connected_contacts: arrayUnion(...loserConnected),
              })
            } catch {
              // Non-critical
            }
          }

          // 3. Move communications subcollection
          try {
            const loserComms = await getDocs(collection(db, 'clients', loserId, 'communications'))
            for (const commDoc of loserComms.docs) {
              await setDoc(doc(db, 'clients', winner.id, 'communications', commDoc.id), commDoc.data())
              await deleteDoc(commDoc.ref)
            }
          } catch {
            // Non-critical — communications may not exist
          }

          // 4. Move access_items subcollection
          try {
            const loserAccessItems = await getDocs(collection(db, 'clients', loserId, 'access_items'))
            for (const accessDoc of loserAccessItems.docs) {
              await setDoc(doc(db, 'clients', winner.id, 'access_items', accessDoc.id), accessDoc.data())
              await deleteDoc(accessDoc.ref)
            }
          } catch {
            // Non-critical — access_items may not exist
          }

          // 5. Household membership reconciliation
          try {
            const winnerData = mergedData as Record<string, unknown>
            const loserData = loser.data as Record<string, unknown>
            const winnerHouseholdId = winnerData.household_id as string | undefined
            const loserHouseholdId = loserData.household_id as string | undefined

            if (loserHouseholdId && !winnerHouseholdId) {
              // Scenario 1: Loser has household, winner doesn't — transfer membership
              await updateDoc(doc(db, winner.path), { household_id: loserHouseholdId })
              const householdRef = doc(db, 'households', loserHouseholdId)
              const householdSnap = await getDoc(householdRef)
              if (householdSnap.exists()) {
                const hhData = householdSnap.data() as Record<string, unknown>
                const members = (hhData.members || []) as Array<Record<string, unknown>>
                const updatedMembers = members.map(m =>
                  m.client_id === loserId
                    ? { ...m, client_id: winner.id, client_name: `${winnerData.first_name || ''} ${winnerData.last_name || ''}`.trim() }
                    : m
                )
                const updates: Record<string, unknown> = { members: updatedMembers, updated_at: new Date().toISOString() }
                if (hhData.primary_contact_id === loserId) {
                  updates.primary_contact_id = winner.id
                  updates.primary_contact_name = `${winnerData.first_name || ''} ${winnerData.last_name || ''}`.trim()
                }
                await updateDoc(householdRef, updates)
              }
            } else if (loserHouseholdId && winnerHouseholdId && loserHouseholdId === winnerHouseholdId) {
              // Scenario 2: Both in same household — just remove loser from members
              const householdRef = doc(db, 'households', loserHouseholdId)
              const householdSnap = await getDoc(householdRef)
              if (householdSnap.exists()) {
                const hhData = householdSnap.data() as Record<string, unknown>
                const members = (hhData.members || []) as Array<Record<string, unknown>>
                const filtered = members.filter(m => m.client_id !== loserId)
                await updateDoc(householdRef, { members: filtered, updated_at: new Date().toISOString() })
              }
            } else if (loserHouseholdId && winnerHouseholdId && loserHouseholdId !== winnerHouseholdId) {
              // Scenario 3: Different households — remove loser from their household
              const loserHouseholdRef = doc(db, 'households', loserHouseholdId)
              const loserHouseholdSnap = await getDoc(loserHouseholdRef)
              if (loserHouseholdSnap.exists()) {
                const hhData = loserHouseholdSnap.data() as Record<string, unknown>
                const members = (hhData.members || []) as Array<Record<string, unknown>>
                const filtered = members.filter(m => m.client_id !== loserId)
                const updates: Record<string, unknown> = { members: filtered, updated_at: new Date().toISOString() }
                if (filtered.length === 0) {
                  updates.household_status = 'Inactive'
                }
                await updateDoc(loserHouseholdRef, updates)
              }
            }
            // Scenario 4: Neither has household — no-op
          } catch {
            // Non-critical — household update failure shouldn't block merge
          }
        }
      }

      setMergedWinnerId(winner.id)
      setMerged(true)
    } catch {
      // swallow
    } finally {
      setMerging(false)
      setShowMergeModal(false)
    }
  }, [records, winnerValues, type, merging])

  function getRecordName(rec: RecordData): string {
    const first = str(rec.data.first_name)
    const last = str(rec.data.last_name)
    if (first || last) return `${first} ${last}`.trim()
    return rec.id.slice(0, 12)
  }

  // ---------------------------------------------------------------------------
  // States
  // ---------------------------------------------------------------------------

  if (effectiveIds.length === 0) {
    return (
      <div className="mx-auto max-w-4xl py-20 text-center">
        <span className="material-icons-outlined text-5xl text-[var(--text-muted)]">merge_type</span>
        <h2 className="mt-4 text-xl font-semibold text-[var(--text-primary)]">No records selected</h2>
        <p className="mt-2 text-sm text-[var(--text-muted)]">Pass <span className="font-mono">?ids=id1,id2</span> or <span className="font-mono">?clientId=xxx</span> to compare records.</p>
        <Link href={type === 'account' ? '/accounts' : '/contacts'} className="mt-6 inline-flex items-center gap-1.5 rounded-md h-[34px] px-5 text-sm font-medium bg-[var(--portal)] text-white">
          Go Back
        </Link>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl py-20 flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--portal)] border-t-transparent" />
        <p className="text-sm text-[var(--text-muted)]">Loading records for comparison...</p>
      </div>
    )
  }

  if (ignored) {
    return (
      <div className="mx-auto max-w-4xl py-20 text-center">
        <span className="material-icons-outlined text-5xl text-[var(--text-muted)]">block</span>
        <h2 className="mt-4 text-xl font-semibold text-[var(--text-primary)]">Match Ignored</h2>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          This pair has been marked as not a duplicate and removed from the duplicate list.
        </p>
        <Link href={type === 'account' ? '/accounts' : '/contacts'} className="mt-6 inline-flex items-center gap-1.5 rounded-md h-[34px] px-5 text-sm font-medium bg-[var(--portal)] text-white">
          Back to {type === 'account' ? 'Accounts' : 'Clients'}
        </Link>
      </div>
    )
  }

  if (merged) {
    return (
      <div className="mx-auto max-w-4xl py-20 text-center">
        <span className="material-icons-outlined text-5xl text-emerald-400">check_circle</span>
        <h2 className="mt-4 text-xl font-semibold text-[var(--text-primary)]">Merge Complete</h2>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          Records have been merged. The losing record has been archived with status &ldquo;merged&rdquo;.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          {mergedWinnerId && type === 'client' && (
            <Link
              href={`/contacts/${mergedWinnerId}`}
              className="inline-flex items-center gap-1.5 rounded-md h-[34px] px-5 text-sm font-medium bg-[var(--portal)] text-white hover:brightness-110"
            >
              <span className="material-icons-outlined text-[16px]">person</span>
              View Surviving Record
            </Link>
          )}
          <Link
            href={type === 'account' ? '/accounts' : '/contacts'}
            className="inline-flex items-center gap-1.5 rounded-md h-[34px] px-5 text-sm font-medium border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface)]"
          >
            Back to {type === 'account' ? 'Accounts' : 'Clients'}
          </Link>
        </div>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Main comparison view
  // ---------------------------------------------------------------------------

  const winnerName = records[0] ? getRecordName(records[0]) : 'Record A'
  const loserName = records[1] ? getRecordName(records[1]) : 'Record B'

  return (
    <>
      <div className="mx-auto max-w-full space-y-5 overflow-x-auto">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Link
                href={type === 'account' ? '/accounts' : '/contacts'}
                className="text-[var(--text-muted)] hover:text-[var(--portal)] transition-colors"
              >
                <span className="material-icons-outlined text-[20px]">arrow_back</span>
              </Link>
              <h1 className="text-2xl font-bold text-[var(--text-primary)]">
                DeDup Comparison
              </h1>
              <span className="rounded-full bg-[var(--bg-surface)] px-2.5 py-0.5 text-xs font-medium text-[var(--text-muted)] capitalize">
                {type === 'account' ? 'Accounts' : 'Clients'}
              </span>
            </div>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Comparing {records.length} records. Left record is the default winner. Click a field value to select it for the merge.
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleIgnore}
              disabled={ignoring}
              className="inline-flex items-center gap-1.5 rounded-md h-[34px] px-4 text-sm font-medium border border-[var(--border)] text-[var(--text-secondary)] transition-all hover:border-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-50"
            >
              {ignoring ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--text-muted)] border-t-transparent" />
              ) : (
                <span className="material-icons-outlined text-[16px]">block</span>
              )}
              Ignore Match
            </button>
            <button
              onClick={() => setShowMergeModal(true)}
              disabled={merging}
              className="inline-flex items-center gap-1.5 rounded-md h-[34px] px-4 text-sm font-medium bg-[var(--portal)] text-white transition-all hover:brightness-110 disabled:opacity-50"
            >
              <span className="material-icons-outlined text-[16px]">merge_type</span>
              Merge Records
            </button>
          </div>
        </div>

        {/* Confidence + Legend */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] px-4 py-3">
          <ConfidenceBar score={confidence} />
          <MatchLegend />
        </div>

        {/* Comparison table */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[var(--bg-surface)]">
              <tr>
                <th className="sticky left-0 z-10 bg-[var(--bg-surface)] px-4 py-3 text-left text-xs font-semibold uppercase text-[var(--text-muted)] w-40">Field</th>
                <th className="px-2 py-3 w-8"></th>
                {records.map((rec, i) => {
                  const recName = i === 0 ? winnerName : loserName
                  // TRK-036: For clients, ACF link is on the record; for accounts, use parent client's ACF link
                  const acfUrl = type === 'account'
                    ? (parentAcfLinks[rec.id] || '')
                    : (str(rec.data.gdrive_folder_url) || str(rec.data.acf_link) || str(rec.data.acf_url))
                  // For account comparisons, extract clientId from path for linking
                  const parentClientId = type === 'account' ? rec.path.split('/')[1] : null
                  return (
                    <th key={rec.id} className="px-4 py-3 text-left text-xs font-semibold uppercase text-[var(--text-muted)] min-w-[220px]">
                      <div className="flex items-center gap-2">
                        {i === 0 && (
                          <span className="rounded bg-[var(--portal)] px-1.5 py-0.5 text-[10px] text-white font-bold">WINNER</span>
                        )}
                        {/* Contact/Account name links to detail page in new tab */}
                        {type === 'client' ? (
                          <a
                            href={`/contacts/${rec.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[var(--portal)] hover:underline normal-case"
                          >
                            {recName}
                          </a>
                        ) : type === 'account' && parentClientId ? (
                          <a
                            href={`/contacts/${parentClientId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[var(--portal)] hover:underline normal-case"
                          >
                            {recName}
                          </a>
                        ) : (
                          recName
                        )}
                        <span className="text-[var(--text-muted)] font-normal normal-case font-mono text-[10px]">
                          {rec.id.slice(0, 8)}
                        </span>
                      </div>
                      {/* ACF link row — from client doc (directly or via parent) */}
                      {acfUrl && (
                        <div className="mt-1">
                          <a
                            href={acfUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[10px] font-normal normal-case text-[var(--portal)] hover:underline"
                          >
                            <span className="material-icons-outlined text-[11px]">folder_open</span>
                            ACF
                          </a>
                        </div>
                      )}
                    </th>
                  )
                })}
                {records.length >= 2 && (
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-[var(--text-muted)] w-28">Keep</th>
                )}
              </tr>
            </thead>
            <tbody>
              {allFields.map((field) => {
                const match = fieldMatches[field] ?? 'exact'
                const isAllSame = match === 'exact'
                const fieldLabel = field.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

                return (
                  <tr key={field} className={`border-t border-[var(--border)] ${getRowClass(match)}`}>
                    {/* Field name */}
                    <td className="sticky left-0 z-10 bg-inherit px-4 py-2 text-xs font-medium text-[var(--text-muted)]">
                      {fieldLabel}
                    </td>

                    {/* Match icon */}
                    <td className="px-2 py-2">
                      <span className={`material-icons-outlined text-[14px] ${getMatchIconClass(match)}`} title={match}>
                        {getMatchIcon(match)}
                      </span>
                    </td>

                    {/* Values */}
                    {records.map((rec) => {
                      const val = str(rec.data[field])
                      const isWinner = winnerValues[field] === rec.id

                      return (
                        <td
                          key={rec.id}
                          onClick={() => !isAllSame && handleSelectWinner(field, rec.id)}
                          className={`px-4 py-2 transition-colors ${!isAllSame ? 'cursor-pointer' : ''} ${getCellClass(isWinner, match)}`}
                        >
                          {val || <span className="text-[var(--text-muted)]">&mdash;</span>}
                          {isWinner && !isAllSame && (
                            <span className="ml-1 material-icons-outlined text-[12px]">check_circle</span>
                          )}
                        </td>
                      )
                    })}

                    {/* Radio: Keep A / Keep B */}
                    {records.length >= 2 && (
                      <td className="px-4 py-2">
                        {!isAllSame ? (
                          <div className="flex items-center gap-2">
                            {records.map((rec, i) => (
                              <label key={rec.id} className="flex items-center gap-1 cursor-pointer text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                                <input
                                  type="radio"
                                  name={`field-${field}`}
                                  value={rec.id}
                                  checked={winnerValues[field] === rec.id}
                                  onChange={() => handleSelectWinner(field, rec.id)}
                                  className="accent-[var(--portal)]"
                                />
                                {i === 0 ? 'A' : 'B'}
                              </label>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-[var(--text-muted)]">—</span>
                        )}
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Merge confirmation modal */}
      {showMergeModal && (
        <MergeModal
          winnerName={winnerName}
          loserName={loserName}
          onConfirm={handleMerge}
          onCancel={() => setShowMergeModal(false)}
          merging={merging}
        />
      )}
    </>
  )
}

export default function DdupPage() {
  return (
    <Suspense fallback={
      <div className="mx-auto max-w-6xl py-20 flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--portal)] border-t-transparent" />
        <p className="text-sm text-[var(--text-muted)]">Loading...</p>
      </div>
    }>
      <DdupContent />
    </Suspense>
  )
}
