import type { ReactNode } from 'react'

// ---------------------------------------------------------------------------
// Shared UI helpers for CLIENT360 tab content
// ---------------------------------------------------------------------------

/**
 * DetailField — consistent label/value pair.
 * When value is empty, renders an em dash.
 */
export function DetailField({
  label,
  value,
  mono,
}: {
  label: string
  value?: string | number | null
  mono?: boolean
}) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-[var(--text-muted)]">{label}</dt>
      <dd className={`mt-1 text-sm text-[var(--text-primary)] ${mono ? 'font-mono' : ''}`}>
        {value != null && value !== '' ? value : <span className="text-[var(--text-muted)]">&mdash;</span>}
      </dd>
    </div>
  )
}

/**
 * SectionCard — consistent card with a title header.
 */
export function SectionCard({
  title,
  icon,
  children,
  className,
}: {
  title: string
  icon?: string
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={`rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 ${className ?? ''}`}
    >
      <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">
        {icon && (
          <span className="material-icons-outlined text-[16px] text-[var(--portal)]">{icon}</span>
        )}
        {title}
      </h3>
      {children}
    </div>
  )
}

/**
 * FieldGrid — responsive grid for DetailField items.
 */
export function FieldGrid({
  children,
  cols = 3,
}: {
  children: ReactNode
  cols?: 2 | 3 | 4
}) {
  const colClass = {
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
  }[cols]

  return <dl className={`grid gap-x-6 gap-y-4 ${colClass}`}>{children}</dl>
}

/**
 * YesNoIndicator — visual Yes/No badge with icon.
 */
export function YesNoIndicator({ value, label }: { value: string; label: string }) {
  const isYes = value === 'Yes'
  const isEmpty = value === ''

  return (
    <div className="flex items-center gap-3">
      <div
        className={`flex h-9 w-9 items-center justify-center rounded-full ${
          isEmpty
            ? 'bg-[var(--bg-surface)] text-[var(--text-muted)]'
            : isYes
              ? 'bg-emerald-500/15 text-emerald-400'
              : 'bg-red-500/15 text-red-400'
        }`}
      >
        <span className="material-icons-outlined text-[18px]">
          {isEmpty ? 'help_outline' : isYes ? 'check_circle' : 'cancel'}
        </span>
      </div>
      <div>
        <p className="text-sm font-medium text-[var(--text-primary)]">{label}</p>
        <p className="text-xs text-[var(--text-muted)]">
          {isEmpty ? 'Not specified' : isYes ? 'Yes' : 'No'}
        </p>
      </div>
    </div>
  )
}

/**
 * EmptyState — for tabs/sections with no data.
 */
export function EmptyState({ icon, message }: { icon: string; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <span className="material-icons-outlined text-4xl text-[var(--text-muted)]">{icon}</span>
      <p className="mt-3 text-sm text-[var(--text-muted)]">{message}</p>
    </div>
  )
}
