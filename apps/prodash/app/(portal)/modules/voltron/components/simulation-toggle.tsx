'use client'

interface SimulationToggleProps {
  enabled: boolean
  onChange: (enabled: boolean) => void
  disabled?: boolean
}

/**
 * Toggle switch for VOLTRON simulation mode.
 * When enabled, wire execution shows what would happen without executing.
 */
export function SimulationToggle({ enabled, onChange, disabled }: SimulationToggleProps) {
  return (
    <label
      className={`flex items-center gap-2 select-none ${disabled ? 'opacity-50 pointer-events-none' : 'cursor-pointer'}`}
    >
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        disabled={disabled}
        onClick={() => onChange(!enabled)}
        className={`
          relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent
          transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2
          focus:ring-[var(--portal)] focus:ring-offset-2 focus:ring-offset-[var(--bg-primary)]
          ${enabled ? 'bg-[var(--warning)]' : 'bg-[var(--bg-surface)]'}
        `}
      >
        <span
          className={`
            pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg
            ring-0 transition-transform duration-200 ease-in-out
            ${enabled ? 'translate-x-5' : 'translate-x-0'}
          `}
        />
      </button>
      <span className="text-sm text-[var(--text-secondary)]">
        {enabled ? (
          <span className="flex items-center gap-1">
            <span className="material-icons-outlined text-[16px] text-[var(--warning)]">science</span>
            Simulation
          </span>
        ) : (
          'Live'
        )}
      </span>
    </label>
  )
}
