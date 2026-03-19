'use client'

import { useMemo, useState, useCallback, useEffect } from 'react'
import {
  query,
  collection,
  doc,
  updateDoc,
  type Query,
  type DocumentData,
} from 'firebase/firestore'
import { useAuth, useEntitlements, computeModulePermissions, PRODASH_ROLE_TEMPLATES, UNIT_MODULE_DEFAULTS, USER_LEVELS, MODULES } from '@tomachina/auth'
import type { UserLevelName, ModuleAction, RoleTemplateKey } from '@tomachina/auth'
import { useCollection } from '@tomachina/db'
import { getDb } from '@tomachina/db/src/firestore'

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
  /** Single source of truth: 0=OWNER, 1=EXECUTIVE, 2=LEADER, 3=USER */
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
  /** National Producer Number — only relevant when is_agent is true */
  npn?: string
  /** Whether this user is a licensed insurance agent eligible for client assignment */
  is_agent?: boolean
  module_permissions?: Record<string, string[]>
  entitlements?: string[]
  assigned_pipelines?: string[]
  assigned_apps?: string[]
}

/** Org unit from org collection (divisions, units, etc.) */
interface OrgRecord {
  _id: string
  entity_type?: string
  name?: string
  entity_name?: string
  status?: string
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
  assigned_section?: 'sales' | 'service' | 'both' | null
}

type AdminTab = 'module-config' | 'team-config'

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

/* ─── MODULE_SECTIONS: Mirrors PortalSidebar NAV_SECTIONS exactly ─── */
const MODULE_SECTIONS: SectionDef[] = [
  {
    key: 'workspace',
    label: 'Workspace',
    icon: 'workspaces',
    items: [
      { key: 'contacts', label: 'Contacts', icon: 'people', moduleKey: 'PRODASH_CLIENTS' },
      { key: 'households', label: 'Households', icon: 'home', moduleKey: 'PRODASH_HOUSEHOLDS' },
      { key: 'accounts', label: 'Accounts', icon: 'account_balance', moduleKey: 'PRODASH_ACCOUNTS' },
    ],
  },
  {
    key: 'sales-centers',
    label: 'Sales',
    icon: 'storefront',
    items: [],  // Populated dynamically by pipelines assigned to 'sales'
  },
  {
    key: 'service-centers',
    label: 'Service',
    icon: 'support_agent',
    items: [
      { key: 'rmd', label: 'RMD Center', icon: 'calendar_month', moduleKey: 'RMD_CENTER' },
      { key: 'beni', label: 'Beni Center', icon: 'volunteer_activism', moduleKey: 'BENI_CENTER' },
      { key: 'access', label: 'Access Center', icon: 'security' },
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
      { key: 'pipeline-studio', label: 'Pipeline Studio', icon: 'view_kanban', moduleKey: 'PIPELINE_STUDIO' },
      { key: 'forge', label: 'FORGE', icon: 'construction', moduleKey: 'FORGE' },
      { key: 'guardian', label: 'GUARDIAN', icon: 'shield', moduleKey: 'GUARDIAN' },
      { key: 'prozone', label: 'ProZONE', icon: 'explore', moduleKey: 'PROZONE' },
    ],
  },
]

const ALL_ACTIONS: ModuleAction[] = ['VIEW', 'EDIT', 'ADD']

const ACTION_ICONS: Record<ModuleAction, string> = {
  VIEW: 'visibility',
  EDIT: 'edit',
  ADD: 'add_circle',
}

/** Derive display name from numeric level */
const LEVEL_NAMES: Record<number, string> = { 0: 'Owner', 1: 'Executive', 2: 'Leader', 3: 'User' }

/** Icon map for pipeline domain categories */
const DOMAIN_ICONS: Record<string, string> = {
  investments: 'trending_up',
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
              if (!item.moduleKey) {
                // Items without a moduleKey (e.g., Access Center) are always visible
                return (
                  <div key={item.key} className="flex items-center gap-2.5 rounded-lg bg-[var(--bg-surface)] px-3 py-2.5">
                    <span className="material-icons-outlined text-[var(--text-muted)]" style={{ fontSize: '16px' }}>{item.icon}</span>
                    <span className="text-sm text-[var(--text-primary)]">{item.label}</span>
                    <span className="text-[10px] text-[var(--text-muted)]">Always visible</span>
                  </div>
                )
              }
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

  // Users who have any permission on this module (including OWNER who has implicit full access)
  const usersWithAccess = useMemo(() => {
    return users
      .filter((u) => {
        // OWNER (level 0) has implicit access to everything
        if ((u.level ?? 3) === 0) return true
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
  const isCurrentUserOwner = (currentUser?.level ?? 3) === 0
  const myPerms = isCurrentUserOwner ? [...ALL_ACTIONS] : (currentUser?.module_permissions?.[moduleKey] || [])

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
          {/* Show minUserLevel from modules.ts if the module has a Firestore-level restriction */}
          {moduleKey && MODULES[moduleKey]?.minUserLevel && MODULES[moduleKey].minUserLevel !== 'USER' && (
            <span className="rounded-full bg-[rgba(245,158,11,0.1)] px-1.5 py-0.5 text-[9px] font-medium text-[rgb(245,158,11)]">
              {MODULES[moduleKey].minUserLevel}+
            </span>
          )}
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
            const isOwnerUser = (teamUser.level ?? 3) === 0
            // OWNER users have implicit full V/E/A on everything
            const perms = isOwnerUser ? [...ALL_ACTIONS] : (teamUser.module_permissions?.[moduleKey] || [])
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
                  {isOwnerUser && (
                    <span className="rounded-full px-1.5 py-0.5 text-[9px] font-semibold text-white" style={{ background: 'var(--portal)' }}>
                      Super Admin
                    </span>
                  )}
                  {!isOwnerUser && teamUser.level !== undefined && (
                    <span className="text-[10px] text-[var(--text-muted)]">{LEVEL_NAMES[teamUser.level ?? 3] || 'User'}</span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {ALL_ACTIONS.map((action) => (
                    <EntitlementBadge
                      key={action}
                      action={action}
                      active={perms.includes(action)}
                      editable={isLeader && !isSelf && !isOwnerUser}
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

/* ─── Role + Unit Assignment ─── */

const ROLE_TEMPLATE_KEYS = Object.keys(PRODASH_ROLE_TEMPLATES) as RoleTemplateKey[]
const UNIT_KEYS = Object.keys(UNIT_MODULE_DEFAULTS)
const DIVISIONS_FALLBACK = ['Sales', 'Service', 'Legacy']

function RoleUnitAssignment({
  member,
  divisions,
  onUpdate,
}: {
  member: UserRecord
  divisions: string[]
  onUpdate: (userId: string, updates: {
    role_template?: string
    division?: string
    unit?: string
    level?: number
    module_permissions?: Record<string, string[]>
  }) => void
}) {
  const [selectedRole, setSelectedRole] = useState<RoleTemplateKey>(
    (member.role_template || 'readonly') as RoleTemplateKey
  )
  const [selectedDivision, setSelectedDivision] = useState(member.division || '')
  const [selectedUnit, setSelectedUnit] = useState(member.unit || '')
  const [saving, setSaving] = useState(false)

  // Live preview of computed permissions
  const preview = useMemo(
    () => computeModulePermissions(selectedRole, selectedUnit || undefined),
    [selectedRole, selectedUnit]
  )

  const templateDef = PRODASH_ROLE_TEMPLATES[selectedRole]
  const derivedLevel = templateDef?.userLevel || 'USER'
  const derivedLevelNum = USER_LEVELS[derivedLevel]?.level ?? 3

  // Count modules with at least one action
  const previewModuleCount = useMemo(
    () => Object.values(preview).filter((acts) => acts.length > 0).length,
    [preview]
  )

  const hasChanges =
    selectedRole !== (member.role_template || 'readonly') ||
    selectedDivision !== (member.division || '') ||
    selectedUnit !== (member.unit || '')

  const handleApply = async () => {
    setSaving(true)
    try {
      await onUpdate(member._id, {
        role_template: selectedRole,
        division: selectedDivision || undefined,
        unit: selectedUnit || undefined,
        level: derivedLevelNum,
        module_permissions: preview,
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] p-3 space-y-3">
      <div className="flex items-center gap-1.5 mb-1">
        <span className="material-icons-outlined text-[var(--portal)]" style={{ fontSize: '14px' }}>
          admin_panel_settings
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          Role + Unit Assignment
        </span>
      </div>

      {/* Dropdowns row */}
      <div className="grid grid-cols-3 gap-2">
        {/* Role Template */}
        <div>
          <label className="block text-[10px] text-[var(--text-muted)] mb-0.5">Role Template</label>
          <select
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value as RoleTemplateKey)}
            className="w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-1.5 text-xs text-[var(--text-primary)]"
          >
            {ROLE_TEMPLATE_KEYS.map((key) => (
              <option key={key} value={key}>
                {PRODASH_ROLE_TEMPLATES[key].label}
              </option>
            ))}
          </select>
        </div>

        {/* Division */}
        <div>
          <label className="block text-[10px] text-[var(--text-muted)] mb-0.5">Division</label>
          <select
            value={selectedDivision}
            onChange={(e) => setSelectedDivision(e.target.value)}
            className="w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-1.5 text-xs text-[var(--text-primary)]"
          >
            <option value="">-- None --</option>
            {divisions.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>

        {/* Unit */}
        <div>
          <label className="block text-[10px] text-[var(--text-muted)] mb-0.5">Unit</label>
          <select
            value={selectedUnit}
            onChange={(e) => setSelectedUnit(e.target.value)}
            className="w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-1.5 text-xs text-[var(--text-primary)]"
          >
            <option value="">-- None --</option>
            {UNIT_KEYS.map((key) => (
              <option key={key} value={key}>
                {UNIT_MODULE_DEFAULTS[key].label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Level preview */}
      <div className="flex items-center gap-2 text-xs">
        <span className="text-[var(--text-muted)]">Derived level:</span>
        <span className="rounded-full bg-[var(--bg-surface)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-primary)]">
          {USER_LEVELS[derivedLevel]?.displayName || derivedLevel} (L{derivedLevelNum})
        </span>
        <span className="text-[var(--text-muted)]">|</span>
        <span className="text-[var(--text-muted)]">{previewModuleCount} modules</span>
      </div>

      {/* Permissions preview */}
      <div className="rounded-md bg-[var(--bg-surface)] p-2">
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          Permissions Preview
        </div>
        <div className="flex flex-wrap gap-1">
          {Object.entries(preview)
            .filter(([, actions]) => actions.length > 0)
            .map(([moduleKey, actions]) => {
              const moduleDef = MODULES[moduleKey]
              return (
                <span
                  key={moduleKey}
                  className="inline-flex items-center gap-1 rounded-md bg-[var(--bg-card)] px-2 py-0.5 text-[10px] text-[var(--text-primary)]"
                  title={`${moduleDef?.fullName || moduleKey}: ${actions.join(', ')}`}
                >
                  {moduleDef?.name || moduleKey}
                  <span className="text-[var(--text-muted)]">
                    {actions.map((a: string) => a[0]).join('')}
                  </span>
                </span>
              )
            })}
        </div>
        {previewModuleCount === 0 && (
          <p className="text-[10px] text-[var(--text-muted)]">No modules assigned for this configuration.</p>
        )}
      </div>

      {/* Apply button */}
      <button
        onClick={handleApply}
        disabled={!hasChanges || saving}
        className="rounded-md px-3 py-1.5 text-xs font-medium text-white transition-opacity disabled:opacity-40"
        style={{ background: 'var(--portal)' }}
      >
        {saving ? 'Applying...' : 'Apply Role + Recompute Permissions'}
      </button>

      {templateDef && (
        <p className="text-[10px] text-[var(--text-muted)]">
          {templateDef.description}
        </p>
      )}
    </div>
  )
}

/* ─── Agent Designation (is_agent toggle + NPN field) ─── */

function AgentDesignation({
  member,
  isLeader,
  isSelf,
}: {
  member: UserRecord
  isLeader: boolean
  isSelf: boolean
}) {
  const [isAgent, setIsAgent] = useState(Boolean(member.is_agent))
  const [npn, setNpn] = useState(member.npn || '')
  const [saving, setSaving] = useState(false)
  const [npnError, setNpnError] = useState('')
  const editable = isLeader && !isSelf

  // Sync with prop changes
  useEffect(() => {
    setIsAgent(Boolean(member.is_agent))
    setNpn(member.npn || '')
  }, [member.is_agent, member.npn])

  const validateNpn = (val: string): boolean => {
    if (!val) return true // empty is OK (agents may not have NPN entered yet)
    const digits = val.replace(/\D/g, '')
    if (digits.length < 7 || digits.length > 10) {
      setNpnError('NPN must be 7-10 digits')
      return false
    }
    setNpnError('')
    return true
  }

  const handleToggle = async () => {
    if (!editable) return
    setSaving(true)
    try {
      const newVal = !isAgent
      const ref = doc(getDb(), 'users', member._id)
      const updates: Record<string, unknown> = {
        is_agent: newVal,
        updated_at: new Date().toISOString(),
      }
      // If turning off agent status, clear NPN
      if (!newVal) {
        updates.npn = ''
        setNpn('')
      }
      await updateDoc(ref, updates)
      setIsAgent(newVal)
    } catch {
      // Revert on failure
      setIsAgent(Boolean(member.is_agent))
    } finally {
      setSaving(false)
    }
  }

  const handleNpnSave = async () => {
    if (!editable || !isAgent) return
    const cleaned = npn.replace(/\D/g, '')
    if (!validateNpn(cleaned)) return
    setSaving(true)
    try {
      const ref = doc(getDb(), 'users', member._id)
      await updateDoc(ref, {
        npn: cleaned,
        updated_at: new Date().toISOString(),
      })
    } catch {
      setNpn(member.npn || '')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] p-3 space-y-3">
      <div className="flex items-center gap-1.5 mb-1">
        <span className="material-icons-outlined text-[var(--portal)]" style={{ fontSize: '14px' }}>
          badge
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          Agent Designation
        </span>
      </div>

      {/* Licensed Agent toggle */}
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={isAgent}
            onChange={handleToggle}
            disabled={!editable || saving}
            className="h-4 w-4 rounded border-[var(--border)] accent-[var(--portal)] disabled:opacity-40"
          />
          <span className="text-xs text-[var(--text-primary)]">Licensed Agent</span>
        </label>
        {saving && (
          <span className="h-3 w-3 animate-spin rounded-full border border-[var(--portal)] border-t-transparent" />
        )}
        {isAgent && (
          <span className="rounded-full bg-[var(--portal)]/10 px-2 py-0.5 text-[10px] font-medium text-[var(--portal)]">
            Eligible for client assignment
          </span>
        )}
      </div>

      {/* NPN field — visible only when is_agent is true */}
      {isAgent && (
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <label className="block text-[10px] text-[var(--text-muted)] mb-0.5">NPN (National Producer Number)</label>
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={npn}
                onChange={(e) => {
                  setNpn(e.target.value)
                  setNpnError('')
                }}
                onBlur={handleNpnSave}
                onKeyDown={(e) => { if (e.key === 'Enter') handleNpnSave() }}
                disabled={!editable}
                placeholder="7-10 digit NPN"
                className="w-40 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-1.5 text-xs text-[var(--text-primary)] font-mono disabled:opacity-50"
              />
              {saving && (
                <span className="h-3 w-3 animate-spin rounded-full border border-[var(--portal)] border-t-transparent" />
              )}
            </div>
            {npnError && (
              <p className="mt-0.5 text-[10px] text-[var(--error)]">{npnError}</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/* ─── Member row — extracted to a proper component so hooks are valid ─── */

/** Unified item type used by section-based rendering in TeamMemberRow */
interface UnifiedItem {
  key: string
  label: string
  icon: string
  moduleKey: string
  isPipeline?: boolean
}

interface UnifiedSection {
  key: string
  label: string
  icon: string
  allItems: UnifiedItem[]
}

function TeamMemberRow({
  member,
  currentUserEmail,
  isLeader,
  isOwner,
  flowPipelines,
  divisions,
  onEntitlementChange,
  onRoleUnitUpdate,
}: {
  member: UserRecord
  currentUserEmail: string
  isLeader: boolean
  isOwner: boolean
  flowPipelines: FlowPipelineRecord[]
  divisions: string[]
  onEntitlementChange: (userId: string, moduleKey: string, action: ModuleAction, enabled: boolean) => void
  onRoleUnitUpdate: (userId: string, updates: {
    role_template?: string; division?: string; unit?: string;
    level?: number; module_permissions?: Record<string, string[]>
  }) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({})
  const isSelf = member.email === currentUserEmail

  // Derive display name from numeric level (single source of truth)
  const memberLevelNum = member.level ?? 3
  const memberLevelName = LEVEL_NAMES[memberLevelNum] || 'User'
  const isFullyLocked = memberLevelNum === 0 // Only Owner is fully locked

  // Can the current user edit this member's permissions?
  // Owner can edit anyone except self. Leaders can edit non-locked users.
  const canEdit = !isSelf && (isOwner || (!isFullyLocked && isLeader))

  // Backward-compat permission resolvers: module_permissions first, fall back to legacy arrays
  const pipelinePerms = useCallback((pipelineKey: string): string[] => {
    const mk = `PIPELINE_${pipelineKey}`
    const perms = member.module_permissions?.[mk]
    if (perms && perms.length > 0) return perms
    // Backward compat: if in legacy assigned_pipelines, treat as full access
    if ((member.assigned_pipelines || []).includes(pipelineKey)) return ['VIEW', 'EDIT', 'ADD']
    return []
  }, [member.module_permissions, member.assigned_pipelines])

  const appPerms = useCallback((moduleKey: string, appKey: string): string[] => {
    const perms = member.module_permissions?.[moduleKey]
    if (perms && perms.length > 0) return perms
    // Backward compat: if in legacy assigned_apps, treat as full access
    if ((member.assigned_apps || []).includes(appKey)) return ['VIEW', 'EDIT', 'ADD']
    return []
  }, [member.module_permissions, member.assigned_apps])

  // Build unified sections: static modules + dynamic pipelines injected into sales/service
  const unifiedSections: UnifiedSection[] = useMemo(() => {
    return MODULE_SECTIONS.map((section) => {
      // Start with static items from MODULE_SECTIONS that have moduleKeys (permission-gated)
      const items: UnifiedItem[] = section.items
        .filter((i) => !!i.moduleKey)
        .map((i) => ({
          key: i.key,
          label: i.label,
          icon: i.icon,
          moduleKey: i.moduleKey!,
        }))

      // For sales section, inject pipelines assigned to 'sales'
      if (section.key === 'sales-centers') {
        const salesPipelines = flowPipelines.filter(
          (fp) => fp.assigned_section === 'sales' || fp.assigned_section === 'both'
        )
        for (const fp of salesPipelines) {
          const pKey = fp.pipeline_key || fp._id
          items.push({
            key: `pipe-${pKey}`,
            label: fp.pipeline_name || pKey,
            icon: fp.icon || DOMAIN_ICONS[(fp.domain || '').toLowerCase()] || 'route',
            moduleKey: `PIPELINE_${pKey}`,
            isPipeline: true,
          })
        }
      }

      // For service section, inject pipelines assigned to 'service'
      if (section.key === 'service-centers') {
        const servicePipelines = flowPipelines.filter(
          (fp) => fp.assigned_section === 'service' || fp.assigned_section === 'both'
        )
        for (const fp of servicePipelines) {
          const pKey = fp.pipeline_key || fp._id
          items.push({
            key: `pipe-${pKey}`,
            label: fp.pipeline_name || pKey,
            icon: fp.icon || DOMAIN_ICONS[(fp.domain || '').toLowerCase()] || 'route',
            moduleKey: `PIPELINE_${pKey}`,
            isPipeline: true,
          })
        }
      }

      return { ...section, allItems: items }
    })
  }, [flowPipelines])

  // Get permissions for any item (static module, pipeline, or app)
  const getItemPerms = useCallback((item: UnifiedItem, sectionKey: string): string[] => {
    if (isFullyLocked) return [...ALL_ACTIONS]
    if (item.isPipeline) {
      // Extract pipeline key from moduleKey 'PIPELINE_xxx'
      const pKey = item.moduleKey.replace('PIPELINE_', '')
      return pipelinePerms(pKey)
    }
    if (sectionKey === 'apps') {
      // Find matching app key for backward-compat fallback
      const appSection = MODULE_SECTIONS.find((s) => s.key === 'apps')
      const appItem = appSection?.items.find((i) => i.moduleKey === item.moduleKey)
      return appPerms(item.moduleKey, appItem?.key || item.key)
    }
    return member.module_permissions?.[item.moduleKey] || []
  }, [isFullyLocked, pipelinePerms, appPerms, member.module_permissions])

  // Count items with any permission per section
  const sectionCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const section of unifiedSections) {
      counts[section.key] = section.allItems.filter(
        (item) => getItemPerms(item, section.key).length > 0
      ).length
    }
    return counts
  }, [unifiedSections, getItemPerms])

  const totalItemsWithPerms = useMemo(
    () => Object.values(sectionCounts).reduce((sum, c) => sum + c, 0),
    [sectionCounts]
  )

  // Section-level bulk V/E/A toggle — batches ALL changes into one Firestore write
  const handleSectionToggle = useCallback(
    async (sectionItems: UnifiedItem[], sectionKey: string, action: ModuleAction) => {
      const allHaveAction = sectionItems.every((item) => {
        const perms = getItemPerms(item, sectionKey)
        return perms.includes(action)
      })
      const enabling = !allHaveAction

      // Build the full updated permissions object in one pass
      const currentPerms = { ...(member.module_permissions || {}) }
      for (const item of sectionItems) {
        if (!item.moduleKey) continue
        const mk = item.moduleKey
        const actions = [...(currentPerms[mk] || [])]
        if (enabling) {
          if (!actions.includes(action)) actions.push(action)
        } else {
          const idx = actions.indexOf(action)
          if (idx >= 0) actions.splice(idx, 1)
        }
        currentPerms[mk] = actions
      }

      // Single Firestore write with all changes
      try {
        const ref = doc(getDb(), 'users', member._id)
        await updateDoc(ref, {
          module_permissions: currentPerms,
          updated_at: new Date().toISOString(),
        })
      } catch {
        // Error handling — toast would go here
      }
    },
    [getItemPerms, member._id, member.module_permissions]
  )

  // Check if all items in a section have a given action
  const sectionAllHaveAction = useCallback(
    (sectionItems: UnifiedItem[], sectionKey: string, action: ModuleAction): boolean => {
      if (sectionItems.length === 0) return false
      return sectionItems.every((item) => {
        const perms = getItemPerms(item, sectionKey)
        return perms.includes(action)
      })
    },
    [getItemPerms]
  )

  const toggleSection = useCallback((sectionKey: string) => {
    setExpandedSections((prev) => ({ ...prev, [sectionKey]: !prev[sectionKey] }))
  }, [])

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
          {member.is_agent && (
            <span className="rounded-full bg-[var(--portal)]/10 px-2 py-0.5 text-[10px] font-medium text-[var(--portal)]">
              Agent
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {/* Section-based summary counts */}
          {unifiedSections
            .filter((s) => sectionCounts[s.key] > 0)
            .map((s) => (
              <span key={s.key} className="text-[10px] text-[var(--text-muted)]">
                {s.label}: {sectionCounts[s.key]}
              </span>
            ))}
          {totalItemsWithPerms === 0 && (
            <span className="text-[10px] text-[var(--text-muted)]">No permissions</span>
          )}
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
          {/* Role + Unit Assignment */}
          {canEdit && (
            <RoleUnitAssignment member={member} divisions={divisions} onUpdate={onRoleUnitUpdate} />
          )}

          {/* Agent Designation — is_agent toggle + NPN */}
          {canEdit && (
            <AgentDesignation member={member} isLeader={canEdit} isSelf={false} />
          )}

          {isFullyLocked && (
            <div className="flex items-center gap-1.5 rounded-md bg-[var(--bg-card)] px-3 py-2">
              <span className="material-icons-outlined text-[var(--portal)]" style={{ fontSize: '14px' }}>verified</span>
              <span className="text-[10px] text-[var(--text-muted)]">
                Owner — all access granted across all sections
              </span>
            </div>
          )}

          {/* Unified section-based rendering */}
          <div className="space-y-2">
            {unifiedSections.map((section) => {
              const isOpen = expandedSections[section.key] ?? false
              const itemCount = section.allItems.length
              const withPermsCount = sectionCounts[section.key]

              if (itemCount === 0) return null

              return (
                <div key={section.key} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)]">
                  {/* Section header with icon + label + count + section-level V/E/A */}
                  <div className="flex items-center justify-between px-3 py-2">
                    <button
                      onClick={() => toggleSection(section.key)}
                      className="flex items-center gap-2"
                    >
                      <span
                        className="material-icons-outlined text-[var(--text-muted)] transition-transform"
                        style={{ fontSize: '14px', transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)' }}
                      >
                        expand_more
                      </span>
                      <span className="material-icons-outlined text-[var(--portal)]" style={{ fontSize: '16px' }}>
                        {section.icon}
                      </span>
                      <span className="text-xs font-semibold text-[var(--text-primary)]">{section.label}</span>
                      <span className="text-[10px] text-[var(--text-muted)]">
                        {withPermsCount}/{itemCount}
                      </span>
                    </button>

                    {/* Section-level bulk V/E/A toggles — click to set ALL items in this section */}
                    <div className="flex items-center gap-1">
                      {canEdit && (
                        <span className="text-[9px] text-[var(--text-muted)] mr-1">SET ALL</span>
                      )}
                      {ALL_ACTIONS.map((action) => {
                        const allActive = sectionAllHaveAction(section.allItems, section.key, action)
                        return (
                          <button
                            key={action}
                            onClick={(e) => {
                              e.stopPropagation()
                              if (canEdit) handleSectionToggle(section.allItems, section.key, action)
                            }}
                            disabled={!canEdit}
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors ${
                              allActive
                                ? 'text-white'
                                : 'bg-[var(--bg-surface)] text-[var(--text-muted)]'
                            } ${canEdit ? 'cursor-pointer hover:opacity-80 ring-1 ring-[var(--border-subtle)]' : 'cursor-default'}`}
                            style={allActive ? { background: 'var(--portal)' } : undefined}
                            title={canEdit ? `Toggle ${action} for all ${section.label} items` : action}
                          >
                            <span className="material-icons-outlined" style={{ fontSize: '10px' }}>
                              {ACTION_ICONS[action]}
                            </span>
                            {action}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Expanded: per-item V/E/A rows */}
                  {isOpen && (
                    <div className="border-t border-[var(--border-subtle)] px-3 pb-2.5 pt-2 space-y-1">
                      {section.allItems.map((item) => {
                        const perms = getItemPerms(item, section.key)
                        return (
                          <div
                            key={item.key}
                            className="flex items-center justify-between rounded-md bg-[var(--bg-surface)] px-3 py-2"
                          >
                            <div className="flex items-center gap-2">
                              <span className="material-icons-outlined text-[var(--text-muted)]" style={{ fontSize: '14px' }}>
                                {item.icon}
                              </span>
                              <span className="text-xs text-[var(--text-primary)]">{item.label}</span>
                              {item.isPipeline && (
                                <span className="rounded-full bg-[var(--portal)]/10 px-1.5 py-0.5 text-[9px] text-[var(--portal)]">
                                  pipeline
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              {ALL_ACTIONS.map((action) => (
                                <EntitlementBadge
                                  key={action}
                                  action={action}
                                  active={perms.includes(action)}
                                  editable={canEdit}
                                  onToggle={() =>
                                    onEntitlementChange(
                                      member._id,
                                      item.moduleKey,
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
                </div>
              )
            })}
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
  isOwner,
  flowPipelines,
  divisions,
  onEntitlementChange,
  onRoleUnitUpdate,
}: {
  users: UserRecord[]
  currentUserEmail: string
  isLeader: boolean
  isOwner: boolean
  flowPipelines: FlowPipelineRecord[]
  divisions: string[]
  onEntitlementChange: (userId: string, moduleKey: string, action: ModuleAction, enabled: boolean) => void
  onRoleUnitUpdate: (userId: string, updates: {
    role_template?: string; division?: string; unit?: string;
    level?: number; module_permissions?: Record<string, string[]>
  }) => void
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
      const normalized = LEVEL_NAMES[u.level ?? 3] || 'User'
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
                    isOwner={isOwner}
                    flowPipelines={flowPipelines}
                    divisions={divisions}
                    onEntitlementChange={onEntitlementChange}
                    onRoleUnitUpdate={onRoleUnitUpdate}
                  />
                ))}
              </div>
            )}
          </div>
        ))}
    </div>
  )
}

/* ─── Main Component ─── */

export function AdminPanel({ portal }: AdminPanelProps) {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<AdminTab>('team-config')

  // Build entitlement context from Firestore profile
  const { ctx: entitlementCtx } = useEntitlements()
  const isOwner = entitlementCtx.userLevel === 'OWNER'
  const isLeader =
    isOwner ||
    entitlementCtx.userLevel === 'EXECUTIVE' ||
    entitlementCtx.userLevel === 'LEADER'

  // Queries
  const usersQ = useMemo<Query<DocumentData>>(
    () => query(collection(getDb(), 'users')),
    []
  )
  const flowPipelinesQ = useMemo<Query<DocumentData>>(
    () => query(collection(getDb(), 'flow_pipelines')),
    []
  )
  const orgQ = useMemo<Query<DocumentData>>(
    () => query(collection(getDb(), 'org')),
    []
  )

  const { data: users, loading: uLoad, error: uError } = useCollection<UserRecord>(usersQ, 'admin-users')
  const { data: flowPipelines } = useCollection<FlowPipelineRecord>(flowPipelinesQ, 'admin-flow-pipelines')
  const { data: orgUnits } = useCollection<OrgRecord>(orgQ, 'admin-org')

  // Derive divisions from org collection, fallback to hardcoded list
  const divisions = useMemo(() => {
    const raw = orgUnits
      .filter((u) => u.entity_type === 'DIVISION' && (u.name || u.entity_name))
      .map((u) => {
        const name = (u.name || u.entity_name) as string
        // Strip trailing " Division" if present (e.g., "Sales Division" → "Sales")
        return name.replace(/\s+Division$/i, '')
      })
    // Deduplicate and sort
    const unique = [...new Set(raw)].sort()
    return unique.length > 0 ? unique : DIVISIONS_FALLBACK
  }, [orgUnits])

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

  // Role + Unit update handler (for Team Config role template assignment)
  const handleRoleUnitUpdate = useCallback(
    async (userId: string, updates: {
      role_template?: string; division?: string; unit?: string;
      level?: number; module_permissions?: Record<string, string[]>
    }) => {
      if (!isLeader) return
      try {
        const ref = doc(getDb(), 'users', userId)
        await updateDoc(ref, {
          ...updates,
          updated_at: new Date().toISOString(),
          _updated_by: user?.email || 'unknown',
        })
      } catch {
        // Error handling — toast would go here
      }
    },
    [isLeader, user?.email]
  )

  /* ─── Loading ─── */
  if (uLoad) {
    return (
      <div className="mx-auto max-w-5xl">
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
        <p className="text-sm text-[var(--text-muted)]">
          {isLeader ? 'Team permissions and module access audit' : 'Your module permissions'}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-1.5 overflow-x-auto">
        {([
          { key: 'team-config' as AdminTab, label: 'Team Config', icon: 'groups' },
          { key: 'module-config' as AdminTab, label: 'Permissions Audit', icon: 'grid_view' },
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

      {/* Permissions Audit Tab — same sections as sidebar, with pipelines injected */}
      {activeTab === 'module-config' && (
        <div className="space-y-4">
          {MODULE_SECTIONS.map((section) => {
            // Inject pipelines into Sales/Service just like the sidebar does
            let augmented = section
            if (section.key === 'sales-centers') {
              const salesPipelines = activeFlowPipelines.filter(
                (fp) => fp.assigned_section === 'sales' || fp.assigned_section === 'both'
              )
              augmented = {
                ...section,
                items: [
                  ...section.items,
                  ...salesPipelines.map((fp) => ({
                    key: `pipe-${fp.pipeline_key || fp._id}`,
                    label: fp.pipeline_name || fp.pipeline_key || fp._id,
                    icon: fp.icon || DOMAIN_ICONS[(fp.domain || '').toLowerCase()] || 'route',
                    moduleKey: `PIPELINE_${fp.pipeline_key || fp._id}`,
                  })),
                ],
              }
            }
            if (section.key === 'service-centers') {
              const servicePipelines = activeFlowPipelines.filter(
                (fp) => fp.assigned_section === 'service' || fp.assigned_section === 'both'
              )
              augmented = {
                ...section,
                items: [
                  ...section.items,
                  ...servicePipelines.map((fp) => ({
                    key: `pipe-${fp.pipeline_key || fp._id}`,
                    label: fp.pipeline_name || fp.pipeline_key || fp._id,
                    icon: fp.icon || DOMAIN_ICONS[(fp.domain || '').toLowerCase()] || 'route',
                    moduleKey: `PIPELINE_${fp.pipeline_key || fp._id}`,
                  })),
                ],
              }
            }
            return (
              <CollapsibleSection
                key={section.key}
                section={augmented}
                users={users}
                currentUserEmail={user?.email || ''}
                isLeader={isLeader}
                onEntitlementChange={handleEntitlementChange}
              />
            )
          })}
        </div>
      )}

      {/* Team Config Tab */}
      {activeTab === 'team-config' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 rounded-lg bg-[var(--bg-card)] border border-[var(--border-subtle)] px-4 py-2.5">
            <span className="material-icons-outlined text-[var(--portal)]" style={{ fontSize: '16px' }}>info</span>
            <span className="text-xs text-[var(--text-muted)]">
              Team configuration applies across all portals. Changes here affect ProDashX, RIIMO, and SENTINEL.
            </span>
          </div>
          <TeamConfigTab
            users={users}
            currentUserEmail={user?.email || ''}
            isLeader={isLeader}
            isOwner={isOwner}
            flowPipelines={activeFlowPipelines}
            divisions={divisions}
            onEntitlementChange={handleEntitlementChange}
            onRoleUnitUpdate={handleRoleUnitUpdate}
          />
        </div>
      )}

    </div>
  )
}
