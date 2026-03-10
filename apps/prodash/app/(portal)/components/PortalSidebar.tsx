'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { useState, useEffect } from 'react'

/* ─── Section Type Styling ─── */
type SectionType = 'workspace' | 'sales' | 'service' | 'pipeline' | 'app' | 'admin'

const sectionColors: Record<SectionType, string> = {
  workspace: 'var(--module-color)',
  sales: 'var(--module-color)',
  service: 'var(--module-color)',
  pipeline: 'var(--pipeline-color)',
  app: 'var(--app-color)',
  admin: 'var(--admin-color)',
}

const sectionBorderStyle: Record<SectionType, string> = {
  workspace: 'solid',
  sales: 'solid',
  service: 'solid',
  pipeline: 'solid',
  app: 'dashed',
  admin: 'solid',
}

/* ─── Nav Item Definition ─── */
interface NavItem {
  key: string
  label: string
  href: string
  icon: string
}

interface NavSection {
  key: string
  label: string
  type: SectionType
  items: NavItem[]
  defaultExpanded: boolean
}

/* ─── Navigation Configuration ─── */
const NAV_SECTIONS: NavSection[] = [
  {
    key: 'workspace',
    label: 'Workspace',
    type: 'workspace',
    defaultExpanded: true,
    items: [
      { key: 'clients', label: 'Clients', href: '/clients', icon: 'people' },
      { key: 'accounts', label: 'Accounts', href: '/accounts', icon: 'account_balance' },
      { key: 'casework', label: 'My Cases', href: '/casework', icon: 'work' },
    ],
  },
  {
    key: 'sales-centers',
    label: 'Sales Centers',
    type: 'sales',
    defaultExpanded: true,
    items: [
      { key: 'medicare', label: 'Medicare', href: '/sales-centers/medicare', icon: 'health_and_safety' },
      { key: 'life', label: 'Life', href: '/sales-centers/life', icon: 'shield' },
      { key: 'annuity', label: 'Annuity', href: '/sales-centers/annuity', icon: 'savings' },
      { key: 'advisory', label: 'Advisory', href: '/sales-centers/advisory', icon: 'trending_up' },
    ],
  },
  {
    key: 'service-centers',
    label: 'Service Centers',
    type: 'service',
    defaultExpanded: true,
    items: [
      { key: 'rmd', label: 'RMD Center', href: '/service-centers/rmd', icon: 'calendar_month' },
      { key: 'beni', label: 'Beni Center', href: '/service-centers/beni', icon: 'volunteer_activism' },
    ],
  },
  {
    key: 'pipelines',
    label: 'Pipelines',
    type: 'pipeline',
    defaultExpanded: false,
    items: [
      { key: 'discovery', label: 'Discovery', href: '/pipelines?stage=discovery', icon: 'search' },
      { key: 'data-foundation', label: 'Data Foundation', href: '/pipelines?stage=data-foundation', icon: 'storage' },
      { key: 'case-building', label: 'Case Building', href: '/pipelines?stage=case-building', icon: 'construction' },
      { key: 'close', label: 'Close', href: '/pipelines?stage=close', icon: 'check_circle' },
    ],
  },
  {
    key: 'apps',
    label: 'Apps',
    type: 'app',
    defaultExpanded: false,
    items: [
      { key: 'atlas', label: 'ATLAS', href: '/modules/atlas', icon: 'hub' },
      { key: 'cam', label: 'CAM', href: '/modules/cam', icon: 'payments' },
      { key: 'dex', label: 'DEX', href: '/modules/dex', icon: 'description' },
      { key: 'c3', label: 'C3', href: '/modules/c3', icon: 'campaign' },
      { key: 'command-center', label: 'Command Center', href: '/modules/command-center', icon: 'dashboard' },
    ],
  },
]

const ADMIN_SECTION: NavSection = {
  key: 'admin',
  label: 'Admin',
  type: 'admin',
  defaultExpanded: false,
  items: [
    { key: 'connect', label: 'Connect', href: '/connect', icon: 'settings_input_composite' },
    { key: 'admin', label: 'Admin', href: '/admin', icon: 'admin_panel_settings' },
  ],
}

const STORAGE_KEY = 'prodash-sidebar-collapsed'
const EXPANDED_KEY = 'prodash-sidebar-expanded'

export function PortalSidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({})

  /* Load saved state from localStorage */
  useEffect(() => {
    try {
      const savedCollapsed = localStorage.getItem(STORAGE_KEY)
      if (savedCollapsed !== null) {
        setCollapsed(JSON.parse(savedCollapsed))
      }

      const savedExpanded = localStorage.getItem(EXPANDED_KEY)
      if (savedExpanded) {
        setExpandedSections(JSON.parse(savedExpanded))
      } else {
        /* Initialize from defaults */
        const defaults: Record<string, boolean> = {}
        NAV_SECTIONS.forEach((s) => { defaults[s.key] = s.defaultExpanded })
        defaults[ADMIN_SECTION.key] = ADMIN_SECTION.defaultExpanded
        setExpandedSections(defaults)
      }
    } catch {
      /* localStorage unavailable — use defaults */
      const defaults: Record<string, boolean> = {}
      NAV_SECTIONS.forEach((s) => { defaults[s.key] = s.defaultExpanded })
      defaults[ADMIN_SECTION.key] = ADMIN_SECTION.defaultExpanded
      setExpandedSections(defaults)
    }
  }, [])

  const toggleCollapse = () => {
    const next = !collapsed
    setCollapsed(next)
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch { /* noop */ }
  }

  const toggleSection = (key: string) => {
    setExpandedSections((prev) => {
      const next = { ...prev, [key]: !prev[key] }
      try { localStorage.setItem(EXPANDED_KEY, JSON.stringify(next)) } catch { /* noop */ }
      return next
    })
  }

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/'
    return pathname === href || pathname.startsWith(href + '/')
  }

  const renderSection = (section: NavSection) => {
    const color = sectionColors[section.type]
    const borderStyle = sectionBorderStyle[section.type]
    const isExpanded = expandedSections[section.key] ?? section.defaultExpanded

    return (
      <div key={section.key} className="mb-1">
        {/* Section Header */}
        {!collapsed && (
          <button
            onClick={() => toggleSection(section.key)}
            className="flex w-full items-center justify-between px-3 py-1.5 text-left"
          >
            <span
              className="text-[10px] font-bold uppercase tracking-wider"
              style={{ color }}
            >
              {section.label}
            </span>
            <span
              className="material-icons-outlined text-sm transition-transform"
              style={{
                color: 'var(--text-muted)',
                transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)',
              }}
            >
              expand_more
            </span>
          </button>
        )}

        {/* Section Items */}
        {(collapsed || isExpanded) && (
          <div
            className="ml-2 pl-2"
            style={{
              borderLeft: collapsed ? 'none' : `2px ${borderStyle} ${color}`,
            }}
          >
            {section.items.map((item) => {
              const active = isActive(item.href)
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  title={collapsed ? item.label : undefined}
                  className={`
                    relative flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm
                    transition-all duration-150
                    ${active
                      ? 'bg-[var(--portal-glow)] text-[var(--portal-accent)]'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
                    }
                  `}
                >
                  {/* Active indicator bar */}
                  {active && (
                    <div
                      className="absolute left-0 top-1 bottom-1 w-[3px] rounded-r"
                      style={{ background: 'var(--portal)' }}
                    />
                  )}
                  <span className="material-icons-outlined" style={{ fontSize: '18px' }}>
                    {item.icon}
                  </span>
                  {!collapsed && <span>{item.label}</span>}
                </Link>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  return (
    <aside
      className="flex flex-col border-r border-[var(--border)] bg-[var(--bg-secondary)] transition-all duration-200"
      style={{ width: collapsed ? 60 : 240, minWidth: collapsed ? 60 : 240 }}
    >
      {/* Header — Logo + Toggle */}
      <div className="flex h-14 items-center justify-between border-b border-[var(--border-subtle)] px-3">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <span
              className="text-lg font-bold"
              style={{ color: 'var(--portal)' }}
            >
              ProDash
            </span>
          </div>
        )}
        <button
          onClick={toggleCollapse}
          className="flex h-8 w-8 items-center justify-center rounded-md text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <span className="material-icons-outlined" style={{ fontSize: '20px' }}>
            {collapsed ? 'chevron_right' : 'chevron_left'}
          </span>
        </button>
      </div>

      {/* Main Nav */}
      <nav className="flex-1 overflow-y-auto py-2 px-1">
        {NAV_SECTIONS.map(renderSection)}
      </nav>

      {/* Admin Footer */}
      <div className="border-t border-[var(--border-subtle)] py-2 px-1">
        {renderSection(ADMIN_SECTION)}
      </div>
    </aside>
  )
}
