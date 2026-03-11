'use client'

import { useMemo, useState } from 'react'
import { query, collection, type Query, type DocumentData } from 'firebase/firestore'
import { useCollection } from '@tomachina/db'
import { getDb } from '@tomachina/db/src/firestore'
import {
  USER_LEVELS,
  MODULES,
  TOOL_SUITES,
  getAccessibleModules,
  type UserLevelName,
} from '@tomachina/core'

// ============================================================================
// Types
// ============================================================================

interface AdminPanelProps {
  portal: string
}

interface UserRecord {
  _id: string
  email?: string
  first_name?: string
  last_name?: string
  display_name?: string
  user_level?: string
  level?: number
  status?: string
  division?: string
  unit?: string
  role_template?: string
  hire_date?: string
  phone?: string
  job_title?: string
  manager_email?: string
  location?: string
  npn?: string
  module_permissions?: Record<string, string[]>
  entitlements?: string[]
}

interface OrgRecord {
  _id: string
  entity_id?: string
  entity_type?: string
  name?: string
  parent_id?: string
  manager_email?: string
  status?: string
}

type ViewMode = 'users' | 'org' | 'roles'

// ============================================================================
// Sub-components
// ============================================================================

function LevelBadge({ level }: { level: string }) {
  const lower = level.toLowerCase()
  const isOwner = lower === 'owner' || lower === 'super admin'
  const isExec = lower === 'executive' || lower === 'admin' || lower === 'superadmin'
  const isLeader = lower === 'leader' || lower === 'manager'
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium"
      style={{
        background: isOwner ? 'rgba(147,51,234,0.1)' : isExec ? 'rgba(59,130,246,0.1)' : isLeader ? 'rgba(34,197,94,0.1)' : 'rgba(156,163,175,0.1)',
        color: isOwner ? '#9333ea' : isExec ? '#3b82f6' : isLeader ? '#22c55e' : '#9ca3af',
      }}
    >
      {level}
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  const isActive = status.toLowerCase() === 'active'
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium"
      style={{
        background: isActive ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
        color: isActive ? '#22c55e' : '#ef4444',
      }}
    >
      {status}
    </span>
  )
}

function UserDetailModal({ user, onClose }: { user: UserRecord; onClose: () => void }) {
  // Resolve user level name for entitlement calc
  const levelName = useMemo<UserLevelName>(() => {
    const lvl = (user.user_level || '').toUpperCase() as UserLevelName
    if (USER_LEVELS[lvl]) return lvl
    return 'USER'
  }, [user.user_level])

  const accessibleModules = useMemo(() => {
    return getAccessibleModules(
      levelName,
      user.module_permissions as Record<string, ('VIEW' | 'EDIT' | 'ADD')[]> | undefined,
    )
  }, [levelName, user.module_permissions])

  const displayName = user.first_name && user.last_name
    ? `${user.first_name} ${user.last_name}`
    : user.display_name || user._id

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="mx-4 max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-[var(--text-primary)]">{displayName}</h2>
            <p className="text-sm text-[var(--text-muted)]">{user.email || '-'}</p>
          </div>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
            <span className="material-icons-outlined">close</span>
          </button>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <InfoField label="Level" value={user.user_level || '-'} />
          <InfoField label="Division" value={user.division || '-'} />
          <InfoField label="Unit" value={user.unit || '-'} />
          <InfoField label="Role Template" value={user.role_template || '-'} />
          <InfoField label="Status" value={user.status || '-'} />
          <InfoField label="Job Title" value={user.job_title || '-'} />
          <InfoField label="Manager" value={user.manager_email || '-'} />
          <InfoField label="Location" value={user.location || '-'} />
          <InfoField label="Phone" value={user.phone || '-'} />
          <InfoField label="NPN" value={user.npn || '-'} />
          <InfoField label="Hire Date" value={user.hire_date || '-'} />
        </div>

        {/* Entitlements */}
        <div className="mt-6">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Accessible Modules ({accessibleModules.length})
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {accessibleModules.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)]">No modules accessible.</p>
            ) : (
              accessibleModules.map((key) => {
                const mod = MODULES[key]
                return (
                  <span
                    key={key}
                    className="rounded-md bg-[var(--bg-surface)] px-2 py-1 text-[10px] text-[var(--text-secondary)]"
                    title={mod?.description || key}
                  >
                    {mod?.name || key}
                  </span>
                )
              })
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-[var(--text-muted)]">{label}</p>
      <p className="text-[var(--text-primary)]">{value}</p>
    </div>
  )
}

function OrgTree({ orgs, users }: { orgs: OrgRecord[]; users: UserRecord[] }) {
  // Build tree from flat list
  const tree = useMemo(() => {
    const roots = orgs.filter((o) => !o.parent_id)
    const childMap: Record<string, OrgRecord[]> = {}
    orgs.forEach((o) => {
      if (o.parent_id) {
        if (!childMap[o.parent_id]) childMap[o.parent_id] = []
        childMap[o.parent_id].push(o)
      }
    })
    return { roots, childMap }
  }, [orgs])

  function renderNode(org: OrgRecord, depth: number): React.ReactNode {
    const id = org.entity_id || org._id
    const children = tree.childMap[id] || []
    const manager = users.find((u) => u.email === org.manager_email)
    return (
      <div key={id} style={{ marginLeft: `${depth * 20}px` }} className="mb-2">
        <div className="flex items-center gap-2 rounded-lg bg-[var(--bg-surface)] px-3 py-2">
          <span className="material-icons-outlined" style={{ fontSize: '16px', color: 'var(--portal)' }}>
            {org.entity_type === 'COMPANY' ? 'domain' : org.entity_type === 'DIVISION' ? 'account_tree' : 'group'}
          </span>
          <div className="flex-1">
            <span className="text-sm font-medium text-[var(--text-primary)]">{org.name || id}</span>
            <span className="ml-2 text-[10px] uppercase text-[var(--text-muted)]">{org.entity_type}</span>
          </div>
          {manager && (
            <span className="text-xs text-[var(--text-muted)]">
              {manager.first_name} {manager.last_name}
            </span>
          )}
        </div>
        {children.map((c) => renderNode(c, depth + 1))}
      </div>
    )
  }

  if (orgs.length === 0) {
    return (
      <div className="flex flex-col items-center py-12 text-center">
        <span className="material-icons-outlined text-4xl text-[var(--text-muted)]">account_tree</span>
        <p className="mt-3 text-sm text-[var(--text-muted)]">No org structure data.</p>
      </div>
    )
  }

  return <div>{tree.roots.map((r) => renderNode(r, 0))}</div>
}

// ============================================================================
// Main Component
// ============================================================================

export function AdminPanel({ portal }: AdminPanelProps) {
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>('users')
  const [selectedUser, setSelectedUser] = useState<UserRecord | null>(null)
  const [levelFilter, setLevelFilter] = useState<string>('all')
  const [divisionFilter, setDivisionFilter] = useState<string>('all')

  // Queries
  const usersQ = useMemo<Query<DocumentData>>(() => query(collection(getDb(), 'users')), [])
  const orgQ = useMemo<Query<DocumentData>>(() => query(collection(getDb(), 'org')), [])

  const { data: users, loading: uLoad, error: uError } = useCollection<UserRecord>(usersQ, 'admin-users')
  const { data: orgs, loading: oLoad } = useCollection<OrgRecord>(orgQ, 'admin-org')

  // Unique values for filters
  const filterOptions = useMemo(() => {
    const levels = new Set<string>()
    const divisions = new Set<string>()
    users.forEach((u) => {
      if (u.user_level) levels.add(u.user_level)
      if (u.division) divisions.add(u.division)
    })
    return { levels: Array.from(levels).sort(), divisions: Array.from(divisions).sort() }
  }, [users])

  // Filtered users
  const filtered = useMemo(() => {
    let result = users

    if (search) {
      const lower = search.toLowerCase()
      result = result.filter((u) => {
        const text = `${u.first_name || ''} ${u.last_name || ''} ${u.display_name || ''} ${u.email || ''} ${u.job_title || ''}`.toLowerCase()
        return text.includes(lower)
      })
    }

    if (levelFilter !== 'all') {
      result = result.filter((u) => (u.user_level || '').toLowerCase() === levelFilter.toLowerCase())
    }

    if (divisionFilter !== 'all') {
      result = result.filter((u) => u.division === divisionFilter)
    }

    return result
  }, [users, search, levelFilter, divisionFilter])

  // Stats
  const stats = useMemo(() => {
    const levels: Record<string, number> = {}
    const statuses: Record<string, number> = {}
    users.forEach((u) => {
      const level = u.user_level || 'Unknown'
      levels[level] = (levels[level] || 0) + 1
      const status = u.status || 'active'
      statuses[status] = (statuses[status] || 0) + 1
    })
    return { levels, statuses }
  }, [users])

  // Loading
  if (uLoad) {
    return (
      <div className="mx-auto max-w-6xl">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Admin</h1>
        <div className="mt-8 flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--portal)] border-t-transparent" />
        </div>
      </div>
    )
  }

  // Error
  if (uError) {
    return (
      <div className="mx-auto max-w-6xl">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Admin</h1>
        <div className="mt-6 rounded-xl border border-[var(--error)] bg-[rgba(239,68,68,0.05)] p-6 text-sm text-[var(--text-secondary)]">
          Failed to load users: {uError.message}
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Admin</h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">User management, org structure, and entitlements</p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">Total Users</p>
          <p className="mt-1 text-2xl font-bold text-[var(--text-primary)]">{users.length}</p>
        </div>
        {Object.entries(stats.levels)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 3)
          .map(([level, count]) => (
            <div key={level} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">{level}</p>
                <LevelBadge level={level} />
              </div>
              <p className="mt-1 text-2xl font-bold text-[var(--text-primary)]">{count}</p>
            </div>
          ))}
      </div>

      {/* View Mode Tabs */}
      <div className="flex gap-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-1.5">
        {([
          { key: 'users' as ViewMode, label: 'Users', icon: 'people' },
          { key: 'org' as ViewMode, label: 'Org Structure', icon: 'account_tree' },
          { key: 'roles' as ViewMode, label: 'Role Templates', icon: 'admin_panel_settings' },
        ]).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setViewMode(tab.key)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              viewMode === tab.key
                ? 'bg-[var(--portal)] text-white'
                : 'text-[var(--text-muted)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-secondary)]'
            }`}
          >
            <span className="material-icons-outlined" style={{ fontSize: '14px' }}>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Users View */}
      {viewMode === 'users' && (
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
          {/* Search + Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1">
              <span
                className="material-icons-outlined absolute left-2.5 top-1/2 -translate-y-1/2"
                style={{ fontSize: '16px', color: 'var(--text-muted)' }}
              >
                search
              </span>
              <input
                type="text"
                placeholder="Search by name, email, or title..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] py-1.5 pl-8 pr-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--portal)] focus:outline-none"
              />
            </div>
            <select
              value={levelFilter}
              onChange={(e) => setLevelFilter(e.target.value)}
              className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-1.5 text-sm text-[var(--text-primary)] focus:border-[var(--portal)] focus:outline-none"
            >
              <option value="all">All Levels</option>
              {filterOptions.levels.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
            <select
              value={divisionFilter}
              onChange={(e) => setDivisionFilter(e.target.value)}
              className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-1.5 text-sm text-[var(--text-primary)] focus:border-[var(--portal)] focus:outline-none"
            >
              <option value="all">All Divisions</option>
              {filterOptions.divisions.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          {/* Results count */}
          <p className="mt-3 text-xs text-[var(--text-muted)]">
            Showing {filtered.length} of {users.length} users
          </p>

          {/* User Table */}
          <div className="mt-3 max-h-[500px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] text-left text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
                  <th className="pb-2 pr-4">Name</th>
                  <th className="pb-2 pr-4">Email</th>
                  <th className="pb-2 pr-4">Level</th>
                  <th className="pb-2 pr-4">Division</th>
                  <th className="pb-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => (
                  <tr
                    key={u._id}
                    className="cursor-pointer border-b border-[var(--border-subtle)] transition-colors hover:bg-[var(--bg-surface)]"
                    onClick={() => setSelectedUser(u)}
                  >
                    <td className="py-2.5 pr-4">
                      <span className="font-medium text-[var(--text-primary)]">
                        {u.first_name && u.last_name
                          ? `${u.first_name} ${u.last_name}`
                          : u.display_name || u._id}
                      </span>
                      {u.job_title && (
                        <span className="ml-2 text-xs text-[var(--text-muted)]">{u.job_title}</span>
                      )}
                    </td>
                    <td className="py-2.5 pr-4 text-[var(--text-secondary)]">{u.email || '-'}</td>
                    <td className="py-2.5 pr-4">
                      <LevelBadge level={u.user_level || u.role_template || 'user'} />
                    </td>
                    <td className="py-2.5 pr-4 text-[var(--text-secondary)]">{u.division || u.unit || '-'}</td>
                    <td className="py-2.5">
                      <StatusBadge status={u.status || 'active'} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div className="flex flex-col items-center py-8 text-center">
                <span className="material-icons-outlined text-3xl text-[var(--text-muted)]">person_search</span>
                <p className="mt-2 text-sm text-[var(--text-muted)]">
                  {search ? `No users matching "${search}"` : 'No users found'}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Org Structure View */}
      {viewMode === 'org' && (
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">Organization Hierarchy</h3>
          {oLoad ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--portal)] border-t-transparent" />
            </div>
          ) : (
            <OrgTree orgs={orgs} users={users} />
          )}
        </div>
      )}

      {/* Role Templates View */}
      {viewMode === 'roles' && (
        <div className="space-y-4">
          {/* User Levels */}
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">User Levels</h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {Object.entries(USER_LEVELS).map(([key, level]) => (
                <div key={key} className="rounded-lg bg-[var(--bg-surface)] p-3">
                  <div className="flex items-center gap-2">
                    <LevelBadge level={key} />
                    <span className="text-sm font-medium text-[var(--text-primary)]">{level.displayName}</span>
                  </div>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">{level.description}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Tool Suites */}
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">Tool Suites</h3>
            <div className="space-y-3">
              {Object.entries(TOOL_SUITES).map(([key, suite]) => (
                <div key={key} className="rounded-lg bg-[var(--bg-surface)] p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-[var(--text-primary)]">{suite.name}</span>
                    <span className="text-[10px] uppercase text-[var(--text-muted)]">{suite.matrix}</span>
                  </div>
                  <p className="text-xs text-[var(--text-muted)]">{suite.description}</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {suite.modules.map((m) => {
                      const mod = MODULES[m]
                      return (
                        <span
                          key={m}
                          className="rounded bg-[var(--bg-card)] px-1.5 py-0.5 text-[10px] text-[var(--text-secondary)]"
                          title={mod?.description}
                        >
                          {mod?.name || m}
                        </span>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* User Detail Modal */}
      {selectedUser && (
        <UserDetailModal user={selectedUser} onClose={() => setSelectedUser(null)} />
      )}
    </div>
  )
}
