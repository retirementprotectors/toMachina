/**
 * SenseiToggle — TRK-SNS-005
 *
 * Portal header toggle. Amber glow when active.
 * Placed in top-right header bar next to MYST.AI icon.
 */

'use client'

import React from 'react'
import { useSensei } from './SenseiProvider'

export interface SenseiToggleProps {
  className?: string
}

export function SenseiToggle({ className }: SenseiToggleProps) {
  const { isActive, toggle } = useSensei()

  return (
    <button
      onClick={toggle}
      title={isActive ? 'SENSEI Mode ON — click to disable' : 'SENSEI Mode OFF — click to enable training overlay'}
      className={`flex h-8 w-8 items-center justify-center rounded-lg transition-all duration-200 cursor-pointer ${className || ''}`}
      style={{
        background: isActive ? 'rgba(245,158,11,0.15)' : 'transparent',
        boxShadow: isActive ? '0 0 8px rgba(245,158,11,0.4)' : 'none',
      }}
    >
      <span
        className="material-icons-outlined"
        style={{
          fontSize: '20px',
          color: isActive ? 'rgb(245,158,11)' : 'var(--text-muted)',
          transition: 'color 0.2s',
        }}
      >
        school
      </span>
    </button>
  )
}
