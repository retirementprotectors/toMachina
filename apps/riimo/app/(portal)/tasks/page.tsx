'use client'

import { useState, useMemo } from 'react'
import { query, orderBy, type Query, type DocumentData } from 'firebase/firestore'
import { useCollection } from '@tomachina/db'
import { collections } from '@tomachina/db/src/firestore'

const tasksQuery: Query<DocumentData> = query(collections.caseTasks(), orderBy('created_at', 'desc'))

interface TaskRecord {
  _id: string
  task_id?: string
  title?: string
  description?: string
  status?: string
  priority?: string
  assigned_to?: string
  client_id?: string
  client_name?: string
  due_date?: string
  created_at?: string
  task_type?: string
}

const STATUS_OPTIONS = ['All', 'open', 'in_progress', 'completed', 'blocked']
const PRIORITY_OPTIONS = ['All', 'high', 'medium', 'low']

function StatusPill({ status }: { status: string }) {
  const colors: Record<string, { bg: string; text: string }> = {
    open: { bg: 'rgba(59,130,246,0.15)', text: 'var(--info)' },
    in_progress: { bg: 'rgba(245,158,11,0.15)', text: 'var(--warning)' },
    completed: { bg: 'rgba(16,185,129,0.15)', text: 'var(--success)' },
    blocked: { bg: 'rgba(239,68,68,0.15)', text: 'var(--error)' },
  }
  const c = colors[status] || { bg: 'var(--bg-surface)', text: 'var(--text-muted)' }

  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
      style={{ background: c.bg, color: c.text }}
    >
      {(status || 'unknown').replace(/_/g, ' ')}
    </span>
  )
}

function PriorityBadge({ priority }: { priority: string }) {
  const icons: Record<string, string> = {
    high: 'priority_high',
    medium: 'remove',
    low: 'arrow_downward',
  }
  const colors: Record<string, string> = {
    high: 'var(--error)',
    medium: 'var(--warning)',
    low: 'var(--text-muted)',
  }

  return (
    <span className="flex items-center gap-1 text-xs" style={{ color: colors[priority] || 'var(--text-muted)' }}>
      <span className="material-icons-outlined" style={{ fontSize: '14px' }}>
        {icons[priority] || 'remove'}
      </span>
      {priority || 'none'}
    </span>
  )
}

export default function TasksPage() {
  const { data: tasks, loading, error } = useCollection<TaskRecord>(tasksQuery, 'all-tasks')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [priorityFilter, setPriorityFilter] = useState('All')

  const filtered = useMemo(() => {
    let result = tasks
    if (search) {
      const q = search.toLowerCase()
      result = result.filter((t) =>
        (t.title || '').toLowerCase().includes(q) ||
        (t.assigned_to || '').toLowerCase().includes(q) ||
        (t.client_name || '').toLowerCase().includes(q)
      )
    }
    if (statusFilter !== 'All') {
      result = result.filter((t) => t.status === statusFilter)
    }
    if (priorityFilter !== 'All') {
      result = result.filter((t) => t.priority === priorityFilter)
    }
    return result
  }, [tasks, search, statusFilter, priorityFilter])

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Tasks</h1>
        <div className="mt-8 flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--portal)] border-t-transparent" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="mx-auto max-w-6xl">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Tasks</h1>
        <div className="mt-6 rounded-xl border border-[var(--error)] bg-[rgba(239,68,68,0.05)] p-6 text-sm text-[var(--text-secondary)]">
          Failed to load tasks: {error.message}
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Tasks</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">{filtered.length} task{filtered.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <span className="material-icons-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" style={{ fontSize: '18px' }}>search</span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tasks..."
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-card)] py-2 pl-10 pr-3 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:border-[var(--portal)]"
          />
        </div>
        <div className="flex items-center gap-1.5">
          {STATUS_OPTIONS.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                statusFilter === s
                  ? 'bg-[var(--portal)] text-white'
                  : 'bg-[var(--bg-surface)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              {s === 'All' ? 'All Status' : s.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          {PRIORITY_OPTIONS.map((p) => (
            <button
              key={p}
              onClick={() => setPriorityFilter(p)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                priorityFilter === p
                  ? 'bg-[var(--portal)] text-white'
                  : 'bg-[var(--bg-surface)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              {p === 'All' ? 'All Priority' : p}
            </button>
          ))}
        </div>
      </div>

      {/* Task List */}
      {filtered.length === 0 ? (
        <div className="mt-8 flex flex-col items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] py-20">
          <span className="material-icons-outlined text-5xl text-[var(--text-muted)]">task_alt</span>
          <p className="mt-4 text-sm text-[var(--text-muted)]">
            {tasks.length === 0 ? 'No tasks in the system yet.' : 'No tasks match your filters.'}
          </p>
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          {filtered.map((task) => (
            <div
              key={task._id}
              className="flex items-center gap-4 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] px-4 py-3 transition-all hover:border-[var(--border)] hover:bg-[var(--bg-card-hover)]"
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium text-[var(--text-primary)] truncate">
                  {task.title || task.task_id || 'Untitled Task'}
                </p>
                <div className="mt-1 flex items-center gap-3 text-xs text-[var(--text-muted)]">
                  {task.assigned_to && <span>Assigned: {task.assigned_to}</span>}
                  {task.client_name && <span>Client: {task.client_name}</span>}
                  {task.due_date && <span>Due: {task.due_date}</span>}
                </div>
              </div>
              <PriorityBadge priority={task.priority || 'medium'} />
              <StatusPill status={task.status || 'open'} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
