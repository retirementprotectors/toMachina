'use client'

// SIDEBAR INTEGRATION NOTE:
// Add to PortalSidebar.tsx in all 3 portals:
// Section: "Workspace" or "Apps"
// Item: { name: 'COMMS Center', href: '/modules/comms', icon: 'forum' }

import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  getDocs,
  type QuerySnapshot,
  type DocumentData,
} from 'firebase/firestore'
import { getDb } from '@tomachina/db/src/firestore'
import { CommsTimeline, type CommRecord } from './comms/CommsTimeline'
import { CommsToolbar, type CommsClient } from './comms/CommsToolbar'

interface CommsCenterProps {
  portal: 'prodashx' | 'riimo' | 'sentinel'
  clientId?: string
  client?: CommsClient
}

function mapSnapshotToComms(snapshot: QuerySnapshot<DocumentData>): CommRecord[] {
  return snapshot.docs.map((doc) => {
    const d = doc.data()
    return {
      comm_id: (d.comm_id as string) || doc.id,
      channel: (d.channel as CommRecord['channel']) || 'sms',
      direction: (d.direction as CommRecord['direction']) || 'outbound',
      recipient: (d.recipient as string) || null,
      body: (d.body as string) || null,
      subject: (d.subject as string) || null,
      status: (d.status as string) || 'unknown',
      sent_by: (d.sent_by as string) || null,
      created_at: (d.created_at as string) || new Date().toISOString(),
      duration: typeof d.duration === 'number' ? d.duration : null,
      call_type: (d.call_type as string) || null,
    }
  })
}

export function CommsCenter({ portal, clientId, client }: CommsCenterProps) {
  const [comms, setComms] = useState<CommRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'sms' | 'email' | 'voice'>('all')
  const [refreshKey, setRefreshKey] = useState(0)

  const db = useMemo(() => getDb(), [])

  const handleRefresh = useCallback(() => {
    setRefreshKey((k) => k + 1)
  }, [])

  // Client-scoped: real-time listener
  useEffect(() => {
    if (!clientId) return
    setLoading(true)
    const q = query(
      collection(db, 'communications'),
      where('client_id', '==', clientId),
      orderBy('created_at', 'desc'),
      limit(50)
    )
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setComms(mapSnapshotToComms(snapshot))
      setLoading(false)
    }, () => {
      setComms([])
      setLoading(false)
    })
    return () => unsubscribe()
  }, [db, clientId, refreshKey])

  // All-clients: one-time fetch
  useEffect(() => {
    if (clientId) return
    setLoading(true)
    const q = query(
      collection(db, 'communications'),
      orderBy('created_at', 'desc'),
      limit(100)
    )
    getDocs(q)
      .then((snapshot) => { setComms(mapSnapshotToComms(snapshot)) })
      .catch(() => { setComms([]) })
      .finally(() => { setLoading(false) })
  }, [db, clientId, refreshKey])

  const isStandalone = !clientId

  return (
    <div className="space-y-4" data-portal={portal}>
      {isStandalone && (
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">COMMS Center</h2>
          <button onClick={handleRefresh}
            className="inline-flex items-center gap-1.5 rounded-md h-[34px] px-3 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
            <span className="material-icons-outlined text-[16px]">refresh</span>
            Refresh
          </button>
        </div>
      )}
      <CommsToolbar client={client} onSent={handleRefresh} />
      <CommsTimeline comms={comms} loading={loading} filter={filter} onFilterChange={setFilter} />
    </div>
  )
}
