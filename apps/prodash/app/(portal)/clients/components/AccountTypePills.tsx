'use client'

const ACCOUNT_TYPE_MAP: Record<string, { label: string; bg: string; text: string }> = {
  annuity: { label: 'A', bg: 'rgba(245, 158, 11, 0.15)', text: '#f59e0b' },
  life: { label: 'L', bg: 'rgba(16, 185, 129, 0.15)', text: '#10b981' },
  medicare: { label: 'M', bg: 'rgba(59, 130, 246, 0.15)', text: '#3b82f6' },
  'bd/ria': { label: 'B', bg: 'rgba(139, 92, 246, 0.15)', text: '#8b5cf6' },
  bd: { label: 'B', bg: 'rgba(139, 92, 246, 0.15)', text: '#8b5cf6' },
  ria: { label: 'B', bg: 'rgba(139, 92, 246, 0.15)', text: '#8b5cf6' },
}

interface AccountTypePillsProps {
  accountTypes: string[]
}

export function AccountTypePills({ accountTypes }: AccountTypePillsProps) {
  if (!accountTypes || accountTypes.length === 0) {
    return <span className="text-xs text-[var(--text-muted)]">&mdash;</span>
  }

  // Deduplicate labels (BD and RIA both map to 'B')
  const seen = new Set<string>()
  const pills: Array<{ label: string; bg: string; text: string }> = []

  for (const type of accountTypes) {
    const normalized = (type || '').toLowerCase().trim()
    const config = ACCOUNT_TYPE_MAP[normalized]
    if (config && !seen.has(config.label)) {
      seen.add(config.label)
      pills.push(config)
    }
  }

  if (pills.length === 0) {
    return <span className="text-xs text-[var(--text-muted)]">&mdash;</span>
  }

  return (
    <div className="flex gap-1">
      {pills.map((pill) => (
        <span
          key={pill.label}
          className="inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold"
          style={{ backgroundColor: pill.bg, color: pill.text }}
          title={
            pill.label === 'A'
              ? 'Annuity'
              : pill.label === 'L'
                ? 'Life'
                : pill.label === 'M'
                  ? 'Medicare'
                  : 'BD/RIA'
          }
        >
          {pill.label}
        </span>
      ))}
    </div>
  )
}
