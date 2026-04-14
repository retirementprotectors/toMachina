'use client'

import { useState, useEffect, useCallback } from 'react'
import { fetchValidated } from '../../fetchValidated'
import { useToast } from '../../../components/Toast'

/* ─── Types ─── */
interface GuardianAlert {
  id: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  description: string
  collection?: string
  source: string
  acknowledged: boolean
  acknowledged_by?: string
  acknowledged_at?: string
  created_at: string
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
  green: 'rgb(34, 197, 94)',
  greenBg: 'rgba(34, 197, 94, 0.15)',
  yellow: 'rgb(251, 191, 36)',
  yellowBg: 'rgba(251, 191, 36, 0.15)',
  red: 'rgb(239, 68, 68)',
  redBg: 'rgba(239, 68, 68, 0.15)',
  blue: 'rgb(59, 130, 246)',
  blueBg: 'rgba(59, 130, 246, 0.15)',
}

const SEVERITY_CONFIG: Record<string, { color: string; bg: string; icon: string }> = {
  critical: { color: s.red, bg: s.redBg, icon: 'error' },
  high: { color: s.yellow, bg: s.yellowBg, icon: 'warning' },
  medium: { color: s.blue, bg: s.blueBg, icon: 'info' },
  low: { color: s.textMuted, bg: 'rgba(100,116,139,0.15)', icon: 'info_outline' },
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
export function AlertFeed() {
  const { showToast } = useToast()
  const [alerts, setAlerts] = useState<GuardianAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [acknowledging, setAcknowledging] = useState<string | null>(null)

  const fetchAlerts = useCallback(async () => {
    try {
      setLoading(true)
      const result = await fetchValidated<GuardianAlert[]>('/api/guardian/alerts')
      if (result.success && result.data) {
        setAlerts(Array.isArray(result.data) ? result.data : [])
      }
    } catch {
      showToast('Failed to load alerts', 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => { fetchAlerts() }, [fetchAlerts])

  const handleAcknowledge = useCallback(async (alertId: string) => {
    try {
      setAcknowledging(alertId)
      const result = await fetchValidated(`/api/guardian/alerts/${alertId}`, {
        method: 'PATCH',
        body: JSON.stringify({ acknowledged: true }),
      })
      if (!result.success) throw new Error(result.error ?? 'Failed to acknowledge')
      setAlerts((prev) => prev.map((a) =>
        a.id === alertId ? { ...a, acknowledged: true } : a
      ))
      showToast('Notification acknowledged', 'success')
    } catch {
      showToast('Failed to acknowledge notification', 'error')
    } finally {
      setAcknowledging(null)
    }
  }, [showToast])

  const unacknowledged = alerts.filter((a) => !a.acknowledged)
  const acknowledged = alerts.filter((a) => a.acknowledged)

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 48, color: s.textMuted }}>
        <Icon name="hourglass_empty" size={24} /> <span style={{ marginLeft: 8 }}>Loading notifications...</span>
      </div>
    )
  }

  if (alerts.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: 48, color: s.textMuted }}>
        <Icon name="notifications_none" size={32} />
        <p style={{ marginTop: 8 }}>No notifications. The system is clean.</p>
      </div>
    )
  }

  const renderAlert = (a: GuardianAlert) => {
    const cfg = SEVERITY_CONFIG[a.severity] ?? SEVERITY_CONFIG.low
    return (
      <div key={a.id} style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 16px',
        background: a.acknowledged ? s.bg : s.surface,
        border: `1px solid ${a.acknowledged ? s.border : cfg.color}`,
        borderRadius: 8,
        opacity: a.acknowledged ? 0.7 : 1,
      }}>
        {/* Severity Dot */}
        <span style={{
          width: 10,
          height: 10,
          borderRadius: '50%',
          background: cfg.color,
          boxShadow: a.acknowledged ? 'none' : `0 0 8px ${cfg.color}`,
          flexShrink: 0,
        }} />

        {/* Content */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 13, color: s.text }}>{a.description}</span>
          <div style={{ display: 'flex', gap: 10, fontSize: 11, color: s.textMuted }}>
            {a.collection && <span>{a.collection}</span>}
            <span>{a.source}</span>
            <span>{formatTimestamp(a.created_at)}</span>
          </div>
        </div>

        {/* Acknowledge Button */}
        {!a.acknowledged ? (
          <button
            onClick={() => handleAcknowledge(a.id)}
            disabled={acknowledging === a.id}
            style={{
              padding: '5px 12px',
              borderRadius: 6,
              border: `1px solid ${s.border}`,
              background: s.hover,
              color: s.text,
              fontSize: 11,
              fontWeight: 600,
              cursor: acknowledging === a.id ? 'wait' : 'pointer',
              opacity: acknowledging === a.id ? 0.5 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <Icon name="check" size={14} color={s.green} />
            {acknowledging === a.id ? 'Saving...' : 'Acknowledge'}
          </button>
        ) : (
          <span style={{ fontSize: 11, color: s.green, display: 'flex', alignItems: 'center', gap: 4 }}>
            <Icon name="check_circle" size={14} color={s.green} />
            Acknowledged
          </span>
        )}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Active */}
      {unacknowledged.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: s.textSecondary, letterSpacing: '0.05em', paddingLeft: 4 }}>
            ACTIVE ({unacknowledged.length})
          </div>
          {unacknowledged.map(renderAlert)}
        </div>
      )}

      {/* Acknowledged */}
      {acknowledged.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: s.textMuted, letterSpacing: '0.05em', paddingLeft: 4 }}>
            ACKNOWLEDGED ({acknowledged.length})
          </div>
          {acknowledged.map(renderAlert)}
        </div>
      )}
    </div>
  )
}
