'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { fetchWithAuth } from '../fetchWithAuth'
import { useToast } from '../../components/Toast'

/* ─── Types ─── */
interface WriteEntry {
  id: string
  collection: string
  operation: 'create' | 'update' | 'delete' | 'bulk'
  status: 'pass' | 'block' | 'warn' | 'bulk'
  detail: string
  fields_validated: number
  fields_failed: number
  blocked_reason?: string
  timestamp: string
  user_email?: string
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

const STATUS_BADGES: Record<string, { color: string; bg: string; label: string }> = {
  pass:  { color: s.green,  bg: s.greenBg,  label: 'PASS' },
  block: { color: s.red,    bg: s.redBg,    label: 'BLOCK' },
  warn:  { color: s.yellow, bg: s.yellowBg, label: 'WARN' },
  bulk:  { color: s.blue,   bg: s.blueBg,   label: 'BULK' },
}

/* ─── Helpers ─── */
function formatTimestamp(ts: string | null | undefined): string {
  if (!ts) return '--'
  try {
    return new Date(ts).toLocaleString('en-US', {
      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit',
    })
  } catch { return '--' }
}

function Icon({ name, size = 18, color }: { name: string; size?: number; color?: string }) {
  return <span className="material-icons-outlined" style={{ fontSize: size, color }}>{name}</span>
}

/* ─── Sub-components ─── */
function FilterSelect({ value, onChange, options, placeholder }: {
  value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; placeholder: string
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        background: s.surface,
        border: `1px solid ${s.border}`,
        borderRadius: 6,
        padding: '6px 10px',
        color: s.text,
        fontSize: 12,
        minWidth: 120,
      }}
    >
      <option value="">{placeholder}</option>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}

/* ─── Component ─── */
export function WriteGateConsole() {
  const { showToast } = useToast()
  const [entries, setEntries] = useState<WriteEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [collectionFilter, setCollectionFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [timeRange, setTimeRange] = useState('24h')
  const scrollRef = useRef<HTMLDivElement>(null)

  const fetchWrites = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (collectionFilter) params.set('collection', collectionFilter)
      if (statusFilter) params.set('status', statusFilter)
      if (timeRange) params.set('range', timeRange)
      const url = `/api/guardian/writes${params.toString() ? '?' + params.toString() : ''}`
      const res = await fetchWithAuth(url)
      if (!res.ok) throw new Error('Failed to fetch writes')
      const json = await res.json() as { success: boolean; data?: WriteEntry[] }
      if (json.success && json.data) {
        setEntries(json.data)
      }
    } catch {
      showToast('Failed to load write log', 'error')
    } finally {
      setLoading(false)
    }
  }, [collectionFilter, statusFilter, timeRange, showToast])

  useEffect(() => { fetchWrites() }, [fetchWrites])

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(fetchWrites, 30000)
    return () => clearInterval(interval)
  }, [fetchWrites])

  const collections = [...new Set(entries.map((e) => e.collection))].sort()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Filter Bar */}
      <div style={{
        display: 'flex',
        gap: 10,
        alignItems: 'center',
        flexWrap: 'wrap',
        padding: '12px 16px',
        background: s.surface,
        borderRadius: 8,
        border: `1px solid ${s.border}`,
      }}>
        <Icon name="filter_list" size={16} color={s.textMuted} />
        <FilterSelect
          value={collectionFilter}
          onChange={setCollectionFilter}
          options={collections.map((c) => ({ value: c, label: c }))}
          placeholder="All Collections"
        />
        <FilterSelect
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: 'pass', label: 'Pass' },
            { value: 'block', label: 'Block' },
            { value: 'warn', label: 'Warn' },
            { value: 'bulk', label: 'Bulk' },
          ]}
          placeholder="All Statuses"
        />
        <FilterSelect
          value={timeRange}
          onChange={setTimeRange}
          options={[
            { value: '1h', label: 'Last Hour' },
            { value: '24h', label: 'Last 24 Hours' },
            { value: '7d', label: 'Last 7 Days' },
            { value: '30d', label: 'Last 30 Days' },
          ]}
          placeholder="Time Range"
        />
        <div style={{ marginLeft: 'auto', fontSize: 11, color: s.textMuted, display: 'flex', alignItems: 'center', gap: 4 }}>
          <Icon name="autorenew" size={14} color={s.textMuted} />
          Auto-refresh: 30s
        </div>
      </div>

      {/* Log */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48, color: s.textMuted }}>
          <Icon name="hourglass_empty" size={24} /> <span style={{ marginLeft: 8 }}>Loading write log...</span>
        </div>
      ) : entries.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, color: s.textMuted }}>
          <Icon name="info" size={32} />
          <p style={{ marginTop: 8 }}>No write events found for the selected filters.</p>
        </div>
      ) : (
        <div
          ref={scrollRef}
          style={{
            maxHeight: 520,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            background: s.surface,
            borderRadius: 8,
            border: `1px solid ${s.border}`,
            padding: 8,
          }}
        >
          {entries.map((entry) => {
            const badge = STATUS_BADGES[entry.status] ?? STATUS_BADGES.pass
            return (
              <div
                key={entry.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 12px',
                  borderRadius: 6,
                  background: s.bg,
                  border: `1px solid ${s.border}`,
                }}
              >
                {/* Status Badge */}
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '2px 8px',
                  borderRadius: 4,
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.05em',
                  color: badge.color,
                  background: badge.bg,
                  minWidth: 48,
                  justifyContent: 'center',
                }}>
                  {badge.label}
                </span>

                {/* Collection */}
                <span style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: s.guardian,
                  minWidth: 80,
                }}>
                  {entry.collection}
                </span>

                {/* Detail */}
                <span style={{ fontSize: 12, color: s.text, flex: 1 }}>
                  {entry.detail}
                  {entry.blocked_reason && (
                    <span style={{ color: s.red, marginLeft: 8, fontSize: 11 }}>
                      [{entry.blocked_reason}]
                    </span>
                  )}
                </span>

                {/* Timestamp */}
                <span style={{ fontSize: 11, color: s.textMuted, whiteSpace: 'nowrap' }}>
                  {formatTimestamp(entry.timestamp)}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
