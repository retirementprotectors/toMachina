'use client'

import { useState, useEffect, useCallback } from 'react'
import { fetchWithAuth } from '../fetchWithAuth'
import { useToast } from '../../components/Toast'

/* ─── Types ─── */
interface AuditFinding {
  id: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  description: string
  collection: string
  resolved: boolean
}

interface AuditRecord {
  id: string
  name: string
  phase: string
  status: 'in_progress' | 'completed' | 'failed'
  findings_count: number
  findings: AuditFinding[]
  started_at: string
  completed_at?: string
  triggered_by: string
}

/* ─── Styles ─── */
const s = {
  bg: 'var(--bg, #0f1219)',
  surface: 'var(--bg-surface, #1c2333)',
  hover: 'var(--bg-hover, #232b3e)',
  border: 'var(--border-color, #2a3347)',
  text: 'var(--text-primary, #e2e8f0)',
  textSecondary: 'var(--text-secondary, #94a3b8)',
  textMuted: 'var(--text-muted, #64748b)',
  portal: 'var(--portal, #4a7ab5)',
  guardian: '#c8872e',
  guardianGlow: 'rgba(200, 135, 46, 0.15)',
  green: 'rgb(34, 197, 94)',
  greenBg: 'rgba(34, 197, 94, 0.15)',
  yellow: 'rgb(251, 191, 36)',
  yellowBg: 'rgba(251, 191, 36, 0.15)',
  red: 'rgb(239, 68, 68)',
  redBg: 'rgba(239, 68, 68, 0.15)',
  blue: 'rgb(59, 130, 246)',
  blueBg: 'rgba(59, 130, 246, 0.15)',
}

const PHASES = ['scan', 'detect', 'respond', 'verify', 'protect'] as const

const STATUS_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  in_progress: { color: s.blue, bg: s.blueBg, label: 'In Progress' },
  completed: { color: s.green, bg: s.greenBg, label: 'Completed' },
  failed: { color: s.red, bg: s.redBg, label: 'Failed' },
}

const SEVERITY_CONFIG: Record<string, { color: string; bg: string }> = {
  critical: { color: s.red, bg: s.redBg },
  high: { color: s.yellow, bg: s.yellowBg },
  medium: { color: s.blue, bg: s.blueBg },
  low: { color: s.textMuted, bg: 'rgba(100,116,139,0.15)' },
}

/* ─── Helpers ─── */
function formatTimestamp(ts: string | null | undefined): string {
  if (!ts) return '--'
  try {
    return new Date(ts).toLocaleString('en-US', {
      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
    })
  } catch { return '--' }
}

function Icon({ name, size = 18, color }: { name: string; size?: number; color?: string }) {
  return <span className="material-icons-outlined" style={{ fontSize: size, color }}>{name}</span>
}

/* ─── Component ─── */
export function AuditHistory() {
  const { showToast } = useToast()
  const [audits, setAudits] = useState<AuditRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const fetchAudits = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetchWithAuth('/api/guardian/audits')
      if (!res.ok) throw new Error('Failed to fetch audits')
      const json = await res.json() as { success: boolean; data?: AuditRecord[] }
      if (json.success && json.data) {
        setAudits(json.data)
      }
    } catch {
      showToast('Failed to load audit history', 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => { fetchAudits() }, [fetchAudits])

  const phaseIndex = (phase: string) => PHASES.indexOf(phase as typeof PHASES[number])

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 48, color: s.textMuted }}>
        <Icon name="hourglass_empty" size={24} /> <span style={{ marginLeft: 8 }}>Loading audit history...</span>
      </div>
    )
  }

  if (audits.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: 48, color: s.textMuted }}>
        <Icon name="assignment" size={32} />
        <p style={{ marginTop: 8 }}>No audits found. Audits will appear here when scans are triggered.</p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {audits.map((audit) => {
        const expanded = expandedId === audit.id
        const statusCfg = STATUS_CONFIG[audit.status] ?? STATUS_CONFIG.in_progress
        const currentPhaseIdx = phaseIndex(audit.phase)

        return (
          <div key={audit.id} style={{
            background: s.surface,
            border: `1px solid ${s.border}`,
            borderRadius: 10,
            overflow: 'hidden',
          }}>
            {/* Header Row */}
            <button
              onClick={() => setExpandedId(expanded ? null : audit.id)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '14px 18px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: s.text,
                textAlign: 'left',
              }}
            >
              {/* Expand Icon */}
              <Icon name={expanded ? 'expand_more' : 'chevron_right'} size={18} color={s.textMuted} />

              {/* Name */}
              <span style={{ fontWeight: 600, fontSize: 14, flex: 1 }}>{audit.name}</span>

              {/* Phase Dots */}
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                {PHASES.map((phase, i) => (
                  <span key={phase} style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: i <= currentPhaseIdx ? s.guardian : 'rgba(100,116,139,0.3)',
                    boxShadow: i === currentPhaseIdx ? `0 0 6px ${s.guardian}` : 'none',
                  }} />
                ))}
              </div>

              {/* Findings Count */}
              <span style={{
                fontSize: 12,
                color: audit.findings_count > 0 ? s.yellow : s.textMuted,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}>
                <Icon name="bug_report" size={14} color={audit.findings_count > 0 ? s.yellow : s.textMuted} />
                {audit.findings_count}
              </span>

              {/* Status Badge */}
              <span style={{
                padding: '3px 10px',
                borderRadius: 12,
                fontSize: 11,
                fontWeight: 600,
                color: statusCfg.color,
                background: statusCfg.bg,
              }}>
                {statusCfg.label}
              </span>

              {/* Timestamp */}
              <span style={{ fontSize: 11, color: s.textMuted, whiteSpace: 'nowrap' }}>
                {formatTimestamp(audit.started_at)}
              </span>
            </button>

            {/* Expanded Findings */}
            {expanded && audit.findings.length > 0 && (
              <div style={{
                borderTop: `1px solid ${s.border}`,
                padding: '12px 18px',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}>
                {audit.findings.map((f) => {
                  const sevCfg = SEVERITY_CONFIG[f.severity] ?? SEVERITY_CONFIG.low
                  return (
                    <div key={f.id} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '8px 12px',
                      background: s.bg,
                      borderRadius: 6,
                      border: `1px solid ${s.border}`,
                    }}>
                      <span style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: sevCfg.color,
                        flexShrink: 0,
                      }} />
                      <span style={{
                        fontSize: 10,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        color: sevCfg.color,
                        minWidth: 55,
                      }}>
                        {f.severity}
                      </span>
                      <span style={{ fontSize: 12, color: s.text, flex: 1 }}>{f.description}</span>
                      <span style={{ fontSize: 11, color: s.guardian }}>{f.collection}</span>
                      {f.resolved && (
                        <Icon name="check_circle" size={14} color={s.green} />
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {expanded && audit.findings.length === 0 && (
              <div style={{
                borderTop: `1px solid ${s.border}`,
                padding: '16px 18px',
                textAlign: 'center',
                fontSize: 12,
                color: s.textMuted,
              }}>
                No findings for this audit.
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
