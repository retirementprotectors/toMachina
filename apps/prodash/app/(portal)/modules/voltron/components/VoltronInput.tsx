'use client'

import { useCallback, useRef, useState } from 'react'

interface VoltronInputProps {
  onSubmit: (message: string) => void
  disabled?: boolean
  placeholder?: string
}

/**
 * VOLTRON Shared Input — single text field for both Mode 1 (deploy) and Mode 2 (chat).
 *
 * User types a goal or question and presses Enter (or clicks Send).
 * The parent calls classifyIntent() on submit to determine routing.
 * No mode toggle is visible to the user.
 */
export function VoltronInput({ onSubmit, disabled = false, placeholder }: VoltronInputProps) {
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim()
    if (!trimmed || disabled) return
    onSubmit(trimmed)
    setValue('')
  }, [value, disabled, onSubmit])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSubmit()
      }
    },
    [handleSubmit]
  )

  return (
    <div className="relative rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-sm transition-colors focus-within:border-[var(--portal)]">
      <textarea
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder={placeholder ?? 'Ask a question or describe a task to deploy...'}
        rows={2}
        className="w-full resize-none bg-transparent px-4 pt-3 pb-10 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none disabled:opacity-50"
      />
      <div className="absolute bottom-2 right-2 flex items-center gap-2">
        <span className="text-[10px] text-[var(--text-muted)] select-none">
          Enter to send · Shift+Enter for newline
        </span>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={disabled || !value.trim()}
          className="flex items-center gap-1 rounded-lg bg-[var(--portal)] px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          <span className="material-icons-outlined text-[16px]">send</span>
          Send
        </button>
      </div>
    </div>
  )
}
