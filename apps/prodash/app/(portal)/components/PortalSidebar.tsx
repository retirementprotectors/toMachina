'use client'

import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useState, useEffect, useMemo } from 'react'
import { useAuth, buildEntitlementContext, canAccessModule } from '@tomachina/auth'
import type { UserEntitlementContext } from '@tomachina/auth'
import { APP_BRANDS, AppIcon, type AppKey } from '@tomachina/ui'

/* ─── Section Type Styling ─── */
type SectionType = 'workspace' | 'sales' | 'service' | 'pipeline'

const sectionColors: Record<SectionType, string> = {
  workspace: 'var(--module-color)',
  sales: 'var(--module-color)',
  service: 'var(--module-color)',
  pipeline: 'var(--pipeline-color)',
}

/* ─── Nav Item Definition ─── */
interface NavItem {
  key: string
  label: string
  href: string
  icon: string
  moduleKey?: string
}

interface NavSection {
  key: string
  label: string
  type: SectionType
  icon: string
  items: NavItem[]
  defaultExpanded: boolean
  moduleKey?: string
}

/* ─── App Item Definition (Fixed Bottom) ─── */
interface AppItem {
  key: AppKey
  href: string
  moduleKey?: string
}

/* ─── ProDashX Navigation Configuration ─── */
const NAV_SECTIONS: NavSection[] = [
  {
    key: 'workspace',
    label: 'Workspace',
    type: 'workspace',
    icon: 'workspaces',
    defaultExpanded: true,
    moduleKey: 'PRODASH',
    items: [
      { key: 'clients', label: 'Clients', href: '/clients', icon: 'people', moduleKey: 'PRODASH_CLIENTS' },
      { key: 'accounts', label: 'Accounts', href: '/accounts', icon: 'account_balance', moduleKey: 'PRODASH_ACCOUNTS' },
      { key: 'intake', label: 'Quick Intake', href: '/intake', icon: 'person_add', moduleKey: 'PRODASH_CLIENTS' },
    ],
  },
  {
    key: 'sales-centers',
    label: 'Sales Centers',
    type: 'sales',
    icon: 'storefront',
    defaultExpanded: false,
    items: [
      { key: 'medicare', label: 'Medicare', href: '/sales-centers/medicare', icon: 'health_and_safety', moduleKey: 'QUE_MEDICARE' },
      { key: 'life', label: 'Life', href: '/sales-centers/life', icon: 'shield', moduleKey: 'QUE_LIFE' },
      { key: 'annuity', label: 'Annuity', href: '/sales-centers/annuity', icon: 'savings', moduleKey: 'QUE_ANNUITY' },
      { key: 'advisory', label: 'Advisory', href: '/sales-centers/advisory', icon: 'trending_up', moduleKey: 'QUE_MEDSUP' },
    ],
  },
  {
    key: 'service-centers',
    label: 'Service Centers',
    type: 'service',
    icon: 'support_agent',
    defaultExpanded: false,
    items: [
      { key: 'rmd', label: 'RMD Center', href: '/service-centers/rmd', icon: 'calendar_month', moduleKey: 'RMD_CENTER' },
      { key: 'beni', label: 'Beni Center', href: '/service-centers/beni', icon: 'volunteer_activism', moduleKey: 'BENI_CENTER' },
    ],
  },
  {
    key: 'pipelines',
    label: 'Pipelines',
    type: 'pipeline',
    icon: 'route',
    defaultExpanded: false,
    moduleKey: 'PRODASH_PIPELINES',
    items: [
      { key: 'pipelines-board', label: 'Pipeline Board', href: '/pipelines', icon: 'view_kanban' },
    ],
  },
]

/* ─── Fixed Bottom: App Items (default order per spec) ─── */
const APP_ITEMS: AppItem[] = [
  { key: 'atlas', href: '/modules/atlas', moduleKey: 'ATLAS' },
  { key: 'cam', href: '/modules/cam', moduleKey: 'CAM' },
  { key: 'dex', href: '/modules/dex', moduleKey: 'DEX' },
  { key: 'c3', href: '/modules/c3', moduleKey: 'C3' },
  { key: 'command-center', href: '/modules/command-center', moduleKey: 'RPI_COMMAND_CENTER' },
]

/* ─── Fixed Bottom: Connect + Admin ─── */
const CONNECT_ITEM = {
  key: 'connect',
  label: 'RPI Connect',
  href: '/connect',
  icon: 'settings_input_composite',
} as const

const ADMIN_ITEM = {
  key: 'admin',
  label: 'Admin',
  href: '/admin',
  icon: 'admin_panel_settings',
  moduleKey: 'PRODASH_ADMIN',
} as const

const STORAGE_KEY = 'prodash-sidebar-collapsed'
const EXPANDED_KEY = 'prodash-sidebar-expanded'

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

function filterAppItems(
  items: AppItem[],
  ctx: UserEntitlementContext
): AppItem[] {
  return items.filter((item) => {
    if (item.moduleKey && !canAccessModule(ctx, item.moduleKey)) {
      return false
    }
    return true
  })
}

export function PortalSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { user } = useAuth()
  const [collapsed, setCollapsed] = useState(false)
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({})

  const entitlementCtx = useMemo(
    () => buildEntitlementContext(user),
    [user]
  )

  const visibleSections = useMemo(
    () => filterSections(NAV_SECTIONS, entitlementCtx),
    [entitlementCtx]
  )

  const visibleApps = useMemo(
    () => filterAppItems(APP_ITEMS, entitlementCtx),
    [entitlementCtx]
  )

  const showAdmin = useMemo(
    () => !ADMIN_ITEM.moduleKey || canAccessModule(entitlementCtx, ADMIN_ITEM.moduleKey),
    [entitlementCtx]
  )

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
        setExpandedSections(defaults)
      }
    } catch {
      const defaults: Record<string, boolean> = {}
      NAV_SECTIONS.forEach((s) => { defaults[s.key] = s.defaultExpanded })
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
    if (href.includes('?') && pathname === basePath) return true
    return false
  }

  /* Logo click navigates to Clients (rule N1) */
  const handleLogoClick = () => {
    router.push('/clients')
  }

  /* ─── Render a scrollable nav section with twist/rotate header ─── */
  const renderSection = (section: NavSection) => {
    const color = sectionColors[section.type]
    const isExpanded = expandedSections[section.key] ?? section.defaultExpanded

    return (
      <div key={section.key} className="mb-1">
        {/* Section Header: icon + title + rotate arrow (rules N4, N5) */}
        <button
          onClick={() => toggleSection(section.key)}
          className="flex w-full items-center gap-2 px-3 py-1.5 text-left"
          title={collapsed ? section.label : undefined}
        >
          <span
            className="material-icons-outlined"
            style={{ fontSize: '16px', color }}
          >
            {section.icon}
          </span>
          {!collapsed && (
            <>
              <span
                className="flex-1 text-[10px] font-bold uppercase tracking-wider"
                style={{ color }}
              >
                {section.label}
              </span>
              <span
                className="material-icons-outlined text-sm transition-transform duration-200"
                style={{
                  color: 'var(--text-muted)',
                  transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)',
                }}
              >
                expand_more
              </span>
            </>
          )}
        </button>

        {/* Section Items */}
        {(collapsed || isExpanded) && (
          <div
            className="ml-2 pl-2"
            style={{
              borderLeft: collapsed ? 'none' : `2px solid ${color}`,
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
      {/* Header — Portal Logo (SVG) + Toggle */}
      <div className="flex h-14 items-center justify-between border-b border-[var(--border-subtle)] px-3">
        <button
          onClick={handleLogoClick}
          className="flex items-center overflow-hidden"
          title="Go to Clients"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={collapsed ? '/prodashx-mark.svg' : '/prodashx-logo.svg'}
            alt="ProDashX"
            style={{ height: '28px' }}
          />
        </button>
        <button
          onClick={toggleCollapse}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <span className="material-icons-outlined" style={{ fontSize: '20px' }}>
            {collapsed ? 'chevron_right' : 'chevron_left'}
          </span>
        </button>
      </div>

      {/* Scrollable Main Nav */}
      <nav className="flex-1 overflow-y-auto py-2 px-1">
        {visibleSections.map(renderSection)}
      </nav>

      {/* ═══ Fixed Bottom Zone ═══ */}
      <div className="shrink-0">

        {/* Apps — branded icons, fixed at bottom */}
        {visibleApps.length > 0 && (
          <div className="border-t border-[var(--border-subtle)] px-2 py-2">
            {!collapsed && (
              <span className="mb-1.5 block px-1 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Apps
              </span>
            )}
            <div className={collapsed ? 'flex flex-col items-center gap-1' : 'flex flex-col gap-0.5'}>
              {visibleApps.map((app) => {
                const brand = APP_BRANDS[app.key]
                const active = isActive(app.href)
                return (
                  <Link
                    key={app.key}
                    href={app.href}
                    title={brand.label}
                    className={`
                      relative flex items-center gap-2.5 rounded-md transition-all duration-150
                      ${collapsed ? 'justify-center p-1.5' : 'px-2.5 py-1.5'}
                      ${active
                        ? 'bg-[var(--bg-surface)]'
                        : 'hover:bg-[var(--bg-hover)]'
                      }
                    `}
                  >
                    {active && (
                      <div
                        className="absolute left-0 top-1 bottom-1 w-[3px] rounded-r"
                        style={{ background: brand.color }}
                      />
                    )}
                    <AppIcon appKey={app.key} size={collapsed ? 28 : 22} />
                    {!collapsed && (
                      <span className="text-xs font-medium text-[var(--text-secondary)]">
                        {brand.label}
                      </span>
                    )}
                  </Link>
                )
              })}
            </div>
          </div>
        )}

        {/* RPI Connect */}
        <div className="border-t border-[var(--border-subtle)] px-2 py-1">
          <Link
            href={CONNECT_ITEM.href}
            title={collapsed ? CONNECT_ITEM.label : undefined}
            className={`
              relative flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm
              transition-all duration-150
              ${collapsed ? 'justify-center' : ''}
              ${isActive(CONNECT_ITEM.href)
                ? 'bg-[var(--portal-glow)] text-[var(--portal-accent)]'
                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
              }
            `}
          >
            {isActive(CONNECT_ITEM.href) && (
              <div
                className="absolute left-0 top-1 bottom-1 w-[3px] rounded-r"
                style={{ background: 'var(--connect-color)' }}
              />
            )}
            <span
              className="material-icons-outlined"
              style={{ fontSize: '18px', color: 'var(--connect-color)' }}
            >
              {CONNECT_ITEM.icon}
            </span>
            {!collapsed && <span>{CONNECT_ITEM.label}</span>}
          </Link>
        </div>

        {/* Admin — always red */}
        {showAdmin && (
          <div className="border-t border-[var(--border-subtle)] px-2 py-1">
            <Link
              href={ADMIN_ITEM.href}
              title={collapsed ? ADMIN_ITEM.label : undefined}
              className={`
                relative flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm
                transition-all duration-150
                ${collapsed ? 'justify-center' : ''}
                ${isActive(ADMIN_ITEM.href)
                  ? 'bg-[rgba(220,38,38,0.12)] text-[#fca5a5]'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
                }
              `}
            >
              {isActive(ADMIN_ITEM.href) && (
                <div
                  className="absolute left-0 top-1 bottom-1 w-[3px] rounded-r"
                  style={{ background: 'var(--admin-color)' }}
                />
              )}
              <span
                className="material-icons-outlined"
                style={{ fontSize: '18px', color: 'var(--admin-color)' }}
              >
                {ADMIN_ITEM.icon}
              </span>
              {!collapsed && <span>{ADMIN_ITEM.label}</span>}
            </Link>
          </div>
        )}
      </div>
    </aside>
  )
}
