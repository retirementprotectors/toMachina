'use client'

export type TabId = 'chat' | 'sales' | 'clients'

interface BottomNavProps {
  activeTab: TabId
  onTabChange: (tab: TabId) => void
}

const tabs: { id: TabId; label: string; icon: string }[] = [
  { id: 'chat', label: 'MDJ', icon: 'M' },
  { id: 'sales', label: 'Sales', icon: 'S' },
  { id: 'clients', label: 'Clients', icon: 'C' },
]

export function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  return (
    <nav className="flex items-center justify-around px-4 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]
      bg-[var(--bg-secondary)] border-t border-[var(--border)]">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex flex-col items-center gap-1 px-6 py-2 rounded-xl transition-colors
              ${isActive
                ? 'text-[var(--mdj-purple)]'
                : 'text-[var(--text-muted)] active:text-[var(--text-secondary)]'
              }`}
          >
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold transition-colors
                ${isActive
                  ? 'bg-[var(--mdj-purple-glow)] text-[var(--mdj-purple)]'
                  : 'text-[var(--text-muted)]'
                }`}
            >
              {tab.icon}
            </div>
            <span className="text-[10px] font-semibold">{tab.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
