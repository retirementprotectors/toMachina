'use client'

interface QuickActionsProps {
  onSelect: (prompt: string) => void
}

const quickActions = [
  { label: 'My Pipeline', prompt: 'Show me my pipeline — what\'s closest to closing?', icon: '📊' },
  { label: 'Run a Quote', prompt: 'I need to run a Medicare quote', icon: '💰' },
  { label: 'Client Lookup', prompt: 'Look up a client for me', icon: '🔍' },
  { label: 'Draft Email', prompt: 'Help me draft a follow-up email', icon: '✉️' },
  { label: 'Case Status', prompt: 'What\'s the status of my pending cases?', icon: '📋' },
  { label: 'Today\'s Tasks', prompt: 'What should I be working on today?', icon: '✅' },
]

export function QuickActions({ onSelect }: QuickActionsProps) {
  return (
    <div className="grid grid-cols-2 gap-2 w-full max-w-sm">
      {quickActions.map((action) => (
        <button
          key={action.label}
          onClick={() => onSelect(action.prompt)}
          className="flex items-center gap-2 px-3 py-3 rounded-xl
            bg-[var(--bg-card)] border border-[var(--border)]
            text-[var(--text-secondary)] text-xs font-medium text-left
            active:bg-[var(--bg-card-hover)] active:scale-[0.97] transition-all"
        >
          <span className="text-base">{action.icon}</span>
          <span>{action.label}</span>
        </button>
      ))}
    </div>
  )
}
