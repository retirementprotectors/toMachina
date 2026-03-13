'use client'

import { useState } from 'react'
import { CommsFeed } from './CommsFeed'
import { CommsCompose } from './CommsCompose'

/* ─── Types ─── */

interface CommsModuleProps {
  open: boolean
  onClose: () => void
}

type CommsView = 'feed' | 'compose'

/* ─── Main Component ─── */

export function CommsModule({ open, onClose }: CommsModuleProps) {
  const [view, setView] = useState<CommsView>('feed')

  const handleClose = () => {
    setView('feed')
    onClose()
  }

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/20 transition-opacity"
          onClick={handleClose}
        />
      )}

      {/* Panel */}
      <div
        className={`fixed right-0 top-0 z-50 flex h-full flex-col bg-[var(--bg-card)] shadow-2xl transition-transform duration-300 ease-in-out ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{ width: '460px' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="material-icons-outlined" style={{ fontSize: '20px', color: 'var(--portal)' }}>forum</span>
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">Communications</h2>
          </div>
          <button
            onClick={handleClose}
            className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
            title="Close panel"
          >
            <span className="material-icons-outlined" style={{ fontSize: '18px' }}>close</span>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {view === 'feed' && <CommsFeed onCompose={() => setView('compose')} />}
          {view === 'compose' && <CommsCompose onBack={() => setView('feed')} />}
        </div>
      </div>
    </>
  )
}
