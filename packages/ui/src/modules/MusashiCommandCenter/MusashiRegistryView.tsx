'use client'

/**
 * MUS-O11 — Registry View Live
 *
 * Shows CMO_REGISTRY data directly from @tomachina/core imports.
 * No API calls — all data is static registry data baked into the package.
 *
 * Displays:
 * - Total tool count (from CMO_REGISTRY.length)
 * - Domain breakdown table (tool count per domain)
 * - Wire status table (3 wires, all "live" in Track 2)
 */
import {
  CMO_REGISTRY,
  getCmoToolsByDomain,
  getCmoToolsByType,
  CMO_WIRES,
} from '@tomachina/core'
import type { CmoToolDomain } from '@tomachina/core'

const GOLD = '#d4a44c'
const GOLD_GLOW = 'rgba(212,164,76,0.12)'
const GREEN = '#22c55e'
const BORDER = '#1e293b'
const TEXT = '#e2e8f0'
const TEXT_MUTED = '#94a3b8'
const BG_HOVER = '#1a2236'

const DOMAINS: CmoToolDomain[] = ['canva', 'wordpress', 'veo', 'c3', 'pdf', 'drive', 'frontend-design']

export function MusashiRegistryView() {
  const totalTools = CMO_REGISTRY.length
  const tools = getCmoToolsByType('TOOL')
  const superTools = getCmoToolsByType('SUPER_TOOL')
  const wires = getCmoToolsByType('WIRE')

  return (
    <div style={{ padding: 24 }}>
      {/* Header stats */}
      <div style={{ display: 'flex', gap: 24, marginBottom: 24, flexWrap: 'wrap' }}>
        <StatCard label="Total Registry" value={totalTools} color={GOLD} />
        <StatCard label="Tools" value={tools.length} color={TEXT_MUTED} />
        <StatCard label="Super Tools" value={superTools.length} color={TEXT_MUTED} />
        <StatCard label="Wires" value={wires.length} color={GREEN} />
      </div>

      {/* Domain breakdown */}
      <h3 style={{ fontSize: '1rem', fontWeight: 600, color: GOLD, marginBottom: 12 }}>
        Domain Breakdown
      </h3>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 24, fontSize: '0.875rem' }}>
        <thead>
          <tr>
            <th style={thStyle}>Domain</th>
            <th style={thStyle}>Tools</th>
            <th style={thStyle}>Representative IDs</th>
          </tr>
        </thead>
        <tbody>
          {DOMAINS.map(domain => {
            const domainTools = getCmoToolsByDomain(domain)
            if (domainTools.length === 0) return null
            return (
              <tr key={domain}>
                <td style={tdStyle}>
                  <span style={{
                    background: GOLD_GLOW, color: GOLD, padding: '2px 10px',
                    borderRadius: 6, fontSize: '0.78rem', fontWeight: 600,
                  }}>
                    {domain}
                  </span>
                </td>
                <td style={tdStyle}>{domainTools.length}</td>
                <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: '0.78rem', color: '#06b6d4' }}>
                  {domainTools.slice(0, 3).map(t => t.id).join(', ')}
                  {domainTools.length > 3 ? ` +${domainTools.length - 3} more` : ''}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {/* Wire status */}
      <h3 style={{ fontSize: '1rem', fontWeight: 600, color: GOLD, marginBottom: 12 }}>
        Wire Status
      </h3>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
        <thead>
          <tr>
            <th style={thStyle}>Wire ID</th>
            <th style={thStyle}>Name</th>
            <th style={thStyle}>Channel</th>
            <th style={thStyle}>Steps</th>
            <th style={thStyle}>Status</th>
          </tr>
        </thead>
        <tbody>
          {CMO_WIRES.map(wire => (
            <tr key={wire.wireId}>
              <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: '0.78rem', color: '#06b6d4' }}>
                {wire.wireId}
              </td>
              <td style={tdStyle}>{wire.name}</td>
              <td style={tdStyle}>
                <span style={{
                  background: GOLD_GLOW, color: GOLD, padding: '2px 8px',
                  borderRadius: 4, fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase',
                }}>
                  {wire.channel}
                </span>
              </td>
              <td style={tdStyle}>{wire.steps.length}</td>
              <td style={tdStyle}>
                <span style={{
                  background: 'rgba(34,197,94,0.12)', color: GREEN, padding: '2px 10px',
                  borderRadius: 4, fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase',
                }}>
                  LIVE
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Shared styles ──

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{
      background: BG_HOVER, border: `1px solid ${BORDER}`, borderRadius: 8,
      padding: '14px 20px', minWidth: 120,
    }}>
      <div style={{ fontSize: '1.6rem', fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: '0.75rem', color: TEXT_MUTED, marginTop: 2 }}>{label}</div>
    </div>
  )
}

const thStyle: React.CSSProperties = {
  textAlign: 'left', padding: '10px 12px', background: BG_HOVER,
  color: GOLD, fontWeight: 600, borderBottom: `1px solid ${BORDER}`,
  fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.5px',
}

const tdStyle: React.CSSProperties = {
  padding: '10px 12px', borderBottom: `1px solid ${BORDER}`, color: TEXT_MUTED,
}
