'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'

// ---------------------------------------------------------------------------
// Intake FAB — Floating Action Button for quick data entry
// 3 quick actions: Quick Client, Upload Document, Paste Data
// ---------------------------------------------------------------------------

interface FABAction {
  key: string
  label: string
  icon: string
  color: string
}

const FAB_ACTIONS: FABAction[] = [
  { key: 'quick-client', label: 'Quick Client', icon: 'person_add', color: 'var(--portal)' },
  { key: 'upload-doc', label: 'Upload Document', icon: 'upload_file', color: '#f59e0b' },
  { key: 'paste-data', label: 'Paste Data', icon: 'content_paste', color: '#8b5cf6' },
]

export function IntakeFAB() {
  const router = useRouter()
  const [expanded, setExpanded] = useState(false)
  const [pasteModalOpen, setPasteModalOpen] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [pasteProcessing, setPasteProcessing] = useState(false)
  const fabRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Close expanded menu on click outside
  useEffect(() => {
    if (!expanded) return

    function handleClickOutside(e: MouseEvent) {
      if (fabRef.current && !fabRef.current.contains(e.target as Node)) {
        setExpanded(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [expanded])

  // Close on Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (pasteModalOpen) {
          setPasteModalOpen(false)
          setPasteText('')
        } else if (expanded) {
          setExpanded(false)
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [expanded, pasteModalOpen])

  const handleAction = useCallback((key: string) => {
    setExpanded(false)

    switch (key) {
      case 'quick-client':
        router.push('/intake')
        break
      case 'upload-doc':
        fileInputRef.current?.click()
        break
      case 'paste-data':
        setPasteModalOpen(true)
        break
    }
  }, [router])

  const handleFileSelect = useCallback((_e: React.ChangeEvent<HTMLInputElement>) => {
    // Placeholder — real upload endpoint requires Sprint 11 DEX work
    // For now, show feedback that the feature is coming
    const input = fileInputRef.current
    if (input?.files?.length) {
      // Reset input so the same file can be selected again
      input.value = ''
    }
  }, [])

  const handlePasteProcess = useCallback(async () => {
    if (!pasteText.trim()) return
    setPasteProcessing(true)

    // Placeholder — hooks into intake pipeline in Sprint 11
    // For now, simulate a brief processing delay
    await new Promise(resolve => setTimeout(resolve, 800))

    setPasteProcessing(false)
    setPasteModalOpen(false)
    setPasteText('')
  }, [pasteText])

  return (
    <>
      {/* Hidden file input for document upload */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.png,.jpg,.jpeg"
        onChange={handleFileSelect}
      />

      {/* FAB container */}
      <div ref={fabRef} className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-3">
        {/* Expanded action buttons — animate up from FAB */}
        {expanded && (
          <div className="flex flex-col gap-2 mb-1">
            {FAB_ACTIONS.map((action, index) => (
              <button
                key={action.key}
                onClick={() => handleAction(action.key)}
                className="flex items-center gap-3 rounded-full py-2.5 pl-4 pr-5 text-white shadow-lg transition-all duration-200 hover:brightness-110"
                style={{
                  background: action.color,
                  animationDelay: `${index * 50}ms`,
                  animation: 'fabSlideUp 200ms ease-out forwards',
                  opacity: 0,
                  transform: 'translateY(8px)',
                }}
              >
                <span className="material-icons-outlined" style={{ fontSize: '20px' }}>
                  {action.icon}
                </span>
                <span className="text-sm font-medium whitespace-nowrap">{action.label}</span>
              </button>
            ))}
          </div>
        )}

        {/* Main FAB button */}
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-all duration-200 hover:brightness-110 hover:shadow-xl"
          style={{
            background: 'var(--portal)',
            transform: expanded ? 'rotate(45deg)' : 'rotate(0deg)',
          }}
          title={expanded ? 'Close menu' : 'Quick actions'}
        >
          <span className="material-icons-outlined text-white" style={{ fontSize: '24px' }}>
            bolt
          </span>
        </button>
      </div>

      {/* Inline keyframe animation */}
      <style>{`
        @keyframes fabSlideUp {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>

      {/* Paste Data Modal */}
      {pasteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => {
              setPasteModalOpen(false)
              setPasteText('')
            }}
          />

          {/* Modal */}
          <div className="relative z-10 mx-4 w-full max-w-lg rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 shadow-2xl">
            <div className="mb-4 flex items-center gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-lg"
                style={{ background: 'rgba(139,92,246,0.15)' }}
              >
                <span className="material-icons-outlined" style={{ fontSize: '22px', color: '#8b5cf6' }}>
                  content_paste
                </span>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-[var(--text-primary)]">
                  Paste Portal Data
                </h3>
                <p className="text-xs text-[var(--text-muted)]">
                  Paste data from carrier portals, CSV, or any structured text
                </p>
              </div>
            </div>

            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              rows={8}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-3 text-sm text-[var(--text-primary)] outline-none transition-colors placeholder:text-[var(--text-muted)] focus:border-[var(--portal)]"
              placeholder="Paste data from carrier portal, CSV, or any structured text..."
              autoFocus
            />

            <div className="mt-4 flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  setPasteModalOpen(false)
                  setPasteText('')
                }}
                className="rounded-lg px-4 py-2 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)]"
              >
                Cancel
              </button>
              <button
                onClick={handlePasteProcess}
                disabled={!pasteText.trim() || pasteProcessing}
                className="inline-flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-medium text-white transition-colors hover:brightness-110 disabled:opacity-50"
                style={{ background: '#8b5cf6' }}
              >
                <span className="material-icons-outlined" style={{ fontSize: '18px' }}>
                  {pasteProcessing ? 'hourglass_empty' : 'play_arrow'}
                </span>
                {pasteProcessing ? 'Processing...' : 'Process'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
