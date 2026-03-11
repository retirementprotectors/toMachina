'use client'

import { useState, useMemo, useCallback } from 'react'
import { collection, query, orderBy, getDocs, addDoc, updateDoc, doc, limit } from 'firebase/firestore'
import { getDb } from '@tomachina/db'
import { useAuth } from '@tomachina/auth'

// ---------------------------------------------------------------------------
// Casework — Case Management & Workflow Tracking
// ---------------------------------------------------------------------------

type CaseStatus = 'open' | 'in_progress' | 'blocked' | 'completed'
type FilterStatus = 'all' | CaseStatus

interface CaseRecord {
  id: string
  title: string
  description: string
  client_id: string
  client_name: string
  assigned_to: string
  status: CaseStatus
  priority: 'low' | 'medium' | 'high' | 'urgent'
  product_lines: string[]
  created_at: string
  updated_at: string
  tasks: TaskRecord[]
  notes: NoteRecord[]
}

interface TaskRecord {
  id: string
  title: string
  status: 'open' | 'complete'
  assigned_to: string
  product_line: string
  sort_order: number
}

interface NoteRecord {
  id: string
  date: string
  author: string
  text: string
}

export default function CaseworkPage() {
  const { user } = useAuth()
  const [cases, setCases] = useState<CaseRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [filter, setFilter] = useState<FilterStatus>('all')
  const [selectedCase, setSelectedCase] = useState<CaseRecord | null>(null)
  const [showNewCase, setShowNewCase] = useState(false)
  const [newNote, setNewNote] = useState('')
  const [newTaskTitle, setNewTaskTitle] = useState('')

  const loadCases = useCallback(async () => {
    setLoading(true)
    try {
      const db = getDb()
      const snap = await getDocs(query(collection(db, 'case_tasks'), orderBy('updated_at', 'desc'), limit(200)))
      const loaded: CaseRecord[] = snap.docs.map((d) => {
        const data = d.data()
        return {
          id: d.id,
          title: String(data.title || 'Untitled Case'),
          description: String(data.description || ''),
          client_id: String(data.client_id || ''),
          client_name: String(data.client_name || ''),
          assigned_to: String(data.assigned_to || ''),
          status: (data.status as CaseStatus) || 'open',
          priority: (data.priority as CaseRecord['priority']) || 'medium',
          product_lines: Array.isArray(data.product_lines) ? data.product_lines : [],
          created_at: String(data.created_at || ''),
          updated_at: String(data.updated_at || ''),
          tasks: Array.isArray(data.tasks) ? data.tasks : [],
          notes: Array.isArray(data.notes) ? data.notes : [],
        }
      })
      setCases(loaded)
      setLoaded(true)
    } catch (err) {
      console.error('Failed to load cases:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  const filtered = useMemo(() => filter === 'all' ? cases : cases.filter((c) => c.status === filter), [cases, filter])

  const stats = useMemo(() => {
    const s = { total: cases.length, open: 0, in_progress: 0, blocked: 0, completed: 0 }
    for (const c of cases) if (c.status in s) (s as Record<string, number>)[c.status]++
    return s
  }, [cases])

  const updateCaseStatus = useCallback(async (caseId: string, newStatus: CaseStatus) => {
    const db = getDb()
    const now = new Date().toISOString()
    await updateDoc(doc(db, 'case_tasks', caseId), { status: newStatus, updated_at: now })
    setCases((prev) => prev.map((c) => c.id === caseId ? { ...c, status: newStatus, updated_at: now } : c))
    setSelectedCase((prev) => prev?.id === caseId ? { ...prev, status: newStatus } : prev)
  }, [])

  const addNote = useCallback(async () => {
    if (!selectedCase || !newNote.trim()) return
    const note: NoteRecord = { id: crypto.randomUUID(), date: new Date().toISOString(), author: user?.email || 'unknown', text: newNote.trim() }
    const updatedNotes = [...selectedCase.notes, note]
    const db = getDb()
    await updateDoc(doc(db, 'case_tasks', selectedCase.id), { notes: updatedNotes, updated_at: new Date().toISOString() })
    setSelectedCase((prev) => prev ? { ...prev, notes: updatedNotes } : null)
    setCases((prev) => prev.map((c) => c.id === selectedCase.id ? { ...c, notes: updatedNotes } : c))
    setNewNote('')
  }, [selectedCase, newNote, user])

  const addTask = useCallback(async () => {
    if (!selectedCase || !newTaskTitle.trim()) return
    const task: TaskRecord = { id: crypto.randomUUID(), title: newTaskTitle.trim(), status: 'open', assigned_to: user?.email || '', product_line: 'general', sort_order: selectedCase.tasks.length + 1 }
    const updatedTasks = [...selectedCase.tasks, task]
    const db = getDb()
    await updateDoc(doc(db, 'case_tasks', selectedCase.id), { tasks: updatedTasks, updated_at: new Date().toISOString() })
    setSelectedCase((prev) => prev ? { ...prev, tasks: updatedTasks } : null)
    setCases((prev) => prev.map((c) => c.id === selectedCase.id ? { ...c, tasks: updatedTasks } : c))
    setNewTaskTitle('')
  }, [selectedCase, newTaskTitle, user])

  const toggleTask = useCallback(async (taskId: string) => {
    if (!selectedCase) return
    const updatedTasks = selectedCase.tasks.map((t) => t.id === taskId ? { ...t, status: t.status === 'open' ? 'complete' as const : 'open' as const } : t)
    const db = getDb()
    await updateDoc(doc(db, 'case_tasks', selectedCase.id), { tasks: updatedTasks, updated_at: new Date().toISOString() })
    setSelectedCase((prev) => prev ? { ...prev, tasks: updatedTasks } : null)
    setCases((prev) => prev.map((c) => c.id === selectedCase.id ? { ...c, tasks: updatedTasks } : c))
  }, [selectedCase])

  // Initial load prompt
  if (!loaded) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">My Cases</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">Case management and workflow tracking</p>
        </div>
        <div className="flex flex-col items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] py-20">
          <span className="material-icons-outlined text-5xl text-[var(--portal)]">work</span>
          <h2 className="mt-4 text-lg font-semibold text-[var(--text-primary)]">Casework</h2>
          <p className="mt-2 max-w-md text-center text-sm text-[var(--text-muted)]">
            Manage active client cases, track tasks, and maintain notes for each engagement.
          </p>
          <button
            onClick={loadCases}
            disabled={loading}
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[var(--portal)] px-6 py-2.5 text-sm font-medium text-white transition-colors hover:brightness-110 disabled:opacity-50"
          >
            <span className="material-icons-outlined text-[18px]">{loading ? 'hourglass_empty' : 'folder_open'}</span>
            {loading ? 'Loading...' : 'Load Cases'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">My Cases</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">{stats.total} total cases</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowNewCase(true)} className="inline-flex items-center gap-2 rounded-lg bg-[var(--portal)] px-4 py-2 text-sm font-medium text-white hover:brightness-110">
            <span className="material-icons-outlined text-[18px]">add</span>New Case
          </button>
          <button onClick={loadCases} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-medium)] px-3 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-50">
            <span className="material-icons-outlined text-[18px]">refresh</span>
          </button>
        </div>
      </div>

      {/* Status filters */}
      <div className="flex gap-2">
        {([
          { key: 'all' as FilterStatus, label: 'All', count: stats.total },
          { key: 'open' as FilterStatus, label: 'Open', count: stats.open },
          { key: 'in_progress' as FilterStatus, label: 'In Progress', count: stats.in_progress },
          { key: 'blocked' as FilterStatus, label: 'Blocked', count: stats.blocked },
          { key: 'completed' as FilterStatus, label: 'Completed', count: stats.completed },
        ]).map((f) => (
          <button key={f.key} onClick={() => setFilter(f.key)} className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-all ${filter === f.key ? 'bg-[var(--portal)] text-white' : 'bg-[var(--bg-surface)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]'}`}>
            {f.label}
            <span className={`inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1 text-xs ${filter === f.key ? 'bg-white/20 text-white' : 'bg-[var(--bg-card)] text-[var(--text-muted)]'}`}>{f.count}</span>
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Case list */}
        <div className="lg:col-span-2 space-y-2">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] py-16">
              <span className="material-icons-outlined text-4xl text-[var(--text-muted)]">inbox</span>
              <p className="mt-3 text-sm text-[var(--text-muted)]">No cases match this filter.</p>
            </div>
          ) : filtered.map((c) => (
            <CaseRow key={c.id} caseItem={c} isSelected={selectedCase?.id === c.id} onSelect={() => setSelectedCase(c)} />
          ))}
        </div>

        {/* Detail panel */}
        <div className="space-y-4">
          {selectedCase ? (
            <>
              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">Case Detail</h3>
                  <StatusBadge status={selectedCase.status} />
                </div>
                <h4 className="mt-3 text-base font-semibold text-[var(--text-primary)]">{selectedCase.title}</h4>
                {selectedCase.description && <p className="mt-1 text-sm text-[var(--text-secondary)]">{selectedCase.description}</p>}
                <div className="mt-4 space-y-2">
                  <MiniRow label="Client" value={selectedCase.client_name || '—'} />
                  <MiniRow label="Assigned" value={selectedCase.assigned_to || '—'} />
                  <MiniRow label="Priority" value={selectedCase.priority} />
                  <MiniRow label="Created" value={selectedCase.created_at ? new Date(selectedCase.created_at).toLocaleDateString() : '—'} />
                </div>
                <div className="mt-4 border-t border-[var(--border-subtle)] pt-3">
                  <p className="mb-2 text-xs uppercase tracking-wide text-[var(--text-muted)]">Move to</p>
                  <div className="flex flex-wrap gap-2">
                    {(['open', 'in_progress', 'blocked', 'completed'] as CaseStatus[]).filter((s) => s !== selectedCase.status).map((s) => (
                      <button key={s} onClick={() => updateCaseStatus(selectedCase.id, s)} className="rounded-md border border-[var(--border-medium)] px-3 py-1 text-xs font-medium text-[var(--text-secondary)] hover:border-[var(--portal)] hover:text-[var(--text-primary)] transition-colors">
                        {fmtStatus(s)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Tasks */}
              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  Tasks ({selectedCase.tasks.filter((t) => t.status === 'complete').length}/{selectedCase.tasks.length})
                </h3>
                <div className="space-y-1">
                  {selectedCase.tasks.map((task) => (
                    <button key={task.id} onClick={() => toggleTask(task.id)} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-[var(--bg-hover)] transition-colors">
                      <span className={`material-icons-outlined text-[18px] ${task.status === 'complete' ? 'text-emerald-400' : 'text-[var(--text-muted)]'}`}>
                        {task.status === 'complete' ? 'check_box' : 'check_box_outline_blank'}
                      </span>
                      <span className={`text-sm ${task.status === 'complete' ? 'line-through text-[var(--text-muted)]' : 'text-[var(--text-primary)]'}`}>{task.title}</span>
                    </button>
                  ))}
                </div>
                <div className="mt-3 flex gap-2">
                  <input type="text" value={newTaskTitle} onChange={(e) => setNewTaskTitle(e.target.value)} placeholder="Add task..." onKeyDown={(e) => e.key === 'Enter' && addTask()} className="flex-1 rounded-md border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-1.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--portal)]" />
                  <button onClick={addTask} disabled={!newTaskTitle.trim()} className="rounded-md bg-[var(--portal)] px-3 py-1.5 text-sm text-white disabled:opacity-50">
                    <span className="material-icons-outlined text-[16px]">add</span>
                  </button>
                </div>
              </div>

              {/* Notes */}
              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">Notes ({selectedCase.notes.length})</h3>
                <div className="max-h-60 space-y-3 overflow-y-auto">
                  {selectedCase.notes.length === 0 ? (
                    <p className="text-xs text-[var(--text-muted)]">No notes yet.</p>
                  ) : selectedCase.notes.slice().reverse().map((note) => (
                    <div key={note.id} className="rounded-md bg-[var(--bg-surface)] p-3">
                      <p className="text-sm text-[var(--text-primary)]">{note.text}</p>
                      <p className="mt-1 text-[10px] text-[var(--text-muted)]">{note.author} &middot; {new Date(note.date).toLocaleString()}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex gap-2">
                  <input type="text" value={newNote} onChange={(e) => setNewNote(e.target.value)} placeholder="Add a note..." onKeyDown={(e) => e.key === 'Enter' && addNote()} className="flex-1 rounded-md border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-1.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--portal)]" />
                  <button onClick={addNote} disabled={!newNote.trim()} className="rounded-md bg-[var(--portal)] px-3 py-1.5 text-sm text-white disabled:opacity-50">
                    <span className="material-icons-outlined text-[16px]">send</span>
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-card)] py-16">
              <span className="material-icons-outlined text-3xl text-[var(--text-muted)]">touch_app</span>
              <p className="mt-3 text-sm text-[var(--text-muted)]">Select a case to view details</p>
            </div>
          )}
        </div>
      </div>

      {/* New Case Modal */}
      {showNewCase && <NewCaseModal onClose={() => setShowNewCase(false)} onCreated={(c) => { setCases((p) => [c, ...p]); setShowNewCase(false); setSelectedCase(c) }} userEmail={user?.email || ''} />}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function CaseRow({ caseItem, isSelected, onSelect }: { caseItem: CaseRecord; isSelected: boolean; onSelect: () => void }) {
  const done = caseItem.tasks.filter((t) => t.status === 'complete').length
  const total = caseItem.tasks.length
  const pct = total > 0 ? Math.round((done / total) * 100) : 0

  return (
    <button onClick={onSelect} className={`w-full text-left rounded-lg border p-4 transition-all ${isSelected ? 'border-[var(--portal)] bg-[var(--portal-glow)]' : 'border-[var(--border-subtle)] bg-[var(--bg-card)] hover:border-[var(--portal)]/30'}`}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <PriorityDot priority={caseItem.priority} />
          <div>
            <p className="text-sm font-medium text-[var(--text-primary)]">{caseItem.title}</p>
            <p className="text-xs text-[var(--text-muted)]">{caseItem.client_name || 'No client'} &middot; {caseItem.assigned_to || 'Unassigned'}</p>
          </div>
        </div>
        <div className="text-right">
          <StatusBadge status={caseItem.status} />
          {total > 0 && <p className="mt-1 text-xs text-[var(--text-muted)]">{done}/{total} tasks</p>}
        </div>
      </div>
      {total > 0 && (
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[var(--bg-surface)]">
          <div className="h-full rounded-full bg-[var(--portal)] transition-all" style={{ width: `${pct}%` }} />
        </div>
      )}
    </button>
  )
}

function StatusBadge({ status }: { status: CaseStatus }) {
  const m: Record<CaseStatus, string> = { open: 'bg-blue-500/15 text-blue-400', in_progress: 'bg-amber-500/15 text-amber-400', blocked: 'bg-red-500/15 text-red-400', completed: 'bg-emerald-500/15 text-emerald-400' }
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${m[status]}`}>{fmtStatus(status)}</span>
}

function PriorityDot({ priority }: { priority: CaseRecord['priority'] }) {
  const c: Record<string, string> = { low: 'bg-blue-400', medium: 'bg-amber-400', high: 'bg-orange-400', urgent: 'bg-red-400' }
  return <div className={`h-3 w-3 shrink-0 rounded-full ${c[priority] || 'bg-gray-400'}`} title={priority} />
}

function MiniRow({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between"><span className="text-xs text-[var(--text-muted)]">{label}</span><span className="text-sm text-[var(--text-primary)]">{value}</span></div>
}

function fmtStatus(s: CaseStatus): string { return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) }

// ---------------------------------------------------------------------------
// New Case Modal
// ---------------------------------------------------------------------------

function NewCaseModal({ onClose, onCreated, userEmail }: { onClose: () => void; onCreated: (c: CaseRecord) => void; userEmail: string }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [clientName, setClientName] = useState('')
  const [priority, setPriority] = useState<CaseRecord['priority']>('medium')
  const [creating, setCreating] = useState(false)

  const create = async () => {
    if (!title.trim()) return
    setCreating(true)
    try {
      const db = getDb()
      const now = new Date().toISOString()
      const data = { title: title.trim(), description: description.trim(), client_name: clientName.trim(), assigned_to: userEmail, status: 'open', priority, product_lines: [], tasks: [], notes: [], created_at: now, updated_at: now }
      const ref = await addDoc(collection(db, 'case_tasks'), data)
      onCreated({ id: ref.id, ...data, client_id: '' } as CaseRecord)
    } catch (err) {
      console.error('Failed to create case:', err)
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="w-full max-w-lg rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-[var(--text-primary)]">New Case</h2>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"><span className="material-icons-outlined">close</span></button>
        </div>
        <div className="mt-4 space-y-4">
          <div>
            <label className="mb-1 block text-xs uppercase tracking-wide text-[var(--text-muted)]">Title *</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-md border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--portal)]" placeholder="Case title..." />
          </div>
          <div>
            <label className="mb-1 block text-xs uppercase tracking-wide text-[var(--text-muted)]">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="w-full rounded-md border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--portal)] resize-none" placeholder="What needs to be done..." />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs uppercase tracking-wide text-[var(--text-muted)]">Client Name</label>
              <input type="text" value={clientName} onChange={(e) => setClientName(e.target.value)} className="w-full rounded-md border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--portal)]" />
            </div>
            <div>
              <label className="mb-1 block text-xs uppercase tracking-wide text-[var(--text-muted)]">Priority</label>
              <select value={priority} onChange={(e) => setPriority(e.target.value as CaseRecord['priority'])} className="w-full rounded-md border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--portal)]">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button onClick={onClose} className="rounded-lg border border-[var(--border-medium)] px-4 py-2 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)]">Cancel</button>
          <button onClick={create} disabled={!title.trim() || creating} className="rounded-lg bg-[var(--portal)] px-4 py-2 text-sm font-medium text-white hover:brightness-110 disabled:opacity-50">{creating ? 'Creating...' : 'Create Case'}</button>
        </div>
      </div>
    </div>
  )
}
