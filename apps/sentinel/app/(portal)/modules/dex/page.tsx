'use client'

import { useMemo } from 'react'
import { query, type Query, type DocumentData } from 'firebase/firestore'
import { useCollection } from '@tomachina/db'
import { collections } from '@tomachina/db/src/firestore'

const commsQuery: Query<DocumentData> = query(collections.communications())
const tasksQuery: Query<DocumentData> = query(collections.caseTasks())

interface CommRecord {
  _id: string
  channel?: string
  type?: string
  subject?: string
  status?: string
}

interface TaskRecord {
  _id: string
  task_type?: string
  title?: string
  status?: string
  priority?: string
}

export default function DexPage() {
  const { data: comms, loading: commsLoading } = useCollection<CommRecord>(commsQuery, 'sentinel-dex-comms')
  const { data: tasks, loading: tasksLoading } = useCollection<TaskRecord>(tasksQuery, 'sentinel-dex-tasks')

  const anyLoading = commsLoading || tasksLoading

  const docStats = useMemo(() => {
    const docComms = comms.filter((c) => {
      const ch = (c.channel || c.type || '').toLowerCase()
      return ch.includes('doc') || ch.includes('email') || ch.includes('fax')
    })
    const docTasks = tasks.filter((t) => {
      const tt = (t.task_type || t.title || '').toLowerCase()
      return tt.includes('doc') || tt.includes('file') || tt.includes('form') || tt.includes('sign')
    })
    const openTasks = docTasks.filter((t) => {
      const s = (t.status || '').toLowerCase()
      return s !== 'completed' && s !== 'closed' && s !== 'done'
    })
    return {
      totalComms: comms.length,
      docComms: docComms.length,
      totalTasks: tasks.length,
      docTasks: docTasks.length,
      openDocTasks: openTasks.length,
    }
  }, [comms, tasks])

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-2xl font-bold text-[var(--text-primary)]">DEX — Document Efficiency</h1>
      <p className="mt-1 text-sm text-[var(--text-muted)]">Document management, OCR extraction, and compliance tracking</p>

      {/* Summary Cards */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon="email" label="Total Communications" value={docStats.totalComms} loading={anyLoading} />
        <StatCard icon="description" label="Document-Related" value={docStats.docComms} loading={anyLoading} />
        <StatCard icon="task" label="Case Tasks" value={docStats.totalTasks} loading={anyLoading} />
        <StatCard icon="pending_actions" label="Open Doc Tasks" value={docStats.openDocTasks} loading={anyLoading} />
      </div>

      {/* Document Pipeline Status */}
      <div className="mt-8 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6">
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">Document Pipeline</h2>
        <p className="mt-0.5 text-xs text-[var(--text-muted)]">Automated filing, OCR extraction, and compliance tracking</p>
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <PipelineStage icon="upload_file" label="Intake" description="Documents received via email, fax, or upload" />
          <PipelineStage icon="document_scanner" label="Processing" description="OCR extraction, classification, and data parsing" />
          <PipelineStage icon="folder_open" label="Filing" description="Automated routing to client folders and compliance storage" />
        </div>
      </div>

      {/* Coming Soon */}
      <div className="mt-6 rounded-xl border border-dashed border-[var(--border)] bg-[var(--bg-surface)] p-6 text-center">
        <span className="material-icons-outlined text-3xl text-[var(--text-muted)]">auto_awesome</span>
        <p className="mt-2 text-sm font-medium text-[var(--text-secondary)]">Full Document Intelligence Coming Soon</p>
        <p className="mt-1 text-xs text-[var(--text-muted)]">
          Document taxonomy browser, compliance audit trail, and automated form-fill will be available when the document collections are migrated to Firestore.
        </p>
      </div>
    </div>
  )
}

function StatCard({ icon, label, value, loading }: {
  icon: string; label: string; value: number; loading: boolean
}) {
  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
      <div className="flex items-center gap-2">
        <span className="material-icons-outlined" style={{ fontSize: '18px', color: 'var(--portal)' }}>{icon}</span>
        <span className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">{label}</span>
      </div>
      {loading ? (
        <div className="mt-2 h-8 w-16 animate-pulse rounded bg-[var(--bg-surface)]" />
      ) : (
        <p className="mt-2 text-2xl font-bold text-[var(--text-primary)]">{value.toLocaleString()}</p>
      )}
    </div>
  )
}

function PipelineStage({ icon, label, description }: {
  icon: string; label: string; description: string
}) {
  return (
    <div className="flex flex-col items-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 text-center">
      <span
        className="flex h-10 w-10 items-center justify-center rounded-full"
        style={{ background: 'var(--portal-glow)' }}
      >
        <span className="material-icons-outlined" style={{ fontSize: '22px', color: 'var(--portal)' }}>{icon}</span>
      </span>
      <p className="mt-2 text-sm font-semibold text-[var(--text-primary)]">{label}</p>
      <p className="mt-1 text-xs text-[var(--text-muted)]">{description}</p>
    </div>
  )
}
