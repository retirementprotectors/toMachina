'use client'

// ============================================================================
// StageProgressBar — horizontal progression visualization for pipeline stages
// ============================================================================

interface StageInfo {
  stage_id: string
  stage_name: string
  stage_color?: string
  stage_order: number
}

export interface StageProgressBarProps {
  stages: StageInfo[]
  currentStageId: string
}

export function StageProgressBar({ stages, currentStageId }: StageProgressBarProps) {
  const sorted = [...stages].sort((a, b) => a.stage_order - b.stage_order)
  const currentIndex = sorted.findIndex((s) => s.stage_id === currentStageId)

  if (sorted.length === 0) return null

  return (
    <div className="w-full">
      {/* Desktop: full bar with labels */}
      <div className="hidden sm:block">
        <div className="relative flex items-center justify-between">
          {/* Connecting line */}
          <div className="absolute left-0 right-0 top-1/2 h-0.5 -translate-y-1/2 bg-[var(--border-subtle)]" />

          {sorted.map((stage, idx) => {
            const isComplete = idx < currentIndex
            const isCurrent = idx === currentIndex
            const isFuture = idx > currentIndex

            return (
              <div key={stage.stage_id} className="relative z-10 flex flex-col items-center gap-2">
                {/* Dot */}
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all ${
                    isComplete
                      ? 'border-transparent'
                      : isCurrent
                        ? 'border-transparent shadow-lg'
                        : 'border-[var(--border-subtle)] bg-[var(--bg-surface)]'
                  } ${isCurrent ? 'animate-pulse' : ''}`}
                  style={{
                    backgroundColor: isComplete
                      ? stage.stage_color || 'var(--success)'
                      : isCurrent
                        ? stage.stage_color || 'var(--portal)'
                        : undefined,
                  }}
                >
                  {isComplete ? (
                    <span className="material-icons-outlined text-white" style={{ fontSize: '16px' }}>
                      check
                    </span>
                  ) : isCurrent ? (
                    <span className="material-icons-outlined text-white" style={{ fontSize: '16px' }}>
                      radio_button_checked
                    </span>
                  ) : (
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: isFuture ? 'var(--text-muted)' : 'var(--portal)' }}
                    />
                  )}
                </div>

                {/* Label */}
                <span
                  className={`max-w-[80px] truncate text-center text-[10px] font-medium ${
                    isCurrent
                      ? 'text-[var(--text-primary)]'
                      : isComplete
                        ? 'text-[var(--text-secondary)]'
                        : 'text-[var(--text-muted)]'
                  }`}
                >
                  {stage.stage_name}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Mobile: compact bar */}
      <div className="block sm:hidden">
        <div className="flex items-center gap-1">
          {sorted.map((stage, idx) => {
            const isComplete = idx < currentIndex
            const isCurrent = idx === currentIndex

            return (
              <div key={stage.stage_id} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className={`h-1.5 w-full rounded-full transition-all ${
                    isCurrent ? 'animate-pulse' : ''
                  }`}
                  style={{
                    backgroundColor: isComplete
                      ? stage.stage_color || 'var(--success)'
                      : isCurrent
                        ? stage.stage_color || 'var(--portal)'
                        : 'var(--bg-surface)',
                  }}
                />
              </div>
            )
          })}
        </div>
        <p className="mt-1.5 text-center text-[10px] text-[var(--text-secondary)]">
          Stage {currentIndex + 1} of {sorted.length}: {sorted[currentIndex]?.stage_name ?? 'Unknown'}
        </p>
      </div>
    </div>
  )
}
