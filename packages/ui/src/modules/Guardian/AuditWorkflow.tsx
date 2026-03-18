'use client'

import { useState, useCallback } from 'react'
import { fetchWithAuth } from '../fetchWithAuth'
import { useToast } from '../../components/Toast'

/* ─── Phase Definitions (inline to avoid cross-package import issues) ─── */
const PHASES = ['scan', 'detect', 'respond', 'verify', 'protect'] as const
const PHASE_LABELS: Record<string, string> = {
  scan: 'Scan',
  detect: 'Detect',
  respond: 'Respond',
  verify: 'Verify',
  protect: 'Protect',
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
  guardianLight: '#f5e6cc',
  guardianGlow: 'rgba(200, 135, 46, 0.15)',
  green: 'rgb(34, 197, 94)',
  greenBg: 'rgba(34, 197, 94, 0.15)',
  red: 'rgb(239, 68, 68)',
  redBg: 'rgba(239, 68, 68, 0.15)',
}

/* ─── Helpers ─── */
function getPhaseIndex(phase: string): number {
  return PHASES.indexOf(phase as typeof PHASES[number])
}

function getPhaseProgress(phase: string): number {
  const idx = getPhaseIndex(phase)
  if (idx < 0) return 0
  return Math.round(((idx + 1) / PHASES.length) * 100)
}

function Icon({ name, size = 18, color }: { name: string; size?: number; color?: string }) {
  return <span className="material-icons-outlined" style={{ fontSize: size, color }}>{name}</span>
}

/* ─── Props ─── */
interface AuditWorkflowProps {
  auditId: string
  currentPhase: string
  onPhaseAdvanced?: (newPhase: string) => void
}

/* ─── Component ─── */
export function AuditWorkflow({ auditId, currentPhase, onPhaseAdvanced }: AuditWorkflowProps) {
  const { showToast } = useToast()
  const [advancing, setAdvancing] = useState(false)
  const [blockedReason, setBlockedReason] = useState<string | null>(null)
  const [phase, setPhase] = useState(currentPhase)

  const currentIdx = getPhaseIndex(phase)
  const progress = getPhaseProgress(phase)
  const isComplete = currentIdx === PHASES.length - 1

  const handleAdvance = useCallback(async () => {
    if (isComplete) return
    try {
      setAdvancing(true)
      setBlockedReason(null)
      const res = await fetchWithAuth(`/api/guardian/audits/${auditId}/phase`, {
        method: 'POST',
        body: JSON.stringify({ action: 'advance' }),
      })
      const json = await res.json() as {
        success: boolean
        data?: { phase: string }
        error?: string
        blocked_reason?: string
      }
      if (json.success && json.data) {
        setPhase(json.data.phase)
        showToast(`Advanced to ${PHASE_LABELS[json.data.phase] ?? json.data.phase}`, 'success')
        onPhaseAdvanced?.(json.data.phase)
      } else {
        const reason = json.blocked_reason ?? json.error ?? 'Transition blocked'
        setBlockedReason(reason)
        showToast('Phase transition blocked', 'warning')
      }
    } catch {
      showToast('Failed to advance phase', 'error')
    } finally {
      setAdvancing(false)
    }
  }, [auditId, isComplete, showToast, onPhaseAdvanced])

  return (
    <div style={{
      background: s.surface,
      border: `1px solid ${s.border}`,
      borderRadius: 12,
      padding: 24,
      display: 'flex',
      flexDirection: 'column',
      gap: 20,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon name="timeline" size={20} color={s.guardian} />
          <span style={{ fontWeight: 700, fontSize: 14, color: s.text }}>Audit Workflow</span>
        </div>
        <span style={{
          fontSize: 13,
          fontWeight: 700,
          color: s.guardian,
        }}>
          {progress}%
        </span>
      </div>

      {/* Phase Indicator Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 0,
        padding: '8px 0',
      }}>
        {PHASES.map((p, i) => {
          const isPast = i < currentIdx
          const isCurrent = i === currentIdx
          const isFuture = i > currentIdx
          const circleColor = isPast ? s.green : isCurrent ? s.guardian : 'rgba(100,116,139,0.3)'
          const circleGlow = isCurrent ? `0 0 12px ${s.guardian}` : isPast ? `0 0 6px ${s.green}` : 'none'

          return (
            <div key={p} style={{ display: 'flex', alignItems: 'center' }}>
              {/* Connector Line (before circle, except first) */}
              {i > 0 && (
                <div style={{
                  width: 40,
                  height: 3,
                  background: isPast ? s.green : isCurrent ? s.guardian : 'rgba(100,116,139,0.2)',
                  borderRadius: 2,
                }} />
              )}

              {/* Phase Node */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 8,
              }}>
                {/* Circle */}
                <div style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  background: circleColor,
                  boxShadow: circleGlow,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: isCurrent ? `2px solid ${s.guardianLight}` : isPast ? `2px solid ${s.green}` : `2px solid rgba(100,116,139,0.3)`,
                  transition: 'all 0.3s ease',
                }}>
                  {isPast ? (
                    <Icon name="check" size={16} color="#fff" />
                  ) : isCurrent ? (
                    <span style={{ fontSize: 12, fontWeight: 800, color: '#fff' }}>{i + 1}</span>
                  ) : (
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(100,116,139,0.5)' }}>{i + 1}</span>
                  )}
                </div>

                {/* Label */}
                <span style={{
                  fontSize: 11,
                  fontWeight: isCurrent ? 700 : 500,
                  color: isCurrent ? s.guardian : isPast ? s.green : s.textMuted,
                  whiteSpace: 'nowrap',
                }}>
                  {PHASE_LABELS[p] ?? p}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Progress Bar */}
      <div style={{
        background: 'rgba(100,116,139,0.15)',
        borderRadius: 4,
        height: 6,
        overflow: 'hidden',
      }}>
        <div style={{
          width: `${progress}%`,
          height: '100%',
          background: `linear-gradient(90deg, ${s.green}, ${s.guardian})`,
          borderRadius: 4,
          transition: 'width 0.4s ease',
        }} />
      </div>

      {/* Advance Button */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
        <button
          onClick={handleAdvance}
          disabled={advancing || isComplete}
          style={{
            padding: '10px 24px',
            borderRadius: 8,
            border: 'none',
            background: isComplete ? s.green : s.guardian,
            color: '#fff',
            fontSize: 13,
            fontWeight: 700,
            cursor: advancing || isComplete ? 'not-allowed' : 'pointer',
            opacity: advancing ? 0.6 : 1,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          {isComplete ? (
            <>
              <Icon name="verified" size={16} color="#fff" />
              Workflow Complete
            </>
          ) : (
            <>
              <Icon name="arrow_forward" size={16} color="#fff" />
              {advancing ? 'Advancing...' : `Advance to ${PHASE_LABELS[PHASES[currentIdx + 1]] ?? 'Next'}`}
            </>
          )}
        </button>

        {/* Blocked Reason */}
        {blockedReason && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 14px',
            borderRadius: 6,
            background: s.redBg,
            fontSize: 12,
            color: s.red,
          }}>
            <Icon name="block" size={14} color={s.red} />
            {blockedReason}
          </div>
        )}
      </div>
    </div>
  )
}
