'use client'

import { type ReactNode } from 'react'

export interface KanbanCard {
  id: string
  title: string
  subtitle?: string
  badges?: Array<{ label: string; color?: string }>
  meta?: Array<{ icon?: string; text: string }>
  onClick?: () => void
}

export interface KanbanColumn {
  id: string
  title: string
  cards: KanbanCard[]
  color?: string
}

interface KanbanBoardProps {
  columns: KanbanColumn[]
  emptyMessage?: string
  renderCard?: (card: KanbanCard) => ReactNode
}

function DefaultCard({ card }: { card: KanbanCard }) {
  return (
    <div
      onClick={card.onClick}
      className={`rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] p-3 transition-all hover:border-[var(--border)] hover:bg-[var(--bg-card-hover)] ${card.onClick ? 'cursor-pointer' : ''}`}
    >
      <p className="text-sm font-medium text-[var(--text-primary)] truncate">{card.title}</p>
      {card.subtitle && (
        <p className="mt-0.5 text-xs text-[var(--text-muted)] truncate">{card.subtitle}</p>
      )}
      {card.badges && card.badges.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {card.badges.map((badge, i) => (
            <span
              key={i}
              className="rounded-full px-2 py-0.5 text-[10px] font-medium"
              style={{
                background: badge.color ? `${badge.color}20` : 'var(--bg-surface)',
                color: badge.color || 'var(--text-muted)',
              }}
            >
              {badge.label}
            </span>
          ))}
        </div>
      )}
      {card.meta && card.meta.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-3 text-[10px] text-[var(--text-muted)]">
          {card.meta.map((m, i) => (
            <span key={i} className="flex items-center gap-0.5">
              {m.icon && (
                <span className="material-icons-outlined" style={{ fontSize: '12px' }}>{m.icon}</span>
              )}
              {m.text}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

export function KanbanBoard({ columns, emptyMessage, renderCard }: KanbanBoardProps) {
  const totalCards = columns.reduce((sum, col) => sum + col.cards.length, 0)

  if (totalCards === 0 && emptyMessage) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] py-20">
        <span className="material-icons-outlined text-5xl text-[var(--text-muted)]">view_kanban</span>
        <p className="mt-4 text-sm text-[var(--text-muted)]">{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {columns.map((column) => (
        <div
          key={column.id}
          className="flex w-72 shrink-0 flex-col rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)]"
        >
          {/* Column Header */}
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-[var(--border-subtle)]">
            <div className="flex items-center gap-2">
              {column.color && (
                <span className="h-2 w-2 rounded-full" style={{ background: column.color }} />
              )}
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                {column.title}
              </span>
            </div>
            <span className="rounded-full bg-[var(--bg-surface)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-muted)]">
              {column.cards.length}
            </span>
          </div>

          {/* Cards */}
          <div className="flex flex-col gap-2 p-2 overflow-y-auto max-h-[calc(100vh-240px)]">
            {column.cards.length === 0 ? (
              <div className="flex items-center justify-center py-8 text-xs text-[var(--text-muted)]">
                No items
              </div>
            ) : (
              column.cards.map((card) =>
                renderCard ? (
                  <div key={card.id}>{renderCard(card)}</div>
                ) : (
                  <DefaultCard key={card.id} card={card} />
                )
              )
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
