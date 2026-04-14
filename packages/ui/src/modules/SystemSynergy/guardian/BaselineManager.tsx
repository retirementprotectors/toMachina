'use client'

import { useState, useEffect, useCallback } from 'react'
import { fetchValidated } from '../../fetchValidated'
import { useToast } from '../../../components/Toast'

/* ─── Types ─── */
interface CollectionCount {
  collection: string
  count: number
}

interface Baseline {
  id: string
  timestamp: string
  collections: CollectionCount[]
  triggered_by: string
  total_docs: number
}

interface BaselineDelta {
  collection: string
  before: number
  after: number
  delta: number
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
function formatTimestamp(ts: string | null | undefined): string {
  if (!ts) return '--'
  try {
    return new Date(ts).toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
    })
  } catch { return '--' }
}

function Icon({ name, size = 18, color }: { name: string; size?: number; color?: string }) {
  return <span className="material-icons-outlined" style={{ fontSize: size, color }}>{name}</span>
}

/* ─── Component ─── */
export function BaselineManager() {
  const { showToast } = useToast()
  const [baselines, setBaselines] = useState<Baseline[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [compareA, setCompareA] = useState<string>('')
  const [compareB, setCompareB] = useState<string>('')
  const [deltas, setDeltas] = useState<BaselineDelta[] | null>(null)

  const fetchBaselines = useCallback(async () => {
    try {
      setLoading(true)
      const result = await fetchValidated<Baseline[]>('/api/guardian/baselines')
      if (result.success && result.data) {
        setBaselines(Array.isArray(result.data) ? result.data : [])
      }
    } catch {
      showToast('Failed to load baselines', 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => { fetchBaselines() }, [fetchBaselines])

  const handleCreate = useCallback(async () => {
    try {
      setCreating(true)
      const result = await fetchValidated('/api/guardian/baselines', {
        method: 'POST',
        body: JSON.stringify({}),
      })
      if (!result.success) throw new Error(result.error ?? 'Failed to create baseline')
      showToast('Baseline snapshot created', 'success')
      await fetchBaselines()
    } catch {
      showToast('Failed to create baseline', 'error')
    } finally {
      setCreating(false)
    }
  }, [showToast, fetchBaselines])

  const handleCompare = useCallback(() => {
    if (!compareA || !compareB) {
      showToast('Select two baselines to compare', 'warning')
      return
    }
    const baseA = baselines.find((b) => b.id === compareA)
    const baseB = baselines.find((b) => b.id === compareB)
    if (!baseA || !baseB) return

    const allCollections = new Set([
      ...baseA.collections.map((c) => c.collection),
      ...baseB.collections.map((c) => c.collection),
    ])

    const results: BaselineDelta[] = [...allCollections].sort().map((collection) => {
      const before = baseA.collections.find((c) => c.collection === collection)?.count ?? 0
      const after = baseB.collections.find((c) => c.collection === collection)?.count ?? 0
      return { collection, before, after, delta: after - before }
    })

    setDeltas(results)
  }, [compareA, compareB, baselines, showToast])

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 48, color: s.textMuted }}>
        <Icon name="hourglass_empty" size={24} /> <span style={{ marginLeft: 8 }}>Loading baselines...</span>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Actions Bar */}
      <div style={{
        display: 'flex',
        gap: 10,
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
      }}>
        <button
          onClick={handleCreate}
          disabled={creating}
          style={{
            padding: '8px 18px',
            borderRadius: 8,
            border: 'none',
            background: s.guardian,
            color: '#fff',
            fontSize: 13,
            fontWeight: 700,
            cursor: creating ? 'wait' : 'pointer',
            opacity: creating ? 0.6 : 1,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <Icon name="add_circle" size={16} color="#fff" />
          {creating ? 'Creating...' : 'Create Baseline'}
        </button>

        {/* Compare Controls */}
        {baselines.length >= 2 && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select
              value={compareA}
              onChange={(e) => { setCompareA(e.target.value); setDeltas(null) }}
              style={{
                background: s.surface,
                border: `1px solid ${s.border}`,
                borderRadius: 6,
                padding: '6px 10px',
                color: s.text,
                fontSize: 12,
              }}
            >
              <option value="">Baseline A</option>
              {baselines.map((b) => (
                <option key={b.id} value={b.id}>{formatTimestamp(b.timestamp)}</option>
              ))}
            </select>
            <span style={{ color: s.textMuted, fontSize: 12 }}>vs</span>
            <select
              value={compareB}
              onChange={(e) => { setCompareB(e.target.value); setDeltas(null) }}
              style={{
                background: s.surface,
                border: `1px solid ${s.border}`,
                borderRadius: 6,
                padding: '6px 10px',
                color: s.text,
                fontSize: 12,
              }}
            >
              <option value="">Baseline B</option>
              {baselines.map((b) => (
                <option key={b.id} value={b.id}>{formatTimestamp(b.timestamp)}</option>
              ))}
            </select>
            <button
              onClick={handleCompare}
              disabled={!compareA || !compareB}
              style={{
                padding: '6px 14px',
                borderRadius: 6,
                border: `1px solid ${s.border}`,
                background: s.hover,
                color: s.text,
                fontSize: 12,
                fontWeight: 600,
                cursor: !compareA || !compareB ? 'not-allowed' : 'pointer',
                opacity: !compareA || !compareB ? 0.5 : 1,
              }}
            >
              Compare
            </button>
          </div>
        )}
      </div>

      {/* Comparison Results */}
      {deltas && (
        <div style={{
          background: s.surface,
          border: `1px solid ${s.guardian}`,
          borderRadius: 10,
          padding: 16,
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: s.guardian, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icon name="compare_arrows" size={18} color={s.guardian} />
            Baseline Comparison
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {/* Header */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 80px 80px 80px',
              gap: 8,
              padding: '6px 12px',
              fontSize: 11,
              fontWeight: 700,
              color: s.textMuted,
              letterSpacing: '0.05em',
            }}>
              <span>COLLECTION</span>
              <span style={{ textAlign: 'right' }}>BEFORE</span>
              <span style={{ textAlign: 'right' }}>AFTER</span>
              <span style={{ textAlign: 'right' }}>DELTA</span>
            </div>
            {deltas.map((d) => (
              <div key={d.collection} style={{
                display: 'grid',
                gridTemplateColumns: '1fr 80px 80px 80px',
                gap: 8,
                padding: '8px 12px',
                background: s.bg,
                borderRadius: 6,
                fontSize: 12,
              }}>
                <span style={{ color: s.text, fontWeight: 600 }}>{d.collection}</span>
                <span style={{ textAlign: 'right', color: s.textSecondary }}>{d.before.toLocaleString()}</span>
                <span style={{ textAlign: 'right', color: s.textSecondary }}>{d.after.toLocaleString()}</span>
                <span style={{
                  textAlign: 'right',
                  fontWeight: 700,
                  color: d.delta > 0 ? s.green : d.delta < 0 ? s.red : s.textMuted,
                }}>
                  {d.delta > 0 ? '+' : ''}{d.delta.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Baselines List */}
      {baselines.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, color: s.textMuted }}>
          <Icon name="inventory_2" size={32} />
          <p style={{ marginTop: 8 }}>No baselines yet. Create one to start tracking collection snapshots.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {baselines.map((baseline) => (
            <div key={baseline.id} style={{
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              padding: '14px 18px',
              background: s.surface,
              border: `1px solid ${s.border}`,
              borderRadius: 8,
            }}>
              <Icon name="save" size={18} color={s.guardian} />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: s.text }}>
                  {formatTimestamp(baseline.timestamp)}
                </span>
                <span style={{ fontSize: 11, color: s.textMuted }}>
                  {baseline.collections.length} collections &middot; {baseline.total_docs.toLocaleString()} total docs &middot; by {baseline.triggered_by}
                </span>
              </div>
              {/* Mini collection chips */}
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', maxWidth: 300 }}>
                {baseline.collections.slice(0, 5).map((c) => (
                  <span key={c.collection} style={{
                    padding: '2px 6px',
                    borderRadius: 4,
                    fontSize: 10,
                    background: s.guardianGlow,
                    color: s.guardian,
                    fontWeight: 600,
                  }}>
                    {c.collection}: {c.count.toLocaleString()}
                  </span>
                ))}
                {baseline.collections.length > 5 && (
                  <span style={{ fontSize: 10, color: s.textMuted, padding: '2px 4px' }}>
                    +{baseline.collections.length - 5} more
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
