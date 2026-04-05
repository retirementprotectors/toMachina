'use client'

/**
 * MUS-O12 — Pipeline View Live
 *
 * Fetches from /api/cmo/pipeline/active and /api/cmo/pipeline/history.
 * Shows active pipeline jobs, recent history table, and success rate.
 * Auto-refreshes active section every 30 seconds.
 */
import { useState, useEffect, useCallback } from 'react'

const GOLD = '#d4a44c'
const GOLD_GLOW = 'rgba(212,164,76,0.12)'
const GREEN = '#22c55e'
const RED = '#ef4444'
const ORANGE = '#f59e0b'
const CYAN = '#06b6d4'
const BORDER = '#1e293b'
const TEXT = '#e2e8f0'
const TEXT_MUTED = '#94a3b8'
const BG_HOVER = '#1a2236'

interface PipelineJob {
  id: string
  market?: string
  artisanId?: string
  wireId?: string
  status: string
  overallStatus?: string
  createdAt?: string
  completedAt?: string
  jobs?: Array<{ artisanId: string; wireId: string; status: string }>
}

function statusColor(status: string): string {
  switch (status) {
    case 'complete': return GREEN
    case 'running': case 'queued': return ORANGE
    case 'partial': return ORANGE
    case 'failed': return RED
    default: return TEXT_MUTED
  }
}

export function MusashiPipelineView() {
  const [activeJobs, setActiveJobs] = useState<PipelineJob[]>([])
  const [history, setHistory] = useState<PipelineJob[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const [activeRes, historyRes] = await Promise.all([
        fetch('/api/cmo/pipeline/active').then(r => r.json()).catch(() => ({ success: false })),
        fetch('/api/cmo/pipeline/history').then(r => r.json()).catch(() => ({ success: false })),
      ])
      if (activeRes.success) setActiveJobs(activeRes.data || [])
      if (historyRes.success) setHistory(historyRes.data || [])
      setError(null)
    } catch {
      setError('Failed to load pipeline data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }, [fetchData])

  // Calculate success rate from history
  const completedJobs = history.filter(j => (j.overallStatus || j.status) === 'complete').length
  const totalHistory = history.length
  const successRate = totalHistory > 0 ? Math.round((completedJobs / totalHistory) * 100) : 0

  if (loading) {
    return (
      <div style={{ padding: 48, textAlign: 'center', color: TEXT_MUTED }}>
        <span className="material-symbols-outlined" style={{ fontSize: 32, opacity: 0.4 }}>hourglass_top</span>
        <p style={{ marginTop: 12, fontSize: '0.9rem' }}>Loading pipeline data...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: 48, textAlign: 'center', color: RED }}>
        <span className="material-symbols-outlined" style={{ fontSize: 32 }}>error</span>
        <p style={{ marginTop: 12, fontSize: '0.9rem' }}>{error}</p>
      </div>
    )
  }

  return (
    <div style={{ padding: 24 }}>
      {/* Stats row */}
      <div style={{ display: 'flex', gap: 24, marginBottom: 24, flexWrap: 'wrap' }}>
        <StatCard label="Active Jobs" value={activeJobs.length} color={ORANGE} />
        <StatCard label="Success Rate" value={`${successRate}%`} color={GREEN} />
        <StatCard label="Total Processed" value={totalHistory} color={TEXT_MUTED} />
      </div>

      {/* Active jobs */}
      <h3 style={{ fontSize: '1rem', fontWeight: 600, color: GOLD, marginBottom: 12 }}>
        Active Jobs
      </h3>
      {activeJobs.length === 0 ? (
        <div style={{
          background: BG_HOVER, border: `1px solid ${BORDER}`, borderRadius: 8,
          padding: '32px 24px', textAlign: 'center', color: TEXT_MUTED, fontSize: '0.875rem',
          marginBottom: 24,
        }}>
          No active jobs
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
          {activeJobs.map(job => (
            <div key={job.id} style={{
              background: BG_HOVER, border: `1px solid ${BORDER}`, borderRadius: 8,
              padding: 16, minWidth: 200,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{
                  width: 8, height: 8, borderRadius: '50%', background: ORANGE,
                  animation: job.status === 'running' ? 'pulse 1.5s infinite' : 'none',
                }} />
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: TEXT }}>
                  {job.wireId || 'Processing'}
                </span>
              </div>
              <div style={{ fontSize: '0.75rem', color: TEXT_MUTED }}>
                {job.artisanId || 'Dispatching...'} — {job.status}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* History table */}
      <h3 style={{ fontSize: '1rem', fontWeight: 600, color: GOLD, marginBottom: 12 }}>
        Recent History
      </h3>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
        <thead>
          <tr>
            <th style={thStyle}>Brief ID</th>
            <th style={thStyle}>Status</th>
            <th style={thStyle}>Jobs</th>
            <th style={thStyle}>Completed</th>
          </tr>
        </thead>
        <tbody>
          {history.length === 0 ? (
            <tr>
              <td colSpan={4} style={{ ...tdStyle, textAlign: 'center', padding: 24 }}>
                No pipeline history yet
              </td>
            </tr>
          ) : (
            history.map(job => {
              const status = job.overallStatus || job.status
              return (
                <tr key={job.id}>
                  <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: '0.75rem', color: CYAN }}>
                    {job.id.slice(0, 8)}...
                  </td>
                  <td style={tdStyle}>
                    <span style={{
                      color: statusColor(status), fontWeight: 700,
                      fontSize: '0.72rem', textTransform: 'uppercase',
                    }}>
                      {status}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    {job.jobs?.length || '—'}
                  </td>
                  <td style={{ ...tdStyle, fontSize: '0.78rem' }}>
                    {job.completedAt ? new Date(job.completedAt).toLocaleString() : '—'}
                  </td>
                </tr>
              )
            })
          )}
        </tbody>
      </table>
    </div>
  )
}

// ── Shared components ──

function StatCard({ label, value, color }: { label: string; value: number | string; color: string }) {
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
