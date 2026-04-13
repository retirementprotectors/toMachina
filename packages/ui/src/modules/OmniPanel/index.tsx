'use client'

import { useState, useEffect, useCallback } from 'react'
import { PanelShell } from '../PanelShell'
import type { TabDef } from '../PanelShell'
import { OmniCallTab } from './OmniCallTab'
import { OmniTextTab } from './OmniTextTab'
import { OmniEmailTab } from './OmniEmailTab'
import { OmniLogTab } from './OmniLogTab'
import type { ClientResult } from '../CommsModule/CommsCompose'

/* ─── Types ─── */

export type OmniTab = 'call' | 'text' | 'email' | 'log'

export interface OmniPanelProps {
  /** Whether the panel is open */
  open: boolean
  /** Called when the panel should close */
  onClose: () => void
  /** Active client from the contact detail page — auto-fills To / dialer */
  activeContact?: ClientResult | null
  /** When set, opens directly on this tab instead of Call */
  initialTab?: OmniTab | null
}

/* ─── Tab definitions ──────────────────────────────────────────────────────
 * CP01: Call first (primary action), Log last (read-only history).
 * Icons are Material Icons symbol names — same pattern as CommsModule.
 * ─────────────────────────────────────────────────────────────────────── */

const OMNI_TABS: TabDef[] = [
  { key: 'call',  label: 'Call',  icon: '📞' },
  { key: 'text',  label: 'Text',  icon: '💬' },
  { key: 'email', label: 'Email', icon: '✉️' },
  { key: 'log',   label: 'Log',   icon: '📋' },
]

/* ─── OmniPanel ─────────────────────────────────────────────────────────── */

export function OmniPanel({ open, onClose, activeContact, initialTab }: OmniPanelProps) {
  const [activeTab, setActiveTab] = useState<OmniTab>('call')

  /* Jump to the requested tab when opened via external trigger */
  useEffect(() => {
    if (open && initialTab) {
      setActiveTab(initialTab)
    }
  }, [open, initialTab])

  const handleClose = useCallback(() => {
    setActiveTab('call')
    onClose()
  }, [onClose])

  const handleTabChange = useCallback((key: string) => {
    setActiveTab(key as OmniTab)
  }, [])

  /* Active tab label for the panel title */
  const tabLabel = OMNI_TABS.find((t) => t.key === activeTab)?.label ?? 'Communications'
  const title = activeContact ? `OMNI · ${activeContact.name}` : `OMNI · ${tabLabel}`

  return (
    <PanelShell
      open={open}
      onClose={handleClose}
      title={title}
      titleIcon="📞"
      tabs={OMNI_TABS}
      activeTab={activeTab}
      onTabChange={handleTabChange}
      testId="omni-panel"
    >
      {/* Only the active tab is rendered — PanelShell handles show/hide */}
      {activeTab === 'call'  && <OmniCallTab activeContact={activeContact} />}
      {activeTab === 'text'  && <OmniTextTab />}
      {activeTab === 'email' && <OmniEmailTab />}
      {activeTab === 'log'   && <OmniLogTab />}
    </PanelShell>
  )
}
