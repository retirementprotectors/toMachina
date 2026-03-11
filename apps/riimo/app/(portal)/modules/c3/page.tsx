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
  campaign_name?: string
  name?: string
  status?: string
  campaign_type?: string
  type?: string
  target_count?: number
  created_at?: string
}

export default function C3Page() {
  const { data: campaigns, loading: campLoading } = useCollection<CampaignRecord>(campaignsQuery, 'c3-campaigns')
  const { data: templates, loading: tplLoading } = useCollection(templatesQuery, 'c3-templates')
  const { data: blocks, loading: blkLoading } = useCollection(blocksQuery, 'c3-blocks')

  const loading = campLoading || tplLoading || blkLoading

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    campaigns.forEach((c) => {
      const s = c.status || 'unknown'
      counts[s] = (counts[s] || 0) + 1
    })
    return counts
  }, [campaigns])

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
                  <p className="font-medium text-[var(--text-primary)] truncate">
                    {c.campaign_name || c.name || c._id}
                  </p>
                  <p className="text-xs text-[var(--text-muted)]">
                    {c.campaign_type || c.type || 'General'}
                  </p>
                </div>
                <span
                  className="rounded-full px-2.5 py-0.5 text-xs font-medium"
                  style={{
                    background: c.status === 'active' ? 'rgba(16,185,129,0.15)' : 'var(--bg-surface)',
                    color: c.status === 'active' ? 'var(--success)' : 'var(--text-muted)',
                  }}
                >
                  {c.status || 'draft'}
                </span>
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

      {/* Status Breakdown */}
      {Object.keys(statusCounts).length > 0 && (
        <div className="mt-6">
          <h2 className="mb-3 text-sm font-semibold text-[var(--text-primary)]">Status Breakdown</h2>
          <div className="flex flex-wrap gap-2">
            {Object.entries(statusCounts).map(([status, count]) => (
              <span
                key={status}
                className="rounded-full bg-[var(--bg-surface)] px-3 py-1 text-xs text-[var(--text-secondary)]"
              >
                {status}: {count}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
