'use client'

import { useMemo, useState, useCallback } from 'react'
import {
  query,
  collection,
  doc,
  updateDoc,
  type Query,
  type DocumentData,
} from 'firebase/firestore'
import { useAuth, buildEntitlementContext } from '@tomachina/auth'
import type { UserLevelName, ModuleAction } from '@tomachina/auth'
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

type AdminTab = 'module-config' | 'pipeline-config'

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
  /* DF-9/DF-28: Default collapsed, click to expand */
  const [expanded, setExpanded] = useState(false)

  // Get unique module keys in this section
  const sectionModuleKeys = useMemo(() => {
    const keys = new Set<string>()
    section.items.forEach((item) => {
      if (item.moduleKey) keys.add(item.moduleKey)
    })
    return Array.from(keys)
  }, [section.items])

  // For leaders: show team members who have access to modules in this section
  const teamAccess = useMemo(() => {
    if (!isLeader) return []
    return users.filter((u) => u.email !== currentUserEmail).map((u) => {
      const perms: Record<string, string[]> = {}
      sectionModuleKeys.forEach((mk) => {
        const userPerms = u.module_permissions?.[mk]
        if (userPerms && userPerms.length > 0) {
          perms[mk] = userPerms
        }
      })
      return { user: u, perms }
    }).filter((entry) => Object.keys(entry.perms).length > 0)
  }, [isLeader, users, currentUserEmail, sectionModuleKeys])

  // Get current user's permissions
  const currentUser = users.find((u) => u.email === currentUserEmail)

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
          <div className="space-y-2">
            {section.items.map((item) => {
              if (!item.moduleKey) return null
              const mk = item.moduleKey
              const myPerms = currentUser?.module_permissions?.[mk] || []

              return (
                <div
                  key={item.key}
                  className="flex items-center justify-between rounded-lg bg-[var(--bg-surface)] px-3 py-2.5"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="material-icons-outlined text-[var(--text-muted)]" style={{ fontSize: '16px' }}>
                      {item.icon}
                    </span>
                    <span className="text-sm text-[var(--text-primary)]">{item.label}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {ALL_ACTIONS.map((action) => (
                      <EntitlementBadge
                        key={action}
                        action={action}
                        active={myPerms.includes(action)}
                        editable={false}
                        onToggle={() => {
                          /* Read-only for own permissions */
                        }}
                      />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Team member access (leaders only) */}
          {isLeader && teamAccess.length > 0 && (
            <div className="mt-4 border-t border-[var(--border-subtle)] pt-3">
              <span className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
                Team Access
              </span>
              <div className="mt-2 space-y-2">
                {teamAccess.map(({ user: teamUser, perms }) => (
                  <div key={teamUser._id} className="rounded-lg bg-[var(--bg-surface)] p-3">
                    <div className="mb-2 flex items-center gap-2">
                      <span className="material-icons-outlined text-[var(--text-muted)]" style={{ fontSize: '14px' }}>
                        person
                      </span>
                      <span className="text-xs font-medium text-[var(--text-primary)]">
                        {teamUser.first_name} {teamUser.last_name}
                      </span>
                      <span className="text-[10px] text-[var(--text-muted)]">{teamUser.email}</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(perms).map(([moduleKey, actions]) => {
                        const moduleItem = section.items.find((i) => i.moduleKey === moduleKey)
                        return (
                          <div key={moduleKey} className="flex items-center gap-1">
                            <span className="text-[10px] text-[var(--text-muted)]">
                              {moduleItem?.label || moduleKey}:
                            </span>
                            {actions.map((action) => (
                              <EntitlementBadge
                                key={action}
                                action={action as ModuleAction}
                                active={true}
                                editable={isLeader}
                                onToggle={() =>
                                  onEntitlementChange(
                                    teamUser._id,
                                    moduleKey,
                                    action as ModuleAction,
                                    false
                                  )
                                }
                              />
                            ))}
                            {/* Show disabled badges for missing actions */}
                            {ALL_ACTIONS.filter((a) => !actions.includes(a)).map((action) => (
                              <EntitlementBadge
                                key={action}
                                action={action}
                                active={false}
                                editable={isLeader}
                                onToggle={() =>
                                  onEntitlementChange(
                                    teamUser._id,
                                    moduleKey,
                                    action,
                                    true
                                  )
                                }
                              />
                            ))}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ─── Pipeline Config ─── */

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

  // Build entitlement context
  const entitlementCtx = useMemo(() => buildEntitlementContext(user), [user])
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

  const { data: users, loading: uLoad, error: uError } = useCollection<UserRecord>(usersQ, 'admin-users')
  const { data: pipelines, loading: pLoad } = useCollection<PipelineRecord>(pipelinesQ, 'admin-pipelines')

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

  // Pipeline stage handlers
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
      {/* PL3-8: Removed redundant "Admin" heading — sidebar already shows context */}

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-1.5">
        {([
          { key: 'module-config' as AdminTab, label: 'Module Config', icon: 'grid_view' },
          { key: 'pipeline-config' as AdminTab, label: 'Pipeline Config', icon: 'view_kanban' },
        ]).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 rounded-md h-[34px] px-4 text-sm font-medium transition-colors ${
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
        <div className="space-y-4">
          {pLoad ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--portal)] border-t-transparent" />
            </div>
          ) : pipelines.length > 0 ? (
            pipelines.map((pipeline) => (
              <PipelineCard
                key={pipeline._id}
                pipeline={pipeline}
                isLeader={isLeader}
                onStageAdd={handleStageAdd}
                onStageUpdate={handleStageUpdate}
              />
            ))
          ) : (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-card)] py-16">
              <span className="material-icons-outlined text-4xl text-[var(--text-muted)]">
                view_kanban
              </span>
              <p className="mt-3 text-sm text-[var(--text-muted)]">
                No pipelines configured yet. Pipelines are created from the flow engine at the RIIMO level.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
