'use client'

import { SourceBadge } from './SourceBadge'

interface QuoteCardProps {
  carrierName: string
  productName: string
  premiumAnnual?: number
  premiumMonthly?: number
  details: Record<string, unknown>
  sourceName: string
  automationLevel: 'full' | 'semi' | 'manual'
  score?: number
  rank?: number
  flags: string[]
  selected?: boolean
  onSelect?: () => void
}

const FLAG_STYLES: Record<string, { bg: string; text: string }> = {
  'Best Value': { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  'Lowest Premium': { bg: 'bg-sky-100', text: 'text-sky-700' },
  best_value: { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  lowest_premium: { bg: 'bg-sky-100', text: 'text-sky-700' },
  best_rated: { bg: 'bg-amber-100', text: 'text-amber-700' },
  missing_data: { bg: 'bg-red-100', text: 'text-red-700' },
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value)
}

function formatFlagLabel(flag: string): string {
  return flag
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

export function QuoteCard({
  carrierName,
  productName,
  premiumAnnual,
  premiumMonthly,
  details,
  sourceName,
  automationLevel,
  score,
  rank,
  flags,
  selected = false,
  onSelect,
}: QuoteCardProps) {
  /** Pull out a few common detail keys to display */
  const detailEntries = Object.entries(details).slice(0, 4)

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-xl border-2 p-4 text-left transition-all ${
        selected
          ? 'border-[var(--portal)] shadow-md'
          : 'border-[var(--border-subtle)] hover:border-[var(--text-muted)]'
      } bg-[var(--bg-card)]`}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-bold text-[var(--text-primary)]">{carrierName}</h3>
          <p className="truncate text-xs text-[var(--text-secondary)]">{productName}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {rank != null && (
            <span
              className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white"
              style={{ background: 'var(--portal)' }}
            >
              {rank}
            </span>
          )}
          {selected && (
            <span
              className="material-icons-outlined text-white rounded-full p-0.5"
              style={{ fontSize: '14px', background: 'var(--portal)' }}
            >
              check
            </span>
          )}
        </div>
      </div>

      {/* Premium */}
      <div className="mt-3 flex items-baseline gap-3">
        {premiumAnnual != null && (
          <div>
            <span className="text-lg font-bold text-[var(--text-primary)]">{formatCurrency(premiumAnnual)}</span>
            <span className="ml-1 text-xs text-[var(--text-muted)]">/yr</span>
          </div>
        )}
        {premiumMonthly != null && (
          <div>
            <span className="text-sm font-semibold text-[var(--text-secondary)]">{formatCurrency(premiumMonthly)}</span>
            <span className="ml-1 text-xs text-[var(--text-muted)]">/mo</span>
          </div>
        )}
      </div>

      {/* Score bar */}
      {score != null && (
        <div className="mt-2 flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--bg-surface)]">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${score}%`, background: 'var(--portal)' }}
            />
          </div>
          <span className="text-[10px] font-semibold text-[var(--text-muted)]">{score}</span>
        </div>
      )}

      {/* Key details */}
      {detailEntries.length > 0 && (
        <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1">
          {detailEntries.map(([key, val]) => (
            <div key={key} className="flex items-baseline gap-1 text-[11px]">
              <span className="text-[var(--text-muted)]">{key.replace(/_/g, ' ')}:</span>
              <span className="font-medium text-[var(--text-secondary)]">{String(val)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Flags */}
      {flags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {flags.map((flag) => {
            const style = FLAG_STYLES[flag] ?? { bg: 'bg-gray-100', text: 'text-gray-700' }
            return (
              <span
                key={flag}
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${style.bg} ${style.text}`}
              >
                {formatFlagLabel(flag)}
              </span>
            )
          })}
        </div>
      )}

      {/* Source badge */}
      <div className="mt-3 border-t border-[var(--border-subtle)] pt-2">
        <SourceBadge sourceName={sourceName} automationLevel={automationLevel} />
      </div>
    </button>
  )
}
