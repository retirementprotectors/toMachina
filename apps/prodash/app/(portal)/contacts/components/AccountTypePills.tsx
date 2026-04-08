'use client'

const ACCOUNT_TYPE_MAP: Record<string, { label: string; bg: string; text: string }> = {
  annuity: { label: 'A', bg: 'rgba(245, 158, 11, 0.15)', text: '#f59e0b' },
  life: { label: 'L', bg: 'rgba(16, 185, 129, 0.15)', text: '#10b981' },
  medicare: { label: 'M', bg: 'rgba(59, 130, 246, 0.15)', text: '#3b82f6' },
  investments: { label: 'I', bg: 'rgba(139, 92, 246, 0.15)', text: '#8b5cf6' },
  investment: { label: 'I', bg: 'rgba(139, 92, 246, 0.15)', text: '#8b5cf6' },
  banking: { label: 'B', bg: 'rgba(6, 182, 212, 0.15)', text: '#06b6d4' },
  bank: { label: 'B', bg: 'rgba(6, 182, 212, 0.15)', text: '#06b6d4' },
  liabilities: { label: 'D', bg: 'rgba(239, 68, 68, 0.15)', text: '#ef4444' },
  liability: { label: 'D', bg: 'rgba(239, 68, 68, 0.15)', text: '#ef4444' },
  debt: { label: 'D', bg: 'rgba(239, 68, 68, 0.15)', text: '#ef4444' },
  // Legacy aliases — map to Investments
  'bd/ria': { label: 'I', bg: 'rgba(139, 92, 246, 0.15)', text: '#8b5cf6' },
  bdria: { label: 'I', bg: 'rgba(139, 92, 246, 0.15)', text: '#8b5cf6' },
  bd_ria: { label: 'I', bg: 'rgba(139, 92, 246, 0.15)', text: '#8b5cf6' },
}

interface AccountTypePillsProps {
  accountTypes: string[]
}

export function AccountTypePills({ accountTypes }: AccountTypePillsProps) {
  if (!accountTypes || accountTypes.length === 0) {
    return <span className="text-xs text-[var(--text-muted)]">&mdash;</span>
  }

  // Deduplicate labels (legacy bd_ria, bdria aliases all map to 'I' for Investments)
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
                  : pill.label === 'I'
                    ? 'Investment'
                    : pill.label === 'B'
                      ? 'Banking'
                      : pill.label === 'D'
                        ? 'Liabilities'
                        : 'Other'
          }
        >
          {pill.label}
        </span>
      ))}
    </div>
  )
}
