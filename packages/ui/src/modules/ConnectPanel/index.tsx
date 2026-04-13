'use client'

import { useState, useCallback } from 'react'
import { PanelShell } from '../PanelShell'
import type { TabDef } from '../PanelShell'
import { ConnectSpacesTab } from './ConnectSpacesTab'
import { ConnectDMsTab } from './ConnectDMsTab'
import { ConnectMeetTab } from './ConnectMeetTab'

/* ─── Types ───────────────────────────────────────────────────────────────── */

export interface ConnectPanelProps {
  portal: string
  open: boolean
  onClose: () => void
}

type ConnectTab = 'spaces' | 'dms' | 'meet'

/* ─── Tab definitions (Discovery Doc: "Channels" → Spaces, "People" → DMs) ── */

const CONNECT_TABS: TabDef[] = [
  { key: 'spaces', label: 'Spaces' },
  { key: 'dms',    label: 'DMs' },
  { key: 'meet',   label: 'Meet' },
]

/* ─── ConnectPanel ────────────────────────────────────────────────────────── */

/**
 * TKO-UX-001 — CONNECT slide-out shell.
 *
 * Renders the 3-tab header (Spaces · DMs · Meet) and routes to placeholder
 * tab components. Full tab implementations land in TKO-UX-002, 003, and 004.
 *
 * The shell inherits push-not-overlay behavior from the portal layout:
 * portals apply `marginRight: var(--panel-push-width, 0px)` to the main
 * content area when any panel is open.
 */
export function ConnectPanel({ portal: _portal, open, onClose }: ConnectPanelProps) {
  const [activeTab, setActiveTab] = useState<ConnectTab>('spaces')

  const handleTabChange = useCallback((key: string) => {
    setActiveTab(key as ConnectTab)
  }, [])

  /* Panel title: "CONNECT" at rest. Future sub-tickets will provide contextual
     titles (e.g. "#team-rpi" when a space is selected). */
  const title = 'CONNECT'
  const titleIcon = '💬'

  return (
    <PanelShell
      open={open}
      onClose={onClose}
      title={title}
      titleIcon={titleIcon}
      tabs={CONNECT_TABS}
      activeTab={activeTab}
      onTabChange={handleTabChange}
      testId="connect-panel"
    >
      {activeTab === 'spaces' && <ConnectSpacesTab />}
      {activeTab === 'dms'    && <ConnectDMsTab />}
      {activeTab === 'meet'   && <ConnectMeetTab />}
    </PanelShell>
  )
}
