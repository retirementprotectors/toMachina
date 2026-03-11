'use client'

import { useMemo } from 'react'
import { query, type Query, type DocumentData } from 'firebase/firestore'
import { useCollection } from '@tomachina/db'
import { collections } from '@tomachina/db/src/firestore'

const orgQuery: Query<DocumentData> = query(collections.org())
const usersQuery: Query<DocumentData> = query(collections.users())

interface OrgUnit {
  _id: string
  unit_id?: string
  unit_name?: string
  parent_unit_id?: string
  manager_email?: string
  slack_channel_id?: string
  unit_type?: string
  status?: string
}

interface UserRecord {
  _id: string
  email?: string
  first_name?: string
  last_name?: string
  full_name?: string
  user_level?: number
  unit?: string
  division?: string
  job_title?: string
}

function OrgNode({
  unit,
  children: childUnits,
  members,
  depth,
}: {
  unit: OrgUnit
  children: OrgUnit[]
  members: UserRecord[]
  depth: number
}) {
  const unitMembers = members.filter(
    (m) => m.unit === unit.unit_name || m.division === unit.unit_name
  )

  return (
    <div className={depth > 0 ? 'ml-6 border-l border-[var(--border-subtle)] pl-4' : ''}>
      <div className="mb-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 transition-all hover:border-[var(--border)]">
        <div className="flex items-center gap-3">
          <span
            className="flex h-9 w-9 items-center justify-center rounded-lg"
            style={{ background: 'var(--portal-glow)' }}
          >
            <span className="material-icons-outlined" style={{ fontSize: '20px', color: 'var(--portal)' }}>
              {depth === 0 ? 'business' : 'group'}
            </span>
          </span>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-[var(--text-primary)]">{unit.unit_name || unit._id}</p>
            <div className="flex items-center gap-3 text-xs text-[var(--text-muted)]">
              {unit.unit_type && <span>{unit.unit_type}</span>}
              {unit.manager_email && <span>Manager: {unit.manager_email}</span>}
              {unitMembers.length > 0 && <span>{unitMembers.length} member{unitMembers.length !== 1 ? 's' : ''}</span>}
            </div>
          </div>
        </div>

        {/* Members */}
        {unitMembers.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {unitMembers.map((m) => (
              <span
                key={m._id}
                className="inline-flex items-center gap-1 rounded-full bg-[var(--bg-surface)] px-2.5 py-1 text-xs text-[var(--text-secondary)]"
              >
                <span className="material-icons-outlined" style={{ fontSize: '12px' }}>person</span>
                {m.full_name || `${m.first_name || ''} ${m.last_name || ''}`.trim() || m.email}
                {m.job_title && <span className="text-[var(--text-muted)]">({m.job_title})</span>}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Child Units */}
      {childUnits.map((child) => {
        const grandchildren = childUnits.length > 0
          ? [] // We'll compute dynamically below
          : []
        return (
          <OrgNode
            key={child._id}
            unit={child}
            children={[]}
            members={members}
            depth={depth + 1}
          />
        )
      })}
    </div>
  )
}

export default function OrgAdminPage() {
  const { data: orgUnits, loading: orgLoading } = useCollection<OrgUnit>(orgQuery, 'org-units')
  const { data: users, loading: usersLoading } = useCollection<UserRecord>(usersQuery, 'org-users')

  const loading = orgLoading || usersLoading

  /* Build tree structure */
  const { roots, childMap } = useMemo(() => {
    const cMap = new Map<string, OrgUnit[]>()
    const rts: OrgUnit[] = []

    orgUnits.forEach((unit) => {
      const parentId = unit.parent_unit_id
      if (!parentId) {
        rts.push(unit)
      } else {
        const existing = cMap.get(parentId) || []
        existing.push(unit)
        cMap.set(parentId, existing)
      }
    })

    return { roots: rts, childMap: cMap }
  }, [orgUnits])

  function getChildren(unitId: string): OrgUnit[] {
    return childMap.get(unitId) || []
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Org Admin</h1>
        <div className="mt-8 flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--portal)] border-t-transparent" />
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Org Admin</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            {orgUnits.length} unit{orgUnits.length !== 1 ? 's' : ''} \u00B7 {users.length} team member{users.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Org Tree */}
      <div className="mt-6">
        {roots.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] py-20">
            <span className="material-icons-outlined text-5xl text-[var(--text-muted)]">account_tree</span>
            <p className="mt-4 text-sm text-[var(--text-muted)]">No organizational structure found.</p>
          </div>
        ) : (
          roots.map((root) => (
            <OrgNode
              key={root._id}
              unit={root}
              children={getChildren(root.unit_id || root._id)}
              members={users}
              depth={0}
            />
          ))
        )}
      </div>
    </div>
  )
}
