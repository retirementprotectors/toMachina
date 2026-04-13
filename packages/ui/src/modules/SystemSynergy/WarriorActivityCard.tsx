'use client'

// WarriorActivityCard — ZRD-SYN-020i
//
// 6th card in the System Synergy Dashboard. Shows real-time warrior activity
// from the warrior_events Firestore collection via /api/system-synergy/warrior-activity.
//
// Shows all 6 warriors with their last event, 24h activity count, and
// online/offline status. Auto-refreshes every 30 seconds.
//
// Paired with logEvent() hooks (020d/e/f) that populate the collection,
// and the wire-warrior-briefing extension (020c, MEGAZORD) that reads it
// back for session recovery.

import { useState, useEffect, useCallback } from 'react'
import { fetchValidated } from '../fetchValidated'

// ── Types (must match /api/system-synergy/warrior-activity response) ─────────

interface WarriorActivityEvent {
  id: string
  warrior: string
  sessionId: string
  timestamp: string
  type: string
  summary: string
  channel?: string
  details?: Record<string, unknown>
}

interface WarriorStatusSummary {
  warrior: string
  lastEventAt: string | null
  lastEventType: string | null
  lastEventSummary: string | null
  eventCount24h: number
  isActive: boolean
}

interface WarriorActivitySnapshot {
  events: WarriorActivityEvent[]
  warriors: WarriorStatusSummary[]
  total_events_24h: number
  active_warrior_count: number
  last_snapshot_at: string
}

// ── Colors (match DashboardView pattern) ────────────────────────────────────

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
  purple:    '#a78bfa',
  blue:      '#60a5fa',
}

// ── Warrior metadata ────────────────────────────────────────────────────────

const WARRIOR_META: Record<string, { emoji: string; role: string }> = {
  SHINOB1:  { emoji: '🥷', role: 'CTO' },
  MEGAZORD: { emoji: '🏯', role: 'CIO' },
  MUSASHI:  { emoji: '⚔️', role: 'CMO' },
  VOLTRON:  { emoji: '🦁', role: 'Bot' },
  RAIDEN:   { emoji: '⚡', role: 'Guardian' },
  RONIN:    { emoji: '🗡️', role: 'Builder' },
  TAIKO:    { emoji: '🥁', role: 'Comms' },
}

// ── Event type colors ──────��────────────────────────────────────────────────

function eventTypeColor(type: string): string {
  switch (type) {
    case 'directive':    return colors.purple
    case 'task_started': return colors.blue
    case 'pr_shipped':   return colors.green
    case 'slack_sent':   return colors.teal
    case 'delegation':   return colors.yellow
    case 'milestone':    return colors.green
    case 'error':        return colors.red
    case 'decision':     return colors.blue
    default:             return colors.gray
  }
}

function eventTypeLabel(type: string): string {
  switch (type) {
    case 'directive':    return 'DIRECTIVE'
    case 'task_started': return 'TASK'
    case 'pr_shipped':   return 'PR'
    case 'slack_sent':   return 'SLACK'
    case 'delegation':   return 'DELEGATED'
    case 'milestone':    return 'MILESTONE'
    case 'error':        return 'ERROR'
    case 'decision':     return 'DECISION'
    default:             return type.toUpperCase()
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

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

// ── Sub-components (mirroring DashboardView internal patterns) ──────────────

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
      Loading warrior activity...
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

// ── Main Card Component ─────────────────────────────────────────────────────

type FetchState = {
  data: WarriorActivitySnapshot | null
  loading: boolean
  error: string | null
}

export function WarriorActivityCard() {
  const [state, setState] = useState<FetchState>({ data: null, loading: true, error: null })
  const [expandedWarrior, setExpandedWarrior] = useState<string | null>(null)

  const load = useCallback(async () => {
    setState(s => ({ ...s, loading: true, error: null }))
    const result = await fetchValidated<WarriorActivitySnapshot>('/api/system-synergy/warrior-activity')
    setState({
      data: result.success ? (result.data ?? null) : null,
      loading: false,
      error: result.success ? null : (result.error ?? 'Failed to load warrior activity'),
    })
  }, [])

  useEffect(() => {
    void load()
    const interval = setInterval(() => { void load() }, 30_000)
    return () => clearInterval(interval)
  }, [load])

  const { data, loading, error } = state

  const badge = data
    ? (
      <span style={{
        display: 'inline-block', padding: '2px 10px', borderRadius: 999,
        fontSize: '0.72rem', fontWeight: 700,
        background: data.active_warrior_count > 0 ? `${colors.green}20` : `${colors.gray}20`,
        color: data.active_warrior_count > 0 ? colors.green : colors.gray,
      }}>
        {data.active_warrior_count} Active
      </span>
    )
    : undefined

  return (
    <div style={{
      background: colors.bgCard, border: `1px solid ${colors.border}`,
      borderRadius: 12, padding: 24,
    }}>
      <CardHeader icon="history" title="Warrior Activity" badge={badge} />

      {loading && !data && <LoadingState />}
      {error && !data && <ErrorState error={error} onRetry={load} />}

      {data && (
        <>
          {/* Aggregate summary row */}
          <div style={{ display: 'flex', gap: 20, marginBottom: 14 }}>
            <div style={{ fontSize: '0.78rem', color: colors.textMuted }}>
              <span style={{ color: colors.text, fontWeight: 700, fontSize: '1.1rem', marginRight: 4 }}>
                {data.total_events_24h}
              </span>
              events 24h
            </div>
            <div style={{ fontSize: '0.78rem', color: colors.textMuted }}>
              <span style={{ color: colors.text, fontWeight: 700, fontSize: '1.1rem', marginRight: 4 }}>
                {data.active_warrior_count}
              </span>
              active
            </div>
            <div style={{ fontSize: '0.78rem', color: colors.textMuted }}>
              <span style={{ color: colors.text, fontWeight: 700, fontSize: '1.1rem', marginRight: 4 }}>
                {data.warriors.length}
              </span>
              warriors
            </div>
          </div>

          {/* Per-warrior rows */}
          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: colors.textMuted, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>
              warrior status
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {data.warriors.map(warrior => {
                const meta = WARRIOR_META[warrior.warrior] ?? { emoji: '?', role: '?' }
                const isOpen = expandedWarrior === warrior.warrior
                const statusColor = warrior.isActive ? colors.green : warrior.lastEventAt ? colors.gray : colors.red

                // Filter events for this warrior when expanded
                const warriorEvents = isOpen
                  ? data.events.filter(e => e.warrior === warrior.warrior).slice(0, 10)
                  : []

                return (
                  <div key={warrior.warrior} style={{ border: `1px solid ${colors.border}`, borderRadius: 8, overflow: 'hidden' }}>
                    <button
                      onClick={() => setExpandedWarrior(isOpen ? null : warrior.warrior)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                        padding: '10px 12px', background: colors.bgHover, border: 'none',
                        cursor: 'pointer', textAlign: 'left',
                      }}
                    >
                      <StatusDot color={statusColor} />
                      <span style={{ fontSize: '1rem', flexShrink: 0 }}>{meta.emoji}</span>
                      <span style={{ fontWeight: 700, fontSize: '0.82rem', color: colors.text, minWidth: 80 }}>
                        {warrior.warrior}
                      </span>
                      <span style={{ fontSize: '0.68rem', color: colors.textMuted, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {warrior.lastEventSummary ?? 'No events yet'}
                      </span>
                      {warrior.lastEventType && (
                        <span style={{
                          fontSize: '0.62rem', fontWeight: 700, padding: '1px 6px', borderRadius: 999,
                          background: `${eventTypeColor(warrior.lastEventType)}20`,
                          color: eventTypeColor(warrior.lastEventType),
                          flexShrink: 0,
                        }}>
                          {eventTypeLabel(warrior.lastEventType)}
                        </span>
                      )}
                      <span style={{
                        fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: 999,
                        background: `${colors.teal}20`, color: colors.teal, flexShrink: 0,
                      }}>
                        {warrior.eventCount24h} 24h
                      </span>
                      <span style={{ fontSize: '0.72rem', color: colors.textMuted, minWidth: 55, textAlign: 'right', flexShrink: 0 }}>
                        {timeAgo(warrior.lastEventAt)}
                      </span>
                    </button>

                    {isOpen && (
                      <div style={{ padding: '8px 12px', background: colors.bg, display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {warriorEvents.length === 0 && (
                          <div style={{ fontSize: '0.74rem', color: colors.textMuted, padding: 4 }}>
                            No recent events for {warrior.warrior}
                          </div>
                        )}
                        {warriorEvents.map(event => (
                          <div
                            key={event.id}
                            style={{
                              display: 'flex', alignItems: 'flex-start', gap: 8,
                              padding: '6px 8px', borderRadius: 6,
                              background: colors.bgHover, border: `1px solid ${colors.border}`,
                            }}
                          >
                            <span style={{
                              fontSize: '0.6rem', fontWeight: 700, padding: '1px 5px', borderRadius: 999,
                              background: `${eventTypeColor(event.type)}20`,
                              color: eventTypeColor(event.type),
                              flexShrink: 0, marginTop: 2,
                            }}>
                              {eventTypeLabel(event.type)}
                            </span>
                            <span style={{
                              fontSize: '0.74rem', color: colors.text, flex: 1,
                              overflow: 'hidden', textOverflow: 'ellipsis',
                              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const,
                            }}>
                              {event.summary}
                            </span>
                            <span style={{ fontSize: '0.68rem', color: colors.textMuted, flexShrink: 0 }}>
                              {timeAgo(event.timestamp)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Footer */}
          <div style={{ fontSize: '0.68rem', color: colors.textMuted, marginTop: 12, textAlign: 'right' }}>
            snapshot: {timeAgo(data.last_snapshot_at)}
          </div>
        </>
      )}
    </div>
  )
}
