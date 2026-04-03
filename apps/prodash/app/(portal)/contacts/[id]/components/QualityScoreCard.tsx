'use client'

import { useEffect, useState } from 'react'
import { fetchWithAuth } from '@tomachina/ui/src/modules/fetchWithAuth'

interface QualityScoreCardProps {
  clientId: string
}

interface ScoreData {
  score: number
  max_score: number
  percentage: number
  fields: Array<{ field: string; present: boolean; weight: number }>
}

export function QualityScoreCard({ clientId }: QualityScoreCardProps) {
  const [data, setData] = useState<ScoreData | null>(null)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetchWithAuth(`/api/clients/${clientId}/quality-score`)
        if (res.ok) {
          const json = await res.json()
          if (json.success) setData(json.data)
        }
      } catch { /* silent */ }
    }
    load()
  }, [clientId])

  if (!data) return null

  const pct = Math.round(data.percentage ?? ((data.score / (data.max_score || 1)) * 100))
  const missing = (data.fields || []).filter(f => !f.present)
  const radius = 24
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference - (pct / 100) * circumference

  return (
    <div className="inline-flex items-center gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-4 py-3">
      {/* Circular progress ring */}
      <div className="relative h-14 w-14 flex-shrink-0">
        <svg className="h-full w-full -rotate-90" viewBox="0 0 56 56">
          <circle cx="28" cy="28" r={radius} fill="none" stroke="var(--border-subtle)" strokeWidth="4" />
          <circle cx="28" cy="28" r={radius} fill="none" stroke="var(--portal)" strokeWidth="4"
            strokeDasharray={circumference} strokeDashoffset={dashOffset} strokeLinecap="round"
            className="transition-all duration-700"
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-[var(--text-primary)]">
          {pct}%
        </span>
      </div>

      <div>
        <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Data Quality</div>
        {missing.length > 0 ? (
          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-0.5 text-xs text-[var(--portal)] hover:underline"
          >
            {missing.length} missing field{missing.length === 1 ? '' : 's'}
            <span className="material-icons-outlined ml-0.5 text-[14px] align-middle">
              {expanded ? 'expand_less' : 'expand_more'}
            </span>
          </button>
        ) : (
          <div className="mt-0.5 text-xs text-[var(--text-muted)]">Complete</div>
        )}
        {expanded && missing.length > 0 && (
          <div className="mt-1 text-xs text-[var(--text-muted)]">
            Missing: {missing.map(f => f.field.replace(/_/g, ' ')).join(', ')}
          </div>
        )}
      </div>
    </div>
  )
}
