'use client'

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  type ReactNode,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react'

/* ─── Types ───────────────────────────────────────────────────────────────── */

/** A single tab definition passed to PanelShell */
export interface TabDef {
  /** Unique key — used to identify the active tab */
  key: string
  /** Display label rendered in the tab bar */
  label: string
  /** Optional emoji or icon string rendered before the label */
  icon?: string
}

export interface PanelShellProps {
  /** Whether the panel is currently open */
  open: boolean
  /** Called when the panel should close (X button, ESC, backdrop click on mobile) */
  onClose: () => void
  /**
   * Panel title.
   * Typically the panel name at rest (e.g. "CONNECT") and the active item
   * name when content is selected (e.g. "#team-rpi"). The parent component
   * is responsible for passing the contextual title — PanelShell just renders it.
   */
  title: string
  /** Optional icon rendered before the title (emoji string) */
  titleIcon?: string
  /** Tab definitions. When supplied, a tab bar is rendered below the title row. */
  tabs?: TabDef[]
  /** The currently active tab key. Required when tabs are supplied. */
  activeTab?: string
  /** Called when the user clicks a tab. Required when tabs are supplied. */
  onTabChange?: (key: string) => void
  /** The content to render in the panel body (should be the active tab content) */
  children: ReactNode
  /** Optional footer content rendered at the very bottom of the panel */
  footer?: ReactNode
  /** Test id for targeting in Playwright tests */
  testId?: string
}

/* ─── Responsive panel width classes ─────────────────────────────────────── */
/* Matches the existing pattern used by CommsModule and MDJPanel              */

const PANEL_CLASSES = [
  'fixed right-0 top-0 z-50 flex h-full flex-col bg-[var(--bg-card)] shadow-2xl',
  'w-screen',                    /* < 1024px: full-screen overlay */
  'lg:w-[360px]',                /* 1024–1399px: compact slide-out */
  'min-[1400px]:w-[460px]',      /* >= 1400px: full width */
].join(' ')

/* ─── PanelShell ──────────────────────────────────────────────────────────── */

export function PanelShell({
  open,
  onClose,
  title,
  titleIcon,
  tabs,
  activeTab,
  onTabChange,
  children,
  footer,
  testId,
}: PanelShellProps) {
  /* Focus trap: capture first/last focusable element refs */
  const panelRef = useRef<HTMLDivElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  /* Slide-in animation via a mounted boolean that lags one frame behind open */
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (open) {
      /* Force a paint before adding translate-x-0 so the transition fires */
      const id = requestAnimationFrame(() => setVisible(true))
      return () => cancelAnimationFrame(id)
    } else {
      setVisible(false)
    }
  }, [open])

  /* Focus the close button when the panel opens */
  useEffect(() => {
    if (open && closeButtonRef.current) {
      closeButtonRef.current.focus()
    }
  }, [open])

  /* Trap focus inside the panel while it is open */
  const handleKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }

      if (e.key !== 'Tab' || !panelRef.current) return

      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      )
      if (focusable.length === 0) return

      const first = focusable[0]
      const last = focusable[focusable.length - 1]

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault()
          last.focus()
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    },
    [onClose],
  )

  if (!open) return null

  return (
    <>
      {/* Mobile backdrop — full-screen overlay gets a dark scrim on small screens */}
      <div
        className="fixed inset-0 z-40 bg-black/40 lg:hidden"
        aria-hidden="true"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        data-testid={testId}
        className={[
          PANEL_CLASSES,
          'transition-transform duration-200 ease-in-out',
          visible ? 'translate-x-0' : 'translate-x-full',
        ].join(' ')}
        onKeyDown={handleKeyDown}
      >
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex-shrink-0 border-b border-[var(--border-primary)] bg-[var(--bg-secondary)]">
          {/* Title row */}
          <div className="flex items-center justify-between px-4 py-3">
            <span className="flex items-center gap-2 font-semibold text-[var(--text-primary)]">
              {titleIcon && <span aria-hidden="true">{titleIcon}</span>}
              <span className="truncate text-sm font-bold">{title}</span>
            </span>
            <button
              ref={closeButtonRef}
              type="button"
              aria-label="Close panel"
              onClick={onClose}
              className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--portal)]"
            >
              ✕
            </button>
          </div>

          {/* Tab bar — only rendered when tabs are provided */}
          {tabs && tabs.length > 0 && (
            <div className="flex" role="tablist" aria-label={`${title} tabs`}>
              {tabs.map((tab) => {
                const isActive = tab.key === activeTab
                return (
                  <button
                    key={tab.key}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    aria-controls={`panel-tab-${tab.key}`}
                    id={`panel-tab-btn-${tab.key}`}
                    onClick={() => onTabChange?.(tab.key)}
                    className={[
                      'flex flex-1 items-center justify-center gap-1 border-b-2 px-2 py-2 text-xs font-bold transition-colors',
                      isActive
                        ? 'border-[var(--portal)] text-[var(--portal)]'
                        : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]',
                    ].join(' ')}
                  >
                    {tab.icon && <span aria-hidden="true">{tab.icon}</span>}
                    {tab.label}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Body ───────────────────────────────────────────────────────── */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {tabs && tabs.length > 0
            ? tabs.map((tab) => (
                <div
                  key={tab.key}
                  id={`panel-tab-${tab.key}`}
                  role="tabpanel"
                  aria-labelledby={`panel-tab-btn-${tab.key}`}
                  hidden={tab.key !== activeTab}
                  className={[
                    'flex min-h-0 flex-1 flex-col overflow-hidden',
                    tab.key !== activeTab ? 'hidden' : '',
                  ].join(' ')}
                >
                  {tab.key === activeTab ? children : null}
                </div>
              ))
            : /* No tabs — render children directly */
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>}
        </div>

        {/* ── Footer ─────────────────────────────────────────────────────── */}
        {footer && (
          <div className="flex-shrink-0 border-t border-[var(--border-primary)]">
            {footer}
          </div>
        )}
      </div>
    </>
  )
}
