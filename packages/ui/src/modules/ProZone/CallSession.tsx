'use client'

import { useState, useEffect, useCallback } from 'react'
import CallPanel from './CallPanel'
import type { CallDisposition } from './CallPanel'
import type { SessionStats, SessionStatus, SessionProspect } from './useCallSession'

// ============================================================================
// CallSession — Power dialer session wrapper
// TRK-PC-007: Stats bar, pause/resume/end controls, progress indicator
// TRK-PC-010: Live stats dashboard
// TRK-PC-011: End session summary modal
// ============================================================================

interface CallSessionProps {
  queue: SessionProspect[]
  currentIndex: number
  currentProspect: SessionProspect | null
  status: SessionStatus
  stats: SessionStats
  remaining: number
  onDisposition: (disposition: CallDisposition) => void
  onSkip: () => void
  onPause: () => void
  onResume: () => void
  onEnd: () => void
  onDone: () => void
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

// ── Stats Bar ──
function SessionStatsBar({ stats, remaining, currentIndex, total, status }: {
  stats: SessionStats
  remaining: number
  currentIndex: number
  total: number
  status: SessionStatus
}) {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (status !== 'active' && status !== 'paused') return
    const start = Date.now()
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [status])

  return (
    <div className="flex items-center gap-4 rounded-xl border border-sky-500/20 bg-sky-500/5 px-4 py-2.5">
      <div className="flex items-center gap-1.5">
        <span className="material-icons-outlined text-sky-400" style={{ fontSize: '16px' }}>phone_in_talk</span>
        <span className="text-xs font-semibold text-sky-400">CALL SESSION</span>
      </div>

      <div className="h-4 w-px bg-[var(--border-subtle)]" />

      <StatBadge label="Progress" value={`${currentIndex + 1} / ${total}`} color="text-[var(--text-primary)]" />
      <StatBadge label="Booked" value={String(stats.booked)} color="text-emerald-400" />
      <StatBadge label="No Answer" value={String(stats.no_answer + stats.left_voicemail)} color="text-amber-400" />
      <StatBadge label="Callbacks" value={String(stats.callback)} color="text-sky-400" />
      <StatBadge label="Remaining" value={String(remaining)} color="text-[var(--text-muted)]" />
      <StatBadge label="Duration" value={formatDuration(elapsed)} color="text-[var(--text-secondary)]" />

      {status === 'paused' && (
        <span className="rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-amber-400">
          PAUSED
        </span>
      )}
    </div>
  )
}

function StatBadge({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className={`text-sm font-bold tabular-nums ${color}`}>{value}</span>
      <span className="text-[9px] uppercase tracking-wider text-[var(--text-muted)]">{label}</span>
    </div>
  )
}

// ── Session Summary Modal ──
function SessionSummary({ stats, onDone }: { stats: SessionStats; onDone: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 shadow-2xl">
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10">
            <span className="material-icons-outlined text-emerald-400" style={{ fontSize: '24px' }}>
              assessment
            </span>
          </span>
          <div>
            <h3 className="text-lg font-bold text-[var(--text-primary)]">Session Complete</h3>
            <p className="text-xs text-[var(--text-muted)]">
              {stats.completed} calls made &middot; {formatDuration(stats.total_duration)} total
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-6">
          <SummaryCard label="Booked" value={stats.booked} color="emerald" />
          <SummaryCard label="Callback" value={stats.callback} color="sky" />
          <SummaryCard label="No Answer" value={stats.no_answer} color="amber" />
          <SummaryCard label="Voicemail" value={stats.left_voicemail} color="violet" />
          <SummaryCard label="Follow Up" value={stats.follow_up_needed} color="orange" />
          <SummaryCard label="Not Interested" value={stats.not_interested} color="neutral" />
        </div>

        {stats.skipped > 0 && (
          <p className="mb-4 text-xs text-[var(--text-muted)]">
            {stats.skipped} prospect{stats.skipped !== 1 ? 's' : ''} skipped
          </p>
        )}

        <button
          type="button"
          onClick={onDone}
          className="w-full rounded-xl bg-[var(--portal)] px-4 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        >
          Done
        </button>
      </div>
    </div>
  )
}

function SummaryCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className={`rounded-lg bg-${color}-500/5 border border-${color}-500/20 px-3 py-2 text-center`}>
      <span className={`text-lg font-bold tabular-nums text-${color}-400`}>{value}</span>
      <p className="text-[9px] uppercase tracking-wider text-[var(--text-muted)]">{label}</p>
    </div>
  )
}

// ── Main Component ──
export default function CallSession({
  queue,
  currentIndex,
  currentProspect,
  status,
  stats,
  remaining,
  onDisposition,
  onSkip,
  onPause,
  onResume,
  onEnd,
  onDone,
}: CallSessionProps) {
  const handleDispositioned = useCallback((disposition: CallDisposition) => {
    onDisposition(disposition)
  }, [onDisposition])

  // Show summary when session ends
  if (status === 'ended') {
    return <SessionSummary stats={stats} onDone={onDone} />
  }

  return (
    <>
      {/* Stats Bar */}
      <SessionStatsBar
        stats={stats}
        remaining={remaining}
        currentIndex={currentIndex}
        total={queue.length}
        status={status}
      />

      {/* Session Controls */}
      <div className="flex items-center gap-2">
        {status === 'active' && (
          <button
            type="button"
            onClick={onPause}
            className="flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-1.5 text-xs font-medium text-amber-400 transition-colors hover:bg-amber-500/10"
          >
            <span className="material-icons-outlined" style={{ fontSize: '14px' }}>pause</span>
            Pause
          </button>
        )}
        {status === 'paused' && (
          <button
            type="button"
            onClick={onResume}
            className="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-1.5 text-xs font-medium text-emerald-400 transition-colors hover:bg-emerald-500/10"
          >
            <span className="material-icons-outlined" style={{ fontSize: '14px' }}>play_arrow</span>
            Resume
          </button>
        )}
        <button
          type="button"
          onClick={onSkip}
          className="flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs font-medium text-[var(--text-muted)] transition-colors hover:text-[var(--text-secondary)]"
        >
          <span className="material-icons-outlined" style={{ fontSize: '14px' }}>skip_next</span>
          Skip
        </button>
        <div className="flex-1" />
        <button
          type="button"
          onClick={onEnd}
          className="flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-1.5 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/10"
        >
          <span className="material-icons-outlined" style={{ fontSize: '14px' }}>stop</span>
          End Session
        </button>
      </div>

      {/* CallPanel in queue mode */}
      {currentProspect && (
        <CallPanel
          prospect={currentProspect}
          onClose={() => {}} // No-op in session mode
          onDispositioned={handleDispositioned}
          queueMode
        />
      )}
    </>
  )
}
