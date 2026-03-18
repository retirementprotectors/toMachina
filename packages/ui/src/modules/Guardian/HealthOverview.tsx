'use client'

import { useState, useEffect, useCallback } from 'react'
import { fetchWithAuth } from '../fetchWithAuth'
import { useToast } from '../../components/Toast'

/* ─── Types ─── */
interface FieldCoverage {
  field: string
  filled: number
  total: number
  percentage: number
}

interface CollectionHealth {
  collection: string
  doc_count: number
  field_coverage: number
  field_details: FieldCoverage[]
  status: 'healthy' | 'warning' | 'critical'
  issues: string[]
  last_updated: string
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
  yellow: 'rgb(251, 191, 36)',
  yellowBg: 'rgba(251, 191, 36, 0.15)',
  red: 'rgb(239, 68, 68)',
  redBg: 'rgba(239, 68, 68, 0.15)',
  blue: 'rgb(59, 130, 246)',
  blueBg: 'rgba(59, 130, 246, 0.15)',
}

/* ─── Helpers ─── */
function statusColor(status: string): string {
  if (status === 'healthy') return s.green
  if (status === 'warning') return s.yellow
  return s.red
}

function statusBg(status: string): string {
  if (status === 'healthy') return s.greenBg
  if (status === 'warning') return s.yellowBg
  return s.redBg
}

function coverageColor(pct: number): string {
  if (pct >= 90) return s.green
  if (pct >= 60) return s.yellow
  return s.red
}

function coverageBg(pct: number): string {
  if (pct >= 90) return s.greenBg
  if (pct >= 60) return s.yellowBg
  return s.redBg
}

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
export function HealthOverview() {
  const { showToast } = useToast()
  const [data, setData] = useState<CollectionHealth[]>([])
  const [loading, setLoading] = useState(true)

  const fetchHealth = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetchWithAuth('/api/guardian/health')
      if (!res.ok) throw new Error('Failed to fetch health data')
      const json = await res.json() as {
        success: boolean
        data?: Record<string, { doc_count: number; field_coverage: Record<string, number> }>
      }
      if (json.success && json.data) {
        // API returns object keyed by collection name — transform to array
        const arr: CollectionHealth[] = Object.entries(json.data).map(([collection, info]) => {
          const fieldEntries = Object.entries(info.field_coverage)
          const avgCoverage = fieldEntries.length > 0
            ? Math.round(fieldEntries.reduce((sum, [, pct]) => sum + pct, 0) / fieldEntries.length)
            : 0
          const issues: string[] = []
          for (const [field, pct] of fieldEntries) {
            if (pct < 50) issues.push(`${field}: ${pct}% populated`)
          }
          return {
            collection,
            doc_count: info.doc_count,
            field_coverage: avgCoverage,
            field_details: fieldEntries.map(([field, pct]) => ({
              field, filled: 0, total: 0, percentage: pct,
            })),
            status: avgCoverage >= 90 ? 'healthy' as const : avgCoverage >= 60 ? 'warning' as const : 'critical' as const,
            issues,
            last_updated: new Date().toISOString(),
          }
        })
        setData(arr)
      }
    } catch {
      showToast('Failed to load health data', 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => { fetchHealth() }, [fetchHealth])

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 48, color: s.textMuted }}>
        <Icon name="hourglass_empty" size={24} /> <span style={{ marginLeft: 8 }}>Loading health data...</span>
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: 48, color: s.textMuted }}>
        <Icon name="info" size={32} />
        <p style={{ marginTop: 8 }}>No health data available. Run a health scan to populate.</p>
      </div>
    )
  }

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
      gap: 16,
    }}>
      {data.map((col) => (
        <div key={col.collection} style={{
          background: s.surface,
          border: `1px solid ${s.border}`,
          borderRadius: 10,
          padding: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 700, fontSize: 13, letterSpacing: '0.05em', color: s.text }}>
              {col.collection.toUpperCase()}
            </span>
            <span style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: statusColor(col.status),
              boxShadow: `0 0 6px ${statusColor(col.status)}`,
              display: 'inline-block',
            }} />
          </div>

          {/* Doc Count */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{ fontSize: 28, fontWeight: 800, color: s.text }}>{col.doc_count.toLocaleString()}</span>
            <span style={{ fontSize: 12, color: s.textMuted }}>documents</span>
          </div>

          {/* Coverage Bar */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 11, color: s.textSecondary }}>Field Coverage</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: coverageColor(col.field_coverage) }}>
                {col.field_coverage.toFixed(1)}%
              </span>
            </div>
            <div style={{
              background: coverageBg(col.field_coverage),
              borderRadius: 4,
              height: 6,
              overflow: 'hidden',
            }}>
              <div style={{
                width: `${Math.min(col.field_coverage, 100)}%`,
                height: '100%',
                background: coverageColor(col.field_coverage),
                borderRadius: 4,
                transition: 'width 0.3s ease',
              }} />
            </div>
          </div>

          {/* Status Badge */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 10px',
            borderRadius: 12,
            background: statusBg(col.status),
            alignSelf: 'flex-start',
          }}>
            <Icon name={col.status === 'healthy' ? 'check_circle' : col.status === 'warning' ? 'warning' : 'error'} size={14} color={statusColor(col.status)} />
            <span style={{ fontSize: 11, fontWeight: 600, color: statusColor(col.status), textTransform: 'capitalize' }}>
              {col.status}
            </span>
          </div>

          {/* Issues */}
          {col.issues.length > 0 && (
            <div style={{ fontSize: 11, color: s.red }}>
              <Icon name="report_problem" size={12} color={s.red} /> {col.issues.length} issue{col.issues.length !== 1 ? 's' : ''} detected
            </div>
          )}

          {/* Last Updated */}
          <div style={{ fontSize: 11, color: s.textMuted, marginTop: 'auto' }}>
            Last updated: {formatTimestamp(col.last_updated)}
          </div>
        </div>
      ))}
    </div>
  )
}
