'use client'

/**
 * MUS-O13 — Mesh View Live
 *
 * Shows the 3 active Artisans with config from CMO_ARTISANS (static import)
 * and health metrics fetched from /api/cmo/pipeline/history.
 *
 * Artisan list is static — no API call needed.
 * Health is computed client-side from last 5 jobs per artisan.
 */
import { useState, useEffect } from 'react'
import { CMO_ARTISANS } from '@tomachina/core'
import type { CmoArtisan } from '@tomachina/core'

const GOLD = '#d4a44c'
const GOLD_GLOW = 'rgba(212,164,76,0.12)'
const GREEN = '#22c55e'
const RED = '#ef4444'
const BORDER = '#1e293b'
const TEXT = '#e2e8f0'
const TEXT_MUTED = '#94a3b8'
const BG_HOVER = '#1a2236'
const GREY = '#475569'

interface PipelineJob {
  id: string
  jobs?: Array<{ artisanId: string; status: string; completedAt?: string }>
  completedAt?: string
}

interface ArtisanHealth {
  lastResult: 'success' | 'failure' | null
  lastExecutedAt: string | null
  successRate: number
  jobCount: number
}

function computeHealth(artisanId: string, history: PipelineJob[]): ArtisanHealth {
  const artisanJobs: Array<{ status: string; completedAt?: string }> = []
  for (const pipeline of history) {
    if (pipeline.jobs) {
      for (const job of pipeline.jobs) {
        if (job.artisanId === artisanId) {
          artisanJobs.push(job)
        }
      }
    }
  }
  const recent = artisanJobs.slice(0, 5)
  const successes = recent.filter(j => j.status === 'complete').length
  const lastJob = recent[0]

  return {
    lastResult: lastJob ? (lastJob.status === 'complete' ? 'success' : 'failure') : null,
    lastExecutedAt: lastJob?.completedAt || null,
    successRate: recent.length > 0 ? Math.round((successes / recent.length) * 100) : 0,
    jobCount: artisanJobs.length,
  }
}

function statusIndicatorColor(health: ArtisanHealth): string {
  if (health.lastResult === null) return GREY
  return health.lastResult === 'success' ? GREEN : RED
}

const channelIcons: Record<string, string> = {
  print: 'print',
  digital: 'campaign',
  web: 'language',
  social: 'share',
  video: 'videocam',
}

export function MusashiMeshView() {
  const [history, setHistory] = useState<PipelineJob[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/cmo/pipeline/history')
      .then(r => r.json())
      .then(data => {
        if (data.success) setHistory(data.data || [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 600, color: GOLD, margin: 0 }}>
          Artisan Mesh
        </h3>
        <span style={{
          background: GOLD_GLOW, color: GOLD, padding: '2px 10px',
          borderRadius: 6, fontSize: '0.72rem', fontWeight: 700,
        }}>
          {CMO_ARTISANS.length} ACTIVE
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
        {CMO_ARTISANS.map((artisan: CmoArtisan) => {
          const health = computeHealth(artisan.id, history)
          const indicatorColor = statusIndicatorColor(health)

          return (
            <div key={artisan.id} style={{
              background: BG_HOVER, border: `1px solid ${BORDER}`, borderRadius: 10,
              padding: 20, borderTop: `3px solid ${GOLD}`,
            }}>
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 24, color: GOLD }}>
                    {channelIcons[artisan.channel] || 'build'}
                  </span>
                  <div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 700, color: TEXT }}>{artisan.name}</div>
                    <div style={{ fontSize: '0.72rem', color: TEXT_MUTED }}>{artisan.description.slice(0, 50)}...</div>
                  </div>
                </div>
                <span style={{
                  width: 12, height: 12, borderRadius: '50%', background: indicatorColor,
                  boxShadow: indicatorColor !== GREY ? `0 0 8px ${indicatorColor}` : 'none',
                }} />
              </div>

              {/* Details */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: '0.78rem' }}>
                <div>
                  <span style={{ color: TEXT_MUTED }}>Channel</span>
                  <div style={{
                    marginTop: 4, background: GOLD_GLOW, color: GOLD, padding: '2px 8px',
                    borderRadius: 4, fontWeight: 600, textTransform: 'uppercase', display: 'inline-block',
                    fontSize: '0.7rem',
                  }}>
                    {artisan.channel}
                  </div>
                </div>
                <div>
                  <span style={{ color: TEXT_MUTED }}>Wire</span>
                  <div style={{ marginTop: 4, fontFamily: 'monospace', color: '#06b6d4', fontSize: '0.72rem' }}>
                    {artisan.wireId}
                  </div>
                </div>
                <div>
                  <span style={{ color: TEXT_MUTED }}>Status</span>
                  <div style={{
                    marginTop: 4, fontWeight: 600,
                    color: artisan.status === 'active' ? GREEN : artisan.status === 'degraded' ? GOLD : RED,
                    textTransform: 'uppercase', fontSize: '0.72rem',
                  }}>
                    {artisan.status}
                  </div>
                </div>
                <div>
                  <span style={{ color: TEXT_MUTED }}>Tools</span>
                  <div style={{ marginTop: 4, color: TEXT_MUTED }}>
                    {artisan.toolDomains.join(', ')}
                  </div>
                </div>
              </div>

              {/* Health footer */}
              <div style={{
                marginTop: 12, paddingTop: 12, borderTop: `1px solid ${BORDER}`,
                display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: TEXT_MUTED,
              }}>
                <span>
                  {loading ? 'Loading...' : health.jobCount > 0
                    ? `${health.successRate}% success (${health.jobCount} jobs)`
                    : 'No history yet'}
                </span>
                <span>
                  {health.lastExecutedAt
                    ? `Last: ${new Date(health.lastExecutedAt).toLocaleDateString()}`
                    : '—'}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
