/**
 * SenseiProvider + useSensei hook — TRK-SNS-006
 *
 * React context wrapping portal layout. Tracks: active state,
 * current module context (from route), available training.
 */

'use client'

import React, { createContext, useContext, useState, useCallback, useMemo } from 'react'
import type { SenseiRegistryEntry } from './sensei-registry'
import { SENSEI_REGISTRY } from './sensei-registry'

interface SenseiContextValue {
  isActive: boolean
  toggle: () => void
  currentModule: string | null
  setCurrentModule: (moduleId: string | null) => void
  registry: SenseiRegistryEntry[]
  showPopup: (moduleId: string, anchorRect: DOMRect) => void
  hidePopup: () => void
  popupState: { moduleId: string; anchorRect: DOMRect } | null
}

const SenseiContext = createContext<SenseiContextValue | null>(null)

export function SenseiProvider({ children }: { children: React.ReactNode }) {
  const [isActive, setIsActive] = useState(false)
  const [currentModule, setCurrentModule] = useState<string | null>(null)
  const [popupState, setPopupState] = useState<{ moduleId: string; anchorRect: DOMRect } | null>(null)

  const toggle = useCallback(() => setIsActive((v) => !v), [])

  const showPopup = useCallback((moduleId: string, anchorRect: DOMRect) => {
    setPopupState({ moduleId, anchorRect })
  }, [])

  const hidePopup = useCallback(() => setPopupState(null), [])

  const value = useMemo(() => ({
    isActive,
    toggle,
    currentModule,
    setCurrentModule,
    registry: SENSEI_REGISTRY,
    showPopup,
    hidePopup,
    popupState,
  }), [isActive, toggle, currentModule, setCurrentModule, showPopup, hidePopup, popupState])

  return (
    <SenseiContext.Provider value={value}>
      {children}
    </SenseiContext.Provider>
  )
}

export function useSensei(): SenseiContextValue {
  const ctx = useContext(SenseiContext)
  if (!ctx) throw new Error('useSensei must be used within SenseiProvider')
  return ctx
}
