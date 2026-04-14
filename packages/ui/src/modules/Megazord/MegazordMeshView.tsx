'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { fetchValidated } from '../fetchValidated'

// ---------------------------------------------------------------------------
// Types (mirrors services/api/src/rangers/types.ts)
// ---------------------------------------------------------------------------

type RangerStatus = 'idle' | 'running' | 'completed' | 'failed' | 'paused' | 'cancelled'
type RangerStepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped'

interface RangerMeta {
  rangerId: string
  wireId: string
  name: string
  description: string
  superTools: string[]
  model: string
  maxRetries: number
  currentStatus: 'idle' | 'running'
  lastRunAt: string | null
  lastRunStatus: RangerStatus | null
}

interface RangerStepResult {
  stepId: string
  superToolId: string
  status: RangerStepStatus
  startedAt: string | null
  completedAt: string | null
  duration_ms: number
  error?: string
}

interface RangerRunDoc {
  runId: string
  rangerId: string
  wireId: string
  status: RangerStatus
  steps: RangerStepResult[]
  startedAt: string
  completedAt: string | null
  triggeredBy: string
  error: string | null
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MECHA_GREEN = '#10b981'
const MECHA_GREEN_BG = 'rgba(16,185,129,0.08)'
const MECHA_GREEN_BORDER = 'rgba(16,185,129,0.2)'
const REFRESH_INTERVAL = 5000

const STATUS_COLORS: Record<RangerStatus | 'idle', { bg: string; text: string; icon: string }> = {
  idle: { bg: 'rgba(148,163,184,0.1)', text: 'rgb(148,163,184)', icon: 'pause_circle' },
  running: { bg: 'rgba(59,130,246,0.1)', text: 'rgb(59,130,246)', icon: 'play_circle' },
  completed: { bg: 'rgba(16,185,129,0.1)', text: MECHA_GREEN, icon: 'check_circle' },
  failed: { bg: 'rgba(239,68,68,0.1)', text: 'rgb(239,68,68)', icon: 'error' },
  paused: { bg: 'rgba(245,158,11,0.1)', text: 'rgb(245,158,11)', icon: 'pause_circle' },
  cancelled: { bg: 'rgba(148,163,184,0.1)', text: 'rgb(148,163,184)', icon: 'cancel' },
}

const STEP_STATUS_COLORS: Record<RangerStepStatus, string> = {
  pending: 'rgb(148,163,184)',
  running: 'rgb(59,130,246)',
  completed: MECHA_GREEN,
  failed: 'rgb(239,68,68)',
  skipped: 'rgb(245,158,11)',
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtTime(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('en-US', {
      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
    })
  } catch { return iso }
}

function fmtDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${(ms / 60000).toFixed(1)}m`
}

// ---------------------------------------------------------------------------
// MegazordMeshView — Ranger status cards, timeline, history, dispatch
// ---------------------------------------------------------------------------

export function MegazordMeshView() {
  const [rangers, setRangers] = useState<RangerMeta[]>([])
  const [history, setHistory] = useState<RangerRunDoc[]>([])
  const [selectedRun, setSelectedRun] = useState<RangerRunDoc | null>(null)
  const [loading, setLoading] = useState(true)
  const [dispatching, setDispatching] = useState<string | null>(null)

  const loadRegistry = useCallback(async () => {
    try {
      const res = await fetchValidated<RangerMeta[]>('/api/rangers/registry')
      if (res?.data) setRangers(res.data)
    } catch { /* registry may not be seeded yet */ }
  }, [])

  const loadHistory = useCallback(async () => {
    try {
      const res = await fetchValidated<{ items: RangerRunDoc[]; nextCursor?: string | null }>('/api/rangers/history?limit=50')
      if (res?.data?.items) setHistory(res.data.items)
    } catch { /* no runs yet */ }
  }, [])

  useEffect(() => {
    Promise.all([loadRegistry(), loadHistory()]).finally(() => setLoading(false))
  }, [loadRegistry, loadHistory])

  // Auto-refresh when any Ranger is running
  useEffect(() => {
    const hasRunning = rangers.some((r) => r.currentStatus === 'running')
    if (!hasRunning) return
    const timer = setInterval(() => {
      loadRegistry()
      loadHistory()
    }, REFRESH_INTERVAL)
    return () => clearInterval(timer)
  }, [rangers, loadRegistry, loadHistory])

  const handleDispatch = async (rangerId: string) => {
    setDispatching(rangerId)
    try {
      await fetchValidated('/api/rangers/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rangerId }),
      })
      // Refresh after dispatch
      setTimeout(() => { loadRegistry(); loadHistory() }, 1000)
    } catch { /* dispatch error handled by toast in production */ }
    setDispatching(null)
  }

  if (loading) return (
    <div className="flex justify-center py-12">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: MECHA_GREEN, borderTopColor: 'transparent' }} />
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Ranger Status Cards */}
      <div>
        <div className="mb-3 flex items-center gap-2">
          <span className="material-icons-outlined" style={{ fontSize: 18, color: MECHA_GREEN }}>cable</span>
          <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Ranger Mesh</span>
          <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: MECHA_GREEN_BG, color: MECHA_GREEN }}>
            {rangers.length} Rangers
          </span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rangers.map((r) => {
            const st = STATUS_COLORS[r.currentStatus] || STATUS_COLORS.idle
            return (
              <div key={r.rangerId} className="rounded-xl border p-4 transition-all hover:shadow-md"
                style={{ borderColor: MECHA_GREEN_BORDER, background: 'var(--bg-surface)' }}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <span className="material-icons-outlined" style={{ fontSize: 20, color: st.text }}>{st.icon}</span>
                    <div>
                      <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{r.name}</p>
                      <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{r.rangerId}</p>
                    </div>
                  </div>
                  <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase" style={{ background: st.bg, color: st.text }}>
                    {r.currentStatus}
                  </span>
                </div>
                <p className="mt-2 text-xs" style={{ color: 'var(--text-secondary)' }}>{r.description}</p>
                <div className="mt-3 flex items-center gap-3 text-[10px]" style={{ color: 'var(--text-muted)' }}>
                  <span>Wire: <strong style={{ color: MECHA_GREEN }}>{r.wireId}</strong></span>
                  <span>{r.superTools.length} stages</span>
                  <span>Model: {r.model}</span>
                </div>
                {r.lastRunAt && (
                  <p className="mt-1 text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    Last: {fmtTime(r.lastRunAt)} — <span style={{ color: STATUS_COLORS[r.lastRunStatus || 'idle'].text }}>{r.lastRunStatus}</span>
                  </p>
                )}
                <button
                  onClick={() => handleDispatch(r.rangerId)}
                  disabled={dispatching === r.rangerId || r.currentStatus === 'running'}
                  className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-white transition-all disabled:opacity-50"
                  style={{ background: MECHA_GREEN }}>
                  <span className="material-icons-outlined" style={{ fontSize: 14 }}>
                    {dispatching === r.rangerId ? 'hourglass_empty' : 'play_arrow'}
                  </span>
                  {dispatching === r.rangerId ? 'Dispatching...' : 'Dispatch'}
                </button>
              </div>
            )
          })}
          {rangers.length === 0 && (
            <div className="col-span-full rounded-xl border border-dashed p-8 text-center" style={{ borderColor: MECHA_GREEN_BORDER }}>
              <span className="material-icons-outlined text-3xl" style={{ color: 'var(--text-muted)' }}>cable</span>
              <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>No Rangers registered yet. Deploy Rangers to see them here.</p>
            </div>
          )}
        </div>
      </div>

      {/* Active Execution Timeline */}
      {selectedRun && (
        <div className="rounded-xl border p-4" style={{ borderColor: MECHA_GREEN_BORDER, background: 'var(--bg-surface)' }}>
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-icons-outlined" style={{ fontSize: 18, color: MECHA_GREEN }}>timeline</span>
              <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Execution Timeline</span>
              <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase"
                style={{ background: STATUS_COLORS[selectedRun.status].bg, color: STATUS_COLORS[selectedRun.status].text }}>
                {selectedRun.status}
              </span>
            </div>
            <button onClick={() => setSelectedRun(null)} className="text-xs" style={{ color: 'var(--text-muted)' }}>Close</button>
          </div>
          <div className="flex items-center gap-3 text-[10px]" style={{ color: 'var(--text-muted)' }}>
            <span>Run: <strong>{selectedRun.runId}</strong></span>
            <span>Started: {fmtTime(selectedRun.startedAt)}</span>
            {selectedRun.completedAt && <span>Completed: {fmtTime(selectedRun.completedAt)}</span>}
            <span>By: {selectedRun.triggeredBy}</span>
          </div>
          {selectedRun.error && (
            <p className="mt-2 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs" style={{ color: 'rgb(239,68,68)' }}>
              {selectedRun.error}
            </p>
          )}
          <div className="mt-4 space-y-1">
            {selectedRun.steps.map((step, i) => (
              <div key={step.stepId} className="flex items-center gap-3 rounded-lg px-3 py-2" style={{ background: i % 2 === 0 ? 'transparent' : 'var(--bg-base)' }}>
                <span className="material-icons-outlined" style={{ fontSize: 16, color: STEP_STATUS_COLORS[step.status] }}>
                  {step.status === 'completed' ? 'check_circle' : step.status === 'failed' ? 'error' : step.status === 'running' ? 'play_circle' : 'radio_button_unchecked'}
                </span>
                <span className="min-w-[140px] text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{step.superToolId}</span>
                <span className="rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase"
                  style={{ background: `${STEP_STATUS_COLORS[step.status]}15`, color: STEP_STATUS_COLORS[step.status] }}>
                  {step.status}
                </span>
                {step.duration_ms > 0 && <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{fmtDuration(step.duration_ms)}</span>}
                {step.error && <span className="truncate text-[10px]" style={{ color: 'rgb(239,68,68)' }}>{step.error}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Run History Table */}
      <div>
        <div className="mb-3 flex items-center gap-2">
          <span className="material-icons-outlined" style={{ fontSize: 18, color: MECHA_GREEN }}>history</span>
          <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Run History</span>
          <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Last 50 runs</span>
        </div>
        <div className="overflow-x-auto rounded-xl border" style={{ borderColor: MECHA_GREEN_BORDER }}>
          <table className="w-full text-left text-xs">
            <thead>
              <tr style={{ background: MECHA_GREEN_BG }}>
                <th className="px-3 py-2 font-medium" style={{ color: 'var(--text-secondary)' }}>Run ID</th>
                <th className="px-3 py-2 font-medium" style={{ color: 'var(--text-secondary)' }}>Ranger</th>
                <th className="px-3 py-2 font-medium" style={{ color: 'var(--text-secondary)' }}>Status</th>
                <th className="px-3 py-2 font-medium" style={{ color: 'var(--text-secondary)' }}>Started</th>
                <th className="px-3 py-2 font-medium" style={{ color: 'var(--text-secondary)' }}>Duration</th>
                <th className="px-3 py-2 font-medium" style={{ color: 'var(--text-secondary)' }}>Triggered By</th>
              </tr>
            </thead>
            <tbody>
              {history.map((run) => {
                const st = STATUS_COLORS[run.status] || STATUS_COLORS.idle
                const duration = run.completedAt
                  ? new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime()
                  : 0
                return (
                  <tr key={run.runId}
                    onClick={() => setSelectedRun(run)}
                    className="cursor-pointer border-t transition-all hover:bg-[var(--bg-surface)]"
                    style={{ borderColor: 'var(--border-default)' }}>
                    <td className="px-3 py-2 font-mono text-[10px]" style={{ color: 'var(--text-muted)' }}>{run.runId}</td>
                    <td className="px-3 py-2 font-medium" style={{ color: 'var(--text-primary)' }}>{run.rangerId}</td>
                    <td className="px-3 py-2">
                      <span className="rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase" style={{ background: st.bg, color: st.text }}>
                        {run.status}
                      </span>
                    </td>
                    <td className="px-3 py-2" style={{ color: 'var(--text-muted)' }}>{fmtTime(run.startedAt)}</td>
                    <td className="px-3 py-2" style={{ color: 'var(--text-muted)' }}>{duration > 0 ? fmtDuration(duration) : '—'}</td>
                    <td className="px-3 py-2" style={{ color: 'var(--text-muted)' }}>{run.triggeredBy}</td>
                  </tr>
                )
              })}
              {history.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center" style={{ color: 'var(--text-muted)' }}>
                    No Ranger runs yet. Dispatch a Ranger to see results here.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
