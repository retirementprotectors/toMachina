'use client'

import { useState, useEffect, useMemo, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { doc, getDoc, updateDoc } from 'firebase/firestore'
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

function DdupContent() {
  const searchParams = useSearchParams()
  const ids = searchParams.get('ids')?.split(',').filter(Boolean) || []
  const type = searchParams.get('type') || 'client' // 'client' or 'account'

  const [records, setRecords] = useState<RecordData[]>([])
  const [loading, setLoading] = useState(true)
  const [winnerValues, setWinnerValues] = useState<Record<string, string>>({}) // field -> recordId
  const [merging, setMerging] = useState(false)
  const [merged, setMerged] = useState(false)

  // Load records
  useEffect(() => {
    if (ids.length === 0) return

    async function loadRecords() {
      const db = getDb()
      const results: RecordData[] = []

      for (const id of ids) {
        try {
          let ref
          let path: string
          if (type === 'account' && id.includes('-')) {
            // Account IDs come as "clientId-accountId"
            const [clientId, accountId] = id.split('-')
            ref = doc(db, 'clients', clientId, 'accounts', accountId)
            path = `clients/${clientId}/accounts/${accountId}`
          } else {
            ref = doc(db, 'clients', id)
            path = `clients/${id}`
          }
          const snap = await getDoc(ref)
          if (snap.exists()) {
            results.push({
              id: snap.id,
              data: snap.data() as Record<string, unknown>,
              path,
            })
          }
        } catch {
          // Skip failed loads
        }
      }

      setRecords(results)
      setLoading(false)
    }
    loadRecords()
  }, [ids.join(','), type])

  // All unique fields across all records
  const allFields = useMemo(() => {
    const skip = new Set(['_id', '_migrated_at', '_source', 'created_at', 'updated_at', 'ghl_contact_id', 'ghl_object_id', 'import_source'])
    const fields = new Set<string>()
    for (const rec of records) {
      for (const key of Object.keys(rec.data)) {
        if (!skip.has(key)) fields.add(key)
      }
    }
    return Array.from(fields).sort()
  }, [records])

  // Winner record is the first one (current client)
  const winnerId = records[0]?.id || ''

  // Initialize winner values: default to first record's values
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

  const handleMerge = useCallback(async () => {
    if (records.length < 2 || merging) return
    setMerging(true)

    try {
      const db = getDb()
      const winner = records[0]
      const mergedData: Record<string, unknown> = { ...winner.data }

      // Apply winner selections
      for (const [field, selectedId] of Object.entries(winnerValues)) {
        const sourceRecord = records.find((r) => r.id === selectedId)
        if (sourceRecord && sourceRecord.data[field] != null) {
          mergedData[field] = sourceRecord.data[field]
        }
      }

      mergedData.updated_at = new Date().toISOString()

      // Write merged data to winner
      const winnerRef = doc(db, winner.path)
      await updateDoc(winnerRef, mergedData)

      // Inactivate losers
      for (let i = 1; i < records.length; i++) {
        const loser = records[i]
        const loserRef = doc(db, loser.path)
        const statusField = type === 'client' ? 'client_status' : 'status'
        await updateDoc(loserRef, {
          [statusField]: 'Inactive',
          _merged_into: winner.id,
          updated_at: new Date().toISOString(),
        })
      }

      setMerged(true)
    } catch (err) {
      console.error('Merge failed:', err)
    } finally {
      setMerging(false)
    }
  }, [records, winnerValues, type, merging])

  if (ids.length === 0) {
    return (
      <div className="mx-auto max-w-4xl py-20 text-center">
        <span className="material-icons-outlined text-5xl text-[var(--text-muted)]">merge_type</span>
        <h2 className="mt-4 text-xl font-semibold text-[var(--text-primary)]">No records selected</h2>
        <p className="mt-2 text-sm text-[var(--text-muted)]">Select records from the grid to compare and merge.</p>
        <Link href={type === 'account' ? '/accounts' : '/clients'} className="mt-6 inline-block rounded-lg bg-[var(--portal)] px-5 py-2.5 text-sm font-medium text-white">
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

  if (merged) {
    return (
      <div className="mx-auto max-w-4xl py-20 text-center">
        <span className="material-icons-outlined text-5xl text-emerald-400">check_circle</span>
        <h2 className="mt-4 text-xl font-semibold text-[var(--text-primary)]">Merge Complete</h2>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          Records have been merged. Losing records have been set to Inactive.
        </p>
        <Link href={type === 'account' ? '/accounts' : '/clients'} className="mt-6 inline-block rounded-lg bg-[var(--portal)] px-5 py-2.5 text-sm font-medium text-white">
          Back to {type === 'account' ? 'Accounts' : 'Clients'}
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-full space-y-6 overflow-x-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">
            Ddup Comparison — {type === 'account' ? 'Accounts' : 'Clients'}
          </h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Comparing {records.length} records. First record (left) is the winner. Click field values to select the winner value.
          </p>
        </div>
        <button
          onClick={handleMerge}
          disabled={merging}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--portal)] px-6 py-2.5 text-sm font-medium text-white transition-all hover:brightness-110 disabled:opacity-50"
        >
          {merging ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : (
            <span className="material-icons-outlined text-[16px]">merge_type</span>
          )}
          Merge
        </button>
      </div>

      {/* Comparison table */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[var(--bg-surface)]">
            <tr>
              <th className="sticky left-0 z-10 bg-[var(--bg-surface)] px-4 py-3 text-left text-xs font-semibold uppercase text-[var(--text-muted)] w-40">Field</th>
              {records.map((rec, i) => (
                <th key={rec.id} className="px-4 py-3 text-left text-xs font-semibold uppercase text-[var(--text-muted)] min-w-[200px]">
                  <div className="flex items-center gap-2">
                    {i === 0 && (
                      <span className="rounded bg-[var(--portal)] px-1.5 py-0.5 text-[10px] text-white font-bold">WINNER</span>
                    )}
                    Record {i + 1}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {allFields.map((field) => {
              const values = records.map((r) => str(r.data[field]))
              const allSame = values.every((v) => v === values[0])
              const fieldLabel = field.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

              return (
                <tr key={field} className={`border-t border-[var(--border)] ${allSame ? '' : 'bg-amber-500/5'}`}>
                  <td className="sticky left-0 z-10 bg-[var(--bg-card)] px-4 py-2 text-xs font-medium text-[var(--text-muted)]">
                    {fieldLabel}
                    {!allSame && (
                      <span className="ml-1 text-amber-400">*</span>
                    )}
                  </td>
                  {records.map((rec) => {
                    const val = str(rec.data[field])
                    const isWinner = winnerValues[field] === rec.id
                    return (
                      <td
                        key={rec.id}
                        onClick={() => !allSame && handleSelectWinner(field, rec.id)}
                        className={`px-4 py-2 text-sm cursor-pointer transition-colors ${
                          isWinner
                            ? 'bg-[var(--portal)]/10 text-[var(--portal)] font-medium'
                            : 'text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
                        }`}
                      >
                        {val || <span className="text-[var(--text-muted)]">&mdash;</span>}
                        {isWinner && !allSame && (
                          <span className="ml-1 material-icons-outlined text-[12px] text-[var(--portal)]">check_circle</span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
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
