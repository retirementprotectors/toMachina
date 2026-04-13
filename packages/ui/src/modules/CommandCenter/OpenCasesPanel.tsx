'use client'

import { useEffect, useState } from 'react'
import { DomainBadge } from './WireExecutionLog'
import type { CaseStatus, IntakeChannel } from '@tomachina/core'
import { authFetch } from './auth-fetch'

// ── Types ──────────────────────────────────────────────────────────────

interface CaseEntry {
  case_id: string
  client_id: string
  client_name: string
  wire_name: string
  lion_domain: string
  agent_id: string
  status: CaseStatus
  intake_channel: IntakeChannel
  outcome: string | null
  created_at: string
  updated_at: string
}

const colors = {
  bgHover: '#1a2236',
  border: '#1e293b',
  text: '#e2e8f0',
  textMuted: '#94a3b8',
  blue: '#3b82f6',
  orange: '#f59e0b',
  green: '#22c55e',
  cyan: '#06b6d4',
  purple: '#a855f7',
  red: '#ef4444',
}

const STATUS_COLORS: Record<string, string> = {
  intake: colors.blue,
  wire_running: colors.orange,
  output_ready: colors.cyan,
  agent_review: colors.purple,
  resolved: colors.green,
}

const CHANNEL_LABELS: Record<string, string> = {
  mdj_panel: 'MDJ',
  slack: 'Slack',
  email: 'Email',
  command_center: 'CC',
}

function formatAge(isoDate: string): string {
  const ms = Date.now() - new Date(isoDate).getTime()
  const hours = Math.floor(ms / (1000 * 60 * 60))
  if (hours < 1) return '<1h'
  if (hours < 24) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
}

// ── Filter Bar ────────────────────────────────────────────────────────

function FilterBar({ statusFilter, onStatusChange }: {
  statusFilter: string
  onStatusChange: (v: string) => void
}) {
  const statuses = ['all', 'intake', 'wire_running', 'output_ready', 'agent_review', 'resolved']
  return (
    <div style={{ display: 'flex', gap: 6, padding: '12px 16px', borderBottom: `1px solid ${colors.border}`, overflowX: 'auto' }}>
      {statuses.map(s => (
        <button
          key={s}
          onClick={() => onStatusChange(s)}
          style={{
            padding: '4px 12px',
            borderRadius: 4,
            border: `1px solid ${s === statusFilter ? colors.blue : colors.border}`,
            background: s === statusFilter ? `${colors.blue}20` : 'transparent',
            color: s === statusFilter ? colors.blue : colors.textMuted,
            fontSize: '0.72rem',
            fontWeight: 600,
            textTransform: 'uppercase' as const,
            cursor: 'pointer',
            whiteSpace: 'nowrap' as const,
          }}
        >
          {s === 'all' ? 'All' : s.replace('_', ' ')}
        </button>
      ))}
    </div>
  )
}

// ── Component ──────────────────────────────────────────────────────────

export function OpenCasesPanel() {
  const [cases, setCases] = useState<CaseEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')

  useEffect(() => {
    async function fetchCases() {
      try {
        const params = new URLSearchParams()
        if (statusFilter !== 'all') params.set('status', statusFilter)
        params.set('limit', '100')

        const res = await authFetch(`/api/voltron/cases?${params}`)
        if (!res.ok) {
          setCases([])
          return
        }
        const json = await res.json()
        setCases(json.data ?? [])
      } catch {
        setCases([])
      } finally {
        setLoading(false)
      }
    }
    setLoading(true)
    fetchCases()
  }, [statusFilter])

  if (loading) {
    return (
      <div>
        <FilterBar statusFilter={statusFilter} onStatusChange={setStatusFilter} />
        <div style={{ padding: 48, textAlign: 'center', color: colors.textMuted }}>
          <div style={{ fontSize: '0.85rem' }}>Loading cases...</div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <FilterBar statusFilter={statusFilter} onStatusChange={setStatusFilter} />
      {cases.length === 0 ? (
        <div style={{ padding: 48, textAlign: 'center', color: colors.textMuted }}>
          <span className="material-symbols-outlined" style={{ fontSize: 40, opacity: 0.4, display: 'block', marginBottom: 12 }}>assignment</span>
          <p style={{ margin: 0, fontSize: '0.9rem' }}>
            {statusFilter === 'all' ? 'No cases yet' : `No ${statusFilter.replace('_', ' ')} cases`}
          </p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr>
                {['Wire', 'Lion', 'Client', 'Status', 'Channel', 'Agent', 'Age'].map(h => (
                  <th key={h} style={{
                    textAlign: 'left', padding: '10px 12px', background: colors.bgHover,
                    color: colors.blue, fontWeight: 600, borderBottom: `1px solid ${colors.border}`,
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cases.map(c => (
                <tr key={c.case_id} style={{ borderBottom: `1px solid ${colors.border}` }}>
                  <td style={{ padding: '10px 12px', color: colors.text, fontFamily: 'monospace', fontSize: '0.78rem' }}>
                    {c.wire_name}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <DomainBadge domain={c.lion_domain} />
                  </td>
                  <td style={{ padding: '10px 12px', color: colors.textMuted, fontSize: '0.82rem' }}>
                    {c.client_name || (c.client_id ? `...${c.client_id.slice(-6)}` : '\u2014')}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{
                      padding: '2px 8px', borderRadius: 4, fontSize: '0.72rem', fontWeight: 700,
                      textTransform: 'uppercase' as const,
                      color: STATUS_COLORS[c.status] || colors.textMuted,
                      background: `${STATUS_COLORS[c.status] || colors.textMuted}20`,
                    }}>
                      {c.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px', fontSize: '0.75rem', color: colors.textMuted }}>
                    {CHANNEL_LABELS[c.intake_channel] || c.intake_channel}
                  </td>
                  <td style={{ padding: '10px 12px', fontSize: '0.75rem', color: colors.textMuted }}>
                    {c.agent_id ? c.agent_id.split('@')[0] : '\u2014'}
                  </td>
                  <td style={{ padding: '10px 12px', color: colors.textMuted, fontFamily: 'monospace' }}>
                    {formatAge(c.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
