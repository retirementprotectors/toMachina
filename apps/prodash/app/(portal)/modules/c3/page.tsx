'use client'

import { useMemo } from 'react'
import { query, type Query, type DocumentData } from 'firebase/firestore'
import { useCollection } from '@tomachina/db'
import { collections } from '@tomachina/db/src/firestore'

const campaignsQuery: Query<DocumentData> = query(collections.campaigns())
const templatesQuery: Query<DocumentData> = query(collections.templates())
const blocksQuery: Query<DocumentData> = query(collections.contentBlocks())

interface CampaignRecord {
  _id: string
  campaign_id?: string
  name?: string
  campaign_name?: string
  description?: string
  status?: string
  type?: string
  campaign_type?: string
  division?: string
  pillar?: string
  frequency?: string
  cadence_series?: string
}

interface TemplateRecord {
  _id: string
  template_id?: string
  campaign_id?: string
  channel?: string
  touchpoint?: string
  touchpoint_day?: string
}

interface BlockRecord {
  _id: string
  block_id?: string
  name?: string
  type?: string
  channel?: string
  status?: string
  owner?: string
}

const statusBadge = (status?: string) => {
  const s = (status || '').toLowerCase()
  if (s === 'active') return { background: 'rgba(16,185,129,0.15)', color: 'var(--success)' }
  if (s === 'draft') return { background: 'rgba(59,130,246,0.15)', color: 'var(--info)' }
  if (s === 'paused') return { background: 'rgba(245,158,11,0.15)', color: 'var(--warning)' }
  return { background: 'var(--bg-surface)', color: 'var(--text-muted)' }
}

export default function C3Page() {
  const { data: campaigns, loading: campLoading } = useCollection<CampaignRecord>(campaignsQuery, 'c3-campaigns')
  const { data: templates, loading: tplLoading } = useCollection<TemplateRecord>(templatesQuery, 'c3-templates')
  const { data: blocks, loading: blkLoading } = useCollection<BlockRecord>(blocksQuery, 'c3-blocks')

  const loading = campLoading || tplLoading || blkLoading

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    campaigns.forEach((c) => {
      const s = c.status || 'unknown'
      counts[s] = (counts[s] || 0) + 1
    })
    return counts
  }, [campaigns])

  const channelCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    templates.forEach((t) => {
      const ch = t.channel || 'unknown'
      counts[ch] = (counts[ch] || 0) + 1
    })
    return counts
  }, [templates])

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">C3 — Campaign Manager</h1>
        <div className="mt-8 flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--portal)] border-t-transparent" />
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-2xl font-bold text-[var(--text-primary)]">C3 — Campaign Manager</h1>
      <p className="mt-1 text-sm text-[var(--text-muted)]">Content, campaigns, and communications</p>

      {/* Stats */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">Campaigns</p>
          <p className="mt-1 text-2xl font-bold text-[var(--text-primary)]">{campaigns.length}</p>
        </div>
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">Templates</p>
          <p className="mt-1 text-2xl font-bold text-[var(--text-primary)]">{templates.length}</p>
        </div>
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">Content Blocks</p>
          <p className="mt-1 text-2xl font-bold text-[var(--text-primary)]">{blocks.length}</p>
        </div>
      </div>

      {/* Campaign List */}
      <div className="mt-6">
        <h2 className="mb-3 text-lg font-semibold text-[var(--text-primary)]">Campaigns</h2>
        {campaigns.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] py-16">
            <span className="material-icons-outlined text-4xl text-[var(--text-muted)]">campaign</span>
            <p className="mt-3 text-sm text-[var(--text-muted)]">No campaigns found.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {campaigns.slice(0, 20).map((c) => (
              <div
                key={c._id}
                className="flex items-center justify-between rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] px-4 py-3 transition-all hover:border-[var(--border)]"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-[var(--text-primary)]">
                    {c.name || c.campaign_name || c._id}
                  </p>
                  <p className="text-xs text-[var(--text-muted)]">
                    {[c.type || c.campaign_type, c.division, c.pillar].filter(Boolean).join(' / ') || 'General'}
                  </p>
                </div>
                <div className="ml-4 flex items-center gap-3">
                  {c.frequency && (
                    <span className="text-xs text-[var(--text-muted)]">{c.frequency}</span>
                  )}
                  <span
                    className="rounded-full px-2.5 py-0.5 text-xs font-medium"
                    style={statusBadge(c.status)}
                  >
                    {c.status || 'draft'}
                  </span>
                </div>
              </div>
            ))}
            {campaigns.length > 20 && (
              <p className="text-center text-xs text-[var(--text-muted)]">
                Showing 20 of {campaigns.length} campaigns
              </p>
            )}
          </div>
        )}
      </div>

      {/* Status + Channel Breakdown */}
      <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
        {Object.keys(statusCounts).length > 0 && (
          <div>
            <h2 className="mb-3 text-sm font-semibold text-[var(--text-primary)]">Campaign Status Breakdown</h2>
            <div className="flex flex-wrap gap-2">
              {Object.entries(statusCounts).map(([status, count]) => (
                <span
                  key={status}
                  className="rounded-full px-3 py-1 text-xs font-medium"
                  style={statusBadge(status)}
                >
                  {status}: {count}
                </span>
              ))}
            </div>
          </div>
        )}
        {Object.keys(channelCounts).length > 0 && (
          <div>
            <h2 className="mb-3 text-sm font-semibold text-[var(--text-primary)]">Templates by Channel</h2>
            <div className="flex flex-wrap gap-2">
              {Object.entries(channelCounts).map(([channel, count]) => (
                <span
                  key={channel}
                  className="rounded-full bg-[var(--bg-surface)] px-3 py-1 text-xs text-[var(--text-secondary)]"
                >
                  {channel}: {count}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Recent Content Blocks */}
      <div className="mt-6">
        <h2 className="mb-3 text-lg font-semibold text-[var(--text-primary)]">Content Blocks</h2>
        {blocks.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] py-16">
            <span className="material-icons-outlined text-4xl text-[var(--text-muted)]">widgets</span>
            <p className="mt-3 text-sm text-[var(--text-muted)]">No content blocks found.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {blocks.slice(0, 12).map((b) => (
              <div
                key={b._id}
                className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 transition-all hover:border-[var(--border)]"
              >
                <div className="flex items-start justify-between">
                  <p className="truncate text-sm font-medium text-[var(--text-primary)]">
                    {b.name || b.block_id || b._id}
                  </p>
                  <span
                    className="ml-2 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium"
                    style={statusBadge(b.status)}
                  >
                    {b.status || 'draft'}
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-2 text-xs text-[var(--text-muted)]">
                  {b.type && <span>{b.type}</span>}
                  {b.type && b.channel && <span>-</span>}
                  {b.channel && <span>{b.channel}</span>}
                </div>
                {b.owner && (
                  <p className="mt-1 text-xs text-[var(--text-muted)]">Owner: {b.owner}</p>
                )}
              </div>
            ))}
          </div>
        )}
        {blocks.length > 12 && (
          <p className="mt-3 text-center text-xs text-[var(--text-muted)]">
            Showing 12 of {blocks.length} content blocks
          </p>
        )}
      </div>
    </div>
  )
}
