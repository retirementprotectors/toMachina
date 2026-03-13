'use client'

import { useState, useRef, useEffect } from 'react'

/* Portal logo PNGs — the REAL logos, on-dark variants */
const PORTAL_LOGOS: Record<string, string> = {
  prodash: '/prodashx-on-dark.png',
  riimo: '/riimo-on-dark.png',
  sentinel: '/sentinel-on-dark.png',
}

const PORTAL_MARKS: Record<string, string> = {
  prodash: '/prodashx-mark.svg',
  riimo: '/riimo-mark.svg',
  sentinel: '/sentinel-mark.svg',
}

interface PortalDef {
  key: string
  label: string
  color: string
  prodUrl: string
  devPort: number
}

const PORTALS: PortalDef[] = [
  { key: 'prodash', label: 'ProDashX', color: '#4264a7', prodUrl: 'https://prodash.tomachina.com', devPort: 3001 },
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
  const markSrc = PORTAL_MARKS[currentPortal] || PORTAL_MARKS.prodash

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
          {/* Current Portal — just the logo, highlighted */}
          <div
            className="flex items-center justify-center px-4 py-3 border-b"
            style={{ borderColor: 'var(--border-subtle)', background: `${current.color}10` }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={PORTAL_LOGOS[current.key]}
              alt={current.label}
              style={{ height: '40px', width: 'auto' }}
            />
            <span
              className="material-icons-outlined ml-auto"
              style={{ color: current.color, fontSize: '20px' }}
            >
              check_circle
            </span>
          </div>

          {/* Other Portals — just logos, open in new tab */}
          {others.map((portal) => (
            <a
              key={portal.key}
              href={getPortalUrl(portal)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center px-4 py-3 transition-colors hover:bg-[var(--bg-hover)] border-b"
              style={{ borderColor: 'var(--border-subtle)' }}
              onClick={() => setOpen(false)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={PORTAL_LOGOS[portal.key]}
                alt={portal.label}
                style={{ height: '36px', width: 'auto', opacity: 0.8 }}
              />
              <span
                className="material-icons-outlined ml-auto text-[var(--text-muted)]"
                style={{ fontSize: '14px' }}
              >
                open_in_new
              </span>
            </a>
          ))}

          {/* Footer — toMachina logo */}
          <div
            className="flex items-center justify-center px-3 py-2"
            style={{ borderColor: 'var(--border-subtle)' }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/tomachina-on-dark.png"
              alt="toMachina"
              style={{ height: '18px', width: 'auto', opacity: 0.5 }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
