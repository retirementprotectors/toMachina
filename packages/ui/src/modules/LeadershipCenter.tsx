'use client'

import React, { useState, useMemo, useCallback, useEffect } from 'react'
import { query, orderBy, where, limit as firestoreLimit, type Query, type DocumentData, collection as firestoreCollection } from 'firebase/firestore'
import { useCollection } from '@tomachina/db'
import { getDb } from '@tomachina/db/src/firestore'
import { KanbanBoard, type KanbanColumn, type KanbanCard } from '../components/KanbanBoard'

/* ─── Types ─── */
interface ActionItem {
  id: string
  item: string
  owner: string
  due_date: string | null
  status: string
  priority: string
  completed_at?: string
}

interface MeetingRecord {
  _id: string
  meeting_id: string
  title: string
  date: string
  attendees: string[]
  summary: string
  action_items: ActionItem[]
  decisions: Array<{ decision: string; context: string; decided_by: string }>
  follow_ups: Array<{ item: string; owner: string; due_date: string }>
  recording_url?: string
  transcript_url?: string
  duration_minutes?: number
  analysis_source?: string
}

interface RoadmapRecord {
  _id: string
  roadmap_id: string
  owner_email: string
  owner_name: string
  division: string
  title: string
  description: string
  milestones: Array<{
    id: string
    title: string
    target_date: string | null
    status: string
    notes: string
    completed_date: string | null
  }>
  status: string
  google_doc_id: string | null
  last_updated: string
}

interface FlowInstance {
  _id: string
  pipeline_key: string
  current_stage: string
  entity_name: string
  entity_type: string
  assigned_to?: string
  status: string
  created_at?: string
}

interface UserRecord {
  _id: string
  email?: string
  first_name?: string
  last_name?: string
  division?: string
  status?: string
}

interface CaseTaskRecord {
  _id: string
  status?: string
  assigned_to?: string
  created_at?: string
}

type TabKey = 'meetings' | 'roadmaps' | 'pipelines' | 'cross-team' | 'digest'

const TABS: Array<{ key: TabKey; label: string; icon: string }> = [
  { key: 'meetings', label: 'Meeting Intelligence', icon: 'groups' },
  { key: 'roadmaps', label: 'Team Roadmaps', icon: 'map' },
  { key: 'pipelines', label: 'Leadership Pipelines', icon: 'view_kanban' },
  { key: 'cross-team', label: 'Cross-Team View', icon: 'diversity_3' },
  { key: 'digest', label: 'Weekly Digest', icon: 'summarize' },
]

const STATUS_COLORS: Record<string, string> = {
  on_track: '#22c55e',
  at_risk: '#f59e0b',
  behind: '#ef4444',
  completed: '#6b7280',
}

const STATUS_LABELS: Record<string, string> = {
  on_track: 'On Track',
  at_risk: 'At Risk',
  behind: 'Behind',
  completed: 'Completed',
}

const PRIORITY_COLORS: Record<string, string> = {
  high: '#ef4444',
  medium: '#f59e0b',
  low: '#6b7280',
}

function formatDate(d: string | null | undefined): string {
  if (!d) return ''
  try { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) } catch { return d }
}

function isOverdue(dueDate: string | null): boolean {
  if (!dueDate) return false
  return dueDate < new Date().toISOString().split('T')[0]
}

/* ─── Queries ─── */
function getMeetingsQuery(): Query<DocumentData> {
  return query(firestoreCollection(getDb(), 'leadership_meetings'), orderBy('date', 'desc'), firestoreLimit(30))
}

function getRoadmapsQuery(): Query<DocumentData> {
  return query(firestoreCollection(getDb(), 'leadership_roadmaps'), orderBy('owner_name'))
}

function getFlowInstancesQuery(): Query<DocumentData> {
  return query(
    firestoreCollection(getDb(), 'flow', 'config', 'instances'),
    where('status', 'in', ['active', 'open']),
  )
}

function getUsersQuery(): Query<DocumentData> {
  return query(firestoreCollection(getDb(), 'users'), where('status', '==', 'active'))
}

function getTasksQuery(): Query<DocumentData> {
  return query(firestoreCollection(getDb(), 'case_tasks'), where('status', 'in', ['open', 'in_progress']), firestoreLimit(200))
}

/* ─── Component ─── */
export function LeadershipCenter() {
  const [activeTab, setActiveTab] = useState<TabKey>('meetings')
  const [selectedMeeting, setSelectedMeeting] = useState<MeetingRecord | null>(null)
  const [selectedRoadmap, setSelectedRoadmap] = useState<RoadmapRecord | null>(null)
  const [actionFilter, setActionFilter] = useState<'all' | 'overdue' | 'this-week'>('all')

  const { data: meetings, loading: meetingsLoading } = useCollection<MeetingRecord>(getMeetingsQuery(), 'leadership-meetings')
  const { data: roadmaps, loading: roadmapsLoading } = useCollection<RoadmapRecord>(getRoadmapsQuery(), 'leadership-roadmaps')
  const { data: flowInstances } = useCollection<FlowInstance>(getFlowInstancesQuery(), 'leadership-flow')
  const { data: users } = useCollection<UserRecord>(getUsersQuery(), 'leadership-users')
  const { data: tasks } = useCollection<CaseTaskRecord>(getTasksQuery(), 'leadership-tasks')

  // Aggregate action items across all meetings
  const allActions = useMemo(() => {
    const items: Array<ActionItem & { meeting_title: string; meeting_date: string }> = []
    for (const m of meetings) {
      for (const ai of m.action_items || []) {
        if (ai.status !== 'completed') {
          items.push({ ...ai, meeting_title: m.title, meeting_date: m.date })
        }
      }
    }
    return items.sort((a, b) => (a.due_date || '9999').localeCompare(b.due_date || '9999'))
  }, [meetings])

  const filteredActions = useMemo(() => {
    const today = new Date().toISOString().split('T')[0]
    const weekEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    return allActions.filter(a => {
      if (actionFilter === 'overdue') return a.due_date != null && a.due_date < today
      if (actionFilter === 'this-week') return a.due_date != null && a.due_date >= today && a.due_date <= weekEnd
      return true
    })
  }, [allActions, actionFilter])

  // Division aggregates
  const divisionData = useMemo(() => {
    const divs: Record<string, { leader: string; team_size: number; open_tasks: number; roadmap_status: string }> = {
      Sales: { leader: 'Vinnie Vazquez', team_size: 0, open_tasks: 0, roadmap_status: 'on_track' },
      Service: { leader: 'Nikki Gray', team_size: 0, open_tasks: 0, roadmap_status: 'on_track' },
      Legacy: { leader: 'Dr. Aprille Trupiano', team_size: 0, open_tasks: 0, roadmap_status: 'on_track' },
      'B2B': { leader: 'Matt McCormick', team_size: 0, open_tasks: 0, roadmap_status: 'on_track' },
    }

    for (const u of users) {
      const div = u.division || ''
      if (divs[div]) divs[div].team_size++
    }

    for (const r of roadmaps) {
      const div = r.division || ''
      if (divs[div]) divs[div].roadmap_status = r.status
    }

    return divs
  }, [users, roadmaps])

  // Weekly digest data
  const digestData = useMemo(() => {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const weekMeetings = meetings.filter(m => m.date >= weekAgo)
    const completedActions = meetings.flatMap(m =>
      (m.action_items || []).filter(a => a.status === 'completed' && a.completed_at && a.completed_at >= weekAgo)
    )
    return {
      meetings_held: weekMeetings.length,
      actions_created: weekMeetings.flatMap(m => m.action_items || []).length,
      actions_completed: completedActions.length,
      overdue_count: allActions.filter(a => isOverdue(a.due_date)).length,
    }
  }, [meetings, allActions])

  // Pipeline Kanban columns
  const kanbanColumns: KanbanColumn[] = useMemo(() => {
    const stages = ['Planning', 'In Progress', 'Review', 'Completed']
    return stages.map(stage => ({
      id: stage.toLowerCase().replace(/\s+/g, '-'),
      title: stage,
      color: stage === 'Completed' ? '#22c55e' : stage === 'Review' ? '#f59e0b' : 'var(--portal)',
      cards: flowInstances
        .filter(inst => {
          const s = (inst.current_stage || '').toLowerCase()
          return s.includes(stage.toLowerCase()) || (stage === 'In Progress' && s === 'active')
        })
        .map(inst => ({
          id: inst._id,
          title: inst.entity_name || 'Initiative',
          subtitle: inst.entity_type || '',
          badges: [{ label: inst.status, color: 'var(--portal)' }],
          meta: [
            ...(inst.assigned_to ? [{ icon: 'person', text: inst.assigned_to }] : []),
            ...(inst.created_at ? [{ icon: 'event', text: formatDate(inst.created_at) }] : []),
          ],
        })),
    }))
  }, [flowInstances])

  /* ─── Tab Renderers ─── */

  const renderMeetings = () => (
    <div className="space-y-6">
      {/* Action Item Rollup */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Open Action Items ({allActions.length})</h3>
          <div className="flex gap-1">
            {(['all', 'overdue', 'this-week'] as const).map(f => (
              <button
                key={f}
                onClick={() => setActionFilter(f)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                  actionFilter === f ? 'bg-[var(--portal)] text-white' : 'text-[var(--text-muted)] hover:bg-[var(--bg-hover)]'
                }`}
              >{f === 'all' ? 'All' : f === 'overdue' ? 'Overdue' : 'This Week'}</button>
            ))}
          </div>
        </div>
        {filteredActions.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">No action items match filter.</p>
        ) : (
          <div className="space-y-1.5">
            {filteredActions.slice(0, 15).map(ai => (
              <div key={ai.id} className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-sm ${
                isOverdue(ai.due_date) ? 'border-[#ef4444] bg-[rgba(239,68,68,0.05)]' : 'border-[var(--border-subtle)] bg-[var(--bg-card)]'
              }`}>
                <span className="h-2 w-2 rounded-full" style={{ background: PRIORITY_COLORS[ai.priority] || '#6b7280' }} />
                <span className="flex-1 text-[var(--text-primary)]">{ai.item}</span>
                <span className="text-xs text-[var(--text-muted)]">{ai.owner}</span>
                <span className={`text-xs ${isOverdue(ai.due_date) ? 'font-semibold text-[#ef4444]' : 'text-[var(--text-muted)]'}`}>
                  {ai.due_date ? formatDate(ai.due_date) : '—'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Meeting List */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-[var(--text-primary)]">Recent Meetings</h3>
        {meetingsLoading ? (
          <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--portal)] border-t-transparent" /> Loading...
          </div>
        ) : meetings.length === 0 ? (
          <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] p-8 text-center text-sm text-[var(--text-muted)]">
            No meetings recorded yet. Meeting data will appear here after analysis.
          </div>
        ) : (
          <div className="space-y-2">
            {meetings.map(m => (
              <button
                key={m._id}
                onClick={() => setSelectedMeeting(selectedMeeting?._id === m._id ? null : m)}
                className={`w-full rounded-lg border p-3 text-left transition-colors ${
                  selectedMeeting?._id === m._id ? 'border-[var(--portal)] bg-[var(--portal-glow)]' : 'border-[var(--border-subtle)] bg-[var(--bg-card)] hover:border-[var(--border)]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-[var(--text-primary)]">{m.title}</span>
                  <span className="text-xs text-[var(--text-muted)]">{formatDate(m.date)}</span>
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-[var(--text-muted)]">{m.summary || 'No summary'}</p>
                <div className="mt-2 flex gap-3 text-[10px] text-[var(--text-muted)]">
                  <span>{m.attendees?.length || 0} attendees</span>
                  <span>{(m.action_items || []).length} actions</span>
                  <span>{(m.decisions || []).length} decisions</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Meeting Detail */}
      {selectedMeeting && (
        <div className="rounded-lg border-2 border-[var(--portal)] bg-[var(--bg-card)] p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">{selectedMeeting.title}</h3>
            <button onClick={() => setSelectedMeeting(null)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
              <span className="material-icons-outlined" style={{ fontSize: '18px' }}>close</span>
            </button>
          </div>
          {selectedMeeting.summary && <p className="mb-3 text-sm text-[var(--text-secondary)]">{selectedMeeting.summary}</p>}

          {(selectedMeeting.action_items || []).length > 0 && (
            <div className="mb-3">
              <h4 className="mb-1 text-xs font-semibold uppercase text-[var(--text-muted)]">Action Items</h4>
              {selectedMeeting.action_items.map(ai => (
                <div key={ai.id} className="flex items-center gap-2 py-1 text-sm">
                  <span className={`material-icons-outlined ${ai.status === 'completed' ? 'text-[#22c55e]' : 'text-[var(--text-muted)]'}`} style={{ fontSize: '16px' }}>
                    {ai.status === 'completed' ? 'check_circle' : 'radio_button_unchecked'}
                  </span>
                  <span className={`flex-1 ${ai.status === 'completed' ? 'line-through text-[var(--text-muted)]' : 'text-[var(--text-secondary)]'}`}>{ai.item}</span>
                  <span className="text-xs text-[var(--text-muted)]">{ai.owner}</span>
                </div>
              ))}
            </div>
          )}

          {(selectedMeeting.decisions || []).length > 0 && (
            <div>
              <h4 className="mb-1 text-xs font-semibold uppercase text-[var(--text-muted)]">Decisions</h4>
              {selectedMeeting.decisions.map((d, i) => (
                <div key={i} className="py-1 text-sm text-[var(--text-secondary)]">
                  <span className="font-medium">{d.decision}</span>
                  {d.decided_by && <span className="text-xs text-[var(--text-muted)]"> — {d.decided_by}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )

  const renderRoadmaps = () => (
    <div>
      {roadmapsLoading ? (
        <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--portal)] border-t-transparent" /> Loading...
        </div>
      ) : roadmaps.length === 0 ? (
        <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] p-8 text-center text-sm text-[var(--text-muted)]">
          No roadmaps created yet. Run the seed script to initialize team roadmaps.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {roadmaps.map(r => {
              const totalMs = r.milestones.length
              const completedMs = r.milestones.filter(m => m.status === 'completed').length
              const progress = totalMs > 0 ? Math.round((completedMs / totalMs) * 100) : 0
              const nextMs = r.milestones.find(m => m.status !== 'completed')

              return (
                <button
                  key={r._id}
                  onClick={() => setSelectedRoadmap(selectedRoadmap?._id === r._id ? null : r)}
                  className={`rounded-xl border p-4 text-left transition-colors ${
                    selectedRoadmap?._id === r._id ? 'border-[var(--portal)] bg-[var(--portal-glow)]' : 'border-[var(--border-subtle)] bg-[var(--bg-card)] hover:border-[var(--border)]'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-semibold text-[var(--text-primary)]">{r.owner_name}</p>
                      <p className="text-xs text-[var(--text-muted)]">{r.division}</p>
                    </div>
                    <span className="rounded-full px-2 py-0.5 text-[10px] font-medium" style={{
                      background: `${STATUS_COLORS[r.status] || '#6b7280'}20`,
                      color: STATUS_COLORS[r.status] || '#6b7280',
                    }}>{STATUS_LABELS[r.status] || r.status}</span>
                  </div>
                  <p className="mt-2 text-xs text-[var(--text-secondary)]">{r.title}</p>
                  {/* Progress bar */}
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)]">
                      <span>{completedMs}/{totalMs} milestones</span>
                      <span>{progress}%</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--bg-surface)]">
                      <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, background: STATUS_COLORS[r.status] || 'var(--portal)' }} />
                    </div>
                  </div>
                  {nextMs && (
                    <p className="mt-2 text-[10px] text-[var(--text-muted)]">
                      Next: {nextMs.title} {nextMs.target_date ? `(${formatDate(nextMs.target_date)})` : ''}
                    </p>
                  )}
                </button>
              )
            })}
          </div>

          {/* Roadmap Detail */}
          {selectedRoadmap && (
            <div className="mt-4 rounded-lg border-2 border-[var(--portal)] bg-[var(--bg-card)] p-4">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-[var(--text-primary)]">{selectedRoadmap.title}</h3>
                  <p className="text-xs text-[var(--text-muted)]">{selectedRoadmap.owner_name} — {selectedRoadmap.division}</p>
                </div>
                <div className="flex items-center gap-2">
                  {selectedRoadmap.google_doc_id && (
                    <a
                      href={`https://docs.google.com/document/d/${selectedRoadmap.google_doc_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-[var(--portal)] hover:underline"
                    >
                      <span className="material-icons-outlined" style={{ fontSize: '14px' }}>open_in_new</span>
                      Google Doc
                    </a>
                  )}
                  <button onClick={() => setSelectedRoadmap(null)} className="text-[var(--text-muted)]">
                    <span className="material-icons-outlined" style={{ fontSize: '18px' }}>close</span>
                  </button>
                </div>
              </div>
              {selectedRoadmap.description && <p className="mb-3 text-sm text-[var(--text-secondary)]">{selectedRoadmap.description}</p>}
              <div className="space-y-2">
                {selectedRoadmap.milestones.map((ms, i) => (
                  <div key={ms.id || i} className="flex items-center gap-3 rounded-lg border border-[var(--border-subtle)] p-2.5">
                    <span className="material-icons-outlined" style={{ fontSize: '18px', color: STATUS_COLORS[ms.status] || '#6b7280' }}>
                      {ms.status === 'completed' ? 'check_circle' : ms.status === 'behind' ? 'error' : ms.status === 'at_risk' ? 'warning' : 'schedule'}
                    </span>
                    <div className="flex-1">
                      <p className="text-sm text-[var(--text-primary)]">{ms.title}</p>
                      {ms.notes && <p className="text-xs text-[var(--text-muted)]">{ms.notes}</p>}
                    </div>
                    <span className="text-xs text-[var(--text-muted)]">
                      {ms.completed_date ? `Done ${formatDate(ms.completed_date)}` : ms.target_date ? formatDate(ms.target_date) : ''}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )

  const renderPipelines = () => (
    <div>
      <KanbanBoard
        columns={kanbanColumns}
        emptyMessage="No active leadership pipeline instances. Create initiatives to track them here."
      />
    </div>
  )

  const renderCrossTeam = () => (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {Object.entries(divisionData).map(([name, data]) => (
        <div key={name} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">{name}</h3>
              <p className="text-xs text-[var(--text-muted)]">{data.leader}</p>
            </div>
            <span className="rounded-full px-2 py-0.5 text-[10px] font-medium" style={{
              background: `${STATUS_COLORS[data.roadmap_status] || '#6b7280'}20`,
              color: STATUS_COLORS[data.roadmap_status] || '#6b7280',
            }}>{STATUS_LABELS[data.roadmap_status] || data.roadmap_status}</span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-[var(--bg-surface)] p-2 text-center">
              <p className="text-lg font-bold text-[var(--text-primary)]">{data.team_size}</p>
              <p className="text-[10px] text-[var(--text-muted)]">Team Members</p>
            </div>
            <div className="rounded-lg bg-[var(--bg-surface)] p-2 text-center">
              <p className="text-lg font-bold text-[var(--text-primary)]">{data.open_tasks}</p>
              <p className="text-[10px] text-[var(--text-muted)]">Open Tasks</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  )

  const renderDigest = () => (
    <div className="space-y-4">
      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6">
        <h3 className="mb-4 text-sm font-semibold text-[var(--text-primary)]">This Week at a Glance</h3>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {[
            { label: 'Meetings Held', value: digestData.meetings_held, icon: 'groups' },
            { label: 'Actions Created', value: digestData.actions_created, icon: 'add_task' },
            { label: 'Actions Completed', value: digestData.actions_completed, icon: 'task_alt' },
            { label: 'Overdue Items', value: digestData.overdue_count, icon: 'warning', color: digestData.overdue_count > 0 ? '#ef4444' : undefined },
          ].map(m => (
            <div key={m.label} className="rounded-lg bg-[var(--bg-surface)] p-3 text-center">
              <span className="material-icons-outlined" style={{ fontSize: '24px', color: m.color || 'var(--portal)' }}>{m.icon}</span>
              <p className="mt-1 text-2xl font-bold text-[var(--text-primary)]">{m.value}</p>
              <p className="text-[10px] text-[var(--text-muted)]">{m.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Roadmap Summary */}
      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6">
        <h3 className="mb-3 text-sm font-semibold text-[var(--text-primary)]">Roadmap Status</h3>
        <div className="space-y-2">
          {roadmaps.map(r => (
            <div key={r._id} className="flex items-center justify-between text-sm">
              <span className="text-[var(--text-secondary)]">{r.owner_name} — {r.title}</span>
              <span className="rounded-full px-2 py-0.5 text-[10px] font-medium" style={{
                background: `${STATUS_COLORS[r.status]}20`,
                color: STATUS_COLORS[r.status],
              }}>{STATUS_LABELS[r.status] || r.status}</span>
            </div>
          ))}
          {roadmaps.length === 0 && <p className="text-sm text-[var(--text-muted)]">No roadmaps to report.</p>}
        </div>
      </div>

      {/* Digest note */}
      <div className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--bg-secondary)] p-4 text-center">
        <span className="material-icons-outlined text-2xl text-[var(--text-muted)]">send</span>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          Weekly digest Slack delivery will be available when the leadership digest API is connected.
        </p>
      </div>
    </div>
  )

  const tabRenderers: Record<TabKey, () => React.ReactNode> = {
    meetings: renderMeetings,
    roadmaps: renderRoadmaps,
    pipelines: renderPipelines,
    'cross-team': renderCrossTeam,
    digest: renderDigest,
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Leadership Center</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">Meeting intelligence, team roadmaps, and cross-team visibility.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-6 flex gap-1 overflow-x-auto border-b border-[var(--border-subtle)]">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'border-[var(--portal)] text-[var(--portal)]'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
            }`}
          >
            <span className="material-icons-outlined" style={{ fontSize: '18px' }}>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {tabRenderers[activeTab]()}
      </div>
    </div>
  )
}
