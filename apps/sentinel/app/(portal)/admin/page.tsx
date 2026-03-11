'use client'

import { useMemo, useState } from 'react'
import { query, type Query, type DocumentData } from 'firebase/firestore'
import { useCollection } from '@tomachina/db'
import { collections } from '@tomachina/db/src/firestore'

const usersQuery: Query<DocumentData> = query(collections.users())

interface UserRecord {
  _id: string
  email?: string
  first_name?: string
  last_name?: string
  display_name?: string
  user_level?: string
  status?: string
  division?: string
  unit?: string
  role_template?: string
  job_title?: string
}

export default function AdminPage() {
  const { data: users, loading, error } = useCollection<UserRecord>(usersQuery, 'sentinel-admin-users')
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    if (!search) return users
    const lower = search.toLowerCase()
    return users.filter((u) => {
      const name = `${u.first_name || ''} ${u.last_name || ''} ${u.display_name || ''} ${u.email || ''}`.toLowerCase()
      return name.includes(lower)
    })
  }, [users, search])

  const stats = useMemo(() => {
    const levels: Record<string, number> = {}
    users.forEach((u) => {
      const level = u.user_level || 'Unknown'
      levels[level] = (levels[level] || 0) + 1
    })
    return { levels }
  }, [users])

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Admin</h1>
        <div className="mt-8 flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--portal)] border-t-transparent" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="mx-auto max-w-6xl">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Admin</h1>
        <div className="mt-6 rounded-xl border border-[var(--error)] bg-[rgba(239,68,68,0.05)] p-6 text-sm text-[var(--text-secondary)]">
          Failed to load users: {error.message}
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-2xl font-bold text-[var(--text-primary)]">Admin</h1>
      <p className="mt-1 text-sm text-[var(--text-muted)]">SENTINEL administration and user management</p>

      {/* Stats */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">Total Users</p>
          <p className="mt-1 text-2xl font-bold text-[var(--text-primary)]">{users.length}</p>
        </div>
        {Object.entries(stats.levels)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 3)
          .map(([level, count]) => (
            <div key={level} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
              <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">{level}</p>
              <p className="mt-1 text-2xl font-bold text-[var(--text-primary)]">{count}</p>
            </div>
          ))}
      </div>

      {/* User List */}
      <div className="mt-6 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">Users</h2>
          <div className="relative">
            <span
              className="material-icons-outlined absolute left-2.5 top-1/2 -translate-y-1/2"
              style={{ fontSize: '16px', color: 'var(--text-muted)' }}
            >
              search
            </span>
            <input
              type="text"
              placeholder="Search users..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] py-1.5 pl-8 pr-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--portal)] focus:outline-none"
            />
          </div>
        </div>

        <div className="mt-4 max-h-[500px] overflow-y-auto">
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
                <tr key={u._id} className="border-b border-[var(--border-subtle)]">
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
                  <td className="py-2.5 pr-4"><LevelBadge level={u.user_level || u.role_template || 'user'} /></td>
                  <td className="py-2.5 pr-4 text-[var(--text-secondary)]">{u.division || u.unit || '-'}</td>
                  <td className="py-2.5"><StatusBadge status={u.status || 'active'} /></td>
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
    </div>
  )
}

function LevelBadge({ level }: { level: string }) {
  const lower = level.toLowerCase()
  const isOwner = lower === 'owner' || lower === 'super admin'
  const isExec = lower === 'executive' || lower === 'admin'
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
