'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth, buildEntitlementContext } from '@tomachina/auth'
import type { FlowPipelineDef } from '@tomachina/core'
import { toSlug } from './pipeline-keys'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api'

/** Leaders, Executives, and Owners see all pipelines. */
function isLeaderOrAbove(userLevel: string): boolean {
  return ['LEADER', 'EXECUTIVE', 'OWNER'].includes(userLevel)
}

/**
 * /pipelines — Smart redirect to the user's first assigned pipeline.
 * If no pipelines are assigned, shows an empty state message.
 */
export default function PipelinesPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [noPipelines, setNoPipelines] = useState(false)

  useEffect(() => {
    if (!user) return

    let cancelled = false

    async function resolve() {
      try {
        const res = await fetch(`${API_BASE}/flow/pipelines?portal=PRODASHX&status=active`)
        const json = await res.json() as { success: boolean; data?: FlowPipelineDef[] }

        if (cancelled) return
        if (!json.success || !json.data || json.data.length === 0) {
          setNoPipelines(true)
          setLoading(false)
          return
        }

        const ctx = buildEntitlementContext(user)
        const assignedPipelines = ctx.assignedModules || []

        // Filter pipelines based on user level
        const visiblePipelines = isLeaderOrAbove(ctx.userLevel)
          ? json.data
          : json.data.filter(
              (p) =>
                assignedPipelines.includes(p.pipeline_key) ||
                assignedPipelines.includes(`PIPELINE_${p.pipeline_key}`)
            )

        if (cancelled) return

        if (visiblePipelines.length === 0) {
          setNoPipelines(true)
          setLoading(false)
          return
        }

        // Redirect to the first available pipeline
        const firstKey = visiblePipelines[0].pipeline_key
        router.replace(`/pipelines/${toSlug(firstKey)}`)
      } catch {
        if (!cancelled) {
          setNoPipelines(true)
          setLoading(false)
        }
      }
    }

    resolve()
    return () => { cancelled = true }
  }, [user, router])

  /* ─── Loading ─── */
  if (loading && !noPipelines) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--portal)] border-t-transparent" />
      </div>
    )
  }

  /* ─── Empty State ─── */
  return (
    <div className="flex h-full items-center justify-center">
      <div className="flex flex-col items-center rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-card)] px-12 py-16">
        <span className="material-icons-outlined text-4xl text-[var(--text-muted)]">
          view_kanban
        </span>
        <p className="mt-4 text-sm font-medium text-[var(--text-primary)]">
          No pipelines assigned
        </p>
        <p className="mt-1 text-xs text-[var(--text-muted)]">
          Contact your team leader to get access to pipeline boards.
        </p>
      </div>
    </div>
  )
}
