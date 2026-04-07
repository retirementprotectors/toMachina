'use client'

import { useState, useEffect, useCallback } from 'react'
import { fetchValidated } from '../fetchValidated'

// ── Types ──────────────────────────────────────────────────────────────

interface ActiveSession {
  file: string
  pid: number
  sessionId: string
  cwd: string
  startedAt: string
  kind: string
  name: string
}

interface SessionInventory {
  active_sessions: ActiveSession[]
  total_jsonl_transcripts: number
  session_count: number
}

interface TmuxSession {
  name: string
  last_activity: string
  windows: number
}

interface WarriorQueue {
  warrior: string
  queue_depth: number
  last_queue_update: string
  queue_reachable: boolean
}

interface WarriorRoster {
  tmux_sessions: TmuxSession[]
  warrior_queues: WarriorQueue[]
  warrior_directories: string[]
  dojo_api_reachable: boolean
}

interface CIRun {
  id: number
  name: string
  status: string
  conclusion: string | null
  head_sha: string
  created_at: string
  html_url: string
}

interface PendingPR {
  number: number
  title: string
  state: string
  author: string
  created_at: string
  html_url: string
}

interface DeployStatus {
  ci_runs: CIRun[]
  pending_prs: PendingPR[]
  last_deploy_sha: string | null
  github_api_available: boolean
}


interface HookProjectAudit {
  project: string
  path: string
  total_source_rules: number
  linked: number
  missing: number
  broken: number
  missing_rules: string[]
  broken_rules: string[]
}

interface HookAudit {
  source_rules_count: number
  projects: HookProjectAudit[]
  all_healthy: boolean
}

// ── Colors ─────────────────────────────────────────────────────────────

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
}

// ── Sub-components ─────────────────────────────────────────────────────

function StatusDot({ color }: { color: string }) {
  return (
    <span style={{
      display: 'inline-block', width: 8, height: 8,
      borderRadius: '50%', background: color, flexShrink: 0,
    }} />
  )
}

function CountBadge({ count, color = colors.teal }: { count: number; color?: string }) {
  return (
    <span style={{
      display: 'inline-block', padding: '2px 10px', borderRadius: 999,
      fontSize: '0.72rem', fontWeight: 700,
      background: `${color}20`, color,
    }}>
      {count}
    </span>
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

function LoadingCard({ title, icon }: { title: string; icon: string }) {
  return (
    <div style={{
      background: colors.bgCard, border: `1px solid ${colors.border}`,
      borderRadius: 12, padding: 24,
    }}>
      <CardHeader icon={icon} title={title} />
      <div style={{ color: colors.textMuted, fontSize: '0.85rem', textAlign: 'center', padding: '24px 0' }}>
        Loading...
      </div>
    </div>
  )
}

function ErrorCard({ title, icon, error, onRetry }: { title: string; icon: string; error: string; onRetry: () => void }) {
  return (
    <div style={{
      background: colors.bgCard, border: `1px solid ${colors.border}`,
      borderRadius: 12, padding: 24,
    }}>
      <CardHeader icon={icon} title={title} />
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
    </div>
  )
}

// ── Card 1: Active Sessions ────────────────────────────────────────────

function SessionsCard({ data, loading, error, onRetry }: {
  data: SessionInventory | null
  loading: boolean
  error: string | null
  onRetry: () => void
}) {
  if (loading) return <LoadingCard title="Active Sessions" icon="terminal" />
  if (error || !data) return <ErrorCard title="Active Sessions" icon="terminal" error={error ?? 'No data'} onRetry={onRetry} />

  return (
    <div style={{
      background: colors.bgCard, border: `1px solid ${colors.border}`,
      borderRadius: 12, padding: 24,
    }}>
      <CardHeader
        icon="terminal"
        title="Active Sessions"
        badge={<CountBadge count={data.session_count} />}
      />
      <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
        <div style={{ fontSize: '0.78rem', color: colors.textMuted }}>
          <span style={{ color: colors.text, fontWeight: 700, fontSize: '1.1rem', marginRight: 4 }}>
            {data.total_jsonl_transcripts}
          </span>
          JSONL transcripts
        </div>
      </div>
      {data.active_sessions.length === 0 ? (
        <p style={{ color: colors.textMuted, fontSize: '0.85rem', margin: 0 }}>No active sessions</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {data.active_sessions.map((s, i) => (
            <div
              key={i}
              style={{
                background: colors.bgHover, borderRadius: 8, padding: '10px 12px',
                border: `1px solid ${colors.border}`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <StatusDot color={colors.green} />
                <span style={{ fontWeight: 600, fontSize: '0.85rem', color: colors.text }}>
                  {s.name || s.sessionId}
                </span>
                <span style={{
                  fontSize: '0.7rem', padding: '1px 6px', borderRadius: 4,
                  background: `${colors.teal}20`, color: colors.teal,
                }}>
                  {s.kind}
                </span>
              </div>
              <div style={{
                fontSize: '0.72rem', color: colors.textMuted, fontFamily: 'monospace',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {s.cwd}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Card 2: Warrior Roster ─────────────────────────────────────────────

function WarriorRosterCard({ data, loading, error, onRetry }: {
  data: WarriorRoster | null
  loading: boolean
  error: string | null
  onRetry: () => void
}) {
  if (loading) return <LoadingCard title="Warrior Roster" icon="groups" />
  if (error || !data) return <ErrorCard title="Warrior Roster" icon="groups" error={error ?? 'No data'} onRetry={onRetry} />

  return (
    <div style={{
      background: colors.bgCard, border: `1px solid ${colors.border}`,
      borderRadius: 12, padding: 24,
    }}>
      <CardHeader
        icon="groups"
        title="Warrior Roster"
        badge={
          <span style={{
            display: 'inline-block', padding: '2px 10px', borderRadius: 999,
            fontSize: '0.72rem', fontWeight: 700,
            background: data.dojo_api_reachable ? `${colors.green}20` : `${colors.red}20`,
            color: data.dojo_api_reachable ? colors.green : colors.red,
          }}>
            {data.dojo_api_reachable ? 'Dojo Online' : 'Dojo Offline'}
          </span>
        }
      />

      {/* tmux sessions */}
      {data.tmux_sessions.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: colors.textMuted, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>
            tmux sessions
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
            {data.tmux_sessions.map((s, i) => (
              <div
                key={i}
                style={{
                  background: colors.bgHover, borderRadius: 8, padding: '8px 10px',
                  border: `1px solid ${colors.border}`,
                }}
              >
                <div style={{ fontWeight: 700, fontSize: '0.82rem', color: colors.teal, marginBottom: 2 }}>{s.name}</div>
                <div style={{ fontSize: '0.72rem', color: colors.textMuted }}>{s.windows} window{s.windows !== 1 ? 's' : ''}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* warrior queues */}
      {data.warrior_queues.length > 0 && (
        <div>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: colors.textMuted, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>
            warrior queues
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {data.warrior_queues.map((q, i) => (
              <div
                key={i}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  background: colors.bgHover, borderRadius: 8, padding: '8px 12px',
                  border: `1px solid ${colors.border}`,
                }}
              >
                <StatusDot color={q.queue_reachable ? colors.green : colors.red} />
                <span style={{ fontWeight: 600, fontSize: '0.85rem', color: colors.text, flex: 1 }}>{q.warrior}</span>
                <span style={{
                  fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: 999,
                  background: `${colors.teal}20`, color: colors.teal,
                }}>
                  {q.queue_depth} queued
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {data.tmux_sessions.length === 0 && data.warrior_queues.length === 0 && (
        <p style={{ color: colors.textMuted, fontSize: '0.85rem', margin: 0 }}>No active warriors</p>
      )}
    </div>
  )
}

// ── Card 3: Deploy Status ──────────────────────────────────────────────

function ciColor(conclusion: string | null, status: string): string {
  if (status === 'in_progress') return colors.yellow
  if (conclusion === 'success') return colors.green
  if (conclusion === 'failure') return colors.red
  return colors.textMuted
}

function DeployStatusCard({ data, loading, error, onRetry }: {
  data: DeployStatus | null
  loading: boolean
  error: string | null
  onRetry: () => void
}) {
  if (loading) return <LoadingCard title="Deploy Status" icon="rocket_launch" />
  if (error || !data) return <ErrorCard title="Deploy Status" icon="rocket_launch" error={error ?? 'No data'} onRetry={onRetry} />

  const recentRuns = data.ci_runs.slice(0, 5)

  return (
    <div style={{
      background: colors.bgCard, border: `1px solid ${colors.border}`,
      borderRadius: 12, padding: 24,
    }}>
      <CardHeader
        icon="rocket_launch"
        title="Deploy Status"
        badge={
          data.last_deploy_sha ? (
            <span style={{
              fontSize: '0.7rem', fontFamily: 'monospace', color: colors.textMuted,
              background: colors.bgHover, padding: '2px 8px', borderRadius: 4,
            }}>
              {data.last_deploy_sha.slice(0, 7)}
            </span>
          ) : undefined
        }
      />

      {!data.github_api_available && (
        <div style={{
          padding: '8px 12px', borderRadius: 6, background: `${colors.yellow}15`,
          border: `1px solid ${colors.yellow}40`, color: colors.yellow,
          fontSize: '0.78rem', marginBottom: 12,
        }}>
          GitHub API unavailable — cached data shown
        </div>
      )}

      {/* CI runs */}
      {recentRuns.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: colors.textMuted, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>
            recent CI runs
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {recentRuns.map(run => (
              <a
                key={run.id}
                href={run.html_url}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none',
                  background: colors.bgHover, borderRadius: 8, padding: '8px 12px',
                  border: `1px solid ${colors.border}`, transition: 'border-color 0.2s',
                }}
              >
                <StatusDot color={ciColor(run.conclusion, run.status)} />
                <span style={{ flex: 1, fontSize: '0.82rem', color: colors.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {run.name}
                </span>
                <span style={{ fontSize: '0.7rem', fontFamily: 'monospace', color: colors.textMuted, flexShrink: 0 }}>
                  {run.head_sha.slice(0, 7)}
                </span>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Pending PRs */}
      {data.pending_prs.length > 0 && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: colors.textMuted, letterSpacing: 1, textTransform: 'uppercase' }}>
              pending PRs
            </div>
            <CountBadge count={data.pending_prs.length} color={colors.yellow} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {data.pending_prs.map(pr => (
              <a
                key={pr.number}
                href={pr.html_url}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none',
                  background: colors.bgHover, borderRadius: 8, padding: '8px 12px',
                  border: `1px solid ${colors.border}`,
                }}
              >
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: colors.yellow }}>#{pr.number}</span>
                <span style={{ flex: 1, fontSize: '0.82rem', color: colors.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {pr.title}
                </span>
                <span style={{ fontSize: '0.7rem', color: colors.textMuted, flexShrink: 0 }}>{pr.author}</span>
              </a>
            ))}
          </div>
        </div>
      )}

      {recentRuns.length === 0 && data.pending_prs.length === 0 && (
        <p style={{ color: colors.textMuted, fontSize: '0.85rem', margin: 0 }}>No recent CI activity</p>
      )}
    </div>
  )
}

// ── Card 4: Hook Health ────────────────────────────────────────────────

function HookHealthCard({ data, loading, error, onRetry }: {
  data: HookAudit | null
  loading: boolean
  error: string | null
  onRetry: () => void
}) {
  const [expanded, setExpanded] = useState<string | null>(null)

  if (loading) return <LoadingCard title="Hook Health" icon="security" />
  if (error || !data) return <ErrorCard title="Hook Health" icon="security" error={error ?? 'No data'} onRetry={onRetry} />

  const totalMissing = data.projects.reduce((sum, p) => sum + p.missing, 0)
  const totalLinked = data.projects.reduce((sum, p) => sum + p.linked, 0)
  const healthColor = data.all_healthy ? colors.green : totalMissing < 5 ? colors.yellow : colors.red

  return (
    <div style={{
      background: colors.bgCard, border: `1px solid ${colors.border}`,
      borderRadius: 12, padding: 24,
    }}>
      <CardHeader
        icon="security"
        title="Hook Health"
        badge={
          <span style={{
            display: 'inline-block', padding: '2px 10px', borderRadius: 999,
            fontSize: '0.72rem', fontWeight: 700,
            background: `${healthColor}20`, color: healthColor,
          }}>
            {data.all_healthy ? 'All Healthy' : `${totalMissing} Missing`}
          </span>
        }
      />

      {/* Summary row */}
      <div style={{ display: 'flex', gap: 20, marginBottom: 16 }}>
        <div style={{ fontSize: '0.78rem', color: colors.textMuted }}>
          <span style={{ color: colors.green, fontWeight: 700, fontSize: '1.1rem', marginRight: 4 }}>
            {totalLinked}
          </span>
          linked
        </div>
        <div style={{ fontSize: '0.78rem', color: colors.textMuted }}>
          <span style={{ color: totalMissing > 0 ? colors.red : colors.textMuted, fontWeight: 700, fontSize: '1.1rem', marginRight: 4 }}>
            {totalMissing}
          </span>
          missing
        </div>
        <div style={{ fontSize: '0.78rem', color: colors.textMuted }}>
          <span style={{ color: colors.text, fontWeight: 700, fontSize: '1.1rem', marginRight: 4 }}>
            {data.projects.length}
          </span>
          projects
        </div>
      </div>

      {/* per-project accordion */}
      <div>
        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: colors.textMuted, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>
          projects
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {data.projects.map((proj, i) => {
            const isOpen = expanded === proj.project
            const projColor = proj.missing === 0 ? colors.green : proj.missing < 3 ? colors.yellow : colors.red
            return (
              <div key={i} style={{ border: `1px solid ${colors.border}`, borderRadius: 8, overflow: 'hidden' }}>
                <button
                  onClick={() => setExpanded(isOpen ? null : proj.project)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                    padding: '8px 12px', background: colors.bgHover, border: 'none',
                    cursor: 'pointer', textAlign: 'left',
                  }}
                >
                  <StatusDot color={projColor} />
                  <span style={{ flex: 1, fontSize: '0.82rem', color: colors.text }}>{proj.project}</span>
                  <span style={{ fontSize: '0.72rem', color: colors.textMuted }}>
                    {proj.linked}/{proj.total_source_rules}
                  </span>
                  <span className="material-symbols-outlined" style={{ fontSize: 16, color: colors.textMuted }}>
                    {isOpen ? 'expand_less' : 'expand_more'}
                  </span>
                </button>
                {isOpen && (
                  <div style={{ padding: '8px 12px', background: colors.bg, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {proj.missing_rules.map((rule, j) => (
                      <div key={j} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <StatusDot color={colors.red} />
                        <span style={{ fontSize: '0.72rem', fontFamily: 'monospace', color: colors.red }}>
                          {rule} (missing)
                        </span>
                      </div>
                    ))}
                    {proj.broken_rules.map((rule, j) => (
                      <div key={`b-${j}`} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <StatusDot color={colors.yellow} />
                        <span style={{ fontSize: '0.72rem', fontFamily: 'monospace', color: colors.yellow }}>
                          {rule} (broken)
                        </span>
                      </div>
                    ))}
                    {proj.missing === 0 && proj.broken === 0 && (
                      <div style={{ fontSize: '0.72rem', color: colors.green, padding: 4 }}>All rules linked</div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── DashboardView ──────────────────────────────────────────────────────

type FetchState<T> = { data: T | null; loading: boolean; error: string | null }

function initState<T>(): FetchState<T> {
  return { data: null, loading: true, error: null }
}

export function DashboardView() {
  const [sessions, setSessions]     = useState<FetchState<SessionInventory>>(initState())
  const [warriors, setWarriors]     = useState<FetchState<WarriorRoster>>(initState())
  const [deploy, setDeploy]         = useState<FetchState<DeployStatus>>(initState())
  const [hooks, setHooks]           = useState<FetchState<HookAudit>>(initState())

  const load = useCallback(async () => {
    setSessions(s => ({ ...s, loading: true, error: null }))
    setWarriors(s => ({ ...s, loading: true, error: null }))
    setDeploy(s => ({ ...s, loading: true, error: null }))
    setHooks(s => ({ ...s, loading: true, error: null }))

    const [sessRes, warRes, depRes, hookRes] = await Promise.allSettled([
      fetchValidated<SessionInventory>('/api/system-synergy/session-inventory'),
      fetchValidated<WarriorRoster>('/api/system-synergy/warrior-roster'),
      fetchValidated<DeployStatus>('/api/system-synergy/deploy-status'),
      fetchValidated<HookAudit>('/api/system-synergy/hook-audit'),
    ])

    setSessions({
      data: sessRes.status === 'fulfilled' && sessRes.value.success ? (sessRes.value.data ?? null) : null,
      loading: false,
      error: sessRes.status === 'rejected'
        ? String(sessRes.reason)
        : sessRes.status === 'fulfilled' && !sessRes.value.success
          ? (sessRes.value.error ?? 'Failed')
          : null,
    })

    setWarriors({
      data: warRes.status === 'fulfilled' && warRes.value.success ? (warRes.value.data ?? null) : null,
      loading: false,
      error: warRes.status === 'rejected'
        ? String(warRes.reason)
        : warRes.status === 'fulfilled' && !warRes.value.success
          ? (warRes.value.error ?? 'Failed')
          : null,
    })

    setDeploy({
      data: depRes.status === 'fulfilled' && depRes.value.success ? (depRes.value.data ?? null) : null,
      loading: false,
      error: depRes.status === 'rejected'
        ? String(depRes.reason)
        : depRes.status === 'fulfilled' && !depRes.value.success
          ? (depRes.value.error ?? 'Failed')
          : null,
    })

    setHooks({
      data: hookRes.status === 'fulfilled' && hookRes.value.success ? (hookRes.value.data ?? null) : null,
      loading: false,
      error: hookRes.status === 'rejected'
        ? String(hookRes.reason)
        : hookRes.status === 'fulfilled' && !hookRes.value.success
          ? (hookRes.value.error ?? 'Failed')
          : null,
    })
  }, [])

  useEffect(() => { void load() }, [load])

  return (
    <div style={{ padding: 24 }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: 20,
      }}>
        {/* @media mobile fallback via minmax — fine for 2-col at ≥600px */}
        <SessionsCard
          data={sessions.data}
          loading={sessions.loading}
          error={sessions.error}
          onRetry={load}
        />
        <WarriorRosterCard
          data={warriors.data}
          loading={warriors.loading}
          error={warriors.error}
          onRetry={load}
        />
        <DeployStatusCard
          data={deploy.data}
          loading={deploy.loading}
          error={deploy.error}
          onRetry={load}
        />
        <HookHealthCard
          data={hooks.data}
          loading={hooks.loading}
          error={hooks.error}
          onRetry={load}
        />
      </div>
    </div>
  )
}
