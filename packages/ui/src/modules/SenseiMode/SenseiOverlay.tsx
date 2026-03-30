/**
 * SenseiOverlay — TRK-SNS-007
 *
 * When SENSEI Mode ON: renders subtle amber pulsing dots
 * on elements registered in sensei-registry. Non-intrusive.
 */

'use client'

import React, { useEffect, useState } from 'react'
import { useSensei } from './SenseiProvider'

interface DotPosition {
  moduleId: string
  label: string
  top: number
  left: number
}

export function SenseiOverlay() {
  const { isActive, registry, showPopup } = useSensei()
  const [dots, setDots] = useState<DotPosition[]>([])

  useEffect(() => {
    if (!isActive) {
      setDots([])
      return
    }

    const positions: DotPosition[] = []
    for (const entry of registry) {
      const el = document.querySelector(entry.selector)
      if (el) {
        const rect = el.getBoundingClientRect()
        positions.push({
          moduleId: entry.moduleId,
          label: entry.label,
          top: rect.top + 8,
          left: rect.right - 8,
        })
      }
    }
    setDots(positions)
  }, [isActive, registry])

  if (!isActive || dots.length === 0) return null

  return (
    <>
      {dots.map((dot) => (
        <button
          key={dot.moduleId}
          onClick={(e) => {
            const el = document.querySelector(`[data-module="${dot.moduleId}"]`)
            if (el) showPopup(dot.moduleId, el.getBoundingClientRect())
          }}
          className="fixed z-50 cursor-pointer"
          style={{ top: dot.top, left: dot.left }}
          title={`Training: ${dot.label}`}
        >
          <span
            className="block h-3 w-3 rounded-full"
            style={{
              background: 'rgb(245,158,11)',
              boxShadow: '0 0 6px rgba(245,158,11,0.6)',
              animation: 'sensei-pulse 2s ease-in-out infinite',
            }}
          />
        </button>
      ))}
      <style>{`
        @keyframes sensei-pulse {
          0%, 100% { opacity: 0.7; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.3); }
        }
      `}</style>
    </>
  )
}
