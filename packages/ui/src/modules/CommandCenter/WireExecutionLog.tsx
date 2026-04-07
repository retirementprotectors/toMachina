'use client'

import { useEffect, useState } from 'react'
import { authFetch } from './auth-fetch'

// ── Types ──────────────────────────────────────────────────────────────

interface WireLogEntry {
  id: string
  timestamp: string
  toolName: string
  lion: string
  status: 'success' | 'error' | 'pending'
  clientId?: string | null
  errorMessage?: string | null
}

const colors = {
  bgHover: '#1a2236',
  border: '#1e293b',
  text: '#e2e8f0',
  textMuted: '#94a3b8',
  blue: '#3b82f6',
  green: '#22c55e',
  red: '#ef4444',
  orange: '#f59e0b',
}

const STATUS_COLORS: Record<string, string> = {
  success: colors.green,
  error: colors.red,
  pending: colors.orange,
}

// ── Domain Badge (shared) ──────────────────────────────────────────────

const DOMAIN_COLORS: Record<string, string> = {
  medicare: '#3b82f6',
  annuity: '#d4a44c',
  investment: '#06b6d4',
  'life-estate': '#22c55e',
  'legacy-ltc': '#a855f7',
  general: '#94a3b8',
}

export function DomainBadge({ domain }: { domain: string }) {
  const color = DOMAIN_COLORS[domain] ?? DOMAIN_COLORS.general
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 4,
      fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase',
      color, background: `${color}20`, border: `1px solid ${color}30`,
    }}>{domain}</span>
  )
}

// ── Component ──────────────────────────────────────────────────────────

export function WireExecutionLog() {
  const [entries, setEntries] = useState<WireLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchLog() {
      try {
        const res = await authFetch('/api/voltron-wire/log')
        if (res.status === 404) {
          setEntries([])
          setLoading(false)
          return
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = await res.json()
        setEntries(json.data ?? [])
      } catch {
        setError('Wire log coming soon')
      } finally {
        setLoading(false)
      }
    }
    fetchLog()
  }, [])

  if (loading) {
    return (
      <div style={{ padding: 48, textAlign: 'center', color: colors.textMuted }}>
        <div style={{ fontSize: '0.85rem' }}>Loading wire log...</div>
      </div>
    )
  }

  if (error || entries.length === 0) {
    return (
      <div style={{ padding: 48, textAlign: 'center', color: colors.textMuted }}>
        <span className="material-symbols-outlined" style={{ fontSize: 40, opacity: 0.4, display: 'block', marginBottom: 12 }}>receipt_long</span>
        <p style={{ margin: 0, fontSize: '0.9rem' }}>{error ?? 'No wires executed yet'}</p>
      </div>
    )
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
        <thead>
          <tr>
            {['Timestamp', 'Tool', 'Lion', 'Status', 'Client'].map(h => (
              <th key={h} style={{
                textAlign: 'left', padding: '10px 12px', background: colors.bgHover,
                color: colors.blue, fontWeight: 600, borderBottom: `1px solid ${colors.border}`,
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {entries.map(e => (
            <tr key={e.id} style={{ borderBottom: `1px solid ${colors.border}` }}>
              <td style={{ padding: '10px 12px', color: colors.textMuted, fontFamily: 'monospace', fontSize: '0.78rem' }}>
                {new Date(e.timestamp).toLocaleString()}
              </td>
              <td style={{ padding: '10px 12px', color: colors.text }}>{e.toolName}</td>
              <td style={{ padding: '10px 12px' }}><DomainBadge domain={e.lion} /></td>
              <td style={{ padding: '10px 12px' }}>
                <span style={{
                  display: 'inline-block', padding: '2px 8px', borderRadius: 4,
                  fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase',
                  color: STATUS_COLORS[e.status] ?? colors.textMuted,
                  background: `${STATUS_COLORS[e.status] ?? colors.textMuted}20`,
                }}>{e.status}</span>
              </td>
              <td style={{ padding: '10px 12px', color: colors.textMuted, fontFamily: 'monospace', fontSize: '0.78rem' }}>
                {e.clientId ? `...${e.clientId.slice(-4)}` : '\u2014'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
