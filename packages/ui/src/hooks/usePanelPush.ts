'use client'

import { useState, useCallback, useEffect } from 'react'

/* ─── usePanelPush ────────────────────────────────────────────────────────────
 *
 * Manages the open/closed state of a single slide-out panel and provides
 * the CSS custom property value consumed by portal layouts to push main
 * content to the left when the panel is open.
 *
 * Usage:
 *   const { panelOpen, openPanel, closePanel, togglePanel, pushStyle } = usePanelPush()
 *
 * The portal layout should apply pushStyle as an inline style when any panel
 * is open:
 *   <div style={anyPanelOpen ? pushStyle : undefined}>...</div>
 *
 * Portal layouts already set --panel-push-width via a <style> block:
 *   @media (min-width: 1024px)  { :root { --panel-push-width: 360px; } }
 *   @media (min-width: 1400px)  { :root { --panel-push-width: 460px; } }
 *
 * This hook simply governs whether the marginRight should be active.
 * ─────────────────────────────────────────────────────────────────────────── */

export interface UsePanelPushReturn {
  /** Whether the panel is currently open */
  panelOpen: boolean
  /** Open the panel */
  openPanel: () => void
  /** Close the panel */
  closePanel: () => void
  /** Toggle open/closed */
  togglePanel: () => void
  /**
   * Inline style object to spread onto the main content wrapper.
   * Applies `marginRight: 'var(--panel-push-width, 0px)'` when the panel
   * is open — portals already define --panel-push-width via a <style> block.
   */
  pushStyle: React.CSSProperties
}

export function usePanelPush(initialOpen = false): UsePanelPushReturn {
  const [panelOpen, setPanelOpen] = useState(initialOpen)

  const openPanel = useCallback(() => setPanelOpen(true), [])
  const closePanel = useCallback(() => setPanelOpen(false), [])
  const togglePanel = useCallback(() => setPanelOpen((v) => !v), [])

  /* Close on Escape — the PanelShell also handles Escape internally,
     but this ensures callers using the hook directly also get Esc-to-close. */
  useEffect(() => {
    if (!panelOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closePanel()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [panelOpen, closePanel])

  const pushStyle: React.CSSProperties = panelOpen
    ? { marginRight: 'var(--panel-push-width, 0px)' }
    : {}

  return { panelOpen, openPanel, closePanel, togglePanel, pushStyle }
}
