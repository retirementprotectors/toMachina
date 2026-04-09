'use client'

// WireHealthCard — LL-07 (System Synergy Dashboard prize)
//
// 5th card in MUSASHI's Phase 3 Synergy Dashboard. Shows real-time health
// of all Learning Loop wires by querying the wire_runs Firestore collection
// via /api/system-synergy/wire-health.
//
// Why this exists: Learning Loop was silently dead for 48+ hours before
// anyone noticed. This tile makes "last successful run" visible for every
// wire so that a wire going dark shows up in minutes, not days.
//
// Paired with MEGAZORD's LL-08 (slack-alert@.service push alerts) — push
// for urgent, pull for situational. Single source of truth: both read from
// the wire_runs collection.

import { useState, useEffect, useCallback } from 'react'
import { fetchValidated } from '../fetchValidated'

// ── Types (must match /api/system-synergy/wire-health response) ─────────

interface WireHealthRow {
  wireName: string
  lastRunAt: string | null
  lastSuccessAt: string | null
  lastFailureAt: string | null
  status: 'unknown' | 'running' | 'success' | 'failure'
  durationMs: number | null
  entriesWritten: number | null
  error: string | null
  host: string | null
}

interface WireHealthSnapshot {
  wires: WireHealthRow[]
  all_healthy: boolean
  total_runs_last_24h: number
  failures_last_24h: number
  last_snapshot_at: string
}

// ── Colors (match DashboardView pattern) ────────────────────────────────

const colors = {
  bg:        '#0a0e17',
  bgCard:    '#111827',
  bgHover:   '#1a2236',
  border:    '#1e293b',
  text:      '#e2e8f0',
  textMuted: '#94a3b8',
  teal:      '#14b8a6',
  tealGlow:  'rgba(20,184,166,0.15)',
  green:     '#22c55e',
  red:       '#ef4444',
  yellow:    '#f59e0b',
  gray:      '#64748b',
}

// ── Helpers ──────────────────────────────────────────────────────────────

function statusColor(status: WireHealthRow['status']): string {
  switch (status) {
    case 'success': return colors.green
    case 'running': return colors.yellow
    case 'failure': return colors.red
    case 'unknown': return colors.gray
    default: return colors.gray
  }
}

function statusLabel(status: WireHealthRow['status']): string {
  switch (status) {
    case 'success': return 'GREEN'
    case 'running': return 'RUNNING'
    case 'failure': return 'FAILED'
    case 'unknown': return 'NEVER RAN'
    default: return '??'
  }
}

function timeAgo(isoOrEmpty: string | null): string {
  if (!isoOrEmpty) return 'never'
  const then = new Date(isoOrEmpty).getTime()
  if (Number.isNaN(then)) return 'never'
  const diffSec = Math.floor((Date.now() - then) / 1000)
  if (diffSec < 60) return `${diffSec}s ago`
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`
  return `${Math.floor(diffSec / 86400)}d ago`
}

function formatDuration(ms: number | null): string {
  if (ms == null) return '—'
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${(ms / 60000).toFixed(1)}m`
}

// ── Sub-components (mirroring DashboardView internal patterns) ──────────

function StatusDot({ color }: { color: string }) {
  return (
    <span style={{
      display: 'inline-block', width: 8, height: 8,
      borderRadius: '50%', background: color, flexShrink: 0,
    }} />
  )
}

function CardHeader({ icon, title, badge }: { icon: string; title: string; badge?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
      <span className="material-symbols-outlined" style={{ fontSize: 20, color: colors.teal }}>{icon}</span>
      <span style={{ fontWeight: 700, fontSize: '0.9rem', color: colors.text, flex: 1 }}>{title}</span>
      {badge}
    </div>
  )
}

function LoadingState() {
  return (
    <div style={{ color: colors.textMuted, fontSize: '0.85rem', textAlign: 'center', padding: '24px 0' }}>
      Loading wire health...
    </div>
  )
}

function ErrorState({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <div style={{ textAlign: 'center', padding: '16px 0' }}>
      <p style={{ color: colors.red, fontSize: '0.85rem', marginBottom: 12 }}>{error}</p>
      <button
        onClick={onRetry}
        style={{
          padding: '6px 16px', borderRadius: 6, border: `1px solid ${colors.teal}`,
          background: colors.tealGlow, color: colors.teal, cursor: 'pointer',
          fontSize: '0.8rem', fontWeight: 600,
        }}
      >
        Retry
      </button>
    </div>
  )
}

// ── Main Card Component ─────────────────────────────────────────────────

type FetchState = {
  data: WireHealthSnapshot | null
  loading: boolean
  error: string | null
}

export function WireHealthCard() {
  const [state, setState] = useState<FetchState>({ data: null, loading: true, error: null })
  const [expandedWire, setExpandedWire] = useState<string | null>(null)

  const load = useCallback(async () => {
    setState(s => ({ ...s, loading: true, error: null }))
    const result = await fetchValidated<WireHealthSnapshot>('/api/system-synergy/wire-health')
    setState({
      data: result.success ? (result.data ?? null) : null,
      loading: false,
      error: result.success ? null : (result.error ?? 'Failed to load wire health'),
    })
  }, [])

  useEffect(() => {
    void load()
    // Refresh every 30s — cheap, bounded, matches the "situational" intent.
    // For push alerts on failure, MEGAZORD's slack-alert@.service handles it.
    const interval = setInterval(() => { void load() }, 30_000)
    return () => clearInterval(interval)
  }, [load])

  const { data, loading, error } = state

  // Badge shows overall health summary
  const badge = data
    ? (
      <span style={{
        display: 'inline-block', padding: '2px 10px', borderRadius: 999,
        fontSize: '0.72rem', fontWeight: 700,
        background: data.all_healthy ? `${colors.green}20` : `${colors.red}20`,
        color: data.all_healthy ? colors.green : colors.red,
      }}>
        {data.all_healthy ? 'All Healthy' : `${data.failures_last_24h} Failed`}
      </span>
    )
    : undefined

  return (
    <div style={{
      background: colors.bgCard, border: `1px solid ${colors.border}`,
      borderRadius: 12, padding: 24,
    }}>
      <CardHeader icon="bolt" title="Learning Loop Wires" badge={badge} />

      {loading && !data && <LoadingState />}
      {error && !data && <ErrorState error={error} onRetry={load} />}

      {data && (
        <>
          {/* Aggregate summary row */}
          <div style={{ display: 'flex', gap: 20, marginBottom: 14 }}>
            <div style={{ fontSize: '0.78rem', color: colors.textMuted }}>
              <span style={{ color: colors.text, fontWeight: 700, fontSize: '1.1rem', marginRight: 4 }}>
                {data.total_runs_last_24h}
              </span>
              runs 24h
            </div>
            <div style={{ fontSize: '0.78rem', color: colors.textMuted }}>
              <span style={{
                color: data.failures_last_24h > 0 ? colors.red : colors.textMuted,
                fontWeight: 700, fontSize: '1.1rem', marginRight: 4,
              }}>
                {data.failures_last_24h}
              </span>
              failed
            </div>
            <div style={{ fontSize: '0.78rem', color: colors.textMuted }}>
              <span style={{ color: colors.text, fontWeight: 700, fontSize: '1.1rem', marginRight: 4 }}>
                {data.wires.length}
              </span>
              wires
            </div>
          </div>

          {/* Per-wire rows */}
          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: colors.textMuted, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>
              per wire
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {data.wires.map(wire => {
                const isOpen = expandedWire === wire.wireName
                const color = statusColor(wire.status)
                return (
                  <div key={wire.wireName} style={{ border: `1px solid ${colors.border}`, borderRadius: 8, overflow: 'hidden' }}>
                    <button
                      onClick={() => setExpandedWire(isOpen ? null : wire.wireName)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                        padding: '10px 12px', background: colors.bgHover, border: 'none',
                        cursor: 'pointer', textAlign: 'left',
                      }}
                    >
                      <StatusDot color={color} />
                      <span style={{ flex: 1, fontSize: '0.82rem', color: colors.text, fontFamily: 'monospace' }}>
                        {wire.wireName}
                      </span>
                      <span style={{
                        fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: 999,
                        background: `${color}20`, color,
                      }}>
                        {statusLabel(wire.status)}
                      </span>
                      <span style={{ fontSize: '0.72rem', color: colors.textMuted, minWidth: 60, textAlign: 'right' }}>
                        {timeAgo(wire.lastRunAt)}
                      </span>
                    </button>
                    {isOpen && (
                      <div style={{ padding: '10px 14px', background: colors.bg, fontSize: '0.74rem', color: colors.textMuted, display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <div>
                          <strong style={{ color: colors.text }}>Last success:</strong> {timeAgo(wire.lastSuccessAt)}
                        </div>
                        <div>
                          <strong style={{ color: colors.text }}>Last failure:</strong> {timeAgo(wire.lastFailureAt)}
                        </div>
                        <div>
                          <strong style={{ color: colors.text }}>Duration:</strong> {formatDuration(wire.durationMs)}
                        </div>
                        {wire.entriesWritten != null && (
                          <div>
                            <strong style={{ color: colors.text }}>Entries written:</strong> {wire.entriesWritten}
                          </div>
                        )}
                        {wire.host && (
                          <div>
                            <strong style={{ color: colors.text }}>Host:</strong> <span style={{ fontFamily: 'monospace' }}>{wire.host}</span>
                          </div>
                        )}
                        {wire.error && (
                          <div style={{ color: colors.red, marginTop: 4 }}>
                            <strong>Error:</strong> {wire.error}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Footer — last snapshot time */}
          <div style={{ fontSize: '0.68rem', color: colors.textMuted, marginTop: 12, textAlign: 'right' }}>
            snapshot: {timeAgo(data.last_snapshot_at)}
          </div>
        </>
      )}
    </div>
  )
}
