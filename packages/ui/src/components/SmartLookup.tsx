'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

interface SmartLookupItem {
  id: string
  label: string
  sublabel?: string
}

interface SmartLookupProps {
  items: SmartLookupItem[]
  value: string
  onChange: (id: string) => void
  placeholder?: string
  className?: string
}

export function SmartLookup({ items, value, onChange, placeholder = 'Search...', className }: SmartLookupProps) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  const selected = items.find((i) => i.id === value)
  const filtered = query
    ? items.filter(
        (i) =>
          i.label.toLowerCase().includes(query.toLowerCase()) ||
          i.sublabel?.toLowerCase().includes(query.toLowerCase())
      )
    : items

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const handleSelect = useCallback(
    (id: string) => {
      onChange(id)
      setQuery('')
      setOpen(false)
    },
    [onChange]
  )

  return (
    <div ref={wrapperRef} className={`relative ${className || ''}`}>
      <input
        type="text"
        value={open ? query : selected?.label || ''}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className="w-full rounded-md border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--portal)]"
      />
      {open && filtered.length > 0 && (
        <ul className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-md border border-[var(--border)] bg-[var(--bg-surface)] shadow-xl">
          {filtered.slice(0, 50).map((item) => (
            <li
              key={item.id}
              onClick={() => handleSelect(item.id)}
              className="cursor-pointer px-3 py-2 text-sm hover:bg-[var(--bg-hover)]"
            >
              <div className="text-[var(--text-primary)]">{item.label}</div>
              {item.sublabel && (
                <div className="text-xs text-[var(--text-muted)]">{item.sublabel}</div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
