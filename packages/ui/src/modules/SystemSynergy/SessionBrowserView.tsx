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
  entrypoint: string
  subagentCount: number
}

interface SessionInventory {
  active_sessions: ActiveSession[]
  total_jsonl_transcripts: number
  session_count: number
}

interface OrphanEntry {
  session_id: string
  is_orphan: boolean
  days_old: number
  last_modified: string
  auto_delete_eligible: boolean
}

interface SessionEnvAudit {
  total_session_envs: number
  active: number
  orphaned: number
  auto_delete_eligible: number
  orphans: OrphanEntry[]
}

interface DuplicateEntry {
  project: string
  file: string
}

interface DuplicateGroup {
  name: string
  entries: DuplicateEntry[]
}

interface DuplicateDetector {
  total_entries: number
  duplicate_groups: number
  duplicates: DuplicateGroup[]
}

// ── Colors ─────────────────────────────────────────────────────────────

const c = {
  bg:        '#0a0e17',
  bgCard:    '#111827',
  bgHover:   '#1a2236',
  border:    '#1e293b',
  text:      '#e2e8f0',
  textMuted: '#94a3b8',
  teal:      '#14b8a6',
  tealGlow:  'rgba(20,184,166,0.15)',
  orange:    '#f97316',
  green:     '#22c55e',
  red:       '#ef4444',
}

// ── Helpers ────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  } catch {
    return iso
  }
}

function truncateCwd(cwd: string, max = 42): string {
  if (cwd.length <= max) return cwd
  return '…' + cwd.slice(-(max - 1))
}

// ── Sub-components ─────────────────────────────────────────────────────

function SectionCard({ title, badge, badgeColor, children }: {
  title: string
  badge?: string | number
  badgeColor?: string
  children: React.ReactNode
}) {
  return (
    <div style={{
      background: c.bgCard,
      border: `1px solid ${c.border}`,
      borderRadius: 12,
      padding: 24,
      marginBottom: 20,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <h3 style={{ margin: 0, color: c.text, fontSize: 15, fontWeight: 600 }}>{title}</h3>
        {badge !== undefined && (
          <span style={{
            background: badgeColor || c.tealGlow,
            color: badgeColor ? '#fff' : c.teal,
            border: `1px solid ${badgeColor || c.teal}`,
            borderRadius: 20,
            fontSize: 11,
            fontWeight: 700,
            padding: '2px 10px',
          }}>{badge}</span>
        )}
      </div>
      {children}
    </div>
  )
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span style={{
      display: 'inline-block',
      background: `${color}22`,
      color: color,
      border: `1px solid ${color}`,
      borderRadius: 20,
      fontSize: 11,
      fontWeight: 700,
      padding: '2px 9px',
    }}>{label}</span>
  )
}

function TableHeader({ cols }: { cols: string[] }) {
  return (
    <thead>
      <tr>
        {cols.map(col => (
          <th key={col} style={{
            textAlign: 'left',
            padding: '8px 12px',
            color: c.textMuted,
            fontSize: 11,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            borderBottom: `1px solid ${c.border}`,
          }}>{col}</th>
        ))}
      </tr>
    </thead>
  )
}

// ── Main Component ─────────────────────────────────────────────────────

export function SessionBrowserView() {
  const [inventory, setInventory] = useState<SessionInventory | null>(null)
  const [envAudit, setEnvAudit] = useState<SessionEnvAudit | null>(null)
  const [duplicates, setDuplicates] = useState<DuplicateDetector | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filter state
  const [kindFilter, setKindFilter] = useState<string>('All')
  // Sort: 'asc' | 'desc'
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const [invRes, envRes, dupRes] = await Promise.all([
      fetchValidated<SessionInventory>('/api/system-synergy/session-inventory'),
      fetchValidated<SessionEnvAudit>('/api/system-synergy/session-env-audit'),
      fetchValidated<DuplicateDetector>('/api/system-synergy/duplicate-detector'),
    ])
    if (!invRes.success || !envRes.success || !dupRes.success) {
      setError(invRes.error || envRes.error || dupRes.error || 'Failed to load session data')
    } else {
      setInventory(invRes.data!)
      setEnvAudit(envRes.data!)
      setDuplicates(dupRes.data!)
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 80, color: c.textMuted }}>
        <span className="material-symbols-outlined" style={{ fontSize: 28, marginRight: 10, color: c.teal }}>sync</span>
        Loading session data…
      </div>
    )
  }

  if (error) {
    return (
      <div style={{
        background: `${c.red}15`,
        border: `1px solid ${c.red}`,
        borderRadius: 10,
        padding: 20,
        color: c.red,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        margin: 20,
      }}>
        <span className="material-symbols-outlined">error</span>
        {error}
      </div>
    )
  }

  // Derived data
  const sessions = inventory?.active_sessions ?? []
  const allKinds = ['All', ...Array.from(new Set(sessions.map(s => s.kind))).sort()]
  const filteredSessions = sessions
    .filter(s => kindFilter === 'All' || s.kind === kindFilter)
    .sort((a, b) => {
      const ta = new Date(a.startedAt).getTime()
      const tb = new Date(b.startedAt).getTime()
      return sortDir === 'desc' ? tb - ta : ta - tb
    })

  const orphans = envAudit?.orphans ?? []
  const eligibleCount = envAudit?.auto_delete_eligible ?? 0
  const dupGroups = duplicates?.duplicates ?? []

  return (
    <div style={{ color: c.text }}>

      {/* ── Active Sessions ─────────────────────────────────────────── */}
      <SectionCard
        title="Active Sessions"
        badge={filteredSessions.length}
        badgeColor={c.teal}
      >
        {/* Summary stats */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
          <div style={{ background: c.tealGlow, border: `1px solid ${c.teal}`, borderRadius: 8, padding: '8px 16px', fontSize: 12 }}>
            <span style={{ color: c.textMuted }}>Total transcripts: </span>
            <span style={{ color: c.teal, fontWeight: 700 }}>{inventory?.total_jsonl_transcripts ?? 0}</span>
          </div>
          <div style={{ background: c.tealGlow, border: `1px solid ${c.teal}`, borderRadius: 8, padding: '8px 16px', fontSize: 12 }}>
            <span style={{ color: c.textMuted }}>Session count: </span>
            <span style={{ color: c.teal, fontWeight: 700 }}>{inventory?.session_count ?? 0}</span>
          </div>
        </div>

        {/* Kind filter buttons */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          {allKinds.map(kind => (
            <button
              key={kind}
              onClick={() => setKindFilter(kind)}
              style={{
                background: kindFilter === kind ? c.teal : 'transparent',
                color: kindFilter === kind ? '#000' : c.textMuted,
                border: `1px solid ${kindFilter === kind ? c.teal : c.border}`,
                borderRadius: 20,
                padding: '4px 14px',
                fontSize: 12,
                fontWeight: kindFilter === kind ? 700 : 400,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >{kind}</button>
          ))}
          <button
            onClick={() => setSortDir(d => d === 'desc' ? 'asc' : 'desc')}
            style={{
              marginLeft: 'auto',
              background: 'transparent',
              color: c.textMuted,
              border: `1px solid ${c.border}`,
              borderRadius: 20,
              padding: '4px 14px',
              fontSize: 12,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
              {sortDir === 'desc' ? 'arrow_downward' : 'arrow_upward'}
            </span>
            Started
          </button>
        </div>

        {filteredSessions.length === 0 ? (
          <div style={{ color: c.textMuted, fontSize: 13, padding: '16px 0', textAlign: 'center' }}>
            No sessions found
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <TableHeader cols={['Name', 'Kind', 'CWD', 'Started', 'Subagents']} />
              <tbody>
                {filteredSessions.map((s, i) => (
                  <tr
                    key={s.sessionId || i}
                    style={{
                      borderBottom: `1px solid ${c.border}`,
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = c.bgHover)}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ padding: '10px 12px', color: c.text, fontWeight: 500 }}>
                      {s.name || '—'}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <Badge label={s.kind || 'unknown'} color={c.teal} />
                    </td>
                    <td style={{ padding: '10px 12px', color: c.textMuted, fontFamily: 'monospace', fontSize: 12 }}>
                      {truncateCwd(s.cwd)}
                    </td>
                    <td style={{ padding: '10px 12px', color: c.textMuted, whiteSpace: 'nowrap' }}>
                      {formatDate(s.startedAt)}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'center', color: s.subagentCount > 0 ? c.teal : c.textMuted, fontWeight: 600 }}>
                      {s.subagentCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {/* ── Orphaned Environments ───────────────────────────────────── */}
      <SectionCard
        title="Orphaned Environments"
        badge={envAudit?.orphaned ?? 0}
        badgeColor={envAudit && envAudit.orphaned > 0 ? c.orange : undefined}
      >
        {eligibleCount > 0 && (
          <div style={{
            background: `${c.orange}15`,
            border: `1px solid ${c.orange}`,
            borderRadius: 8,
            padding: '10px 14px',
            marginBottom: 14,
            color: c.orange,
            fontSize: 13,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>warning</span>
            <strong>{eligibleCount}</strong> environment{eligibleCount !== 1 ? 's' : ''} eligible for cleanup
          </div>
        )}

        {orphans.length === 0 ? (
          <div style={{ color: c.textMuted, fontSize: 13, padding: '12px 0', textAlign: 'center' }}>
            No orphaned environments — clean!
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <TableHeader cols={['Session ID', 'Days Old', 'Last Modified', 'Auto-Delete']} />
              <tbody>
                {orphans.map((o, i) => (
                  <tr
                    key={o.session_id || i}
                    style={{ borderBottom: `1px solid ${c.border}` }}
                    onMouseEnter={e => (e.currentTarget.style.background = c.bgHover)}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 11, color: c.textMuted }}>
                      {o.session_id}
                    </td>
                    <td style={{ padding: '10px 12px', color: o.days_old > 14 ? c.orange : c.text, fontWeight: 600 }}>
                      {o.days_old}d
                    </td>
                    <td style={{ padding: '10px 12px', color: c.textMuted, fontSize: 12 }}>
                      {formatDate(o.last_modified)}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <Badge
                        label={o.auto_delete_eligible ? 'Eligible' : 'Retain'}
                        color={o.auto_delete_eligible ? c.green : c.textMuted}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {/* ── Duplicate Entries ───────────────────────────────────────── */}
      <SectionCard
        title="Duplicate Entries"
        badge={`${duplicates?.duplicate_groups ?? 0} groups`}
        badgeColor={duplicates && duplicates.duplicate_groups > 0 ? c.orange : c.teal}
      >
        {dupGroups.length === 0 ? (
          <div style={{ color: c.textMuted, fontSize: 13, padding: '12px 0', textAlign: 'center' }}>
            No duplicate entries detected
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {dupGroups.map((group, i) => (
              <div
                key={group.name || i}
                style={{
                  background: c.bg,
                  border: `1px solid ${c.border}`,
                  borderRadius: 8,
                  padding: 16,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 16, color: c.orange }}>content_copy</span>
                  <span style={{ color: c.text, fontWeight: 600, fontSize: 13 }}>{group.name}</span>
                  <Badge label={`${group.entries.length} copies`} color={c.orange} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {group.entries.map((entry, j) => (
                    <div
                      key={j}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '6px 10px',
                        background: c.bgCard,
                        borderRadius: 6,
                        fontSize: 12,
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 14, color: c.textMuted }}>folder</span>
                      <span style={{ color: c.teal, fontWeight: 600 }}>{entry.project}</span>
                      <span style={{ color: c.border }}>›</span>
                      <span style={{ color: c.textMuted, fontFamily: 'monospace' }}>{entry.file}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

    </div>
  )
}
