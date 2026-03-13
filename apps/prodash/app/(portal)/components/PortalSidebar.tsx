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
  workspace: '#4264a7',
  sales: '#4264a7',
  service: '#4264a7',
  pipeline: '#4264a7',
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
  {
    key: 'workspace',
    label: 'Workspace',
    type: 'workspace',
    icon: 'workspaces',
    defaultExpanded: false,
    moduleKey: 'PRODASH',
    items: [
      { key: 'contacts', label: 'Contacts', href: '/contacts', icon: 'people', moduleKey: 'PRODASH_CLIENTS' },
      { key: 'accounts', label: 'Accounts', href: '/accounts', icon: 'account_balance', moduleKey: 'PRODASH_ACCOUNTS' },
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
      { key: 'access', label: 'Access Center', href: '/service-centers/access', icon: 'security' },
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
  icon: 'hub',
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

  /* Logo click navigates to Contacts (rule N1) */
  const handleLogoClick = () => {
    router.push('/contacts')
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
          className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left transition-colors hover:bg-[rgba(255,255,255,0.03)]"
          title={collapsed ? section.label : undefined}
          style={{
            background: isExpanded ? 'rgba(255,255,255,0.02)' : 'transparent',
          }}
        >
          <span
            className="material-icons-outlined"
            style={{ fontSize: '18px', color }}
          >
            {section.icon}
          </span>
          {!collapsed && (
            <>
              <span
                className="flex-1 text-[11px] font-bold uppercase tracking-wider"
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

        {/* Bottom border on expanded section header */}
        {isExpanded && !collapsed && (
          <div className="mx-3 mb-1" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }} />
        )}

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
                    relative flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm
                    transition-all duration-150
                    ${active
                      ? 'text-[var(--portal-accent)]'
                      : 'text-[var(--text-secondary)] hover:bg-[rgba(74,122,181,0.06)] hover:text-[var(--text-primary)]'
                    }
                  `}
                  style={active ? {
                    background: 'linear-gradient(90deg, rgba(74,122,181,0.12) 0%, transparent 100%)',
                  } : undefined}
                >
                  {/* No vertical bar — active state shown via text/bg color only */}
                  <span
                    className="material-icons-outlined"
                    style={{
                      fontSize: '18px',
                      color: active ? 'var(--portal)' : 'var(--text-muted)',
                    }}
                  >
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
      className="flex flex-col bg-[var(--bg-card)] transition-all duration-200"
      style={{
        width: collapsed ? 60 : 240,
        minWidth: collapsed ? 60 : 240,
      }}
    >
      {/* Header — Portal Logo (large, like GAS version) + Toggle */}
      <div
        style={{
          borderBottom: '1px solid rgba(74,122,181,0.15)',
        }}
      >
        <button
          onClick={handleLogoClick}
          className="flex w-full items-center justify-center"
          style={{ padding: collapsed ? '16px 8px' : '16px 20px 16px 32px' }}
          title="Go to Clients"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={collapsed ? '/prodashx-icon-150w.png' : '/prodashx-transparent.png'}
            alt="ProDashX"
            style={{
              height: 'auto',
              width: collapsed ? '36px' : '100%',
              maxWidth: collapsed ? '36px' : '200px',
            }}
          />
        </button>
        <div className="flex justify-end px-2 pb-0.5">
          <button
            onClick={toggleCollapse}
            className="flex h-5 w-5 items-center justify-center rounded text-[var(--text-muted)] hover:bg-[rgba(74,122,181,0.08)] hover:text-[var(--text-primary)]"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <span className="material-icons-outlined" style={{ fontSize: '14px' }}>
              {collapsed ? 'chevron_right' : 'chevron_left'}
            </span>
          </button>
        </div>
      </div>

      {/* Scrollable Main Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-1">
        {visibleSections.map(renderSection)}
      </nav>

      {/* ═══ Fixed Bottom Zone ═══ */}
      <div className="shrink-0">

        {/* Apps — branded icons, fixed at bottom */}
        {visibleApps.length > 0 && (
          <div className="border-t border-[var(--border-subtle)] px-2 py-2">
            {!collapsed && (
              <div className="mb-1.5 flex items-center gap-1.5 px-1">
                <span className="material-icons-outlined text-[var(--text-muted)]" style={{ fontSize: '14px' }}>apps</span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                  Apps
                </span>
              </div>
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
                    `}
                    style={{
                      background: active
                        ? `${brand.color}20`
                        : `${brand.color}14`,
                    }}
                  >
                    {/* No vertical bar on apps */}
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

        {/* RPI Connect — green-tinted background */}
        <div className="border-t border-[var(--border-subtle)] px-2 py-1">
          <Link
            href={CONNECT_ITEM.href}
            title={collapsed ? CONNECT_ITEM.label : undefined}
            className={`
              relative flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm
              transition-all duration-150
              ${collapsed ? 'justify-center' : ''}
            `}
            style={{
              background: isActive(CONNECT_ITEM.href)
                ? 'rgba(104,211,145,0.15)'
                : 'rgba(104,211,145,0.06)',
              color: isActive(CONNECT_ITEM.href)
                ? 'var(--connect-color)'
                : 'var(--text-secondary)',
            }}
          >
            {isActive(CONNECT_ITEM.href) && (
              <div
                className="absolute left-0 top-1 bottom-1 w-[3px] rounded-r"
                style={{ background: 'var(--connect-color)' }}
              />
            )}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/rpi-shield.png"
              alt="RPI"
              style={{ height: '20px', width: 'auto', opacity: isActive(CONNECT_ITEM.href) ? 1 : 0.7 }}
            />
            {!collapsed && <span>Connect</span>}
          </Link>
        </div>

        {/* Admin — always red-tinted background */}
        {showAdmin && (
          <div className="border-t border-[var(--border-subtle)] px-2 py-1">
            <Link
              href={ADMIN_ITEM.href}
              title={collapsed ? ADMIN_ITEM.label : undefined}
              className={`
                relative flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm
                transition-all duration-150
                ${collapsed ? 'justify-center' : ''}
              `}
              style={{
                background: isActive(ADMIN_ITEM.href)
                  ? 'rgba(220,38,38,0.12)'
                  : 'rgba(220,38,38,0.06)',
                color: isActive(ADMIN_ITEM.href)
                  ? '#fca5a5'
                  : 'var(--text-secondary)',
              }}
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
