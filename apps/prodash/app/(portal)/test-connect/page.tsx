'use client'

import { useState } from 'react'
import { ConnectPanel } from '@tomachina/ui/src/modules/ConnectPanel'

/* Standalone test page for the RPI Connect slide-out redesign.
   Navigate to /test-connect to see the panel in action.
   The sidebar/layout wiring will be done during merge. */
export default function TestConnectPage() {
  const [open, setOpen] = useState(true)

  return (
    <div>
      <div className="flex items-center gap-4 p-6">
        <h1 className="text-xl font-bold text-[var(--text-primary)]">RPI Connect — Slide-out Test</h1>
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-1.5 rounded-md h-[34px] px-4 text-xs font-medium text-white transition-colors hover:opacity-90"
          style={{ background: 'var(--connect-color)' }}
        >
          <span className="material-icons-outlined" style={{ fontSize: '16px' }}>hub</span>
          Open RPI Connect
        </button>
      </div>

      <ConnectPanel portal="prodashx" open={open} onClose={() => setOpen(false)} />
    </div>
  )
}
