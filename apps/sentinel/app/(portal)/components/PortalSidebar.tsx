'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { useState, useEffect, useMemo } from 'react'
import { useAuth, buildEntitlementContext, canAccessModule } from '@tomachina/auth'
import type { UserEntitlementContext } from '@tomachina/auth'

/* ─── Section Type Styling ─── */
type SectionType = 'workspace' | 'intel' | 'app' | 'admin'

const sectionColors: Record<SectionType, string> = {
  workspace: 'var(--module-color)',
  intel: 'var(--pipeline-color)',
  app: 'var(--app-color)',
  admin: 'var(--admin-color)',
}

const sectionBorderStyle: Record<SectionType, string> = {
  workspace: 'solid',
  intel: 'solid',
  app: 'dashed',
  admin: 'solid',
}

/* ─── Nav Item Definition ─── */
interface NavItem {
  key: string
  label: string
  href: string
  icon: string
  /** Module key from MODULES — used for entitlement gating. Omit for always-visible items. */
  moduleKey?: string
}

interface NavSection {
  key: string
  label: string
  type: SectionType
  items: NavItem[]
  defaultExpanded: boolean
  /** Module key for the entire section — if user lacks access, whole section is hidden. */
  moduleKey?: string
}

/* ─── SENTINEL Navigation Configuration ─── */
const NAV_SECTIONS: NavSection[] = [
  {
    key: 'workspace',
    label: 'Workspace',
    type: 'workspace',
    defaultExpanded: true,
    moduleKey: 'SENTINEL_V2',
    items: [
      { key: 'deals', label: 'Deals', href: '/deals', icon: 'handshake', moduleKey: 'SENTINEL_DEALS' },
      { key: 'producers', label: 'Producers', href: '/producers', icon: 'people', moduleKey: 'SENTINEL_PRODUCERS' },
      { key: 'myrpi', label: 'MyRPI', href: '/myrpi', icon: 'person', moduleKey: 'MY_RPI' },
    ],
  },
  {
    key: 'intel',
    label: 'Intelligence',
    type: 'intel',
    defaultExpanded: true,
    items: [
      { key: 'analysis', label: 'Analysis', href: '/analysis', icon: 'analytics', moduleKey: 'SENTINEL_ANALYSIS' },
      { key: 'market-intel', label: 'Market Intel', href: '/market-intel', icon: 'travel_explore', moduleKey: 'SENTINEL_ANALYSIS' },
    ],
  },
  {
    key: 'apps',
    label: 'Apps',
    type: 'app',
    defaultExpanded: false,
    items: [
      { key: 'david-hub', label: 'DAVID HUB', href: '/modules/david-hub', icon: 'calculate', moduleKey: 'DAVID_HUB' },
      { key: 'cam', label: 'CAM', href: '/modules/cam', icon: 'payments', moduleKey: 'CAM' },
      { key: 'dex', label: 'DEX', href: '/modules/dex', icon: 'description', moduleKey: 'DEX' },
      { key: 'atlas', label: 'ATLAS', href: '/modules/atlas', icon: 'hub', moduleKey: 'ATLAS' },
      { key: 'command-center', label: 'Command Center', href: '/modules/command-center', icon: 'speed', moduleKey: 'RPI_COMMAND_CENTER' },
    ],
  },
]

const ADMIN_SECTION: NavSection = {
  key: 'admin',
  label: 'Admin',
  type: 'admin',
  defaultExpanded: false,
  moduleKey: 'SENTINEL_ADMIN',
  items: [
    { key: 'admin', label: 'Admin', href: '/admin', icon: 'admin_panel_settings', moduleKey: 'SENTINEL_ADMIN' },
  ],
}

const STORAGE_KEY = 'sentinel-sidebar-collapsed'
const EXPANDED_KEY = 'sentinel-sidebar-expanded'

/**
 * Filter nav sections based on the user's entitlement context.
 * Sections with no accessible items are excluded entirely.
 */
function filterSections(
  sections: NavSection[],
  ctx: UserEntitlementContext
): NavSection[] {
  return sections
    .filter((section) => {
      if (section.moduleKey && !canAccessModule(ctx, section.moduleKey)) {
        return false
      }
      return true
    })
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        if (item.moduleKey && !canAccessModule(ctx, item.moduleKey)) {
          return false
        }
        return true
      }),
    }))
    .filter((section) => section.items.length > 0)
}

export function PortalSidebar() {
  const pathname = usePathname()
  const { user } = useAuth()
  const [collapsed, setCollapsed] = useState(false)
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({})

  // Build entitlement context from the authenticated user
  const entitlementCtx = useMemo(
    () => buildEntitlementContext(user),
    [user]
  )

  // Filter nav sections based on entitlements
  const visibleSections = useMemo(
    () => filterSections(NAV_SECTIONS, entitlementCtx),
    [entitlementCtx]
  )

  const visibleAdmin = useMemo(() => {
    const filtered = filterSections([ADMIN_SECTION], entitlementCtx)
    return filtered.length > 0 ? filtered[0] : null
  }, [entitlementCtx])

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
        const defaults: Record<string, boolean> = {}
        NAV_SECTIONS.forEach((s) => { defaults[s.key] = s.defaultExpanded })
        defaults[ADMIN_SECTION.key] = ADMIN_SECTION.defaultExpanded
        setExpandedSections(defaults)
      }
    } catch {
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
    const basePath = href.split('?')[0]
    if (pathname === basePath) return true
    if (pathname.startsWith(basePath + '/')) return true
    return false
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
        {!collapsed ? (
          <img
            src="/sentinel-tm-transparent.png"
            alt="SENTINEL"
            style={{ height: '28px' }}
          />
        ) : null}
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
        {visibleSections.map(renderSection)}
      </nav>

      {/* Admin Footer */}
      {visibleAdmin && (
        <div className="border-t border-[var(--border-subtle)] py-2 px-1">
          {renderSection(visibleAdmin)}
        </div>
      )}
    </aside>
  )
}
