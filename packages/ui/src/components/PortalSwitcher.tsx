'use client'

import { useState, useRef, useEffect } from 'react'

/* ─── Portal Definitions ─── */
interface PortalDef {
  key: string
  label: string
  description: string
  color: string
  prodUrl: string
  devPort: number
}

const PORTALS: PortalDef[] = [
  {
    key: 'prodash',
    label: 'ProDashX',
    description: 'B2C Client Portal',
    color: '#3d8a8f',
    prodUrl: 'https://prodash.tomachina.com',
    devPort: 3001,
  },
  {
    key: 'riimo',
    label: 'RIIMO',
    description: 'B2E Operations',
    color: '#276749',
    prodUrl: 'https://riimo.tomachina.com',
    devPort: 3002,
  },
  {
    key: 'sentinel',
    label: 'SENTINEL',
    description: 'B2B Partnerships',
    color: '#3CB371',
    prodUrl: 'https://sentinel.tomachina.com',
    devPort: 3003,
  },
]

function isDevMode(): boolean {
  if (typeof window === 'undefined') return false
  return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
}

function getPortalUrl(portal: PortalDef): string {
  if (isDevMode()) {
    return `http://localhost:${portal.devPort}`
  }
  return portal.prodUrl
}

interface PortalSwitcherProps {
  /** The key of the currently active portal ('prodash' | 'riimo' | 'sentinel') */
  currentPortal: string
}

export function PortalSwitcher({ currentPortal }: PortalSwitcherProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const current = PORTALS.find((p) => p.key === currentPortal) ?? PORTALS[0]
  const others = PORTALS.filter((p) => p.key !== currentPortal)

  /* Close on outside click */
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClick)
      return () => document.removeEventListener('mousedown', handleClick)
    }
  }, [open])

  /* Close on Escape */
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    if (open) {
      document.addEventListener('keydown', handleKey)
      return () => document.removeEventListener('keydown', handleKey)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      {/* Trigger Button */}
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-[var(--bg-hover)]"
        style={{ color: current.color }}
        title="Switch portal"
      >
        <span
          className="flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold text-white"
          style={{ background: current.color }}
        >
          {current.label[0]}
        </span>
        <span className="hidden sm:inline">{current.label}</span>
        <span
          className="material-icons-outlined transition-transform"
          style={{
            fontSize: '14px',
            color: 'var(--text-muted)',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        >
          expand_more
        </span>
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className="absolute left-0 top-full z-50 mt-1 w-56 rounded-lg border shadow-lg"
          style={{
            background: 'var(--bg-card)',
            borderColor: 'var(--border)',
          }}
        >
          {/* Current Portal */}
          <div
            className="flex items-center gap-3 border-b px-3 py-2.5"
            style={{ borderColor: 'var(--border-subtle)' }}
          >
            <span
              className="flex h-7 w-7 items-center justify-center rounded-md text-xs font-bold text-white"
              style={{ background: current.color }}
            >
              {current.label[0]}
            </span>
            <div>
              <p className="text-sm font-semibold text-[var(--text-primary)]">{current.label}</p>
              <p className="text-[10px] text-[var(--text-muted)]">{current.description}</p>
            </div>
            <span
              className="material-icons-outlined ml-auto text-sm"
              style={{ color: current.color }}
            >
              check_circle
            </span>
          </div>

          {/* Other Portals */}
          <div className="py-1">
            {others.map((portal) => (
              <a
                key={portal.key}
                href={getPortalUrl(portal)}
                className="flex items-center gap-3 px-3 py-2 transition-colors hover:bg-[var(--bg-hover)]"
                onClick={() => setOpen(false)}
              >
                <span
                  className="flex h-7 w-7 items-center justify-center rounded-md text-xs font-bold text-white"
                  style={{ background: portal.color }}
                >
                  {portal.label[0]}
                </span>
                <div>
                  <p className="text-sm font-medium text-[var(--text-secondary)]">{portal.label}</p>
                  <p className="text-[10px] text-[var(--text-muted)]">{portal.description}</p>
                </div>
                <span
                  className="material-icons-outlined ml-auto text-sm text-[var(--text-muted)]"
                  style={{ fontSize: '14px' }}
                >
                  open_in_new
                </span>
              </a>
            ))}
          </div>

          {/* Footer */}
          <div
            className="border-t px-3 py-2"
            style={{ borderColor: 'var(--border-subtle)' }}
          >
            <p className="text-center text-[10px] text-[var(--text-muted)]">
              toMachina Platform
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
