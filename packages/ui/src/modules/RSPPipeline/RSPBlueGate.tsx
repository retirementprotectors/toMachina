'use client'

/**
 * RSPBlueGate — TRK-RSP-010
 * Blue Gate UI — progress ring + missing items + block state.
 * Like a doctor who runs tests and says "let's get the full picture."
 */

interface GateItem {
  id: string
  label: string
  category: 'field' | 'report' | 'auth'
  complete: boolean
}

interface RSPBlueGateProps {
  instanceId: string
  items: GateItem[]
  onGateCheck?: () => void
}

export function RSPBlueGate({ instanceId, items, onGateCheck }: RSPBlueGateProps) {
  const completed = items.filter(i => i.complete).length
  const total = items.length
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0
  const passed = percent === 100

  const categories = ['field', 'report', 'auth'] as const
  const categoryLabels: Record<string, string> = {
    field: 'Required Fields',
    report: 'Reports & Documents',
    auth: 'Authorizations',
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Blue Gate</h3>
        <span className={`px-3 py-1 rounded-full text-xs font-bold ${
          passed ? 'bg-green-500/20 text-green-400' : 'bg-blue-500/20 text-blue-400'
        }`}>
          {passed ? 'GATE PASSED' : `${percent}% Complete`}
        </span>
      </div>

      {/* Progress Ring */}
      <div className="flex items-center gap-4 p-4 rounded-lg bg-[var(--card)] border border-[var(--border)]">
        <div className="relative w-20 h-20">
          <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
            <circle cx="40" cy="40" r="35" fill="none" stroke="var(--border)" strokeWidth="6" />
            <circle
              cx="40" cy="40" r="35" fill="none"
              stroke={passed ? '#22c55e' : 'var(--portal)'}
              strokeWidth="6"
              strokeDasharray={`${percent * 2.2} 220`}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-lg font-bold">{percent}%</span>
          </div>
        </div>
        <div>
          <div className="text-2xl font-bold">{completed}/{total}</div>
          <div className="text-sm text-[var(--text-muted)]">items complete</div>
        </div>
      </div>

      {/* Items by Category */}
      {categories.map(cat => {
        const catItems = items.filter(i => i.category === cat)
        if (catItems.length === 0) return null
        return (
          <div key={cat} className="p-4 rounded-lg bg-[var(--card)] border border-[var(--border)]">
            <h4 className="text-sm font-semibold text-[var(--portal)] mb-2">{categoryLabels[cat]}</h4>
            <div className="space-y-1.5">
              {catItems.map(item => (
                <div key={item.id} className="flex items-center gap-2 text-sm">
                  <span className={`material-symbols-outlined text-base ${
                    item.complete ? 'text-green-400' : 'text-[var(--text-muted)]'
                  }`}>
                    {item.complete ? 'check_circle' : 'radio_button_unchecked'}
                  </span>
                  <span className={item.complete ? '' : 'text-[var(--text-muted)]'}>{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        )
      })}

      {onGateCheck && (
        <button
          onClick={onGateCheck}
          className="w-full px-4 py-2.5 rounded bg-[var(--portal)] text-white text-sm font-semibold hover:opacity-90"
        >
          Run Gate Check
        </button>
      )}
    </div>
  )
}

export type { RSPBlueGateProps, GateItem }
