'use client'

import { useState, useEffect, useRef } from 'react'

/* ─── Types ─── */

export interface SpecialistOption {
  id: string
  specialist_name: string
  display_name: string
  icon: string
  required_level: number
}

interface SpecialistBadgeProps {
  currentSpecialistId: string
  specialists: SpecialistOption[]
  userLevel: number
  onSpecialistChange: (specialistId: string) => void
}

/* ─── Component ─── */

export function SpecialistBadge({
  currentSpecialistId,
  specialists,
  userLevel,
  onSpecialistChange,
}: SpecialistBadgeProps) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const current = specialists.find((s) => s.id === currentSpecialistId) || {
    id: 'mdj-medicare',
    display_name: 'VOLTRON',
    icon: 'smart_toy',
    specialist_name: 'General',
    required_level: 3,
  }

  // Filter specialists by user level (lower number = higher access)
  const available = specialists.filter((s) => userLevel <= s.required_level)

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setPickerOpen(false)
      }
    }
    if (pickerOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [pickerOpen])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setPickerOpen(!pickerOpen)}
        className="flex items-center gap-1.5 px-2 py-1 rounded-full text-xs
          bg-[var(--bg-secondary)] border border-[var(--border)]
          hover:bg-[var(--bg-tertiary)] transition-colors"
      >
        <span className="material-symbols-outlined text-sm">{current.icon}</span>
        <span className="font-medium">{current.display_name}</span>
        <span className="material-symbols-outlined text-xs">expand_more</span>
      </button>

      {pickerOpen && (
        <div
          className="absolute top-full left-0 mt-1 w-56 rounded-lg shadow-lg border border-[var(--border)]
            bg-[var(--bg-primary)] z-30 overflow-hidden"
        >
          {available.map((spec) => (
            <button
              key={spec.id}
              onClick={() => {
                onSpecialistChange(spec.id)
                setPickerOpen(false)
              }}
              className={`flex items-center gap-2 w-full px-3 py-2 text-left text-sm
                hover:bg-[var(--bg-secondary)] transition-colors ${
                  spec.id === currentSpecialistId
                    ? 'bg-[var(--bg-secondary)] font-medium'
                    : ''
                }`}
            >
              <span className="material-symbols-outlined text-base">{spec.icon}</span>
              <span>{spec.display_name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
