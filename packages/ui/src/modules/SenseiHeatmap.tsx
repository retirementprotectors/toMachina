'use client'

import { useState, useEffect, useCallback } from 'react'
import { fetchValidated } from './fetchValidated'

/* ─── Types (mirror API DTOs) ─── */

type Period = '7d' | '30d' | '90d'

interface ModuleRow {
  rank?: number
  module_id: string
  module_label: string
  total: number
  train_response: number
  voltron_query: number
  popup_view: number
}

interface HeatmapData {
  period: Period
  modules: ModuleRow[]
}

/* ─── Helpers ─── */

const PERIOD_LABELS: Record<Period, string> = {
  '7d': '7 Days',
  '30d': '30 Days',
  '90d': '90 Days',
}

const EVENT_COLORS: Record<string, string> = {
  train_response: '#f59e0b', // amber — RAIDEN TRAIN
  voltron_query: '#8b5cf6',  // violet — VOLTRON
  popup_view: '#06b6d4',     // cyan — SENSEI Mode
}

const EVENT_LABELS: Record<string, string> = {
  train_response: 'RAIDEN TRAIN',
  voltron_query: 'VOLTRON Query',
  popup_view: 'Popup View',
}

function pct(value: number, total: number): string {
  if (total === 0) return '0'
  return Math.round((value / total) * 100).toString()
}

/* ─── Component ─── */

interface SenseiHeatmapProps {
  portal: string
}

export function SenseiHeatmap({ portal: _portal }: SenseiHeatmapProps) {
  const [period, setPeriod] = useState<Period>('7d')
  const [topModules, setTopModules] = useState<ModuleRow[]>([])
  const [allModules, setAllModules] = useState<ModuleRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadData = useCallback(async (p: Period) => {
    setLoading(true)
    setError(null)

    const [topRes, heatmapRes] = await Promise.all([
      fetchValidated<HeatmapData>(`/api/sensei/analytics/top?period=${p}`),
      fetchValidated<HeatmapData>(`/api/sensei/analytics/heatmap?period=${p}`),
    ])

    if (!topRes.success || !heatmapRes.success) {
      setError(topRes.error || heatmapRes.error || 'Failed to load analytics')
      setLoading(false)
      return
    }

    setTopModules(topRes.data?.modules ?? [])
    setAllModules(heatmapRes.data?.modules ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    loadData(period)
  }, [period, loadData])

  const grandTotal = allModules.reduce((s, m) => s + m.total, 0)

  return (
    <div style={{ padding: '1.5rem', maxWidth: 960, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>SENSEI Heat Map</h1>
          <p style={{ margin: '0.25rem 0 0', opacity: 0.6, fontSize: '0.875rem' }}>
            Training engagement by module — top queries across RAIDEN, VOLTRON &amp; SENSEI Mode
          </p>
        </div>

        {/* Period selector */}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {(['7d', '30d', '90d'] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              style={{
                padding: '0.375rem 0.75rem',
                borderRadius: '0.375rem',
                border: '1px solid',
                borderColor: p === period ? '#f59e0b' : 'rgba(255,255,255,0.15)',
                background: p === period ? 'rgba(245,158,11,0.15)' : 'transparent',
                color: p === period ? '#f59e0b' : 'inherit',
                cursor: 'pointer',
                fontSize: '0.8125rem',
                fontWeight: p === period ? 600 : 400,
              }}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: '1.25rem', marginBottom: '1.25rem', fontSize: '0.8125rem' }}>
        {Object.entries(EVENT_LABELS).map(([key, label]) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
            <span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: 3, background: EVENT_COLORS[key] }} />
            {label}
          </div>
        ))}
      </div>

      {/* Loading / Error */}
      {loading && <p style={{ textAlign: 'center', padding: '2rem 0', opacity: 0.5 }}>Loading analytics…</p>}
      {error && <p style={{ textAlign: 'center', padding: '2rem 0', color: '#ef4444' }}>{error}</p>}

      {/* Top-10 ranking */}
      {!loading && !error && (
        <>
          <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.75rem' }}>
            Top 10 Most-Queried Modules
          </h2>

          {topModules.length === 0 ? (
            <div style={{
              padding: '2rem',
              textAlign: 'center',
              border: '1px dashed rgba(255,255,255,0.15)',
              borderRadius: '0.5rem',
              opacity: 0.5,
            }}>
              No training events recorded yet. Data will populate after SENSEI is active for 1 week.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '2rem' }}>
              {topModules.map((mod, idx) => {
                const maxTotal = topModules[0]?.total || 1
                return (
                  <div
                    key={mod.module_id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '2rem 1fr auto',
                      alignItems: 'center',
                      gap: '0.75rem',
                      padding: '0.625rem 0.75rem',
                      borderRadius: '0.375rem',
                      background: 'rgba(255,255,255,0.04)',
                    }}
                  >
                    {/* Rank */}
                    <span style={{ fontWeight: 700, fontSize: '0.875rem', opacity: 0.5, textAlign: 'center' }}>
                      {idx + 1}
                    </span>

                    {/* Module + bar */}
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.25rem' }}>
                        {mod.module_label}
                      </div>
                      {/* Stacked bar */}
                      <div style={{ display: 'flex', height: 6, borderRadius: 3, overflow: 'hidden', background: 'rgba(255,255,255,0.08)', width: `${Math.max((mod.total / maxTotal) * 100, 4)}%` }}>
                        {mod.train_response > 0 && (
                          <div style={{ width: `${pct(mod.train_response, mod.total)}%`, background: EVENT_COLORS.train_response }} />
                        )}
                        {mod.voltron_query > 0 && (
                          <div style={{ width: `${pct(mod.voltron_query, mod.total)}%`, background: EVENT_COLORS.voltron_query }} />
                        )}
                        {mod.popup_view > 0 && (
                          <div style={{ width: `${pct(mod.popup_view, mod.total)}%`, background: EVENT_COLORS.popup_view }} />
                        )}
                      </div>
                    </div>

                    {/* Count */}
                    <span style={{ fontWeight: 700, fontSize: '0.875rem', fontVariantNumeric: 'tabular-nums' }}>
                      {mod.total}
                    </span>
                  </div>
                )
              })}
            </div>
          )}

          {/* Full heatmap table */}
          {allModules.length > 0 && (
            <>
              <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.75rem' }}>
                All Module Engagement ({PERIOD_LABELS[period]})
              </h2>

              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                    <th style={{ textAlign: 'left', padding: '0.5rem 0.75rem', fontWeight: 600 }}>Module</th>
                    <th style={{ textAlign: 'right', padding: '0.5rem 0.75rem', fontWeight: 600, color: EVENT_COLORS.train_response }}>RAIDEN</th>
                    <th style={{ textAlign: 'right', padding: '0.5rem 0.75rem', fontWeight: 600, color: EVENT_COLORS.voltron_query }}>VOLTRON</th>
                    <th style={{ textAlign: 'right', padding: '0.5rem 0.75rem', fontWeight: 600, color: EVENT_COLORS.popup_view }}>Popup</th>
                    <th style={{ textAlign: 'right', padding: '0.5rem 0.75rem', fontWeight: 600 }}>Total</th>
                    <th style={{ textAlign: 'right', padding: '0.5rem 0.75rem', fontWeight: 600 }}>% Share</th>
                  </tr>
                </thead>
                <tbody>
                  {allModules.map((mod) => (
                    <tr key={mod.module_id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '0.5rem 0.75rem', fontWeight: 500 }}>{mod.module_label}</td>
                      <td style={{ textAlign: 'right', padding: '0.5rem 0.75rem', fontVariantNumeric: 'tabular-nums' }}>{mod.train_response}</td>
                      <td style={{ textAlign: 'right', padding: '0.5rem 0.75rem', fontVariantNumeric: 'tabular-nums' }}>{mod.voltron_query}</td>
                      <td style={{ textAlign: 'right', padding: '0.5rem 0.75rem', fontVariantNumeric: 'tabular-nums' }}>{mod.popup_view}</td>
                      <td style={{ textAlign: 'right', padding: '0.5rem 0.75rem', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{mod.total}</td>
                      <td style={{ textAlign: 'right', padding: '0.5rem 0.75rem', fontVariantNumeric: 'tabular-nums', opacity: 0.6 }}>{pct(mod.total, grandTotal)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </>
      )}
    </div>
  )
}
