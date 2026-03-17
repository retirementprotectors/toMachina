'use client'

interface SourceBadgeProps {
  sourceName: string
  automationLevel: 'full' | 'semi' | 'manual'
}

const DOT_CLASSES: Record<SourceBadgeProps['automationLevel'], string> = {
  full: 'bg-green-500',
  semi: 'bg-yellow-500',
  manual: 'bg-red-500',
}

const LEVEL_LABELS: Record<SourceBadgeProps['automationLevel'], string> = {
  full: 'Auto',
  semi: 'Semi-Auto',
  manual: 'Manual',
}

export function SourceBadge({ sourceName, automationLevel }: SourceBadgeProps) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[10px] text-[var(--text-muted)]">
      <span
        className={`inline-block h-2 w-2 rounded-full ${DOT_CLASSES[automationLevel]}`}
      />
      <span className="font-medium">{sourceName}</span>
      <span className="text-[var(--text-muted)]">{LEVEL_LABELS[automationLevel]}</span>
    </span>
  )
}
