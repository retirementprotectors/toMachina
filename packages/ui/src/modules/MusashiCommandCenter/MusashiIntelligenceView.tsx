/**
 * MusashiIntelligenceView — DEVOUR Intelligence Dashboard (MUS-D15)
 *
 * 5 sections: Creative Inventory, Parity Gap Tracker, Brand Compliance,
 * Campaign Calendar, Artisan Health. All wired to GET /api/cmo/dashboard.
 *
 * Built by RONIN — MUSASHI DEVOUR Track
 */

'use client'

import { useEffect, useState } from 'react'

// ── Types ───────────────────────────────────────────────────────────────

interface InventoryCounts {
  canva: { total: number; stale: number }
  drive: { total: number; stale: number }
  wordpress: { total: number; gaps: number }
  c3: { total: number; stale: number }
}

interface ParityGap {
  printAssetId: string
  printAssetName: string
  printAssetType: string
  missingDigital: Array<{ type: string; status: string }>
  priority: string
  marketRelevance: string[]
}

interface ComplianceData {
  passed7d: number
  failed7d: number
  lastViolation?: { assetType: string; artisan: string; checkedAt: string }
}

interface CalendarEntry {
  entryId: string
  name: string
  type: string
  scheduledDate: string
  market: string
  artisan: string
  priority: string
  status: string
  blockedReason?: string
}

interface ArtisanHealth {
  artisanId: string
  status: 'active' | 'degraded' | 'offline'
  lastResult?: string
}

interface DashboardData {
  inventory: InventoryCounts
  parity: ParityGap[]
  compliance: ComplianceData
  calendar: CalendarEntry[]
  artisans: ArtisanHealth[]
}

// ── Design tokens ───────────────────────────────────────────────────────

const GOLD = '#d4a44c'
const colors = {
  bg: '#0a0e17',
  bgCard: '#111827',
  bgHover: '#1a2236',
  border: '#1e293b',
  text: '#e2e8f0',
  textMuted: '#94a3b8',
  gold: GOLD,
  goldGlow: 'rgba(212,164,76,0.12)',
  green: '#22c55e',
  red: '#ef4444',
  orange: '#f59e0b',
  cyan: '#06b6d4',
}

// ── Styles ──────────────────────────────────────────────────────────────

const sectionStyle: React.CSSProperties = {
  padding: 24,
}

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
  gap: 16,
  marginBottom: 24,
}

const cardStyle: React.CSSProperties = {
  background: colors.bgHover,
  border: `1px solid ${colors.border}`,
  borderRadius: 10,
  padding: 20,
}

const sectionHeaderStyle: React.CSSProperties = {
  fontSize: '0.85rem',
  fontWeight: 700,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.08em',
  color: colors.gold,
  marginBottom: 14,
  paddingBottom: 8,
  borderBottom: `1px solid ${colors.border}`,
}

const statValueStyle: React.CSSProperties = {
  fontSize: '1.8rem',
  fontWeight: 800,
  color: colors.text,
  lineHeight: 1.2,
}

const statLabelStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  color: colors.textMuted,
  marginTop: 2,
}

const badgeStyle = (color: string): React.CSSProperties => ({
  display: 'inline-block',
  padding: '2px 8px',
  borderRadius: 4,
  fontSize: '0.7rem',
  fontWeight: 600,
  color,
  background: `${color}18`,
  border: `1px solid ${color}40`,
})

const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse' as const,
  fontSize: '0.82rem',
}

const thStyle: React.CSSProperties = {
  textAlign: 'left' as const,
  padding: '8px 10px',
  fontWeight: 600,
  color: colors.gold,
  borderBottom: `1px solid ${colors.border}`,
  fontSize: '0.75rem',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.04em',
}

const tdStyle: React.CSSProperties = {
  padding: '8px 10px',
  borderBottom: `1px solid ${colors.border}`,
  color: colors.textMuted,
}

// ── Artisan name map ────────────────────────────────────────────────────

const ARTISAN_NAMES: Record<string, string> = {
  'print-artisan': 'Print',
  'digital-artisan': 'Digital',
  'web-artisan': 'Web',
  'social-artisan': 'Social',
  'video-artisan': 'Video',
}

const STATUS_COLORS: Record<string, string> = {
  active: colors.green,
  degraded: colors.orange,
  offline: colors.red,
}

const PRIORITY_COLORS: Record<string, string> = {
  high: colors.red,
  medium: colors.orange,
  low: colors.textMuted,
  backlog: colors.textMuted,
}

// ── Component ───────────────────────────────────────────────────────────

export function MusashiIntelligenceView() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchDashboard() {
      try {
        const res = await fetch('/api/cmo/dashboard')
        const json = await res.json() as { success: boolean; data?: DashboardData; error?: string }
        if (json.success && json.data) {
          setData(json.data)
        } else {
          setError(json.error || 'Failed to load dashboard')
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Network error')
      } finally {
        setLoading(false)
      }
    }
    fetchDashboard()
  }, [])

  if (loading) {
    return (
      <div style={{ ...sectionStyle, textAlign: 'center', color: colors.textMuted, padding: 60 }}>
        Loading DEVOUR intelligence...
      </div>
    )
  }

  if (error || !data) {
    return (
      <div style={{ ...sectionStyle, textAlign: 'center', color: colors.red, padding: 60 }}>
        {error || 'No data available'}
      </div>
    )
  }

  const isAepActive = data.calendar.some((e) => e.blockedReason === 'AEP_BLACKOUT')

  return (
    <div style={sectionStyle}>
      {/* ── Creative Inventory Summary ── */}
      <div style={sectionHeaderStyle}>Creative Inventory</div>
      <div style={gridStyle}>
        {([
          { label: 'Canva Designs', total: data.inventory.canva.total, sub: `${data.inventory.canva.stale} stale`, icon: '🎨' },
          { label: 'Drive Assets', total: data.inventory.drive.total, sub: `${data.inventory.drive.stale} stale`, icon: '📁' },
          { label: 'WordPress Pages', total: data.inventory.wordpress.total, sub: `${data.inventory.wordpress.gaps} gaps`, icon: '🌐' },
          { label: 'C3 Templates', total: data.inventory.c3.total, sub: `${data.inventory.c3.stale} stale`, icon: '📧' },
        ] as const).map((item) => (
          <div key={item.label} style={cardStyle}>
            <div style={{ fontSize: '1.2rem', marginBottom: 6 }}>{item.icon}</div>
            <div style={statValueStyle}>{item.total}</div>
            <div style={statLabelStyle}>{item.label}</div>
            <div style={{ fontSize: '0.72rem', color: colors.textMuted, marginTop: 4 }}>{item.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Parity Gap Tracker ── */}
      <div style={sectionHeaderStyle}>Parity Gap Tracker</div>
      {data.parity.length === 0 ? (
        <div style={{ ...cardStyle, textAlign: 'center', color: colors.textMuted, marginBottom: 24 }}>
          No parity gaps detected — all print assets have digital coverage.
        </div>
      ) : (
        <div style={{ ...cardStyle, padding: 0, overflow: 'hidden', marginBottom: 24 }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Print Asset</th>
                <th style={thStyle}>Missing Digital</th>
                <th style={thStyle}>Priority</th>
              </tr>
            </thead>
            <tbody>
              {data.parity.slice(0, 10).map((gap) => (
                <tr key={gap.printAssetId}>
                  <td style={{ ...tdStyle, color: colors.text, fontWeight: 500 }}>{gap.printAssetName}</td>
                  <td style={tdStyle}>
                    {gap.missingDigital.map((d) => (
                      <span key={d.type} style={{ ...badgeStyle(colors.cyan), marginRight: 4 }}>{d.type}</span>
                    ))}
                  </td>
                  <td style={tdStyle}>
                    <span style={badgeStyle(PRIORITY_COLORS[gap.priority] || colors.textMuted)}>
                      {gap.priority.toUpperCase()}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Brand Compliance Feed ── */}
      <div style={sectionHeaderStyle}>Brand Compliance (7d)</div>
      <div style={{ ...gridStyle, gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
        <div style={cardStyle}>
          <div style={{ ...statValueStyle, color: colors.green }}>{data.compliance.passed7d}</div>
          <div style={statLabelStyle}>Passed</div>
        </div>
        <div style={cardStyle}>
          <div style={{ ...statValueStyle, color: data.compliance.failed7d > 0 ? colors.red : colors.textMuted }}>
            {data.compliance.failed7d}
          </div>
          <div style={statLabelStyle}>Failed</div>
        </div>
        {data.compliance.lastViolation && (
          <div style={{ ...cardStyle, gridColumn: 'span 2' }}>
            <div style={{ fontSize: '0.75rem', color: colors.red, fontWeight: 600, marginBottom: 4 }}>Last Violation</div>
            <div style={{ fontSize: '0.82rem', color: colors.text }}>
              {data.compliance.lastViolation.assetType} — {data.compliance.lastViolation.artisan}
            </div>
            <div style={{ fontSize: '0.7rem', color: colors.textMuted, marginTop: 2 }}>
              {data.compliance.lastViolation.checkedAt}
            </div>
          </div>
        )}
      </div>

      {/* ── Campaign Calendar ── */}
      <div style={sectionHeaderStyle}>
        Campaign Calendar (30d)
        {isAepActive && (
          <span style={{ ...badgeStyle(colors.red), marginLeft: 10, fontSize: '0.65rem' }}>
            AEP BLACKOUT ACTIVE
          </span>
        )}
      </div>
      {data.calendar.length === 0 ? (
        <div style={{ ...cardStyle, textAlign: 'center', color: colors.textMuted, marginBottom: 24 }}>
          No campaigns scheduled in the next 30 days.
        </div>
      ) : (
        <div style={{ ...cardStyle, padding: 0, overflow: 'hidden', marginBottom: 24 }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Campaign</th>
                <th style={thStyle}>Date</th>
                <th style={thStyle}>Type</th>
                <th style={thStyle}>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.calendar.slice(0, 15).map((entry) => (
                <tr key={entry.entryId}>
                  <td style={{ ...tdStyle, color: colors.text, fontWeight: 500 }}>{entry.name}</td>
                  <td style={tdStyle}>{new Date(entry.scheduledDate).toLocaleDateString()}</td>
                  <td style={tdStyle}>
                    <span style={badgeStyle(colors.gold)}>{entry.type}</span>
                  </td>
                  <td style={tdStyle}>
                    <span style={badgeStyle(
                      entry.status === 'blocked' ? colors.red
                      : entry.status === 'ready' ? colors.green
                      : colors.textMuted
                    )}>
                      {entry.status.toUpperCase()}
                      {entry.blockedReason ? ` (${entry.blockedReason})` : ''}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Artisan Health ── */}
      <div style={sectionHeaderStyle}>Artisan Health (5/5)</div>
      <div style={gridStyle}>
        {data.artisans.map((artisan) => (
          <div key={artisan.artisanId} style={{
            ...cardStyle,
            borderTop: `3px solid ${STATUS_COLORS[artisan.status] || colors.textMuted}`,
          }}>
            <div style={{ fontSize: '0.9rem', fontWeight: 600, color: colors.text, marginBottom: 4 }}>
              {ARTISAN_NAMES[artisan.artisanId] || artisan.artisanId}
            </div>
            <div style={{
              fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase' as const,
              color: STATUS_COLORS[artisan.status] || colors.textMuted,
            }}>
              {artisan.status}
            </div>
            {artisan.lastResult && (
              <div style={{ fontSize: '0.7rem', color: colors.textMuted, marginTop: 4 }}>
                Last: {artisan.lastResult}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
