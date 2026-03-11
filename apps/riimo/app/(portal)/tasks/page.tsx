'use client'

import { useState, useMemo, useCallback } from 'react'
import { query, orderBy, type Query, type DocumentData } from 'firebase/firestore'
import { useCollection } from '@tomachina/db'
import { collections } from '@tomachina/db/src/firestore'
import { Modal } from '@tomachina/ui'

const tasksQuery: Query<DocumentData> = query(collections.caseTasks(), orderBy('created_at', 'desc'))
const usersQuery: Query<DocumentData> = query(collections.users())

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
  updated_at?: string
  task_type?: string
  notes?: string
  pipeline_id?: string
  stage_name?: string
}

interface UserRecord {
  _id: string
  display_name?: string
  email?: string
}

const STATUS_OPTIONS = ['All', 'open', 'in_progress', 'completed', 'blocked']
const PRIORITY_OPTIONS = ['All', 'high', 'medium', 'low']

type ViewMode = 'my_tasks' | 'team_tasks'

function isOverdue(dueDate: string | undefined, status: string | undefined): boolean {
  if (!dueDate || status === 'completed') return false
  return new Date(dueDate) < new Date()
}

function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  const now = new Date()
  const diffDays = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Tomorrow'
  if (diffDays === -1) return 'Yesterday'
  if (diffDays < 0) return `${Math.abs(diffDays)}d overdue`
  if (diffDays <= 7) return `In ${diffDays}d`
  return d.toLocaleDateString()
}

export default function TasksPage() {
  const { data: tasks, loading, error } = useCollection<TaskRecord>(tasksQuery, 'all-tasks')
  const { data: users } = useCollection<UserRecord>(usersQuery, 'task-users')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [priorityFilter, setPriorityFilter] = useState('All')
  const [viewMode, setViewMode] = useState<ViewMode>('my_tasks')
  const [selectedTask, setSelectedTask] = useState<TaskRecord | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)

  const taskStats = useMemo(() => {
    const open = tasks.filter((t) => t.status !== 'completed').length
    const overdue = tasks.filter((t) => isOverdue(t.due_date, t.status)).length
    const blocked = tasks.filter((t) => t.status === 'blocked').length
    const completedThisWeek = tasks.filter((t) => {
      if (t.status !== 'completed' || !t.updated_at) return false
      const d = new Date(t.updated_at)
      const now = new Date()
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      return d >= weekAgo
    }).length
    return { open, overdue, blocked, completedThisWeek }
  }, [tasks])

  const filtered = useMemo(() => {
    let result = tasks
    if (search) {
      const q = search.toLowerCase()
      result = result.filter((t) =>
        (t.title || '').toLowerCase().includes(q) ||
        (t.assigned_to || '').toLowerCase().includes(q) ||
        (t.client_name || '').toLowerCase().includes(q) ||
        (t.description || '').toLowerCase().includes(q)
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

  // Group tasks by assignee for team view
  const groupedByAssignee = useMemo(() => {
    if (viewMode !== 'team_tasks') return null
    const groups: Record<string, TaskRecord[]> = {}
    filtered.forEach((t) => {
      const key = t.assigned_to || 'Unassigned'
      if (!groups[key]) groups[key] = []
      groups[key].push(t)
    })
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b))
  }, [filtered, viewMode])

  const handleCloseTask = useCallback(() => setSelectedTask(null), [])
  const handleCloseCreate = useCallback(() => setShowCreateModal(false), [])

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
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors"
          style={{ background: 'var(--portal)' }}
        >
          <span className="material-icons-outlined" style={{ fontSize: '18px' }}>add</span>
          New Task
        </button>
      </div>

      {/* Stats Bar */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Open" value={taskStats.open} icon="pending" color="var(--info)" />
        <StatCard label="Overdue" value={taskStats.overdue} icon="warning" color="var(--error)" />
        <StatCard label="Blocked" value={taskStats.blocked} icon="block" color="var(--warning)" />
        <StatCard label="Completed This Week" value={taskStats.completedThisWeek} icon="done_all" color="var(--success)" />
      </div>

      {/* View Toggle + Filters */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-lg bg-[var(--bg-surface)] p-0.5">
          <button
            onClick={() => setViewMode('my_tasks')}
            className="rounded-md px-3 py-1.5 text-xs font-medium transition-colors"
            style={{
              background: viewMode === 'my_tasks' ? 'var(--bg-card)' : 'transparent',
              color: viewMode === 'my_tasks' ? 'var(--text-primary)' : 'var(--text-muted)',
              boxShadow: viewMode === 'my_tasks' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            }}
          >
            All Tasks
          </button>
          <button
            onClick={() => setViewMode('team_tasks')}
            className="rounded-md px-3 py-1.5 text-xs font-medium transition-colors"
            style={{
              background: viewMode === 'team_tasks' ? 'var(--bg-card)' : 'transparent',
              color: viewMode === 'team_tasks' ? 'var(--text-primary)' : 'var(--text-muted)',
              boxShadow: viewMode === 'team_tasks' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            }}
          >
            By Team Member
          </button>
        </div>

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
      ) : viewMode === 'team_tasks' && groupedByAssignee ? (
        <div className="mt-4 space-y-6">
          {groupedByAssignee.map(([assignee, assigneeTasks]) => (
            <div key={assignee}>
              <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
                <span className="material-icons-outlined" style={{ fontSize: '16px', color: 'var(--portal)' }}>person</span>
                {assignee}
                <span className="ml-1 text-xs font-normal text-[var(--text-muted)]">({assigneeTasks.length})</span>
              </h3>
              <div className="space-y-2">
                {assigneeTasks.map((task) => (
                  <TaskCard key={task._id} task={task} onClick={() => setSelectedTask(task)} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          {filtered.map((task) => (
            <TaskCard key={task._id} task={task} onClick={() => setSelectedTask(task)} />
          ))}
        </div>
      )}

      {/* Task Detail Modal */}
      {selectedTask && (
        <Modal open={!!selectedTask} onClose={handleCloseTask} title={selectedTask.title || 'Task Detail'} size="lg">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">Status</p>
                <StatusPill status={selectedTask.status || 'open'} />
              </div>
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">Priority</p>
                <PriorityBadge priority={selectedTask.priority || 'medium'} />
              </div>
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">Assigned To</p>
                <p className="mt-0.5 text-sm text-[var(--text-primary)]">{selectedTask.assigned_to || 'Unassigned'}</p>
              </div>
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">Due Date</p>
                <p className={`mt-0.5 text-sm ${isOverdue(selectedTask.due_date, selectedTask.status) ? 'font-medium text-[var(--error)]' : 'text-[var(--text-primary)]'}`}>
                  {formatDate(selectedTask.due_date)}
                </p>
              </div>
              {selectedTask.client_name && (
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">Client</p>
                  <p className="mt-0.5 text-sm text-[var(--text-primary)]">{selectedTask.client_name}</p>
                </div>
              )}
              {selectedTask.stage_name && (
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">Pipeline Stage</p>
                  <p className="mt-0.5 text-sm text-[var(--text-primary)]">{selectedTask.stage_name}</p>
                </div>
              )}
            </div>

            {selectedTask.description && (
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">Description</p>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">{selectedTask.description}</p>
              </div>
            )}

            {selectedTask.notes && (
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">Notes</p>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">{selectedTask.notes}</p>
              </div>
            )}

            {/* Status Workflow */}
            <div>
              <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">Status Workflow</p>
              <div className="flex gap-2">
                {(['open', 'in_progress', 'blocked', 'completed'] as const).map((s) => (
                  <div
                    key={s}
                    className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium"
                    style={{
                      background: selectedTask.status === s ? 'var(--portal-glow)' : 'var(--bg-surface)',
                      color: selectedTask.status === s ? 'var(--portal)' : 'var(--text-muted)',
                      border: selectedTask.status === s ? '1px solid var(--portal)' : '1px solid transparent',
                    }}
                  >
                    {s === 'open' && <span className="material-icons-outlined" style={{ fontSize: '12px' }}>radio_button_unchecked</span>}
                    {s === 'in_progress' && <span className="material-icons-outlined" style={{ fontSize: '12px' }}>pending</span>}
                    {s === 'blocked' && <span className="material-icons-outlined" style={{ fontSize: '12px' }}>block</span>}
                    {s === 'completed' && <span className="material-icons-outlined" style={{ fontSize: '12px' }}>check_circle</span>}
                    {s.replace(/_/g, ' ')}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Create Task Modal */}
      <Modal open={showCreateModal} onClose={handleCloseCreate} title="New Task" size="md">
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Title</label>
            <input type="text" placeholder="Task title..." className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--portal)]" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Description</label>
            <textarea placeholder="Task description..." rows={3} className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--portal)]" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Priority</label>
              <div className="flex gap-2">
                {['high', 'medium', 'low'].map((p) => (
                  <button key={p} className="rounded-lg bg-[var(--bg-surface)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)]">
                    {p}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Due Date</label>
              <input type="date" className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--portal)]" />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Assigned To</label>
            <input type="text" placeholder="Search team members..." className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--portal)]" />
            <p className="mt-1 text-[10px] text-[var(--text-muted)]">Smart Lookup will be connected when user data is available</p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={handleCloseCreate}
              className="rounded-lg bg-[var(--bg-surface)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)]"
            >
              Cancel
            </button>
            <button
              onClick={handleCloseCreate}
              className="rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors"
              style={{ background: 'var(--portal)' }}
            >
              Create Task
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

/* ─── Sub-components ─── */

function TaskCard({ task, onClick }: { task: TaskRecord; onClick: () => void }) {
  const overdue = isOverdue(task.due_date, task.status)
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-4 rounded-lg border px-4 py-3 text-left transition-all hover:bg-[var(--bg-card-hover)] ${
        overdue
          ? 'border-[var(--error)] bg-[rgba(239,68,68,0.03)]'
          : 'border-[var(--border-subtle)] bg-[var(--bg-card)]'
      }`}
    >
      <div className="flex-1 min-w-0">
        <p className="font-medium text-[var(--text-primary)] truncate">
          {task.title || task.task_id || 'Untitled Task'}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-[var(--text-muted)]">
          {task.assigned_to && (
            <span className="flex items-center gap-1">
              <span className="material-icons-outlined" style={{ fontSize: '12px' }}>person</span>
              {task.assigned_to}
            </span>
          )}
          {task.client_name && (
            <span className="flex items-center gap-1">
              <span className="material-icons-outlined" style={{ fontSize: '12px' }}>business</span>
              {task.client_name}
            </span>
          )}
          {task.due_date && (
            <span className={`flex items-center gap-1 ${overdue ? 'font-medium text-[var(--error)]' : ''}`}>
              <span className="material-icons-outlined" style={{ fontSize: '12px' }}>event</span>
              {formatDate(task.due_date)}
            </span>
          )}
        </div>
      </div>
      <PriorityBadge priority={task.priority || 'medium'} />
      <StatusPill status={task.status || 'open'} />
    </button>
  )
}

function StatCard({ label, value, icon, color }: { label: string; value: number; icon: string; color: string }) {
  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4">
      <div className="flex items-center gap-2">
        <span className="material-icons-outlined" style={{ fontSize: '16px', color }}>{icon}</span>
        <span className="text-xs text-[var(--text-muted)]">{label}</span>
      </div>
      <p className="mt-1 text-xl font-bold text-[var(--text-primary)]">{value}</p>
    </div>
  )
}

function StatusPill({ status }: { status: string }) {
  const colors: Record<string, { bg: string; text: string }> = {
    open: { bg: 'rgba(59,130,246,0.15)', text: 'var(--info)' },
    in_progress: { bg: 'rgba(245,158,11,0.15)', text: 'var(--warning)' },
    completed: { bg: 'rgba(16,185,129,0.15)', text: 'var(--success)' },
    blocked: { bg: 'rgba(239,68,68,0.15)', text: 'var(--error)' },
  }
  const c = colors[status] || { bg: 'var(--bg-surface)', text: 'var(--text-muted)' }
  return (
    <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium" style={{ background: c.bg, color: c.text }}>
      {(status || 'unknown').replace(/_/g, ' ')}
    </span>
  )
}

function PriorityBadge({ priority }: { priority: string }) {
  const icons: Record<string, string> = { high: 'priority_high', medium: 'remove', low: 'arrow_downward' }
  const colors: Record<string, string> = { high: 'var(--error)', medium: 'var(--warning)', low: 'var(--text-muted)' }
  return (
    <span className="flex items-center gap-1 text-xs" style={{ color: colors[priority] || 'var(--text-muted)' }}>
      <span className="material-icons-outlined" style={{ fontSize: '14px' }}>{icons[priority] || 'remove'}</span>
      {priority || 'none'}
    </span>
  )
}
