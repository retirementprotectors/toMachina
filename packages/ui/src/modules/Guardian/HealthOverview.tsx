'use client'

import { useState, useEffect, useCallback } from 'react'
import { fetchValidated } from '../fetchValidated'
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

interface StructuralReport {
  timestamp: string
  clients: {
    total: number
    coverage: { field: string; populated: number; total: number; pct: number }[]
    distribution: { tier: string; count: number; pct: number }[]
  }
  duplicates: {
    name_dob_clusters: number
    name_dob_total_records: number
    shared_emails: number
    shared_phones: number
    top_name_clusters: { key: string; count: number }[]
  }
  carriers: {
    total_accounts: number
    exact_matches: number
    fuzzy_matches: number
    mismatches: { name: string; count: number }[]
  }
  collections: { name: string; count: number }[]
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
  const [structural, setStructural] = useState<StructuralReport | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchHealth = useCallback(async () => {
    try {
      setLoading(true)
      const result = await fetchValidated<Record<string, unknown>>('/api/guardian/health')
      if (result.success && result.data) {
        // Structural report (from guardian-structural.ts)
        const rawData = result.data as Record<string, unknown>
        if (rawData.structural) {
          setStructural(rawData.structural as unknown as StructuralReport)
        }
        // API returns { collections: {...}, structural: {...} } or flat object
        const collections = (rawData.collections || rawData) as Record<string, { doc_count: number; field_coverage: Record<string, number> }>
        const arr: CollectionHealth[] = Object.entries(collections)
          .filter(([key]) => key !== 'structural')
          .map(([collection, info]) => {
          const infoTyped = info as { doc_count: number; field_coverage: Record<string, number> }
          if (!infoTyped.field_coverage) return null
          const fieldEntries = Object.entries(infoTyped.field_coverage)
          const avgCoverage = fieldEntries.length > 0
            ? Math.round(fieldEntries.reduce((sum, [, pct]) => sum + (pct as number), 0) / fieldEntries.length)
            : 0
          const issues: string[] = []
          for (const [field, pct] of fieldEntries) {
            if ((pct as number) < 50) issues.push(`${field}: ${pct}% populated`)
          }
          return {
            collection,
            doc_count: infoTyped.doc_count,
            field_coverage: avgCoverage,
            field_details: fieldEntries.map(([field, pct]) => ({
              field, filled: 0, total: 0, percentage: pct as number,
            })),
            status: avgCoverage >= 90 ? 'healthy' as const : avgCoverage >= 60 ? 'warning' as const : 'critical' as const,
            issues,
            last_updated: new Date().toISOString(),
          }
        }).filter((x): x is CollectionHealth => x !== null)
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
    <div>
      {/* Structural Health Banner */}
      {structural && (
        <div style={{ marginBottom: 20 }}>
          {/* Summary Stats */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12, marginBottom: 16,
          }}>
            {[
              { label: 'Total Clients', value: structural.clients.total.toLocaleString(), color: s.guardian },
              { label: 'Duplicate Clusters', value: String(structural.duplicates.name_dob_clusters), color: structural.duplicates.name_dob_clusters > 0 ? s.red : s.green },
              { label: 'Shared Emails', value: String(structural.duplicates.shared_emails), color: structural.duplicates.shared_emails > 10 ? s.yellow : s.green },
              { label: 'Shared Phones', value: String(structural.duplicates.shared_phones), color: structural.duplicates.shared_phones > 10 ? s.yellow : s.green },
              { label: 'Carrier Mismatches', value: String(structural.carriers.mismatches.length), color: structural.carriers.mismatches.length > 0 ? s.red : s.green },
              { label: 'Accounts Scanned', value: structural.carriers.total_accounts.toLocaleString(), color: s.guardian },
            ].map((stat, i) => (
              <div key={i} style={{
                background: s.surface, border: `1px solid ${s.border}`, borderRadius: 10, padding: '14px 16px', textAlign: 'center',
              }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: stat.color }}>{stat.value}</div>
                <div style={{ fontSize: 10, color: s.textMuted, marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Client Field Coverage (full scan) */}
          <div style={{
            background: s.surface, border: `1px solid ${s.border}`, borderRadius: 10, padding: 16, marginBottom: 16,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Icon name="analytics" size={16} color={s.guardian} />
              <span style={{ fontSize: 13, fontWeight: 700 }}>Client Field Coverage (ALL {structural.clients.total.toLocaleString()} clients)</span>
              <span style={{ marginLeft: 'auto', fontSize: 10, color: s.textMuted }}>
                Last scan: {formatTimestamp(structural.timestamp)}
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 8 }}>
              {structural.clients.coverage.map((f) => (
                <div key={f.field} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 11, color: s.textSecondary, width: 100, textAlign: 'right', fontFamily: 'monospace' }}>{f.field}</span>
                  <div style={{ flex: 1, height: 6, background: coverageBg(f.pct), borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ width: `${f.pct}%`, height: '100%', background: coverageColor(f.pct), borderRadius: 3 }} />
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 600, color: coverageColor(f.pct), width: 40, textAlign: 'right' }}>{f.pct.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* Completeness Distribution */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16,
          }}>
            <div style={{ background: s.surface, border: `1px solid ${s.border}`, borderRadius: 10, padding: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Icon name="pie_chart" size={14} color={s.guardian} /> Completeness Distribution
              </div>
              {structural.clients.distribution.map((d) => (
                <div key={d.tier} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0', fontSize: 12 }}>
                  <span style={{ color: s.textSecondary }}>{d.tier}</span>
                  <span style={{ fontWeight: 700, color: d.tier.includes('100') ? s.green : d.tier.includes('Below') ? s.red : s.text }}>
                    {d.count.toLocaleString()} ({d.pct}%)
                  </span>
                </div>
              ))}
            </div>
            <div style={{ background: s.surface, border: `1px solid ${s.border}`, borderRadius: 10, padding: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Icon name="warning" size={14} color={s.red} /> Top Carrier Mismatches
              </div>
              {structural.carriers.mismatches.slice(0, 8).map((m) => (
                <div key={m.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '3px 0', fontSize: 11 }}>
                  <span style={{ color: s.textSecondary, fontFamily: 'monospace', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</span>
                  <span style={{ fontWeight: 700, color: s.yellow }}>{m.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Per-Collection Health Cards */}
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, color: s.textSecondary }}>
        <Icon name="storage" size={14} color={s.textMuted} /> Collection Health (Schema-Based Sampling)
      </div>
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
    </div>
  )
}
