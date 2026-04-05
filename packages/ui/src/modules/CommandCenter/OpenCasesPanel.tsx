'use client'

import { useEffect, useState } from 'react'
import { DomainBadge } from './WireExecutionLog'

// ── Types ──────────────────────────────────────────────────────────────

interface OpenCase {
  id: string
  type: string
  domain: string
  clientId?: string | null
  status: string
  created_at: string
}

const colors = {
  bgHover: '#1a2236',
  border: '#1e293b',
  text: '#e2e8f0',
  textMuted: '#94a3b8',
  blue: '#3b82f6',
  orange: '#f59e0b',
  green: '#22c55e',
}

function formatAge(isoDate: string): string {
  const ms = Date.now() - new Date(isoDate).getTime()
  const hours = Math.floor(ms / (1000 * 60 * 60))
  if (hours < 1) return '<1h'
  if (hours < 24) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
}

// ── Component ──────────────────────────────────────────────────────────

export function OpenCasesPanel() {
  const [cases, setCases] = useState<OpenCase[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchCases() {
      try {
        const res = await fetch('/api/voltron/deploy?status=open')
        if (res.status === 404 || !res.ok) {
          setCases([])
          return
        }
        const json = await res.json()
        const sessions = json.data ?? []
        setCases(sessions.map((s: Record<string, unknown>) => ({
          id: String(s.session_id ?? s.id ?? ''),
          type: s.goal ? 'Deploy' : 'Wire',
          domain: String(s.specialist_id ?? 'general'),
          clientId: s.client_id ? String(s.client_id) : null,
          status: String(s.status ?? 'open'),
          created_at: String(s.created_at ?? new Date().toISOString()),
        })))
      } catch {
        setCases([])
      } finally {
        setLoading(false)
      }
    }
    fetchCases()
  }, [])

  if (loading) {
    return (
      <div style={{ padding: 48, textAlign: 'center', color: colors.textMuted }}>
        <div style={{ fontSize: '0.85rem' }}>Loading open cases...</div>
      </div>
    )
  }

  if (cases.length === 0) {
    return (
      <div style={{ padding: 48, textAlign: 'center', color: colors.textMuted }}>
        <span className="material-symbols-outlined" style={{ fontSize: 40, opacity: 0.4, display: 'block', marginBottom: 12 }}>assignment</span>
        <p style={{ margin: 0, fontSize: '0.9rem' }}>No open cases</p>
      </div>
    )
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
        <thead>
          <tr>
            {['Type', 'Lion Domain', 'Client', 'Status', 'Age'].map(h => (
              <th key={h} style={{
                textAlign: 'left', padding: '10px 12px', background: colors.bgHover,
                color: colors.blue, fontWeight: 600, borderBottom: `1px solid ${colors.border}`,
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cases.map(c => (
            <tr key={c.id} style={{ borderBottom: `1px solid ${colors.border}` }}>
              <td style={{ padding: '10px 12px', color: colors.text }}>{c.type}</td>
              <td style={{ padding: '10px 12px' }}><DomainBadge domain={c.domain} /></td>
              <td style={{ padding: '10px 12px', color: colors.textMuted, fontFamily: 'monospace', fontSize: '0.78rem' }}>
                {c.clientId ? `...${c.clientId.slice(-4)}` : '\u2014'}
              </td>
              <td style={{ padding: '10px 12px' }}>
                <span style={{
                  padding: '2px 8px', borderRadius: 4, fontSize: '0.72rem', fontWeight: 700,
                  textTransform: 'uppercase',
                  color: c.status === 'approval_pending' ? colors.orange : colors.green,
                  background: c.status === 'approval_pending' ? `${colors.orange}20` : `${colors.green}20`,
                }}>{c.status.replace('_', ' ')}</span>
              </td>
              <td style={{ padding: '10px 12px', color: colors.textMuted, fontFamily: 'monospace' }}>
                {formatAge(c.created_at)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
