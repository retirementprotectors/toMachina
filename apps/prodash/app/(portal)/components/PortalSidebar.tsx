'use client'

import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useState, useEffect, useMemo } from 'react'
import { useAuth, useEntitlements, canAccessModule } from '@tomachina/auth'
import type { UserEntitlementContext } from '@tomachina/auth'
import { APP_BRANDS, AppIcon, type AppKey } from '@tomachina/ui'
import { toSlug } from '../pipelines/pipeline-keys'
import { getAuth } from 'firebase/auth'

/* ─── Section Type Styling ─── */
type SectionType = 'workspace' | 'sales' | 'service'

const sectionColors: Record<SectionType, string> = {
  workspace: '#4264a7',
  sales: '#4264a7',
  service: '#4264a7',
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
    label: 'Workspaces',
    type: 'workspace',
    icon: 'workspaces',
    defaultExpanded: false,
    moduleKey: 'PRODASH',
    items: [
      { key: 'contacts', label: 'Contacts', href: '/contacts', icon: 'people', moduleKey: 'PRODASH_CLIENTS' },
      { key: 'households', label: 'Households', href: '/households', icon: 'home', moduleKey: 'PRODASH_HOUSEHOLDS' },
      { key: 'accounts', label: 'Accounts', href: '/accounts', icon: 'account_balance', moduleKey: 'PRODASH_ACCOUNTS' },
      { key: 'acf', label: 'ACF', href: '/acf', icon: 'folder_open', moduleKey: 'PRODASH_CLIENTS' },
    ],
  },
  {
    key: 'sales-centers',
    label: 'Sales',
    type: 'sales',
    icon: 'storefront',
    defaultExpanded: false,
    items: [],
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
  { key: 'pipeline-studio', href: '/modules/pipeline-studio', moduleKey: 'PIPELINE_STUDIO' },
  { key: 'forge', href: '/modules/forge', moduleKey: 'FORGE' },
  { key: 'guardian', href: '/admin/guardian', moduleKey: 'GUARDIAN' },
  { key: 'prozone', href: '/modules/prozone', moduleKey: 'PROZONE' },
  { key: 'rsp', href: '/modules/rsp', moduleKey: 'RSP' },
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
const APPS_EXPANDED_KEY = 'prodash-apps-expanded'

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
  onCollapsedChange?: (collapsed: boolean) => void
}

export function PortalSidebar({ onCommsToggle, commsOpen, onConnectToggle, connectOpen, onNotificationsToggle, notificationsOpen, onMdjToggle, mdjOpen, panelOpen, onCollapsedChange }: PortalSidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { user } = useAuth()
  const { ctx: entitlementCtx } = useEntitlements()
  const [collapsed, setCollapsed] = useState(false)
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({})
  const [appsExpanded, setAppsExpanded] = useState(true)

  // Dynamic pipeline loading
  const [pipelineItems, setPipelineItems] = useState<Array<{ pipeline_key: string; pipeline_name: string; icon: string; assigned_section: string }>>([])

  useEffect(() => {
    let cancelled = false
    async function loadPipelines() {
      try {
        const auth = getAuth()
        const fbUser = auth.currentUser
        const token = fbUser ? await fbUser.getIdToken() : null
        const res = await fetch('/api/flow/pipelines?portal=PRODASHX&status=active', {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })
        if (!res.ok || cancelled) return
        const json = await res.json()
        if (json.success && json.data) setPipelineItems(Array.isArray(json.data) ? json.data : [])
      } catch { /* silent — sidebar degrades to static items */ }
    }
    if (user) loadPipelines()
    return () => { cancelled = true }
  }, [user])

  // Inject pipelines into Sales/Service sections
  // NOTE: We filter entitlements on items first but keep all sections (even empty ones)
  // so pipeline injection can populate them. Empty sections are filtered AFTER injection.
  const sectionsWithPipelines = useMemo(() => {
    const sections = NAV_SECTIONS
      .filter((section) => !section.moduleKey || canAccessModule(entitlementCtx, section.moduleKey))
      .map((section) => ({
        ...section,
        items: section.items.filter((item) => !item.moduleKey || canAccessModule(entitlementCtx, item.moduleKey)),
      }))

    if (pipelineItems.length === 0) return sections.filter(s => s.items.length > 0)

    const isElevated = ['OWNER', 'EXECUTIVE', 'LEADER'].includes(entitlementCtx.userLevel)
    const assignedKeys = entitlementCtx.assignedModules || []
    const visible = isElevated
      ? pipelineItems
      : pipelineItems.filter(p => assignedKeys.includes(p.pipeline_key) || assignedKeys.includes(`PIPELINE_${p.pipeline_key}`))

    return sections.map(section => {
      if (section.key === 'sales-centers') {
        const salesPipelines = visible.filter(p => p.assigned_section === 'sales' || p.assigned_section === 'both')
        return {
          ...section,
          items: [
            ...section.items,
            ...salesPipelines.map(p => ({
              key: `pipe-${p.pipeline_key}`,
              label: p.pipeline_name,
              href: `/pipelines/${toSlug(p.pipeline_key)}`,
              icon: p.icon || 'route',
            })),
          ],
        }
      }
      if (section.key === 'service-centers') {
        const servicePipelines = visible.filter(p => p.assigned_section === 'service' || p.assigned_section === 'both')
        return {
          ...section,
          items: [
            ...section.items,
            ...servicePipelines.map(p => ({
              key: `pipe-${p.pipeline_key}`,
              label: p.pipeline_name,
              href: `/pipelines/${toSlug(p.pipeline_key)}`,
              icon: p.icon || 'route',
            })),
          ],
        }
      }
      return section
    }).filter(s => s.items.length > 0)
  }, [entitlementCtx, pipelineItems])

  const visibleSections = sectionsWithPipelines

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

  /* Auto-collapse when a slide-out panel opens; restore when all panels close */
  useEffect(() => {
    if (panelOpen) {
      // Panel opened: force collapse (don't touch localStorage — this is temporary)
      if (!collapsed) {
        setCollapsed(true)
      }
    } else {
      // All panels closed: restore to user's saved preference
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

  const toggleCollapse = () => {
    const next = !collapsed
    setCollapsed(next)
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch { /* noop */ }
    onCollapsedChange?.(next)
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
              <button
                onClick={toggleApps}
                className="mb-1.5 flex w-full items-center gap-1.5 px-1 rounded-md hover:bg-[rgba(255,255,255,0.05)]"
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
              background: commsOpen ? 'rgba(74,122,181,0.15)' : 'transparent',
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
              background: notificationsOpen ? 'rgba(74,122,181,0.15)' : 'transparent',
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
              background: mdjOpen ? 'rgba(74,122,181,0.15)' : 'transparent',
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
