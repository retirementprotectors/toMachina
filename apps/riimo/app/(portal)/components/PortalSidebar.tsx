'use client'

import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useState, useEffect, useMemo } from 'react'
import { useAuth, useEntitlements, canAccessModule } from '@tomachina/auth'
import type { UserEntitlementContext } from '@tomachina/auth'
import { APP_BRANDS, AppIcon, type AppKey } from '@tomachina/ui'

/* ─── Section Type Styling ─── */
type SectionType = 'workspace' | 'service' | 'pipeline'

const sectionColors: Record<SectionType, string> = {
  workspace: 'var(--module-color)',
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

/* ─── RIIMO Navigation Configuration ─── */
const NAV_SECTIONS: NavSection[] = [
  {
    key: 'workspace',
    label: 'Workspaces',
    type: 'workspace',
    icon: 'workspaces',
    defaultExpanded: true,
    items: [
      { key: 'dashboard', label: 'Dashboard', href: '/dashboard', icon: 'dashboard', moduleKey: 'MY_RPI' },
      { key: 'tasks', label: 'Tasks', href: '/tasks', icon: 'task_alt', moduleKey: 'MY_RPI' },
      { key: 'org-admin', label: 'Org Admin', href: '/org-admin', icon: 'account_tree', moduleKey: 'ORG_STRUCTURE' },
      { key: 'intelligence', label: 'Intelligence', href: '/intelligence', icon: 'psychology', moduleKey: 'MCP_HUB' },
    ],
  },
  {
    key: 'service-centers',
    label: 'Service',
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
    moduleKey: 'DATA_MAINTENANCE',
    items: [
      { key: 'pipelines-board', label: 'Pipeline Board', href: '/pipelines', icon: 'view_kanban' },
    ],
  },
]

/* ─── Fixed Bottom: App Items (RIIMO order per spec) ─── */
const APP_ITEMS: AppItem[] = [
  { key: 'cam', href: '/modules/cam', moduleKey: 'CAM' },
  { key: 'dex', href: '/modules/dex', moduleKey: 'DEX' },
  { key: 'c3', href: '/modules/c3', moduleKey: 'C3' },
  { key: 'megazord', href: '/modules/megazord', moduleKey: 'MEGAZORD' },
  { key: 'leadership-center', href: '/modules/command-center', moduleKey: 'RPI_COMMAND_CENTER' },
  { key: 'voltron', href: '/command-center', moduleKey: 'VOLTRON' },
  { key: 'forge', href: '/modules/forge', moduleKey: 'FORGE' },
  { key: 'guardian', href: '/admin/guardian', moduleKey: 'GUARDIAN' },
  { key: 'prozone', href: '/modules/prozone', moduleKey: 'PROZONE' },
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
  moduleKey: 'PERMISSIONS',
} as const

const STORAGE_KEY = 'riimo-sidebar-collapsed'
const EXPANDED_KEY = 'riimo-sidebar-expanded'
const APPS_EXPANDED_KEY = 'riimo-apps-expanded'

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

interface PortalSidebarProps {
  onCommsToggle?: () => void
  commsOpen?: boolean
  onConnectToggle?: () => void
  connectOpen?: boolean
  onNotificationsToggle?: () => void
  notificationsOpen?: boolean
  onMdjToggle?: () => void
  mdjOpen?: boolean
  panelOpen?: boolean
}

export function PortalSidebar({ onCommsToggle, commsOpen, onConnectToggle, connectOpen, onNotificationsToggle, notificationsOpen, onMdjToggle, mdjOpen, panelOpen }: PortalSidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { user } = useAuth()
  const { ctx: entitlementCtx } = useEntitlements()
  const [collapsed, setCollapsed] = useState(false)
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({})
  const [appsExpanded, setAppsExpanded] = useState(true)

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

      const savedApps = localStorage.getItem(APPS_EXPANDED_KEY)
      if (savedApps !== null) {
        setAppsExpanded(JSON.parse(savedApps))
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

  const toggleApps = () => {
    setAppsExpanded((prev) => {
      const next = !prev
      try { localStorage.setItem(APPS_EXPANDED_KEY, JSON.stringify(next)) } catch { /* noop */ }
      return next
    })
  }

  /* Auto-collapse when a slide-out panel opens; restore when all panels close */
  useEffect(() => {
    if (panelOpen) {
      if (!collapsed) {
        setCollapsed(true)
      }
    } else {
      try {
        const saved = localStorage.getItem(STORAGE_KEY)
        const shouldCollapse = saved ? JSON.parse(saved) : false
        setCollapsed(shouldCollapse)
      } catch {
        setCollapsed(false)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panelOpen])

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/'
    const basePath = href.split('?')[0]
    if (pathname === basePath) return true
    if (pathname.startsWith(basePath + '/')) return true
    return false
  }

  const handleLogoClick = () => {
    router.push('/dashboard')
  }

  const renderSection = (section: NavSection) => {
    const color = sectionColors[section.type]
    const isExpanded = expandedSections[section.key] ?? section.defaultExpanded

    return (
      <div key={section.key} className="mb-1">
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
      <div className="flex h-14 items-center justify-between border-b border-[var(--border-subtle)] px-3">
        <button
          onClick={handleLogoClick}
          className="flex items-center overflow-hidden"
          title="Go to Dashboard"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={collapsed ? '/riimo-mark.svg' : '/riimo-logo.svg'}
            alt="RIIMO"
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

      <nav className="flex-1 overflow-y-auto py-2 px-1">
        {visibleSections.map(renderSection)}
      </nav>

      <div className="shrink-0">
        {visibleApps.length > 0 && (
          <div className="border-t border-[var(--border-subtle)] px-2 py-2">
            {!collapsed && (
              <button
                onClick={toggleApps}
                className="mb-1.5 flex w-full items-center gap-1.5 px-1 rounded-md hover:bg-[var(--bg-hover)]"
              >
                <span className="material-icons-outlined text-[var(--text-muted)]" style={{ fontSize: '14px' }}>apps</span>
                <span className="flex-1 text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                  Apps
                </span>
                <span
                  className="material-icons-outlined text-sm transition-transform duration-200"
                  style={{
                    color: 'var(--text-muted)',
                    transform: appsExpanded ? 'rotate(0deg)' : 'rotate(-90deg)',
                  }}
                >
                  expand_more
                </span>
              </button>
            )}
            {(collapsed || appsExpanded) && (
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
            )}
          </div>
        )}

        {/* ─── Compact Action Bar ─── */}
        <div
          className={`border-t border-[var(--border-subtle)] ${
            collapsed
              ? 'flex flex-col items-center gap-1 px-1.5 py-2'
              : 'flex items-center justify-around px-2 py-1.5'
          }`}
        >
          {/* Comms */}
          <button
            onClick={onCommsToggle}
            title="Communications"
            className={`flex flex-col items-center justify-center rounded-lg transition-all duration-150 ${
              collapsed ? 'h-9 w-9' : 'h-9 w-9'
            }`}
            style={{
              background: commsOpen ? 'rgba(167,139,250,0.15)' : 'transparent',
            }}
          >
            <span
              className="material-icons-outlined"
              style={{ fontSize: '20px', color: commsOpen ? 'var(--portal)' : 'var(--text-muted)' }}
            >
              forum
            </span>
            {!collapsed && (
              <span className="text-[9px] mt-0.5" style={{ color: commsOpen ? 'var(--portal)' : 'var(--text-muted)' }}>
                Comms
              </span>
            )}
          </button>

          {/* Connect */}
          <button
            onClick={onConnectToggle}
            title="RPI Connect"
            className={`flex flex-col items-center justify-center rounded-lg transition-all duration-150 ${
              collapsed ? 'h-9 w-9' : 'h-9 w-9'
            }`}
            style={{
              background: connectOpen ? 'rgba(104,211,145,0.15)' : 'transparent',
            }}
          >
            <span
              className="material-icons-outlined"
              style={{ fontSize: '20px', color: connectOpen ? 'var(--connect-color)' : 'var(--text-muted)' }}
            >
              hub
            </span>
            {!collapsed && (
              <span className="text-[9px] mt-0.5" style={{ color: connectOpen ? 'var(--connect-color)' : 'var(--text-muted)' }}>
                Connect
              </span>
            )}
          </button>

          {/* Notifications */}
          <button
            onClick={onNotificationsToggle}
            title="Notifications"
            className={`relative flex flex-col items-center justify-center rounded-lg transition-all duration-150 ${
              collapsed ? 'h-9 w-9' : 'h-9 w-9'
            }`}
            style={{
              background: notificationsOpen ? 'rgba(167,139,250,0.15)' : 'transparent',
            }}
          >
            <span
              className="material-icons-outlined"
              style={{ fontSize: '20px', color: notificationsOpen ? 'var(--portal)' : 'var(--text-muted)' }}
            >
              notifications
            </span>
            {!collapsed && (
              <span className="text-[9px] mt-0.5" style={{ color: notificationsOpen ? 'var(--portal)' : 'var(--text-muted)' }}>
                Alerts
              </span>
            )}
          </button>

          {/* VOLTRON */}
          <button
            onClick={onMdjToggle}
            title="VOLTRON"
            className={`flex flex-col items-center justify-center rounded-lg transition-all duration-150 ${
              collapsed ? 'h-9 w-9' : 'h-9 w-9'
            }`}
            style={{
              background: mdjOpen ? 'rgba(167,139,250,0.15)' : 'transparent',
            }}
          >
            <span
              className="material-icons-outlined"
              style={{ fontSize: '20px', color: mdjOpen ? 'var(--portal)' : 'var(--text-muted)' }}
            >
              smart_toy
            </span>
            {!collapsed && (
              <span className="text-[9px] mt-0.5" style={{ color: mdjOpen ? 'var(--portal)' : 'var(--text-muted)' }}>
                VOLTRON
              </span>
            )}
          </button>

          {/* Admin */}
          {showAdmin && (
            <Link
              href={ADMIN_ITEM.href}
              title="Admin"
              className={`flex flex-col items-center justify-center rounded-lg transition-all duration-150 ${
                collapsed ? 'h-9 w-9' : 'h-9 w-9'
              }`}
              style={{
                background: isActive(ADMIN_ITEM.href) ? 'rgba(220,38,38,0.12)' : 'transparent',
              }}
            >
              <span
                className="material-icons-outlined"
                style={{ fontSize: '20px', color: 'var(--admin-color)' }}
              >
                {ADMIN_ITEM.icon}
              </span>
              {!collapsed && (
                <span className="text-[9px] mt-0.5" style={{ color: 'var(--admin-color)' }}>
                  Admin
                </span>
              )}
            </Link>
          )}
        </div>
      </div>
    </aside>
  )
}
