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

type ActivityFilter = 'all' | 'create' | 'update' | 'email' | 'call' | 'note' | 'import' | 'status'

export function ActivityTab({ clientId }: ActivityTabProps) {
  const [typeFilter, setTypeFilter] = useState<ActivityFilter>('all')

  // Query the activities subcollection under this client
  const activitiesQuery = useMemo(() => {
    if (!clientId) return null
    return query(
      collection(getDb(), 'clients', clientId, 'activities'),
      orderBy('created_at', 'desc'),
      limit(50)
    )
  }, [clientId])

  const { data: activities, loading } = useCollection<Activity>(activitiesQuery, `activities-${clientId}`)

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

  if (activities.length === 0) {
    return <EmptyState icon="history" message="No activity recorded yet." />
  }

  // Filter activities by type
  const filteredActivities = useMemo(() => {
    if (typeFilter === 'all') return activities
    return activities.filter((a) => {
      const t = str(a.activity_type).toLowerCase()
      return t.includes(typeFilter)
    })
  }, [activities, typeFilter])

  return (
    <div className="space-y-1">
      {/* Header + Filter */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3">
        <p className="text-sm font-semibold text-[var(--text-primary)]">
          {filteredActivities.length} {filteredActivities.length === 1 ? 'Activity' : 'Activities'}
        </p>
        <div className="flex gap-1">
          {(['all', 'create', 'update', 'email', 'call', 'note', 'import'] as ActivityFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setTypeFilter(f)}
              className={`rounded-full px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide transition-all ${
                typeFilter === f
                  ? 'bg-[var(--portal)] text-white'
                  : 'bg-[var(--bg-surface)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Timeline */}
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-5 top-0 bottom-0 w-px bg-[var(--border-subtle)]" />

        <div className="space-y-0">
          {filteredActivities.map((activity, index) => (
            <ActivityRow key={activity.activity_id || index} activity={activity} isLast={index === filteredActivities.length - 1} />
          ))}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ActivityRow({ activity, isLast }: { activity: Activity; isLast: boolean }) {
  const typeInfo = getActivityTypeInfo(str(activity.activity_type))

  return (
    <div className="relative flex gap-4 py-3">
      {/* Timeline dot */}
      <div className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${typeInfo.bgColor}`}>
        <span className={`material-icons-outlined text-[18px] ${typeInfo.iconColor}`}>
          {typeInfo.icon}
        </span>
      </div>

      {/* Content */}
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

        {/* User who performed it */}
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

  return { icon: 'radio_button_checked', bgColor: 'bg-[var(--bg-surface)]', iconColor: 'text-[var(--text-muted)]' }
}
