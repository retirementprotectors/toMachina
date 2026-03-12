'use client'

import { useMemo, useState } from 'react'
import { collection, orderBy, query, limit } from 'firebase/firestore'
import { useCollection, getDb } from '@tomachina/db'
import type { Activity } from '@tomachina/core'
import { formatDate, str } from '../../lib/formatters'
import { EmptyState } from '../../lib/ui-helpers'

interface ActivityTabProps {
  clientId: string
}

type SubTab = 'client' | 'account' | 'comms'

export function ActivityTab({ clientId }: ActivityTabProps) {
  const [subTab, setSubTab] = useState<SubTab>('client')

  // Query activities subcollection
  const activitiesQuery = useMemo(() => {
    if (!clientId) return null
    return query(
      collection(getDb(), 'clients', clientId, 'activities'),
      orderBy('created_at', 'desc'),
      limit(50)
    )
  }, [clientId])

  const { data: activities, loading } = useCollection<Activity>(activitiesQuery, `activities-${clientId}`)

  // Filter by sub-tab
  const filtered = useMemo(() => {
    return activities.filter((a) => {
      const t = str(a.activity_type).toLowerCase()
      switch (subTab) {
        case 'client':
          return t.includes('create') || t.includes('update') || t.includes('status') || t.includes('edit') || t.includes('import') || t.includes('note') || t.includes('profile')
        case 'account':
          return t.includes('account') || t.includes('policy') || t.includes('transaction') || t.includes('valuation')
        case 'comms':
          return t.includes('email') || t.includes('call') || t.includes('sms') || t.includes('text') || t.includes('send') || t.includes('meeting')
        default:
          return true
      }
    })
  }, [activities, subTab])

  if (loading) {
    return (
      <div className="space-y-3 animate-pulse">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex gap-4">
            <div className="h-10 w-10 shrink-0 rounded-full bg-[var(--bg-card)]" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-48 rounded bg-[var(--bg-card)]" />
              <div className="h-3 w-72 rounded bg-[var(--bg-card)]" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Sub-tabs */}
      <div className="flex gap-1 rounded-lg bg-[var(--bg-surface)] p-1">
        {([
          { key: 'client', label: 'Client', icon: 'person' },
          { key: 'account', label: 'Account', icon: 'account_balance_wallet' },
          { key: 'comms', label: 'Comms', icon: 'forum' },
        ] as const).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setSubTab(tab.key)}
            className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-all ${
              subTab === tab.key
                ? 'bg-[var(--portal)] text-white shadow-sm'
                : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
            }`}
          >
            <span className="material-icons-outlined text-[16px]">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Activity list */}
      {filtered.length === 0 ? (
        <EmptyState
          icon="history"
          message={`No ${subTab} activity recorded yet.`}
        />
      ) : (
        <div className="relative">
          <div className="absolute left-5 top-0 bottom-0 w-px bg-[var(--border-subtle)]" />
          <div className="space-y-0">
            {filtered.map((activity, index) => (
              <ActivityRow key={activity.activity_id || index} activity={activity} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ActivityRow({ activity }: { activity: Activity }) {
  const typeInfo = getActivityTypeInfo(str(activity.activity_type))

  return (
    <div className="relative flex gap-4 py-3">
      <div className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${typeInfo.bgColor}`}>
        <span className={`material-icons-outlined text-[18px] ${typeInfo.iconColor}`}>
          {typeInfo.icon}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-medium text-[var(--text-primary)]">
              {str(activity.activity_type) || 'Activity'}
            </p>
            <p className="mt-0.5 text-sm text-[var(--text-secondary)] break-words">
              {str(activity.description) || 'No description'}
            </p>
          </div>
          <p className="shrink-0 text-xs text-[var(--text-muted)] whitespace-nowrap">
            {formatDate(activity.created_at)}
          </p>
        </div>
        {str(activity.performed_by || activity.user || activity.agent_name) && (
          <p className="mt-1.5 text-xs text-[var(--text-muted)]">
            <span className="material-icons-outlined text-[12px] align-middle mr-1">person</span>
            {str(activity.performed_by || activity.user || activity.agent_name)}
          </p>
        )}
      </div>
    </div>
  )
}

function getActivityTypeInfo(type: string): { icon: string; bgColor: string; iconColor: string } {
  const t = type.toLowerCase()
  if (t.includes('create') || t.includes('add') || t.includes('new'))
    return { icon: 'add_circle', bgColor: 'bg-emerald-500/15', iconColor: 'text-emerald-400' }
  if (t.includes('update') || t.includes('edit') || t.includes('change') || t.includes('modify'))
    return { icon: 'edit', bgColor: 'bg-blue-500/15', iconColor: 'text-blue-400' }
  if (t.includes('delete') || t.includes('remove'))
    return { icon: 'remove_circle', bgColor: 'bg-red-500/15', iconColor: 'text-red-400' }
  if (t.includes('email') || t.includes('send'))
    return { icon: 'email', bgColor: 'bg-purple-500/15', iconColor: 'text-purple-400' }
  if (t.includes('call') || t.includes('phone'))
    return { icon: 'phone', bgColor: 'bg-amber-500/15', iconColor: 'text-amber-400' }
  if (t.includes('note') || t.includes('comment'))
    return { icon: 'sticky_note_2', bgColor: 'bg-cyan-500/15', iconColor: 'text-cyan-400' }
  if (t.includes('import') || t.includes('migrate'))
    return { icon: 'cloud_download', bgColor: 'bg-indigo-500/15', iconColor: 'text-indigo-400' }
  if (t.includes('status'))
    return { icon: 'swap_horiz', bgColor: 'bg-orange-500/15', iconColor: 'text-orange-400' }
  if (t.includes('account') || t.includes('policy'))
    return { icon: 'account_balance', bgColor: 'bg-violet-500/15', iconColor: 'text-violet-400' }
  return { icon: 'radio_button_checked', bgColor: 'bg-[var(--bg-surface)]', iconColor: 'text-[var(--text-muted)]' }
}
