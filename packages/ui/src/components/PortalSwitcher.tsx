'use client'

import { useState, useRef, useEffect } from 'react'

const PORTAL_MARKS: Record<string, string> = {
  prodash: '/prodashx-mark.svg',
  riimo: '/riimo-mark.svg',
  sentinel: '/sentinel-mark.svg',
}

const TOMACHINA_MARK = '/tomachina-transparent.png'

interface PortalDef {
  key: string
  label: string
  color: string
  prodUrl: string
  devPort: number
}

const PORTALS: PortalDef[] = [
  { key: 'prodash', label: 'ProDashX', color: '#4a7ab5', prodUrl: 'https://prodash.tomachina.com', devPort: 3001 },
  { key: 'riimo', label: 'RIIMO', color: '#a78bfa', prodUrl: 'https://riimo.tomachina.com', devPort: 3002 },
  { key: 'sentinel', label: 'SENTINEL', color: '#40bc58', prodUrl: 'https://sentinel.tomachina.com', devPort: 3003 },
]

function isDevMode(): boolean {
  if (typeof window === 'undefined') return false
  return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
}

function getPortalUrl(portal: PortalDef): string {
  return isDevMode() ? `http://localhost:${portal.devPort}` : portal.prodUrl
}

interface PortalSwitcherProps {
  currentPortal: string
}

export function PortalSwitcher({ currentPortal }: PortalSwitcherProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const current = PORTALS.find((p) => p.key === currentPortal) ?? PORTALS[0]
  const others = PORTALS.filter((p) => p.key !== currentPortal)
  const markSrc = PORTAL_MARKS[currentPortal] || TOMACHINA_MARK

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) {
      document.addEventListener('mousedown', handleClick)
      return () => document.removeEventListener('mousedown', handleClick)
    }
  }, [open])

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
      {/* Trigger: mark + chevron */}
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded-md px-1.5 py-1 transition-colors hover:bg-[rgba(66,100,167,0.08)]"
        title="Switch portal"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={markSrc} alt={current.label} style={{ height: '28px' }} />
        <span
          className="material-icons-outlined transition-transform duration-150"
          style={{ fontSize: '16px', color: 'var(--text-muted)', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
        >
          expand_more
        </span>
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className="absolute left-0 top-full z-50 mt-1 w-56 rounded-lg border overflow-hidden"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}
        >
          {/* Current Portal — styled text label, highlighted */}
          <div
            className="flex items-center px-4 py-3 border-b"
            style={{ borderColor: 'var(--border-subtle)', background: `${current.color}10` }}
          >
            <span style={{ color: current.color, fontWeight: 700, fontSize: '18px' }}>
              {current.label}
            </span>
            <span
              className="material-icons-outlined ml-auto"
              style={{ color: current.color, fontSize: '20px' }}
            >
              check_circle
            </span>
          </div>

          {/* Other Portals — styled text labels, open in new tab */}
          {others.map((portal) => (
            <a
              key={portal.key}
              href={getPortalUrl(portal)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center px-4 py-3 transition-colors hover:bg-[var(--bg-hover)] border-b"
              style={{ borderColor: 'var(--border-subtle)' }}
              onClick={() => setOpen(false)}
            >
              <span style={{ color: portal.color, fontWeight: 700, fontSize: '18px' }}>
                {portal.label}
              </span>
              <span
                className="material-icons-outlined ml-auto text-[var(--text-muted)]"
                style={{ fontSize: '14px' }}
              >
                open_in_new
              </span>
            </a>
          ))}

          {/* Footer — toMachina gear mark */}
          <div
            className="flex items-center justify-center gap-2 px-3 py-2.5"
            style={{ borderColor: 'var(--border-subtle)' }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={TOMACHINA_MARK}
              alt="toMachina — The Machine"
              style={{ height: '22px', width: 'auto', opacity: 0.6 }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
