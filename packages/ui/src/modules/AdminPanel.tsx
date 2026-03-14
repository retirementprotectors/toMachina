'use client'

import { useMemo, useState, useCallback } from 'react'
import {
  query,
  collection,
  doc,
  updateDoc,
  setDoc,
  type Query,
  type DocumentData,
} from 'firebase/firestore'
import { useAuth, useEntitlements } from '@tomachina/auth'
import type { UserLevelName, ModuleAction } from '@tomachina/auth'
import { useCollection } from '@tomachina/db'
import { getDb } from '@tomachina/db/src/firestore'
import { APP_BRANDS, type AppKey } from '../apps/brands'

/* ─── Types ─── */

interface AdminPanelProps {
  portal: string
}

interface UserRecord {
  _id: string
  email?: string
  first_name?: string
  last_name?: string
  display_name?: string
  user_level?: string
  level?: number
  status?: string
  division?: string
  unit?: string
  role_template?: string
  hire_date?: string
  phone?: string
  job_title?: string
  manager_email?: string
  location?: string
  npn?: string
  module_permissions?: Record<string, string[]>
  entitlements?: string[]
  assigned_pipelines?: string[]
  assigned_apps?: string[]
}

interface PipelineRecord {
  _id: string
  name?: string
  category?: string
  status?: string
  stages?: Array<{
    name: string
    order: number
    status?: string
  }>
}

/** Flow pipeline definition from flow_pipelines collection */
interface FlowPipelineRecord {
  _id: string
  pipeline_key?: string
  pipeline_name?: string
  description?: string
  domain?: string
  icon?: string
  status?: string
  assigned_section?: 'sales' | 'service' | null
}

/** Portal app config from portal_config/{portal}/apps/{appKey} */
interface PortalAppConfig {
  _id: string
  enabled: boolean
}

type SectionAssignment = 'sales' | 'service' | null

type AdminTab = 'module-config' | 'pipeline-config' | 'app-config' | 'team-config'

/* ─── Section Definitions (mirrors PortalSidebar NAV_SECTIONS) ─── */

interface ModuleItem {
  key: string
  label: string
  icon: string
  moduleKey?: string
}

interface SectionDef {
  key: string
  label: string
  icon: string
  items: ModuleItem[]
}

const MODULE_SECTIONS: SectionDef[] = [
  {
    key: 'workspace',
    label: 'Workspace',
    icon: 'dashboard',
    items: [
      { key: 'clients', label: 'Clients', icon: 'people', moduleKey: 'PRODASH_CLIENTS' },
      { key: 'accounts', label: 'Accounts', icon: 'account_balance', moduleKey: 'PRODASH_ACCOUNTS' },
      { key: 'casework', label: 'My Cases', icon: 'work', moduleKey: 'PRODASH_PIPELINES' },
      { key: 'myrpi', label: 'MyRPI', icon: 'person', moduleKey: 'MY_RPI' },
      { key: 'intake', label: 'Quick Intake', icon: 'person_add', moduleKey: 'PRODASH_CLIENTS' },
    ],
  },
  {
    key: 'sales-centers',
    label: 'Sales Centers',
    icon: 'storefront',
    items: [
      { key: 'medicare', label: 'Medicare', icon: 'health_and_safety', moduleKey: 'QUE_MEDICARE' },
      { key: 'life', label: 'Life', icon: 'shield', moduleKey: 'QUE_LIFE' },
      { key: 'annuity', label: 'Annuity', icon: 'savings', moduleKey: 'QUE_ANNUITY' },
      { key: 'advisory', label: 'Advisory', icon: 'trending_up', moduleKey: 'QUE_MEDSUP' },
    ],
  },
  {
    key: 'service-centers',
    label: 'Service Centers',
    icon: 'support_agent',
    items: [
      { key: 'rmd', label: 'RMD Center', icon: 'calendar_month', moduleKey: 'RMD_CENTER' },
      { key: 'beni', label: 'Beni Center', icon: 'volunteer_activism', moduleKey: 'BENI_CENTER' },
    ],
  },
  {
    key: 'pipelines',
    label: 'Pipelines',
    icon: 'view_kanban',
    items: [
      { key: 'pipeline-board', label: 'Pipeline Board', icon: 'view_kanban', moduleKey: 'PRODASH_PIPELINES' },
      { key: 'discovery-kit', label: 'Discovery Kit', icon: 'assignment', moduleKey: 'DISCOVERY_KIT' },
      { key: 'discovery', label: 'Discovery', icon: 'search', moduleKey: 'PRODASH_PIPELINES' },
      { key: 'data-foundation', label: 'Data Foundation', icon: 'storage', moduleKey: 'PRODASH_PIPELINES' },
      { key: 'case-building', label: 'Case Building', icon: 'construction', moduleKey: 'PRODASH_PIPELINES' },
      { key: 'close', label: 'Close', icon: 'check_circle', moduleKey: 'PRODASH_PIPELINES' },
    ],
  },
  {
    key: 'apps',
    label: 'Apps',
    icon: 'apps',
    items: [
      { key: 'atlas', label: 'ATLAS', icon: 'hub', moduleKey: 'ATLAS' },
      { key: 'cam', label: 'CAM', icon: 'payments', moduleKey: 'CAM' },
      { key: 'dex', label: 'DEX', icon: 'description', moduleKey: 'DEX' },
      { key: 'c3', label: 'C3', icon: 'campaign', moduleKey: 'C3' },
      { key: 'command-center', label: 'Command Center', icon: 'dashboard', moduleKey: 'RPI_COMMAND_CENTER' },
    ],
  },
]

const ALL_ACTIONS: ModuleAction[] = ['VIEW', 'EDIT', 'ADD']

const ACTION_ICONS: Record<ModuleAction, string> = {
  VIEW: 'visibility',
  EDIT: 'edit',
  ADD: 'add_circle',
}

/** Elevated roles that get all access locked */
const ELEVATED_LEVELS = ['Owner', 'Executive', 'Leader']

/** Icon map for pipeline domain categories */
const DOMAIN_ICONS: Record<string, string> = {
  securities: 'trending_up',
  life: 'shield',
  annuity: 'savings',
  medicare: 'health_and_safety',
  legacy: 'volunteer_activism',
  retirement: 'account_balance',
  prospect: 'person_search',
  reactive: 'replay',
}

/* ─── Sub-components ─── */

function EntitlementBadge({
  action,
  active,
  editable,
  onToggle,
}: {
  action: ModuleAction
  active: boolean
  editable: boolean
  onToggle: () => void
}) {
  return (
    <button
      onClick={editable ? onToggle : undefined}
      disabled={!editable}
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors ${
        active
          ? 'text-white'
          : 'bg-[var(--bg-surface)] text-[var(--text-muted)]'
      } ${editable ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}`}
      style={active ? { background: 'var(--portal)' } : undefined}
      title={`${action}${editable ? ' (click to toggle)' : ''}`}
    >
      <span className="material-icons-outlined" style={{ fontSize: '10px' }}>
        {ACTION_ICONS[action]}
      </span>
      {action}
    </button>
  )
}

/** Generic toggle switch used by App Config and other tabs */
function ToggleSwitch({
  enabled,
  editable,
  onToggle,
  label,
}: {
  enabled: boolean
  editable: boolean
  onToggle: () => void
  label?: string
}) {
  return (
    <button
      onClick={editable ? onToggle : undefined}
      disabled={!editable}
      className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors ${
        editable ? 'cursor-pointer' : 'cursor-default opacity-70'
      }`}
      style={{ background: enabled ? 'var(--portal)' : 'var(--bg-surface)' }}
      title={label || (enabled ? 'Enabled' : 'Disabled')}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
          enabled ? 'translate-x-[18px]' : 'translate-x-0.5'
        } mt-0.5`}
      />
    </button>
  )
}

/** Checkbox used in Team Config for pipeline/app assignment */
function AssignmentCheckbox({
  checked,
  editable,
  onToggle,
  label,
}: {
  checked: boolean
  editable: boolean
  onToggle: () => void
  label: string
}) {
  return (
    <button
      onClick={editable ? onToggle : undefined}
      disabled={!editable}
      className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] transition-colors ${
        checked
          ? 'text-white'
          : 'bg-[var(--bg-surface)] text-[var(--text-muted)]'
      } ${editable ? 'cursor-pointer hover:opacity-80' : 'cursor-default opacity-70'}`}
      style={checked ? { background: 'var(--portal)' } : undefined}
      title={`${label}${!editable ? ' (locked)' : checked ? ' (click to remove)' : ' (click to assign)'}`}
    >
      <span className="material-icons-outlined" style={{ fontSize: '12px' }}>
        {checked ? 'check_box' : 'check_box_outline_blank'}
      </span>
      {label}
    </button>
  )
}

function CollapsibleSection({
  section,
  users,
  currentUserEmail,
  isLeader,
  onEntitlementChange,
}: {
  section: SectionDef
  users: UserRecord[]
  currentUserEmail: string
  isLeader: boolean
  onEntitlementChange: (userId: string, moduleKey: string, action: ModuleAction, enabled: boolean) => void
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)]">
      {/* Section Header */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between px-5 py-3.5"
      >
        <div className="flex items-center gap-2">
          <span className="material-icons-outlined text-[var(--portal)]" style={{ fontSize: '18px' }}>
            {section.icon}
          </span>
          <span className="text-sm font-semibold text-[var(--text-primary)]">{section.label}</span>
          <span className="text-xs text-[var(--text-muted)]">({section.items.length})</span>
        </div>
        <span
          className="material-icons-outlined text-[var(--text-muted)] transition-transform"
          style={{ fontSize: '18px', transform: expanded ? 'rotate(0deg)' : 'rotate(-90deg)' }}
        >
          expand_more
        </span>
      </button>

      {expanded && (
        <div className="border-t border-[var(--border-subtle)] px-5 pb-4 pt-3">
          <div className="space-y-1">
            {section.items.map((item) => {
              if (!item.moduleKey) return null
              const mk = item.moduleKey

              return (
                <ModuleExpandRow
                  key={item.key}
                  item={item}
                  moduleKey={mk}
                  users={users}
                  currentUserEmail={currentUserEmail}
                  isLeader={isLeader}
                  onEntitlementChange={onEntitlementChange}
                />
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

/* ─── Module Expand Row (click module → see people with access) ─── */

function ModuleExpandRow({
  item,
  moduleKey,
  users,
  currentUserEmail,
  isLeader,
  onEntitlementChange,
}: {
  item: ModuleItem
  moduleKey: string
  users: UserRecord[]
  currentUserEmail: string
  isLeader: boolean
  onEntitlementChange: (userId: string, moduleKey: string, action: ModuleAction, enabled: boolean) => void
}) {
  const [open, setOpen] = useState(false)

  // Users who have any permission on this module
  const usersWithAccess = useMemo(() => {
    return users
      .filter((u) => {
        const perms = u.module_permissions?.[moduleKey]
        return perms && perms.length > 0
      })
      .sort((a, b) => {
        const aName = `${a.last_name || ''} ${a.first_name || ''}`
        const bName = `${b.last_name || ''} ${b.first_name || ''}`
        return aName.localeCompare(bName)
      })
  }, [users, moduleKey])

  const currentUser = users.find((u) => u.email === currentUserEmail)
  const myPerms = currentUser?.module_permissions?.[moduleKey] || []

  return (
    <div className="rounded-lg bg-[var(--bg-surface)]">
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen((v) => !v) } }}
        className="flex w-full cursor-pointer items-center justify-between px-3 py-2.5"
      >
        <div className="flex items-center gap-2.5">
          <span className="material-icons-outlined text-[var(--text-muted)]" style={{ fontSize: '16px' }}>
            {item.icon}
          </span>
          <span className="text-sm text-[var(--text-primary)]">{item.label}</span>
          <span className="text-[10px] text-[var(--text-muted)]">
            {usersWithAccess.length} user{usersWithAccess.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* My permissions (always visible) */}
          <div className="flex items-center gap-1">
            {ALL_ACTIONS.map((action) => (
              <EntitlementBadge
                key={action}
                action={action}
                active={myPerms.includes(action)}
                editable={false}
                onToggle={() => {}}
              />
            ))}
          </div>
          <span
            className="material-icons-outlined text-[var(--text-muted)] transition-transform"
            style={{ fontSize: '16px', transform: open ? 'rotate(0deg)' : 'rotate(-90deg)' }}
          >
            expand_more
          </span>
        </div>
      </div>

      {open && usersWithAccess.length > 0 && (
        <div className="border-t border-[var(--border-subtle)] px-3 pb-3 pt-2 space-y-1.5">
          {usersWithAccess.map((teamUser) => {
            const perms = teamUser.module_permissions?.[moduleKey] || []
            const isSelf = teamUser.email === currentUserEmail
            return (
              <div
                key={teamUser._id}
                className="flex items-center justify-between rounded-md bg-[var(--bg-card)] px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <span className="material-icons-outlined text-[var(--text-muted)]" style={{ fontSize: '14px' }}>
                    person
                  </span>
                  <span className="text-xs font-medium text-[var(--text-primary)]">
                    {teamUser.first_name} {teamUser.last_name}
                    {isSelf && <span className="ml-1 text-[10px] text-[var(--text-muted)]">(you)</span>}
                  </span>
                  {teamUser.user_level && (
                    <span className="text-[10px] text-[var(--text-muted)]">{teamUser.user_level}</span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {ALL_ACTIONS.map((action) => (
                    <EntitlementBadge
                      key={action}
                      action={action}
                      active={perms.includes(action)}
                      editable={isLeader && !isSelf}
                      onToggle={() =>
                        onEntitlementChange(
                          teamUser._id,
                          moduleKey,
                          action,
                          !perms.includes(action)
                        )
                      }
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {open && usersWithAccess.length === 0 && (
        <div className="border-t border-[var(--border-subtle)] px-3 py-3">
          <p className="text-xs text-[var(--text-muted)]">No users have access to this module.</p>
        </div>
      )}
    </div>
  )
}

/* ─── Team Config Tab (Item 29 — inverse of Module Config) ─── */

type FlatModule = { key: string; label: string; section: string; sectionKey: string }

const ALL_MODULES_FLAT: FlatModule[] = MODULE_SECTIONS.flatMap((section) =>
  section.items
    .filter((item) => !!item.moduleKey)
    .map((item) => ({ key: item.moduleKey!, label: item.label, section: section.label, sectionKey: section.key }))
)

const LEVEL_ICONS: Record<string, string> = {
  Owner: 'shield',
  Executive: 'star',
  Leader: 'manage_accounts',
  User: 'person',
}

/** All app keys for Team Config assignment */
const ALL_APP_KEYS = Object.keys(APP_BRANDS) as AppKey[]

/* ─── Member row — extracted to a proper component so hooks are valid ─── */

function TeamMemberRow({
  member,
  currentUserEmail,
  isLeader,
  flowPipelines,
  onEntitlementChange,
  onPipelineAssignmentChange,
  onAppAssignmentChange,
}: {
  member: UserRecord
  currentUserEmail: string
  isLeader: boolean
  flowPipelines: FlowPipelineRecord[]
  onEntitlementChange: (userId: string, moduleKey: string, action: ModuleAction, enabled: boolean) => void
  onPipelineAssignmentChange: (userId: string, pipelineKey: string, assigned: boolean) => void
  onAppAssignmentChange: (userId: string, appKey: string, assigned: boolean) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const isSelf = member.email === currentUserEmail

  // Determine if this user has elevated role (all access locked)
  const memberLevel = member.user_level || member.role_template || 'User'
  const normalizedLevel = memberLevel.charAt(0).toUpperCase() + memberLevel.slice(1).toLowerCase()
  const isElevated = ELEVATED_LEVELS.includes(normalizedLevel)

  // Group modules by section, only those with permissions
  const modulesBySectionKey = useMemo(() => {
    const map: Record<string, { sectionLabel: string; items: FlatModule[] }> = {}
    for (const mod of ALL_MODULES_FLAT) {
      const perms = member.module_permissions?.[mod.key]
      if (!perms || perms.length === 0) continue
      if (!map[mod.sectionKey]) {
        map[mod.sectionKey] = { sectionLabel: mod.section, items: [] }
      }
      map[mod.sectionKey].items.push(mod)
    }
    return map
  }, [member.module_permissions])

  const totalModules = useMemo(
    () => Object.values(modulesBySectionKey).reduce((sum, s) => sum + s.items.length, 0),
    [modulesBySectionKey]
  )

  const assignedPipelines = member.assigned_pipelines || []
  const assignedApps = member.assigned_apps || []

  // Count summary for the collapsed row
  const totalPipelines = isElevated ? flowPipelines.length : assignedPipelines.length
  const totalApps = isElevated ? ALL_APP_KEYS.length : assignedApps.length

  return (
    <div className="rounded-lg bg-[var(--bg-surface)]">
      {/* Level 2: Individual user row */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between px-3 py-2.5"
      >
        <div className="flex items-center gap-2">
          <span className="material-icons-outlined text-[var(--text-muted)]" style={{ fontSize: '16px' }}>
            person
          </span>
          <span className="text-sm text-[var(--text-primary)]">
            {member.first_name} {member.last_name}
            {isSelf && <span className="ml-1 text-[10px] text-[var(--text-muted)]">(you)</span>}
          </span>
          {member.division && (
            <span className="rounded-full bg-[var(--bg-card)] px-2 py-0.5 text-[10px] text-[var(--text-muted)]">
              {member.division}
            </span>
          )}
          {member.unit && (
            <span className="text-[10px] text-[var(--text-muted)]">{member.unit}</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-[var(--text-muted)]">
            {totalModules} module{totalModules !== 1 ? 's' : ''}
          </span>
          <span className="text-[10px] text-[var(--text-muted)]">
            {totalPipelines} pipeline{totalPipelines !== 1 ? 's' : ''}
          </span>
          <span className="text-[10px] text-[var(--text-muted)]">
            {totalApps} app{totalApps !== 1 ? 's' : ''}
          </span>
          <span
            className="material-icons-outlined text-[var(--text-muted)] transition-transform"
            style={{ fontSize: '16px', transform: expanded ? 'rotate(0deg)' : 'rotate(-90deg)' }}
          >
            expand_more
          </span>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-[var(--border-subtle)] px-3 pb-3 pt-2 space-y-3">
          {/* Modules Section */}
          <div>
            <div className="mb-1.5 flex items-center gap-1.5">
              <span className="material-icons-outlined text-[var(--portal)]" style={{ fontSize: '14px' }}>grid_view</span>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Modules {isElevated && '(all access)'}
              </span>
            </div>
            {totalModules > 0 ? (
              Object.entries(modulesBySectionKey).map(([sectionKey, { sectionLabel, items }]) => (
                <div key={sectionKey} className="mb-2">
                  <div className="mb-1">
                    <span className="text-[10px] text-[var(--text-muted)]">{sectionLabel}</span>
                  </div>
                  <div className="space-y-1">
                    {items.map((mod) => {
                      const perms = member.module_permissions?.[mod.key] || []
                      return (
                        <div
                          key={mod.key}
                          className="flex items-center justify-between rounded-md bg-[var(--bg-card)] px-3 py-2"
                        >
                          <span className="text-xs text-[var(--text-primary)]">{mod.label}</span>
                          <div className="flex items-center gap-1">
                            {ALL_ACTIONS.map((action) => (
                              <EntitlementBadge
                                key={action}
                                action={action}
                                active={perms.includes(action)}
                                editable={isLeader && !isSelf}
                                onToggle={() =>
                                  onEntitlementChange(member._id, mod.key, action, !perms.includes(action))
                                }
                              />
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-[var(--text-muted)] py-1">No module permissions assigned.</p>
            )}
          </div>

          {/* Pipelines Section */}
          <div>
            <div className="mb-1.5 flex items-center gap-1.5">
              <span className="material-icons-outlined text-[var(--portal)]" style={{ fontSize: '14px' }}>route</span>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Pipelines {isElevated && '(all access)'}
              </span>
            </div>
            {flowPipelines.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {flowPipelines.map((fp) => {
                  const pKey = fp.pipeline_key || fp._id
                  const isAssigned = isElevated || assignedPipelines.includes(pKey)
                  return (
                    <AssignmentCheckbox
                      key={pKey}
                      checked={isAssigned}
                      editable={!isElevated && isLeader && !isSelf}
                      onToggle={() => onPipelineAssignmentChange(member._id, pKey, !isAssigned)}
                      label={fp.pipeline_name || pKey}
                    />
                  )
                })}
              </div>
            ) : (
              <p className="text-xs text-[var(--text-muted)] py-1">No pipelines configured.</p>
            )}
          </div>

          {/* Apps Section */}
          <div>
            <div className="mb-1.5 flex items-center gap-1.5">
              <span className="material-icons-outlined text-[var(--portal)]" style={{ fontSize: '14px' }}>apps</span>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Apps {isElevated && '(all access)'}
              </span>
            </div>
            <div className="flex flex-wrap gap-1">
              {ALL_APP_KEYS.map((appKey) => {
                const brand = APP_BRANDS[appKey]
                const isAssigned = isElevated || assignedApps.includes(appKey)
                return (
                  <AssignmentCheckbox
                    key={appKey}
                    checked={isAssigned}
                    editable={!isElevated && isLeader && !isSelf}
                    onToggle={() => onAppAssignmentChange(member._id, appKey, !isAssigned)}
                    label={brand.label}
                  />
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function TeamConfigTab({
  users,
  currentUserEmail,
  isLeader,
  flowPipelines,
  onEntitlementChange,
  onPipelineAssignmentChange,
  onAppAssignmentChange,
}: {
  users: UserRecord[]
  currentUserEmail: string
  isLeader: boolean
  flowPipelines: FlowPipelineRecord[]
  onEntitlementChange: (userId: string, moduleKey: string, action: ModuleAction, enabled: boolean) => void
  onPipelineAssignmentChange: (userId: string, pipelineKey: string, assigned: boolean) => void
  onAppAssignmentChange: (userId: string, appKey: string, assigned: boolean) => void
}) {
  // AD-1: Active users only
  const activeUsers = useMemo(
    () => users.filter((u) => !u.status || u.status.toLowerCase() === 'active'),
    [users]
  )

  // AD-2: Group by user level (Owner / Executive / Leader / User)
  const levelGroups = useMemo(() => {
    const groups: Record<string, UserRecord[]> = {
      Owner: [],
      Executive: [],
      Leader: [],
      User: [],
    }
    for (const u of activeUsers) {
      const raw = u.user_level || u.role_template || 'User'
      const normalized = raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase()
      if (normalized in groups) groups[normalized].push(u)
      else groups.User.push(u)
    }
    Object.values(groups).forEach((g) =>
      g.sort((a, b) => `${a.last_name}`.localeCompare(`${b.last_name}`))
    )
    return groups
  }, [activeUsers])

  const [expandedLevel, setExpandedLevel] = useState<string | null>(null)

  return (
    <div className="space-y-3">
      {Object.entries(levelGroups)
        .filter(([, members]) => members.length > 0)
        .map(([levelName, members]) => (
          <div key={levelName} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)]">
            {/* Level 1: User Type header */}
            <button
              onClick={() => setExpandedLevel((v) => (v === levelName ? null : levelName))}
              className="flex w-full items-center justify-between px-5 py-3.5"
            >
              <div className="flex items-center gap-2">
                <span className="material-icons-outlined text-[var(--portal)]" style={{ fontSize: '18px' }}>
                  {LEVEL_ICONS[levelName] || 'person'}
                </span>
                <span className="text-sm font-semibold text-[var(--text-primary)]">{levelName}</span>
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-medium text-white"
                  style={{ background: 'var(--portal)' }}
                >
                  {members.length}
                </span>
              </div>
              <span
                className="material-icons-outlined text-[var(--text-muted)] transition-transform"
                style={{ fontSize: '18px', transform: expandedLevel === levelName ? 'rotate(0deg)' : 'rotate(-90deg)' }}
              >
                expand_more
              </span>
            </button>

            {expandedLevel === levelName && (
              <div className="border-t border-[var(--border-subtle)] px-5 pb-4 pt-3 space-y-1">
                {members.map((member) => (
                  <TeamMemberRow
                    key={member._id}
                    member={member}
                    currentUserEmail={currentUserEmail}
                    isLeader={isLeader}
                    flowPipelines={flowPipelines}
                    onEntitlementChange={onEntitlementChange}
                    onPipelineAssignmentChange={onPipelineAssignmentChange}
                    onAppAssignmentChange={onAppAssignmentChange}
                  />
                ))}
              </div>
            )}
          </div>
        ))}
    </div>
  )
}

/* ─── Pipeline Config Tab (with Section Assignment) ─── */

function PipelineConfigCard({
  pipeline,
  isLeader,
  onSectionChange,
}: {
  pipeline: FlowPipelineRecord
  isLeader: boolean
  onSectionChange: (pipelineId: string, section: SectionAssignment) => void
}) {
  const pipelineKey = pipeline.pipeline_key || pipeline._id
  const domainLower = (pipeline.domain || '').toLowerCase()
  const icon = pipeline.icon || DOMAIN_ICONS[domainLower] || 'route'

  return (
    <div className="flex items-center justify-between rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-5 py-4">
      <div className="flex items-center gap-3">
        <span
          className="flex h-9 w-9 items-center justify-center rounded-lg"
          style={{ background: 'var(--portal-glow)' }}
        >
          <span className="material-icons-outlined" style={{ fontSize: '18px', color: 'var(--portal)' }}>
            {icon}
          </span>
        </span>
        <div>
          <h4 className="text-sm font-semibold text-[var(--text-primary)]">
            {pipeline.pipeline_name || pipelineKey}
          </h4>
          <div className="flex items-center gap-2">
            {pipeline.domain && (
              <span className="text-xs text-[var(--text-muted)]">{pipeline.domain}</span>
            )}
            {pipeline.description && (
              <span className="text-xs text-[var(--text-muted)]">{pipeline.description}</span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs text-[var(--text-muted)]">Section:</span>
        <select
          value={pipeline.assigned_section || ''}
          onChange={(e) => {
            const val = e.target.value
            onSectionChange(
              pipeline._id,
              val === 'sales' ? 'sales' : val === 'service' ? 'service' : null
            )
          }}
          disabled={!isLeader}
          className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--portal)] disabled:opacity-50"
        >
          <option value="">Unassigned</option>
          <option value="sales">Sales Centers</option>
          <option value="service">Service Centers</option>
        </select>
      </div>
    </div>
  )
}

function PipelineConfigTab({
  flowPipelines,
  loading,
  isLeader,
  onSectionChange,
}: {
  flowPipelines: FlowPipelineRecord[]
  loading: boolean
  isLeader: boolean
  onSectionChange: (pipelineId: string, section: SectionAssignment) => void
}) {
  // Summary counts
  const counts = useMemo(() => {
    let sales = 0
    let service = 0
    let unassigned = 0
    for (const fp of flowPipelines) {
      if (fp.assigned_section === 'sales') sales++
      else if (fp.assigned_section === 'service') service++
      else unassigned++
    }
    return { sales, service, unassigned }
  }, [flowPipelines])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--portal)] border-t-transparent" />
      </div>
    )
  }

  if (flowPipelines.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-card)] py-16">
        <span className="material-icons-outlined text-4xl text-[var(--text-muted)]">route</span>
        <p className="mt-3 text-sm text-[var(--text-muted)]">
          No flow pipelines configured yet. Pipelines are created via the Pipeline Studio.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Summary counts */}
      <div className="flex gap-3">
        <div className="flex items-center gap-2 rounded-lg bg-[var(--bg-card)] border border-[var(--border-subtle)] px-3 py-2">
          <span className="material-icons-outlined text-[var(--portal)]" style={{ fontSize: '16px' }}>storefront</span>
          <span className="text-xs text-[var(--text-primary)]">{counts.sales} in Sales</span>
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-[var(--bg-card)] border border-[var(--border-subtle)] px-3 py-2">
          <span className="material-icons-outlined text-[var(--portal)]" style={{ fontSize: '16px' }}>support_agent</span>
          <span className="text-xs text-[var(--text-primary)]">{counts.service} in Service</span>
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-[var(--bg-card)] border border-[var(--border-subtle)] px-3 py-2">
          <span className="material-icons-outlined text-[var(--text-muted)]" style={{ fontSize: '16px' }}>help_outline</span>
          <span className="text-xs text-[var(--text-muted)]">{counts.unassigned} Unassigned</span>
        </div>
      </div>

      {/* Pipeline cards */}
      {flowPipelines.map((fp) => (
        <PipelineConfigCard
          key={fp._id}
          pipeline={fp}
          isLeader={isLeader}
          onSectionChange={onSectionChange}
        />
      ))}
    </div>
  )
}

/* ─── App Config Tab ─── */

function AppConfigTab({
  portal,
  appConfigs,
  isLeader,
  onAppToggle,
}: {
  portal: string
  appConfigs: Record<string, boolean>
  isLeader: boolean
  onAppToggle: (appKey: string, enabled: boolean) => void
}) {
  const enabledCount = ALL_APP_KEYS.filter((k) => appConfigs[k] !== false).length

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex items-center gap-2 rounded-lg bg-[var(--bg-card)] border border-[var(--border-subtle)] px-4 py-2.5">
        <span className="material-icons-outlined text-[var(--portal)]" style={{ fontSize: '16px' }}>apps</span>
        <span className="text-xs text-[var(--text-primary)]">
          {enabledCount} of {ALL_APP_KEYS.length} apps enabled for this portal
        </span>
        <span className="ml-2 text-[10px] text-[var(--text-muted)]">
          Leaders, Executives, and Owners always see all apps regardless.
        </span>
      </div>

      {/* App cards */}
      <div className="space-y-2">
        {ALL_APP_KEYS.map((appKey) => {
          const brand = APP_BRANDS[appKey]
          const enabled = appConfigs[appKey] !== false

          return (
            <div
              key={appKey}
              className="flex items-center justify-between rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-5 py-4"
            >
              <div className="flex items-center gap-3">
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-lg"
                  style={{ background: 'var(--portal-glow)' }}
                >
                  <span className="material-icons-outlined" style={{ fontSize: '18px', color: 'var(--portal)' }}>
                    {brand.icon}
                  </span>
                </span>
                <div>
                  <h4 className="text-sm font-semibold text-[var(--text-primary)]">{brand.label}</h4>
                  <span className="text-xs text-[var(--text-muted)]">{brand.description}</span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xs text-[var(--text-muted)]">
                  {enabled ? 'Enabled' : 'Disabled'}
                </span>
                <ToggleSwitch
                  enabled={enabled}
                  editable={isLeader}
                  onToggle={() => onAppToggle(appKey, !enabled)}
                  label={`${brand.label}: ${enabled ? 'Enabled' : 'Disabled'}`}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ─── Pipeline Config (Legacy — stage editor) ─── */

function PipelineCard({
  pipeline,
  isLeader,
  onStageAdd,
  onStageUpdate,
}: {
  pipeline: PipelineRecord
  isLeader: boolean
  onStageAdd: (pipelineId: string, stageName: string) => void
  onStageUpdate: (pipelineId: string, stageIndex: number, name: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [newStageName, setNewStageName] = useState('')
  const sortedStages = useMemo(
    () => [...(pipeline.stages || [])].sort((a, b) => a.order - b.order),
    [pipeline.stages]
  )

  const handleAddStage = () => {
    if (!newStageName.trim()) return
    onStageAdd(pipeline._id, newStageName.trim())
    setNewStageName('')
  }

  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span
            className="flex h-9 w-9 items-center justify-center rounded-lg"
            style={{ background: 'var(--portal-glow)' }}
          >
            <span className="material-icons-outlined" style={{ fontSize: '18px', color: 'var(--portal)' }}>
              view_kanban
            </span>
          </span>
          <div>
            <h4 className="text-sm font-semibold text-[var(--text-primary)]">{pipeline.name || 'Unnamed Pipeline'}</h4>
            {pipeline.category && (
              <span className="text-xs text-[var(--text-muted)]">{pipeline.category}</span>
            )}
          </div>
        </div>
        {isLeader && (
          <button
            onClick={() => setEditing((v) => !v)}
            className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
              editing
                ? 'text-white'
                : 'border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
            }`}
            style={editing ? { background: 'var(--portal)' } : undefined}
          >
            <span className="material-icons-outlined" style={{ fontSize: '14px' }}>
              {editing ? 'check' : 'edit'}
            </span>
            {editing ? 'Done' : 'Edit'}
          </button>
        )}
      </div>

      {/* Stages */}
      <div className="mt-4">
        <span className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
          Stages ({sortedStages.length})
        </span>
        <div className="mt-2 flex flex-wrap gap-2">
          {sortedStages.map((stage, idx) => (
            <div key={idx} className="flex items-center gap-1">
              {editing ? (
                <input
                  type="text"
                  value={stage.name}
                  onChange={(e) => onStageUpdate(pipeline._id, idx, e.target.value)}
                  className="rounded-md border border-[var(--portal)] bg-[var(--bg-surface)] px-2 py-1 text-xs text-[var(--text-primary)] outline-none"
                  style={{ width: `${Math.max(stage.name.length * 7, 60)}px` }}
                />
              ) : (
                <span className="flex items-center gap-1 rounded-full bg-[var(--bg-surface)] px-2.5 py-1 text-xs text-[var(--text-secondary)]">
                  <span className="text-[10px] font-bold text-[var(--text-muted)]">{idx + 1}</span>
                  {stage.name}
                </span>
              )}
              {idx < sortedStages.length - 1 && !editing && (
                <span className="material-icons-outlined text-[var(--text-muted)]" style={{ fontSize: '12px' }}>
                  arrow_forward
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Add stage (leader editing mode) */}
        {editing && isLeader && (
          <div className="mt-3 flex items-center gap-2">
            <input
              type="text"
              value={newStageName}
              onChange={(e) => setNewStageName(e.target.value)}
              placeholder="New stage name..."
              className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-xs text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--portal)]"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddStage()
              }}
            />
            <button
              onClick={handleAddStage}
              disabled={!newStageName.trim()}
              className="flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium text-white transition-colors disabled:opacity-50"
              style={{ background: 'var(--portal)' }}
            >
              <span className="material-icons-outlined" style={{ fontSize: '12px' }}>add</span>
              Add
            </button>
          </div>
        )}

        {/* Empty state */}
        {sortedStages.length === 0 && !editing && (
          <p className="mt-2 text-xs text-[var(--text-muted)]">No stages configured.</p>
        )}
      </div>
    </div>
  )
}

/* ─── Main Component ─── */

export function AdminPanel({ portal }: AdminPanelProps) {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<AdminTab>('module-config')

  // Local app config state (loaded from Firestore, managed locally for optimistic updates)
  const [appConfigOverrides, setAppConfigOverrides] = useState<Record<string, boolean>>({})

  // Build entitlement context from Firestore profile
  const { ctx: entitlementCtx } = useEntitlements()
  const isLeader =
    entitlementCtx.userLevel === 'OWNER' ||
    entitlementCtx.userLevel === 'EXECUTIVE' ||
    entitlementCtx.userLevel === 'LEADER'

  // Queries
  const usersQ = useMemo<Query<DocumentData>>(
    () => query(collection(getDb(), 'users')),
    []
  )
  const pipelinesQ = useMemo<Query<DocumentData>>(
    () => query(collection(getDb(), 'pipelines')),
    []
  )
  const flowPipelinesQ = useMemo<Query<DocumentData>>(
    () => query(collection(getDb(), 'flow_pipelines')),
    []
  )
  const portalAppsQ = useMemo<Query<DocumentData>>(
    () => query(collection(getDb(), 'portal_config', portal, 'apps')),
    [portal]
  )

  const { data: users, loading: uLoad, error: uError } = useCollection<UserRecord>(usersQ, 'admin-users')
  const { data: pipelines, loading: pLoad } = useCollection<PipelineRecord>(pipelinesQ, 'admin-pipelines')
  const { data: flowPipelines, loading: fpLoad } = useCollection<FlowPipelineRecord>(flowPipelinesQ, 'admin-flow-pipelines')
  const { data: portalAppsRaw } = useCollection<PortalAppConfig>(portalAppsQ, `admin-portal-apps-${portal}`)

  // Build app config state from Firestore + local overrides
  const appConfigs = useMemo(() => {
    const configs: Record<string, boolean> = {}
    // Default all apps to enabled
    for (const key of ALL_APP_KEYS) {
      configs[key] = true
    }
    // Apply Firestore values
    for (const doc of portalAppsRaw) {
      configs[doc._id] = doc.enabled
    }
    // Apply local overrides (optimistic)
    for (const [key, val] of Object.entries(appConfigOverrides)) {
      configs[key] = val
    }
    return configs
  }, [portalAppsRaw, appConfigOverrides])

  // Active flow pipelines only
  const activeFlowPipelines = useMemo(
    () => flowPipelines.filter((fp) => !fp.status || fp.status === 'active' || fp.status === 'published'),
    [flowPipelines]
  )

  // Entitlement change handler (leaders only)
  const handleEntitlementChange = useCallback(
    async (userId: string, moduleKey: string, action: ModuleAction, enabled: boolean) => {
      if (!isLeader) return
      const targetUser = users.find((u) => u._id === userId)
      if (!targetUser) return

      const currentPerms = { ...(targetUser.module_permissions || {}) }
      const currentActions = [...(currentPerms[moduleKey] || [])]

      if (enabled) {
        if (!currentActions.includes(action)) {
          currentActions.push(action)
        }
      } else {
        const idx = currentActions.indexOf(action)
        if (idx >= 0) currentActions.splice(idx, 1)
      }

      currentPerms[moduleKey] = currentActions

      try {
        const ref = doc(getDb(), 'users', userId)
        await updateDoc(ref, {
          module_permissions: currentPerms,
          updated_at: new Date().toISOString(),
        })
      } catch {
        // Error handling — toast would go here
      }
    },
    [isLeader, users]
  )

  // Pipeline assignment handler (for Team Config)
  const handlePipelineAssignmentChange = useCallback(
    async (userId: string, pipelineKey: string, assigned: boolean) => {
      if (!isLeader) return
      const targetUser = users.find((u) => u._id === userId)
      if (!targetUser) return

      const current = [...(targetUser.assigned_pipelines || [])]
      if (assigned) {
        if (!current.includes(pipelineKey)) current.push(pipelineKey)
      } else {
        const idx = current.indexOf(pipelineKey)
        if (idx >= 0) current.splice(idx, 1)
      }

      try {
        const ref = doc(getDb(), 'users', userId)
        await updateDoc(ref, {
          assigned_pipelines: current,
          updated_at: new Date().toISOString(),
        })
      } catch {
        // Error handling — toast would go here
      }
    },
    [isLeader, users]
  )

  // App assignment handler (for Team Config per-user)
  const handleAppAssignmentChange = useCallback(
    async (userId: string, appKey: string, assigned: boolean) => {
      if (!isLeader) return
      const targetUser = users.find((u) => u._id === userId)
      if (!targetUser) return

      const current = [...(targetUser.assigned_apps || [])]
      if (assigned) {
        if (!current.includes(appKey)) current.push(appKey)
      } else {
        const idx = current.indexOf(appKey)
        if (idx >= 0) current.splice(idx, 1)
      }

      try {
        const ref = doc(getDb(), 'users', userId)
        await updateDoc(ref, {
          assigned_apps: current,
          updated_at: new Date().toISOString(),
        })
      } catch {
        // Error handling — toast would go here
      }
    },
    [isLeader, users]
  )

  // Pipeline section assignment handler
  const handlePipelineSectionChange = useCallback(
    async (pipelineId: string, section: SectionAssignment) => {
      if (!isLeader) return
      try {
        const ref = doc(getDb(), 'flow_pipelines', pipelineId)
        await updateDoc(ref, {
          assigned_section: section,
          updated_at: new Date().toISOString(),
        })
      } catch {
        // Error handling — toast would go here
      }
    },
    [isLeader]
  )

  // App toggle handler (portal-level availability)
  const handleAppToggle = useCallback(
    async (appKey: string, enabled: boolean) => {
      if (!isLeader) return

      // Optimistic update
      setAppConfigOverrides((prev) => ({ ...prev, [appKey]: enabled }))

      try {
        const ref = doc(getDb(), 'portal_config', portal, 'apps', appKey)
        await setDoc(ref, {
          enabled,
          updated_at: new Date().toISOString(),
        }, { merge: true })
      } catch {
        // Revert optimistic update on failure
        setAppConfigOverrides((prev) => {
          const next = { ...prev }
          delete next[appKey]
          return next
        })
      }
    },
    [isLeader, portal]
  )

  // Pipeline stage handlers (legacy pipelines collection)
  const handleStageAdd = useCallback(
    async (pipelineId: string, stageName: string) => {
      const pipeline = pipelines.find((p) => p._id === pipelineId)
      if (!pipeline) return

      const currentStages = [...(pipeline.stages || [])]
      const maxOrder = currentStages.reduce((max, s) => Math.max(max, s.order), 0)
      currentStages.push({ name: stageName, order: maxOrder + 1, status: 'active' })

      try {
        const ref = doc(getDb(), 'pipelines', pipelineId)
        await updateDoc(ref, {
          stages: currentStages,
          updated_at: new Date().toISOString(),
        })
      } catch {
        // Error handling
      }
    },
    [pipelines]
  )

  const handleStageUpdate = useCallback(
    async (pipelineId: string, stageIndex: number, name: string) => {
      const pipeline = pipelines.find((p) => p._id === pipelineId)
      if (!pipeline) return

      const sortedStages = [...(pipeline.stages || [])].sort((a, b) => a.order - b.order)
      if (stageIndex >= sortedStages.length) return
      sortedStages[stageIndex] = { ...sortedStages[stageIndex], name }

      try {
        const ref = doc(getDb(), 'pipelines', pipelineId)
        await updateDoc(ref, {
          stages: sortedStages,
          updated_at: new Date().toISOString(),
        })
      } catch {
        // Error handling
      }
    },
    [pipelines]
  )

  /* ─── Loading ─── */
  if (uLoad) {
    return (
      <div className="mx-auto max-w-5xl">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Admin</h1>
        <div className="mt-8 flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--portal)] border-t-transparent" />
        </div>
      </div>
    )
  }

  /* ─── Error ─── */
  if (uError) {
    return (
      <div className="mx-auto max-w-5xl">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Admin</h1>
        <div className="mt-6 rounded-xl border border-[var(--error)] bg-[rgba(239,68,68,0.05)] p-6 text-sm text-[var(--text-secondary)]">
          Failed to load admin data: {uError.message}
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Admin</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          {isLeader ? 'Module permissions, pipeline configuration, and app management' : 'Your module permissions'}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-1.5">
        {([
          { key: 'module-config' as AdminTab, label: 'Module Config', icon: 'grid_view' },
          { key: 'pipeline-config' as AdminTab, label: 'Pipeline Config', icon: 'route' },
          { key: 'app-config' as AdminTab, label: 'App Config', icon: 'apps' },
          { key: 'team-config' as AdminTab, label: 'Team Config', icon: 'groups' },
        ]).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'text-white'
                : 'text-[var(--text-muted)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-secondary)]'
            }`}
            style={activeTab === tab.key ? { background: 'var(--portal)' } : undefined}
          >
            <span className="material-icons-outlined" style={{ fontSize: '16px' }}>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Module Config Tab */}
      {activeTab === 'module-config' && (
        <div className="space-y-4">
          {MODULE_SECTIONS.map((section) => (
            <CollapsibleSection
              key={section.key}
              section={section}
              users={users}
              currentUserEmail={user?.email || ''}
              isLeader={isLeader}
              onEntitlementChange={handleEntitlementChange}
            />
          ))}
        </div>
      )}

      {/* Pipeline Config Tab */}
      {activeTab === 'pipeline-config' && (
        <div className="space-y-6">
          {/* Flow Pipelines — Section Assignment */}
          <PipelineConfigTab
            flowPipelines={activeFlowPipelines}
            loading={fpLoad}
            isLeader={isLeader}
            onSectionChange={handlePipelineSectionChange}
          />

          {/* Legacy Pipelines — Stage Editor (if any exist) */}
          {pipelines.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="material-icons-outlined text-[var(--text-muted)]" style={{ fontSize: '16px' }}>view_kanban</span>
                <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  Legacy Pipelines (Stage Editor)
                </span>
              </div>
              {pLoad ? (
                <div className="flex items-center justify-center py-12">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--portal)] border-t-transparent" />
                </div>
              ) : (
                pipelines.map((pipeline) => (
                  <PipelineCard
                    key={pipeline._id}
                    pipeline={pipeline}
                    isLeader={isLeader}
                    onStageAdd={handleStageAdd}
                    onStageUpdate={handleStageUpdate}
                  />
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* App Config Tab */}
      {activeTab === 'app-config' && (
        <AppConfigTab
          portal={portal}
          appConfigs={appConfigs}
          isLeader={isLeader}
          onAppToggle={handleAppToggle}
        />
      )}

      {/* Team Config Tab */}
      {activeTab === 'team-config' && (
        <TeamConfigTab
          users={users}
          currentUserEmail={user?.email || ''}
          isLeader={isLeader}
          flowPipelines={activeFlowPipelines}
          onEntitlementChange={handleEntitlementChange}
          onPipelineAssignmentChange={handlePipelineAssignmentChange}
          onAppAssignmentChange={handleAppAssignmentChange}
        />
      )}
    </div>
  )
}
