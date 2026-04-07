'use client'

import { useEffect, useState, useMemo } from 'react'
import { DomainBadge } from './WireExecutionLog'
import { authFetch } from './auth-fetch'

// ── Types ──────────────────────────────────────────────────────────────

interface RegistryEntry {
  tool_id: string
  name: string
  description: string
  type: string
  source: string
  entitlement_min: string
  domain?: string
  generated_at?: string
}

const LION_DOMAINS = ['all', 'medicare', 'annuity', 'investment', 'life-estate', 'legacy-ltc', 'general'] as const

const colors = {
  bgHover: '#1a2236',
  border: '#1e293b',
  text: '#e2e8f0',
  textMuted: '#94a3b8',
  blue: '#3b82f6',
}

// ── Component ──────────────────────────────────────────────────────────

export function RegistryBrowser() {
  const [entries, setEntries] = useState<RegistryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [domainFilter, setDomainFilter] = useState<string>('all')

  useEffect(() => {
    async function fetchRegistry() {
      try {
        const url = domainFilter !== 'all'
          ? `/api/voltron/registry?domain=${domainFilter}`
          : '/api/voltron/registry'
        const res = await authFetch(url)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = await res.json()
        setEntries(json.data?.tools ?? [])
      } catch {
        setError('Failed to load registry')
      } finally {
        setLoading(false)
      }
    }
    setLoading(true)
    fetchRegistry()
  }, [domainFilter])

  const filtered = useMemo(() => {
    if (!search.trim()) return entries
    const q = search.toLowerCase()
    return entries.filter(e =>
      e.name.toLowerCase().includes(q) ||
      e.tool_id.toLowerCase().includes(q) ||
      e.description.toLowerCase().includes(q)
    )
  }, [entries, search])

  if (loading) {
    return (
      <div style={{ padding: 48, textAlign: 'center', color: colors.textMuted }}>
        <div style={{ fontSize: '0.85rem' }}>Loading registry...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: 48, textAlign: 'center', color: colors.textMuted }}>
        <span className="material-symbols-outlined" style={{ fontSize: 40, opacity: 0.4, display: 'block', marginBottom: 12 }}>database</span>
        <p style={{ margin: 0, fontSize: '0.9rem' }}>{error}</p>
      </div>
    )
  }

  return (
    <div>
      {/* ── Controls ── */}
      <div style={{
        display: 'flex', gap: 12, padding: '16px 20px',
        borderBottom: `1px solid ${colors.border}`, flexWrap: 'wrap',
      }}>
        <input
          type="text"
          placeholder="Search tools..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            flex: 1, minWidth: 200, padding: '8px 12px', borderRadius: 6,
            border: `1px solid ${colors.border}`, background: colors.bgHover,
            color: colors.text, fontSize: '0.85rem', outline: 'none',
          }}
        />
        <select
          value={domainFilter}
          onChange={e => setDomainFilter(e.target.value)}
          style={{
            padding: '8px 12px', borderRadius: 6,
            border: `1px solid ${colors.border}`, background: colors.bgHover,
            color: colors.text, fontSize: '0.85rem', cursor: 'pointer',
          }}
        >
          {LION_DOMAINS.map(d => (
            <option key={d} value={d}>{d === 'all' ? 'All Domains' : d}</option>
          ))}
        </select>
        <span style={{ color: colors.textMuted, fontSize: '0.78rem', alignSelf: 'center' }}>
          {filtered.length} entries
        </span>
      </div>

      {/* ── Table ── */}
      {filtered.length === 0 ? (
        <div style={{ padding: 48, textAlign: 'center', color: colors.textMuted }}>
          <p style={{ margin: 0, fontSize: '0.9rem' }}>No registry entries found</p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr>
                {['Tool Name', 'Domain', 'Type', 'Entitlement'].map(h => (
                  <th key={h} style={{
                    textAlign: 'left', padding: '10px 12px', background: colors.bgHover,
                    color: colors.blue, fontWeight: 600, borderBottom: `1px solid ${colors.border}`,
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 200).map(e => (
                <tr key={e.tool_id} style={{ borderBottom: `1px solid ${colors.border}` }}>
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ color: colors.text, fontWeight: 500 }}>{e.name}</div>
                    <div style={{ color: colors.textMuted, fontSize: '0.75rem', marginTop: 2 }}>{e.description}</div>
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <DomainBadge domain={e.domain ?? 'general'} />
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{
                      padding: '2px 8px', borderRadius: 4, fontSize: '0.72rem',
                      fontWeight: 700, textTransform: 'uppercase',
                      color: colors.blue, background: `${colors.blue}15`,
                    }}>{e.type}</span>
                  </td>
                  <td style={{ padding: '10px 12px', color: colors.textMuted, fontSize: '0.78rem' }}>
                    {e.entitlement_min}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length > 200 && (
            <div style={{ padding: 12, textAlign: 'center', color: colors.textMuted, fontSize: '0.78rem' }}>
              Showing 200 of {filtered.length} entries
            </div>
          )}
        </div>
      )}
    </div>
  )
}
