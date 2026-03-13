'use client'

/* ─── Types ─── */

export type BoardView = 'kanban' | 'list' | 'table'

export interface BoardViewToggleProps {
  view: BoardView
  onViewChange: (view: BoardView) => void
}

/* ─── View definitions ─── */

const VIEWS: Array<{ key: BoardView; icon: string; label: string }> = [
  { key: 'kanban', icon: 'view_kanban', label: 'Board' },
  { key: 'list', icon: 'view_list', label: 'List' },
  { key: 'table', icon: 'table_chart', label: 'Table' },
]

/* ─── Component ─── */

export function BoardViewToggle({ view, onViewChange }: BoardViewToggleProps) {
  return (
    <div className="flex rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] p-0.5">
      {VIEWS.map((v) => (
        <button
          key={v.key}
          onClick={() => onViewChange(v.key)}
          className={`flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            view === v.key
              ? 'text-white'
              : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
          }`}
          style={view === v.key ? { background: 'var(--portal)' } : undefined}
          title={v.label}
        >
          <span className="material-icons-outlined" style={{ fontSize: '16px' }}>
            {v.icon}
          </span>
          <span className="hidden sm:inline">{v.label}</span>
        </button>
      ))}
    </div>
  )
}
