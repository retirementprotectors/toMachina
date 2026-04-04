'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { fetchValidated } from './fetchValidated'
import { useToast } from '../components/Toast'

/* ─── Types ─── */
interface QueueItem {
  id: string
  item_id: string
  title: string
  description?: string
  status: string
  type?: string
  priority?: string
  portal?: string
  reporter?: string
  reporter_name?: string
  division?: string
  division_leader?: string
  triage_recommendation?: string
  triage_confidence?: number
  triage_reasoning?: string
  created_at: string
  updated_at: string
}

export interface ActionQueueProps {
  portal: string
}

/* ─── Priority styling ─── */
const PRIORITY_STYLES: Record<string, { bg: string; text: string }> = {
  P0: { bg: 'rgba(239,68,68,0.2)', text: 'rgb(239,68,68)' },
  P1: { bg: 'rgba(245,158,11,0.2)', text: 'rgb(245,158,11)' },
  P2: { bg: 'rgba(251,191,36,0.2)', text: 'rgb(251,191,36)' },
  P3: { bg: 'rgba(107,114,128,0.2)', text: 'rgb(156,163,175)' },
}

const REC_LABELS: Record<string, string> = {
  FIX: 'Fix (RAIDEN)',
  FEATURE: 'Feature (RONIN)',
  FILE: 'File (VOLTRON)',
  TRAIN: 'Train (VOLTRON)',
}

const TYPE_FILTERS = [
  { key: 'all', label: 'All', icon: 'apps' },
  { key: 'fix', label: 'Fixes', icon: 'build' },
  { key: 'feature', label: 'Features', icon: 'add_circle' },
  { key: 'infra', label: 'Infra', icon: 'dns' },
  { key: 'content', label: 'Content', icon: 'article' },
  { key: 'test', label: 'Tests', icon: 'science' },
] as const

const PORTAL_FILTERS = [
  { key: 'all', label: 'All Portals', color: '' },
  { key: 'prodash', label: 'PRODASHX', color: '#4a7ab5' },
  { key: 'riimo', label: 'RIIMO', color: '#a78bfa' },
  { key: 'sentinel', label: 'SENTINEL', color: '#40bc58' },
] as const

/* ─── Filter helpers ─── */
function matchesTypeFilter(item: QueueItem, filter: string): boolean {
  if (filter === 'all') return true
  const t = ((item.type || '') + ' ' + (item.triage_recommendation || '') + ' ' + (item.item_id || '') + ' ' + (item.title || '')).toLowerCase()
  switch (filter) {
    case 'fix': return t.includes('fix') || t.includes('bug')
    case 'feature': return t.includes('feat') || t.includes('feature')
    case 'infra': return t.includes('infra') || t.includes('infrastructure') || t.includes('deploy')
    case 'content': return t.includes('content') || t.includes('doc')
    case 'test': return t.includes('test') || t.includes('e2e')
    default: return true
  }
}

function matchesPortalFilter(item: QueueItem, filter: string): boolean {
  if (filter === 'all') return true
  const p = ((item.portal || '') + ' ' + (item.title || '')).toLowerCase()
  return p.includes(filter)
}

function humanizeTitle(title: string): string {
  // Strip item-id prefixes like "INT-0042: ", "FP-015: "
  const stripped = title.replace(/^[A-Z]+-\d+:\s*/, '')
  return stripped
    .replace(/_/g, ' ')
    .replace(/\b[a-z]/g, c => c.toUpperCase())
}

/* ─── Relative time helper ─── */
function timeAgo(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diff = Math.max(0, now - then)
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}hr ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

/* ─── Component ─── */
export function ActionQueue({ portal }: ActionQueueProps) {
  const { showToast } = useToast()
  const [items, setItems] = useState<QueueItem[]>([])
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState<string | null>(null)
  const [reclassifyId, setReclassifyId] = useState<string | null>(null)
  const [commentId, setCommentId] = useState<string | null>(null)
  const [commentText, setCommentText] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [portalFilter, setPortalFilter] = useState<string>('all')

  const loadQueue = useCallback(async () => {
    const result = await fetchValidated<QueueItem[]>('/api/queue')
    if (result.success && result.data) {
      setItems(result.data)
    }
    setLoading(false)
  }, [])

  useEffect(() => { loadQueue() }, [loadQueue])

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(loadQueue, 30000)
    return () => clearInterval(interval)
  }, [loadQueue])

  const handleApprove = async (item: QueueItem, rec?: string) => {
    setActing(item.id)
    const body: Record<string, string> = {}
    if (rec) body.recommendation = rec
    const result = await fetchValidated('/api/queue/' + item.id + '/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (result.success) {
      showToast(`${item.item_id} approved — routed to ${rec || item.triage_recommendation || 'FIX'}`, 'success')
      setItems(prev => prev.filter(i => i.id !== item.id))
    } else {
      showToast(result.error || 'Approve failed', 'error')
    }
    setActing(null)
    setReclassifyId(null)
  }

  const handleDecline = async (item: QueueItem) => {
    setActing(item.id)
    const result = await fetchValidated('/api/queue/' + item.id + '/decline', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Declined by CEO' }),
    })
    if (result.success) {
      showToast(`${item.item_id} declined`, 'warning')
      setItems(prev => prev.filter(i => i.id !== item.id))
    } else {
      showToast(result.error || 'Decline failed', 'error')
    }
    setActing(null)
  }

  const handleReclassify = async (item: QueueItem, newRec: string) => {
    setActing(item.id)
    const result = await fetchValidated('/api/queue/' + item.id + '/reclassify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recommendation: newRec }),
    })
    if (result.success) {
      showToast(`${item.item_id} reclassified to ${newRec}`, 'success')
      setItems(prev => prev.filter(i => i.id !== item.id))
    } else {
      showToast(result.error || 'Reclassify failed', 'error')
    }
    setActing(null)
    setReclassifyId(null)
  }

  const handleComment = async (item: QueueItem) => {
    if (!commentText.trim()) return
    setActing(item.id)
    const result = await fetchValidated('/api/queue/' + item.id + '/comment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: commentText }),
    })
    if (result.success) {
      showToast('Comment sent', 'success')
      setCommentId(null)
      setCommentText('')
    } else {
      showToast(result.error || 'Comment failed', 'error')
    }
    setActing(null)
  }

  const filteredItems = items.filter(item =>
    matchesTypeFilter(item, typeFilter) && matchesPortalFilter(item, portalFilter)
  )

  // Styles — mobile-first, no sidebar, dark theme
  const s = {
    bg: 'var(--bg, #0f1219)',
    surface: 'var(--bg-card, #1c2333)',
    border: 'var(--border, #2a3347)',
    text: 'var(--text-primary, #e2e8f0)',
    textMuted: 'var(--text-muted, #8892a8)',
    portal: 'var(--portal, #4a7ab5)',
    green: 'rgb(34,197,94)',
    red: 'rgb(239,68,68)',
    amber: 'rgb(245,158,11)',
    teal: 'rgb(20,184,166)',
  }

  if (loading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        minHeight: '100dvh', background: s.bg, color: s.textMuted,
      }}>
        <span className="material-icons-outlined" style={{ fontSize: 28, animation: 'spin 1s linear infinite' }}>refresh</span>
        <span style={{ marginLeft: 12, fontSize: 15 }}>Loading queue...</span>
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100dvh', background: s.bg,
      padding: '16px 12px env(safe-area-inset-bottom)', maxWidth: 480, margin: '0 auto',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, padding: '0 4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => window.history.back()}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 4, color: s.textMuted, display: 'flex', alignItems: 'center' }}
          >
            <span className="material-icons-outlined" style={{ fontSize: 20 }}>arrow_back</span>
          </button>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, color: s.text, letterSpacing: '-0.02em' }}>/q</div>
            <div style={{ fontSize: 12, color: s.textMuted }}>CEO Action Queue</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            fontSize: 13, fontWeight: 600, padding: '4px 10px', borderRadius: 20,
            background: filteredItems.length > 0 ? 'rgba(245,158,11,0.2)' : 'rgba(34,197,94,0.2)',
            color: filteredItems.length > 0 ? s.amber : s.green,
          }}>
            {filteredItems.length}{filteredItems.length !== items.length ? `/${items.length}` : ''} {filteredItems.length === 1 ? 'item' : 'items'}
          </span>
          <button
            onClick={() => { setLoading(true); loadQueue() }}
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer', padding: 4,
              color: s.textMuted, display: 'flex', alignItems: 'center',
            }}
          >
            <span className="material-icons-outlined" style={{ fontSize: 20 }}>refresh</span>
          </button>
        </div>
      </div>

      {/* Type Filters */}
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', marginBottom: 10, padding: '0 4px' }}>
        {TYPE_FILTERS.map(tf => {
          const count = items.filter(i => matchesTypeFilter(i, tf.key) && matchesPortalFilter(i, portalFilter)).length
          const active = typeFilter === tf.key
          return (
            <button
              key={tf.key}
              onClick={() => setTypeFilter(tf.key)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '8px 14px', borderRadius: 20, border: 'none', cursor: 'pointer',
                fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' as const,
                minHeight: 44, touchAction: 'manipulation' as const,
                background: active ? s.portal : s.surface,
                color: active ? '#fff' : s.textMuted,
                transition: 'all 0.15s',
              }}
            >
              <span className="material-icons-outlined" style={{ fontSize: 16 }}>{tf.icon}</span>
              {tf.label}
              <span style={{
                fontSize: 11, fontWeight: 700, padding: '1px 6px', borderRadius: 10,
                background: active ? 'rgba(255,255,255,0.2)' : 'rgba(136,146,168,0.2)',
                color: active ? '#fff' : s.textMuted,
              }}>{count}</span>
            </button>
          )
        })}
      </div>

      {/* Portal Filters */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, padding: '0 4px' }}>
        {PORTAL_FILTERS.map(pf => {
          const count = items.filter(i => matchesTypeFilter(i, typeFilter) && matchesPortalFilter(i, pf.key)).length
          const active = portalFilter === pf.key
          const c = pf.color || s.textMuted
          return (
            <button
              key={pf.key}
              onClick={() => setPortalFilter(pf.key)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '6px 12px', borderRadius: 16, cursor: 'pointer',
                fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' as const,
                minHeight: 36, touchAction: 'manipulation' as const,
                background: active ? (pf.color ? `${pf.color}22` : s.surface) : 'transparent',
                color: active ? c : s.textMuted,
                border: `1px solid ${active ? c : s.border}`,
                transition: 'all 0.15s',
              }}
            >
              {pf.label}
              <span style={{ fontSize: 10, opacity: 0.7 }}>({count})</span>
            </button>
          )
        })}
      </div>

      {/* Empty state — queue truly clear */}
      {filteredItems.length === 0 && items.length === 0 && (
        <div style={{
          textAlign: 'center', padding: '60px 20px', color: s.textMuted,
        }}>
          <span className="material-icons-outlined" style={{ fontSize: 48, marginBottom: 12, display: 'block', opacity: 0.5 }}>check_circle</span>
          <div style={{ fontSize: 16, fontWeight: 600, color: s.text, marginBottom: 4 }}>Queue clear</div>
          <div style={{ fontSize: 13 }}>No items waiting for triage. The Machine moves.</div>
        </div>
      )}

      {/* Empty state — no filter matches */}
      {filteredItems.length === 0 && items.length > 0 && (
        <div style={{
          textAlign: 'center', padding: '40px 20px', color: s.textMuted,
        }}>
          <span className="material-icons-outlined" style={{ fontSize: 40, marginBottom: 8, display: 'block', opacity: 0.5 }}>filter_list</span>
          <div style={{ fontSize: 14, fontWeight: 600, color: s.text, marginBottom: 4 }}>No matches</div>
          <div style={{ fontSize: 13 }}>{items.length} items in queue, none match current filters.</div>
        </div>
      )}

      {/* Card stack */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {filteredItems.map(item => {
          const priority = (item.priority || 'P2').toUpperCase()
          const pStyle = PRIORITY_STYLES[priority] || PRIORITY_STYLES['P2']
          const rec = item.triage_recommendation || 'FIX'
          const confidence = item.triage_confidence != null ? Math.round(item.triage_confidence * 100) : null
          const isActing = acting === item.id
          const isReclassifying = reclassifyId === item.id
          const isCommenting = commentId === item.id

          return (
            <div key={item.id} style={{
              background: s.surface, border: `1px solid ${s.border}`, borderRadius: 14,
              padding: 18, opacity: isActing ? 0.6 : 1, transition: 'opacity 0.2s',
            }}>
              {/* Card header — ID + priority */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontFamily: 'monospace', fontSize: 12, color: s.textMuted }}>{item.item_id}</span>
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
                  background: pStyle.bg, color: pStyle.text,
                }}>
                  {priority}
                </span>
              </div>

              {/* Title */}
              <div style={{ fontSize: 15, fontWeight: 600, color: s.text, marginBottom: 4, lineHeight: 1.3 }}>
                {humanizeTitle(item.title)}
              </div>

              {/* Meta */}
              <div style={{ fontSize: 12, color: s.textMuted, marginBottom: 14 }}>
                {item.reporter_name ? `from: ${item.reporter_name}` : ''}
                {item.division ? ` · ${item.division}` : ''}
                {item.created_at ? ` · ${timeAgo(item.created_at)}` : ''}
              </div>

              {/* RAIDEN recommendation */}
              <div style={{
                fontSize: 12, padding: '8px 12px', borderRadius: 8, marginBottom: 14,
                background: 'rgba(20,184,166,0.12)', color: s.teal,
              }}>
                RAIDEN recommends: <strong>{REC_LABELS[rec] || rec}</strong>
                {confidence != null && ` (${confidence}% confidence)`}
              </div>

              {/* Main action buttons — big tap targets */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <button
                  onClick={() => handleApprove(item)}
                  disabled={isActing}
                  style={{
                    flex: 1, padding: '12px 0', borderRadius: 10, border: 'none', cursor: 'pointer',
                    fontSize: 14, fontWeight: 700, background: s.green, color: '#fff',
                    minHeight: 48, touchAction: 'manipulation',
                  }}
                >
                  Approve
                </button>
                <button
                  onClick={() => handleDecline(item)}
                  disabled={isActing}
                  style={{
                    flex: 1, padding: '12px 0', borderRadius: 10, border: 'none', cursor: 'pointer',
                    fontSize: 14, fontWeight: 700, background: s.red, color: '#fff',
                    minHeight: 48, touchAction: 'manipulation',
                  }}
                >
                  Decline
                </button>
                <button
                  onClick={() => setReclassifyId(isReclassifying ? null : item.id)}
                  disabled={isActing}
                  style={{
                    flex: 1, padding: '12px 0', borderRadius: 10, cursor: 'pointer',
                    fontSize: 13, fontWeight: 600, background: s.surface, color: s.amber,
                    border: `1px solid ${s.amber}`,
                    minHeight: 48, touchAction: 'manipulation',
                  }}
                >
                  Reclassify
                </button>
              </div>

              {/* Reclassify dropdown */}
              {isReclassifying && (
                <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
                  {(['FIX', 'FEATURE', 'FILE'] as const).filter(r => r !== rec).map(r => (
                    <button
                      key={r}
                      onClick={() => handleReclassify(item, r)}
                      disabled={isActing}
                      style={{
                        padding: '10px 16px', borderRadius: 8, border: `1px solid ${s.border}`,
                        background: s.surface, color: s.text, fontSize: 13, fontWeight: 600,
                        cursor: 'pointer', minHeight: 44, touchAction: 'manipulation',
                      }}
                    >
                      {REC_LABELS[r]}
                    </button>
                  ))}
                </div>
              )}

              {/* Secondary actions — View Ticket + Comment */}
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => window.open(`/modules/forge?item=${item.item_id}`, '_blank')}
                  style={{
                    flex: 1, padding: '10px 0', borderRadius: 8, cursor: 'pointer',
                    fontSize: 12, fontWeight: 500, background: s.surface, color: s.textMuted,
                    border: `1px solid ${s.border}`, minHeight: 40, touchAction: 'manipulation',
                  }}
                >
                  View Ticket
                </button>
                <button
                  onClick={() => { setCommentId(isCommenting ? null : item.id); setCommentText('') }}
                  style={{
                    flex: 1, padding: '10px 0', borderRadius: 8, cursor: 'pointer',
                    fontSize: 12, fontWeight: 500, background: s.surface, color: s.portal,
                    border: `1px solid ${s.portal}`, minHeight: 40, touchAction: 'manipulation',
                  }}
                >
                  {item.division_leader || item.reporter_name || 'Comment'}
                </button>
              </div>

              {/* Comment input */}
              {isCommenting && (
                <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
                  <input
                    type="text"
                    value={commentText}
                    onChange={e => setCommentText(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleComment(item) }}
                    placeholder="Type message..."
                    autoFocus
                    style={{
                      flex: 1, padding: '10px 12px', borderRadius: 8, border: `1px solid ${s.border}`,
                      background: s.bg, color: s.text, fontSize: 14, outline: 'none',
                      minHeight: 44,
                    }}
                  />
                  <button
                    onClick={() => handleComment(item)}
                    disabled={!commentText.trim() || isActing}
                    style={{
                      padding: '10px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
                      background: s.portal, color: '#fff', fontSize: 13, fontWeight: 600,
                      minHeight: 44, touchAction: 'manipulation',
                    }}
                  >
                    Send
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
