'use client'

import { useState, useEffect, useCallback } from 'react'
import { fetchValidated } from '../fetchValidated'

// ── Types ──────────────────────────────────────────────────────────────

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

interface HookRule {
  file: string
  exists: boolean
}

interface HookProject {
  project: string
  path: string
  rules: HookRule[]
  total: number
  linked: number
  missing: number
}

interface HookService {
  name: string
  active: boolean
  enabled: boolean
}

interface HookAudit {
  projects: HookProject[]
  services: HookService[]
  total_projects: number
  total_rules_linked: number
  total_rules_missing: number
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
  green:     '#22c55e',
  red:       '#ef4444',
  orange:    '#f97316',
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
            background: badgeColor ? `${badgeColor}20` : c.tealGlow,
            color: badgeColor || c.teal,
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

function DisabledActionButton({ label, icon }: { label: string; icon: string }) {
  const [showTip, setShowTip] = useState(false)
  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        title="Coming in Phase 4"
        disabled
        onMouseEnter={() => setShowTip(true)}
        onMouseLeave={() => setShowTip(false)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          background: `${c.teal}20`,
          color: c.teal,
          border: `1px solid ${c.teal}`,
          borderRadius: 8,
          padding: '7px 14px',
          fontSize: 12,
          fontWeight: 600,
          cursor: 'not-allowed',
          opacity: 0.5,
        }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>{icon}</span>
        {label}
      </button>
      {showTip && (
        <div style={{
          position: 'absolute',
          bottom: 'calc(100% + 6px)',
          left: '50%',
          transform: 'translateX(-50%)',
          background: '#1a2236',
          border: `1px solid ${c.border}`,
          borderRadius: 6,
          padding: '5px 10px',
          fontSize: 11,
          color: c.textMuted,
          whiteSpace: 'nowrap',
          zIndex: 10,
          pointerEvents: 'none',
        }}>
          Coming in Phase 4
        </div>
      )}
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────

export function CleanupControlsView() {
  const [envAudit, setEnvAudit] = useState<SessionEnvAudit | null>(null)
  const [duplicates, setDuplicates] = useState<DuplicateDetector | null>(null)
  const [hookAudit, setHookAudit] = useState<HookAudit | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Selection state for orphan checkboxes
  const [selectedOrphans, setSelectedOrphans] = useState<Set<string>>(new Set())
  const [cleanupMsg, setCleanupMsg] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const [envRes, dupRes, hookRes] = await Promise.all([
      fetchValidated<SessionEnvAudit>('/api/system-synergy/session-env-audit'),
      fetchValidated<DuplicateDetector>('/api/system-synergy/duplicate-detector'),
      fetchValidated<HookAudit>('/api/system-synergy/hook-audit'),
    ])
    if (!envRes.success || !dupRes.success || !hookRes.success) {
      setError(envRes.error || dupRes.error || hookRes.error || 'Failed to load cleanup data')
    } else {
      setEnvAudit(envRes.data!)
      setDuplicates(dupRes.data!)
      setHookAudit(hookRes.data!)
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 80, color: c.textMuted }}>
        <span className="material-symbols-outlined" style={{ fontSize: 28, marginRight: 10, color: c.teal }}>sync</span>
        Loading cleanup controls…
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

  const orphans = envAudit?.orphans ?? []
  const eligibleCount = envAudit?.auto_delete_eligible ?? 0
  const orphanedCount = envAudit?.orphaned ?? 0
  const dupGroups = duplicates?.duplicates ?? []

  const allSelected = orphans.length > 0 && selectedOrphans.size === orphans.length
  const toggleAll = () => {
    if (allSelected) {
      setSelectedOrphans(new Set())
    } else {
      setSelectedOrphans(new Set(orphans.map(o => o.session_id)))
    }
  }
  const toggleOne = (id: string) => {
    setSelectedOrphans(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const handleCleanSelected = () => {
    setCleanupMsg('Cleanup coming in Phase 4 — this is a read-only view.')
    setTimeout(() => setCleanupMsg(null), 3500)
  }

  return (
    <div style={{ color: c.text }}>

      {/* ── Session Cleanup ──────────────────────────────────────────── */}
      <SectionCard
        title="Session Cleanup"
        badge={orphanedCount > 0 ? orphanedCount : undefined}
        badgeColor={orphanedCount > 0 ? c.orange : undefined}
      >
        {/* Banner */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          background: orphanedCount > 0 ? `${c.orange}15` : c.tealGlow,
          border: `1px solid ${orphanedCount > 0 ? c.orange : c.teal}`,
          borderRadius: 8,
          padding: '12px 16px',
          marginBottom: 16,
          fontSize: 13,
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: 20, color: orphanedCount > 0 ? c.orange : c.teal }}>
            {orphanedCount > 0 ? 'warning' : 'check_circle'}
          </span>
          <span style={{ color: c.text }}>
            <strong>{orphanedCount}</strong> orphaned session{orphanedCount !== 1 ? 's' : ''},{' '}
            <strong>{eligibleCount}</strong> eligible for auto-delete
          </span>
          {selectedOrphans.size > 0 && (
            <div style={{ marginLeft: 'auto' }}>
              <button
                onClick={handleCleanSelected}
                title="Coming in Phase 4"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  background: `${c.teal}20`,
                  color: c.teal,
                  border: `1px solid ${c.teal}`,
                  borderRadius: 8,
                  padding: '6px 14px',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'not-allowed',
                  opacity: 0.5,
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>delete_sweep</span>
                Clean Selected ({selectedOrphans.size})
              </button>
            </div>
          )}
        </div>

        {/* Toast message */}
        {cleanupMsg && (
          <div style={{
            background: c.tealGlow,
            border: `1px solid ${c.teal}`,
            borderRadius: 8,
            padding: '10px 14px',
            marginBottom: 14,
            color: c.teal,
            fontSize: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>info</span>
            {cleanupMsg}
          </div>
        )}

        {orphans.length === 0 ? (
          <div style={{ color: c.textMuted, fontSize: 13, textAlign: 'center', padding: '16px 0' }}>
            No orphaned sessions — environment is clean
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <TableHeader cols={['', 'Session ID', 'Days Old', 'Last Modified', 'Auto-Delete']} />
              <tbody>
                {/* Select all row */}
                <tr style={{ borderBottom: `1px solid ${c.border}` }}>
                  <td colSpan={5} style={{ padding: '8px 12px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', color: c.textMuted, fontSize: 12 }}>
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={toggleAll}
                        style={{ accentColor: c.teal, cursor: 'pointer' }}
                      />
                      Select all ({orphans.length})
                    </label>
                  </td>
                </tr>
                {orphans.map((o, i) => (
                  <tr
                    key={o.session_id || i}
                    style={{
                      borderBottom: `1px solid ${c.border}`,
                      background: selectedOrphans.has(o.session_id) ? c.tealGlow : 'transparent',
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => {
                      if (!selectedOrphans.has(o.session_id)) e.currentTarget.style.background = c.bgHover
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = selectedOrphans.has(o.session_id) ? c.tealGlow : 'transparent'
                    }}
                  >
                    <td style={{ padding: '10px 12px', width: 32 }}>
                      <input
                        type="checkbox"
                        checked={selectedOrphans.has(o.session_id)}
                        onChange={() => toggleOne(o.session_id)}
                        style={{ accentColor: c.teal, cursor: 'pointer' }}
                      />
                    </td>
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
                      <span style={{
                        display: 'inline-block',
                        background: o.auto_delete_eligible ? `${c.green}20` : `${c.textMuted}20`,
                        color: o.auto_delete_eligible ? c.green : c.textMuted,
                        border: `1px solid ${o.auto_delete_eligible ? c.green : c.textMuted}`,
                        borderRadius: 20,
                        fontSize: 11,
                        fontWeight: 700,
                        padding: '2px 9px',
                      }}>{o.auto_delete_eligible ? 'Eligible' : 'Retain'}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {/* ── Duplicate Resolution ─────────────────────────────────────── */}
      <SectionCard
        title="Duplicate Resolution"
        badge={`${duplicates?.duplicate_groups ?? 0} groups`}
        badgeColor={duplicates && duplicates.duplicate_groups > 0 ? c.orange : undefined}
      >
        {dupGroups.length === 0 ? (
          <div style={{ color: c.textMuted, fontSize: 13, textAlign: 'center', padding: '16px 0' }}>
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
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 12,
                }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 16, color: c.orange }}>
                    content_copy
                  </span>
                  <span style={{ color: c.text, fontWeight: 600, fontSize: 13 }}>{group.name}</span>
                  <span style={{
                    background: `${c.orange}20`,
                    color: c.orange,
                    border: `1px solid ${c.orange}`,
                    borderRadius: 20,
                    fontSize: 10,
                    fontWeight: 700,
                    padding: '2px 8px',
                  }}>{group.entries.length} copies</span>
                  <div style={{ marginLeft: 'auto' }}>
                    <DisabledActionButton label="Resolve" icon="auto_fix_high" />
                  </div>
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
                      <span className="material-symbols-outlined" style={{ fontSize: 14, color: c.textMuted }}>
                        folder
                      </span>
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

      {/* ── Hook Sync Status ─────────────────────────────────────────── */}
      <SectionCard
        title="Hook Sync Status"
        badge={`${hookAudit?.total_projects ?? 0} projects`}
      >
        {hookAudit && hookAudit.total_rules_missing > 0 && (
          <div style={{
            background: `${c.orange}15`,
            border: `1px solid ${c.orange}`,
            borderRadius: 8,
            padding: '10px 14px',
            marginBottom: 14,
            color: c.orange,
            fontSize: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>warning</span>
              <strong>{hookAudit.total_rules_missing}</strong> rules missing across {hookAudit.total_projects} projects
            </div>
            <DisabledActionButton label="Sync All" icon="sync" />
          </div>
        )}

        {(hookAudit?.projects ?? []).length === 0 ? (
          <div style={{ color: c.textMuted, fontSize: 13, textAlign: 'center', padding: '16px 0' }}>
            No hook projects found
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {hookAudit!.projects.map((proj, i) => {
              const pct = proj.total > 0 ? Math.round((proj.linked / proj.total) * 100) : 0
              const barColor = pct === 100 ? c.green : pct >= 70 ? c.orange : c.red
              return (
                <div
                  key={proj.project || i}
                  style={{
                    background: c.bg,
                    border: `1px solid ${proj.missing > 0 ? c.orange + '80' : c.border}`,
                    borderRadius: 8,
                    padding: 14,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 16, color: c.textMuted }}>
                      hook
                    </span>
                    <span style={{ color: c.text, fontWeight: 600, fontSize: 13 }}>{proj.project}</span>
                    <span style={{ color: c.textMuted, fontSize: 11, fontFamily: 'monospace', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {proj.path}
                    </span>
                    <span style={{ color: barColor, fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                      {proj.linked}/{proj.total}
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div style={{
                    height: 6,
                    background: c.border,
                    borderRadius: 3,
                    overflow: 'hidden',
                    marginBottom: proj.missing > 0 ? 10 : 0,
                  }}>
                    <div style={{
                      width: `${pct}%`,
                      height: '100%',
                      background: barColor,
                      borderRadius: 3,
                      transition: 'width 0.3s',
                    }} />
                  </div>

                  {/* Missing rules */}
                  {proj.missing > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
                      {proj.rules.filter(r => !r.exists).map((rule, j) => (
                        <div key={j} style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          fontSize: 12,
                          color: c.red,
                        }}>
                          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>cancel</span>
                          <span style={{ fontFamily: 'monospace' }}>{rule.file}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </SectionCard>

      {/* ── Services ─────────────────────────────────────────────────── */}
      <SectionCard
        title="Services"
        badge={`${hookAudit?.services.length ?? 0} configured`}
      >
        {(hookAudit?.services ?? []).length === 0 ? (
          <div style={{ color: c.textMuted, fontSize: 13, textAlign: 'center', padding: '16px 0' }}>
            No services configured
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: 10,
          }}>
            {hookAudit!.services.map((svc, i) => (
              <div
                key={svc.name || i}
                style={{
                  background: c.bg,
                  border: `1px solid ${c.border}`,
                  borderRadius: 8,
                  padding: '14px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                  <span className="material-symbols-outlined" style={{
                    fontSize: 16,
                    color: svc.active ? c.green : c.textMuted,
                    flexShrink: 0,
                  }}>
                    {svc.active ? 'circle' : 'radio_button_unchecked'}
                  </span>
                  <span style={{
                    color: svc.active ? c.text : c.textMuted,
                    fontSize: 13,
                    fontWeight: svc.active ? 600 : 400,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>{svc.name}</span>
                </div>

                {/* Visual-only toggle — disabled */}
                <div
                  title="Coming in Phase 4"
                  style={{
                    width: 36,
                    height: 20,
                    background: svc.enabled ? `${c.teal}80` : c.border,
                    borderRadius: 10,
                    position: 'relative',
                    cursor: 'not-allowed',
                    opacity: 0.6,
                    flexShrink: 0,
                    transition: 'background 0.2s',
                  }}
                >
                  <div style={{
                    width: 14,
                    height: 14,
                    background: svc.enabled ? c.teal : c.textMuted,
                    borderRadius: '50%',
                    position: 'absolute',
                    top: 3,
                    left: svc.enabled ? 19 : 3,
                    transition: 'left 0.2s',
                  }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

    </div>
  )
}
