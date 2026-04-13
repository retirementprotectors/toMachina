'use client'

import { useEffect, useState } from 'react'
import { authFetch } from './auth-fetch'

// ── Types ──────────────────────────────────────────────────────────────

interface LionSpec {
  id: string
  specialist_name: string
  display_name: string
  icon: string
  routing_keywords: string[]
  required_level: number
}

const LION_DOMAINS = [
  { domain: 'medicare', label: 'Medicare Lion', color: '#3b82f6' },
  { domain: 'annuity', label: 'Annuity Lion', color: '#d4a44c' },
  { domain: 'investment', label: 'Investment Lion', color: '#06b6d4' },
  { domain: 'life-estate', label: 'Life & Estate Lion', color: '#22c55e' },
  { domain: 'legacy-ltc', label: 'Legacy/LTC Lion', color: '#a855f7' },
]

const colors = {
  bgHover: '#1a2236',
  border: '#1e293b',
  text: '#e2e8f0',
  textMuted: '#94a3b8',
  green: '#22c55e',
  red: '#ef4444',
}

// ── Component ──────────────────────────────────────────────────────────

export function LionStatusPanel() {
  const [specs, setSpecs] = useState<LionSpec[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchSpecs() {
      try {
        const res = await authFetch('/api/mdj/specialists')
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = await res.json()
        setSpecs(json.data ?? [])
      } catch {
        setError('Could not load specialist configs')
      } finally {
        setLoading(false)
      }
    }
    fetchSpecs()
  }, [])

  if (loading) {
    return (
      <div style={{ padding: 48, textAlign: 'center', color: colors.textMuted }}>
        <div style={{ fontSize: '0.85rem' }}>Loading Lion status...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: 48, textAlign: 'center', color: colors.textMuted }}>
        <span className="material-symbols-outlined" style={{ fontSize: 40, opacity: 0.4, display: 'block', marginBottom: 12 }}>pets</span>
        <p style={{ margin: 0, fontSize: '0.9rem' }}>{error}</p>
      </div>
    )
  }

  return (
    <div style={{ padding: 20, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
      {LION_DOMAINS.map(lion => {
        const spec = specs.find(s =>
          s.specialist_name?.toLowerCase().includes(lion.domain.split('-')[0])
        )
        const configured = !!spec

        return (
          <div key={lion.domain} style={{
            background: colors.bgHover, border: `1px solid ${colors.border}`,
            borderRadius: 10, padding: 16, borderLeft: `3px solid ${lion.color}`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <span style={{ fontSize: 24 }}>🦁</span>
              <div>
                <div style={{ fontWeight: 700, color: colors.text, fontSize: '0.9rem' }}>{lion.label}</div>
                <div style={{ fontSize: '0.75rem', color: colors.textMuted, fontFamily: 'monospace' }}>{lion.domain}</div>
              </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, fontSize: '0.78rem' }}>
              <span style={{
                padding: '2px 8px', borderRadius: 4, fontWeight: 700,
                color: configured ? colors.green : colors.red,
                background: configured ? `${colors.green}15` : `${colors.red}15`,
              }}>
                {configured ? 'Configured' : 'Not configured'}
              </span>
              {spec && (
                <span style={{ padding: '2px 8px', borderRadius: 4, color: colors.textMuted, background: `${colors.textMuted}15` }}>
                  {spec.display_name}
                </span>
              )}
            </div>
            {spec?.routing_keywords && spec.routing_keywords.length > 0 && (
              <div style={{ marginTop: 8, fontSize: '0.72rem', color: colors.textMuted }}>
                Keywords: {spec.routing_keywords.slice(0, 5).join(', ')}
                {spec.routing_keywords.length > 5 && ` +${spec.routing_keywords.length - 5}`}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
