'use client'

import { useState, useCallback, useRef, useEffect, type ReactNode } from 'react'
import { doc, updateDoc } from 'firebase/firestore'
import { getDb } from '@tomachina/db'

// ---------------------------------------------------------------------------
// Per-field inline editing hook & components
// ---------------------------------------------------------------------------

/**
 * InlineField — click to edit a single field. Saves directly to Firestore.
 * No global "Edit" toggle needed.
 */
export function InlineField({
  label,
  value,
  fieldKey,
  docPath,
  type = 'text',
  options,
  mono,
  placeholder,
  formatDisplay,
  onSaved,
}: {
  label: string
  value: string
  fieldKey: string
  docPath: string // e.g. 'clients/abc123' or 'clients/abc123/accounts/xyz'
  type?: 'text' | 'email' | 'tel' | 'date' | 'select' | 'textarea' | 'number'
  options?: { label: string; value: string }[]
  mono?: boolean
  placeholder?: string
  formatDisplay?: (val: string) => string
  onSaved?: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState(value)
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(null)

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
    }
  }, [editing])

  // Sync when prop value changes (real-time listener update)
  useEffect(() => {
    if (!editing) setEditValue(value)
  }, [value, editing])

  const handleSave = useCallback(async () => {
    if (editValue === value) {
      setEditing(false)
      return
    }
    setSaving(true)
    try {
      const ref = doc(getDb(), docPath)
      await updateDoc(ref, {
        [fieldKey]: editValue,
        updated_at: new Date().toISOString(),
      })
      setEditing(false)
      onSaved?.()
    } catch (err) {
      // Error is caught, user sees no change
      console.error('Inline edit save failed:', err)
    } finally {
      setSaving(false)
    }
  }, [editValue, value, docPath, fieldKey, onSaved])

  const handleCancel = useCallback(() => {
    setEditValue(value)
    setEditing(false)
  }, [value])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && type !== 'textarea') handleSave()
      if (e.key === 'Escape') handleCancel()
    },
    [handleSave, handleCancel, type]
  )

  const displayValue = formatDisplay ? formatDisplay(value) : value

  if (!editing) {
    return (
      <div className="group">
        <dt className="text-xs uppercase tracking-wide text-[var(--text-muted)]">{label}</dt>
        <dd
          className={`mt-1 flex items-center gap-1.5 cursor-pointer rounded px-1 -mx-1 py-0.5 transition-colors hover:bg-[var(--bg-surface)] ${mono ? 'font-mono text-sm' : 'text-sm'} text-[var(--text-primary)]`}
          onClick={() => setEditing(true)}
          title="Click to edit"
        >
          {displayValue || <span className="text-[var(--text-muted)]">&mdash;</span>}
          <span className="material-icons-outlined text-[14px] text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity">
            edit
          </span>
        </dd>
      </div>
    )
  }

  const inputClasses =
    'w-full rounded-md border border-[var(--portal)] bg-[var(--bg-surface)] px-3 py-1.5 text-sm text-[var(--text-primary)] outline-none ring-1 ring-[var(--portal)]/30'

  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-[var(--text-muted)]">{label}</dt>
      <div className="mt-1 space-y-1.5">
        {type === 'select' && options ? (
          <select
            ref={inputRef as React.RefObject<HTMLSelectElement>}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={() => setTimeout(handleSave, 150)}
            className={inputClasses}
          >
            <option value="">--</option>
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        ) : type === 'textarea' ? (
          <textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={3}
            className={inputClasses}
            placeholder={placeholder}
          />
        ) : (
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type={type}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            className={inputClasses}
            placeholder={placeholder}
          />
        )}
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-1 rounded bg-[var(--portal)] px-2.5 py-1 text-xs font-medium text-white transition-colors hover:brightness-110 disabled:opacity-50"
          >
            {saving ? (
              <span className="h-3 w-3 animate-spin rounded-full border border-white border-t-transparent" />
            ) : (
              <span className="material-icons-outlined text-[12px]">check</span>
            )}
            Save
          </button>
          <button
            onClick={handleCancel}
            disabled={saving}
            className="inline-flex items-center gap-1 rounded border border-[var(--border)] px-2.5 py-1 text-xs text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)] disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * InlineToggle — for DND-style toggle switches that save immediately
 */
export function InlineToggle({
  label,
  value,
  fieldKey,
  docPath,
}: {
  label: string
  value: boolean
  fieldKey: string
  docPath: string
}) {
  const [saving, setSaving] = useState(false)

  const handleToggle = useCallback(async () => {
    setSaving(true)
    try {
      const ref = doc(getDb(), docPath)
      await updateDoc(ref, {
        [fieldKey]: !value,
        updated_at: new Date().toISOString(),
      })
    } catch (err) {
      console.error('Toggle save failed:', err)
    } finally {
      setSaving(false)
    }
  }, [value, docPath, fieldKey])

  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-sm text-[var(--text-secondary)]">{label}</span>
      <button
        onClick={handleToggle}
        disabled={saving}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
          value ? 'bg-red-500' : 'bg-[var(--bg-surface)]'
        } ${saving ? 'opacity-50' : ''}`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
            value ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  )
}

/**
 * ReadOnlyField — for fields that cannot be edited inline (SSN, computed values, etc.)
 */
export function ReadOnlyField({
  label,
  value,
  mono,
}: {
  label: string
  value: string | number | null | undefined
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
 * InlineSection — collapsible section card used across tabs
 */
export function InlineSection({
  title,
  icon,
  children,
  defaultOpen = true,
}: {
  title: string
  icon?: string
  children: ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)]">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between p-5 text-left"
      >
        <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          {icon && (
            <span className="material-icons-outlined text-[16px] text-[var(--portal)]">{icon}</span>
          )}
          {title}
        </h3>
        <span
          className={`material-icons-outlined text-[18px] text-[var(--text-muted)] transition-transform duration-200 ${
            open ? 'rotate-180' : ''
          }`}
        >
          expand_more
        </span>
      </button>
      {open && <div className="px-5 pb-5">{children}</div>}
    </div>
  )
}
