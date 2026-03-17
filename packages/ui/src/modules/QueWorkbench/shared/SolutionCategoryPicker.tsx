'use client'

const SOLUTION_CATEGORIES = [
  { id: 'INCOME_NOW', label: 'Income NOW', description: 'Immediate income solutions', icon: 'payments' },
  { id: 'INCOME_LATER', label: 'Income LATER', description: 'Deferred income strategies', icon: 'trending_up' },
  { id: 'ESTATE_MAX', label: 'Estate MAX', description: 'Maximum legacy transfer', icon: 'account_balance' },
  { id: 'GROWTH_MAX', label: 'Growth MAX', description: 'Maximum accumulation', icon: 'rocket_launch' },
  { id: 'LTC_MAX', label: 'LTC MAX', description: 'Long-term care optimization', icon: 'local_hospital' },
  { id: 'ROTH_CONVERSION', label: 'ROTH Conversion', description: 'Tax optimization via Roth', icon: 'swap_horiz' },
  { id: 'TAX_HARVEST', label: 'Tax Harvesting', description: 'Strategic tax management', icon: 'bar_chart' },
  { id: 'MGE_DETAILED', label: 'MGE Detailed', description: 'MoneyGuidePro deep dive', icon: 'search' },
] as const

interface SolutionCategoryPickerProps {
  selected: string | null
  onSelect: (category: string) => void
}

export function SolutionCategoryPicker({ selected, onSelect }: SolutionCategoryPickerProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {SOLUTION_CATEGORIES.map((cat) => {
        const isSelected = selected === cat.id
        return (
          <button
            key={cat.id}
            type="button"
            onClick={() => onSelect(cat.id)}
            className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 text-center transition-all ${
              isSelected
                ? 'border-[var(--portal)] shadow-md'
                : 'border-[var(--border-subtle)] hover:border-[var(--text-muted)]'
            } bg-[var(--bg-card)]`}
          >
            <span
              className="material-icons-outlined"
              style={{
                fontSize: '28px',
                color: isSelected ? 'var(--portal)' : 'var(--text-muted)',
              }}
            >
              {cat.icon}
            </span>
            <span
              className={`text-xs font-semibold ${
                isSelected ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'
              }`}
            >
              {cat.label}
            </span>
            <span className="text-[10px] leading-tight text-[var(--text-muted)]">{cat.description}</span>
          </button>
        )
      })}
    </div>
  )
}
