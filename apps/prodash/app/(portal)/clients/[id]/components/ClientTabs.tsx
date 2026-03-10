'use client'

export type TabKey =
  | 'contact'
  | 'personal'
  | 'financial'
  | 'health'
  | 'medicare'
  | 'estate'
  | 'accounts'
  | 'connected'
  | 'communications'
  | 'activity'
  | 'integrations'

interface Tab {
  key: TabKey
  label: string
  icon: string
}

const TABS: Tab[] = [
  { key: 'contact', label: 'Connect', icon: 'contact_phone' },
  { key: 'personal', label: 'Personal', icon: 'person' },
  { key: 'financial', label: 'Financial', icon: 'account_balance' },
  { key: 'health', label: 'Health', icon: 'health_and_safety' },
  { key: 'medicare', label: 'Medicare', icon: 'local_hospital' },
  { key: 'estate', label: 'Estate', icon: 'gavel' },
  { key: 'accounts', label: 'Accounts', icon: 'account_balance_wallet' },
  { key: 'connected', label: 'Connected', icon: 'people' },
  { key: 'communications', label: 'Comms', icon: 'forum' },
  { key: 'activity', label: 'Activity', icon: 'history' },
  { key: 'integrations', label: 'Integrations', icon: 'integration_instructions' },
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
              inline-flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium
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
