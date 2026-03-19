'use client'

export type TabKey =
  | 'contact'
  | 'personal'
  | 'estate'
  | 'accounts'
  | 'acf'
  | 'connected'
  | 'access'
  | 'activity'

interface Tab {
  key: TabKey
  label: string
  icon: string
}

// Sprint 7: Removed Financial, Health, Medicare, Integrations, Comms tabs
// Personal tab consolidates personal details, employment, Medicare card info, driver's license
// Sprint 8: Reordered — Connect→Personal→Estate→Accounts→Connected→Access→Activity
// Sprint 9 (TRK-024): Removed Communications tab — comms now handled via slide-out panel
const TABS: Tab[] = [
  { key: 'contact', label: 'Connect', icon: 'contact_phone' },
  { key: 'personal', label: 'Personal', icon: 'person' },
  { key: 'estate', label: 'Estate', icon: 'gavel' },
  { key: 'accounts', label: 'Accounts', icon: 'account_balance_wallet' },
  { key: 'acf', label: 'ACF', icon: 'folder_special' },
  { key: 'connected', label: 'Connected', icon: 'people' },
  { key: 'access', label: 'Access', icon: 'security' },
  { key: 'activity', label: 'Activity', icon: 'history' },
]

interface ClientTabsProps {
  activeTab: TabKey
  onTabChange: (tab: TabKey) => void
}

export function ClientTabs({ activeTab, onTabChange }: ClientTabsProps) {
  return (
    <div className="scrollbar-hide -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
      {TABS.map((tab) => {
        const isActive = tab.key === activeTab
        return (
          <button
            key={tab.key}
            onClick={() => onTabChange(tab.key)}
            className={`
              inline-flex shrink-0 items-center gap-1.5 rounded px-4 py-1.5 text-sm font-medium
              transition-all duration-150
              ${
                isActive
                  ? 'bg-[var(--portal)] text-white shadow-sm shadow-[var(--portal-glow)]'
                  : 'text-[var(--text-muted)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-secondary)]'
              }
            `}
          >
            <span className="material-icons-outlined text-[18px]">{tab.icon}</span>
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
