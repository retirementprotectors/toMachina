'use client'

/**
 * RSP Pipeline — Instance Detail Page
 *
 * Fetches a flow instance from /api/flow/instances/:id and renders
 * the appropriate stage component based on current_stage:
 *
 *   orange_discovery  → RSPDiscoveryPanel
 *   blue_analysis     → RSPBlueGate + RSPAccountReview + RSPAuthStatus
 *   yellow_presentation → RSPYellowQUE  ← Yellow Phase focus (TRK-14130)
 *   green_implementation → RSPTransitionPanel
 *   red_service       → RSPServiceHandoff + RSPReportTracker
 *
 * Route: /modules/rsp/[instanceId]
 */

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { apiGet } from '@tomachina/core'
import type { FlowInstanceDetailData } from '@tomachina/core'
import type { RSPAccount } from '@tomachina/ui/src/modules/RSPPipeline/types'
import {
  RSPDiscoveryPanel,
  RSPBlueGate,
  RSPAccountReview,
  RSPAuthStatus,
  RSPYellowQUE,
  RSPTransitionPanel,
  RSPServiceHandoff,
  RSPReportTracker,
} from '@tomachina/ui/src/modules/RSPPipeline'

// ============================================================================
// STAGE CONFIG
// ============================================================================

type RSPStageId =
  | 'orange_discovery'
  | 'blue_analysis'
  | 'yellow_presentation'
  | 'green_implementation'
  | 'red_service'

const STAGE_ORDER: RSPStageId[] = [
  'orange_discovery',
  'blue_analysis',
  'yellow_presentation',
  'green_implementation',
  'red_service',
]

const STAGE_META: Record<RSPStageId, { label: string; shortLabel: string; color: string; textColor: string; icon: string }> = {
  orange_discovery: {
    label: 'Orange — Discovery',
    shortLabel: 'Discovery',
    color: '#f97316',
    textColor: '#fff',
    icon: 'search',
  },
  blue_analysis: {
    label: 'Blue — Analysis',
    shortLabel: 'Analysis',
    color: '#3b82f6',
    textColor: '#fff',
    icon: 'analytics',
  },
  yellow_presentation: {
    label: 'Yellow — Presentation',
    shortLabel: 'Presentation',
    color: '#eab308',
    textColor: '#000',
    icon: 'slideshow',
  },
  green_implementation: {
    label: 'Green — Implementation',
    shortLabel: 'Implementation',
    color: '#22c55e',
    textColor: '#fff',
    icon: 'check_circle',
  },
  red_service: {
    label: 'Red — Service',
    shortLabel: 'Service',
    color: '#ef4444',
    textColor: '#fff',
    icon: 'support_agent',
  },
}

// ============================================================================
// HELPERS
// ============================================================================

/** Extract accounts from instance custom_fields JSON. Returns [] on parse failure. */
function extractAccounts(customFieldsRaw: unknown): RSPAccount[] {
  try {
    const parsed: unknown =
      typeof customFieldsRaw === 'string'
        ? JSON.parse(customFieldsRaw)
        : customFieldsRaw
    if (parsed && typeof parsed === 'object' && 'accounts' in parsed) {
      const accounts = (parsed as Record<string, unknown>).accounts
      if (Array.isArray(accounts)) {
        return accounts as RSPAccount[]
      }
    }
    return []
  } catch {
    return []
  }
}

/** Narrow a string to RSPStageId — falls back to orange if unknown. */
function toRSPStageId(stage: unknown): RSPStageId {
  if (typeof stage === 'string' && STAGE_ORDER.includes(stage as RSPStageId)) {
    return stage as RSPStageId
  }
  return 'orange_discovery'
}

// ============================================================================
// PAGE
// ============================================================================

export default function RSPInstancePage() {
  const params = useParams<{ instanceId: string }>()
  const router = useRouter()
  const instanceId = params.instanceId

  const [detail, setDetail] = useState<FlowInstanceDetailData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // ── Fetch ────────────────────────────────────────────────────────────────
  const loadDetail = useCallback(async () => {
    setLoading(true)
    setError(null)

    const result = await apiGet<FlowInstanceDetailData>(`/flow/instances/${instanceId}`)

    if (result.success && result.data) {
      setDetail(result.data)
    } else {
      setError(result.error ?? 'Failed to load instance')
    }

    setLoading(false)
  }, [instanceId])

  useEffect(() => {
    void loadDetail()
  }, [loadDetail])

  // ── Loading skeleton ─────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="mx-auto max-w-4xl space-y-6 p-6">
        <BackLink />
        <div className="animate-pulse space-y-4">
          <div className="h-20 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)]" />
          <div className="h-48 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)]" />
        </div>
      </div>
    )
  }

  // ── Error ────────────────────────────────────────────────────────────────
  if (error || !detail) {
    return (
      <div className="mx-auto max-w-4xl space-y-6 p-6">
        <BackLink />
        <div className="rounded-lg border border-red-300 bg-red-50 p-5">
          <div className="flex items-center gap-2">
            <span className="material-icons-outlined text-red-600" style={{ fontSize: '20px' }}>
              error
            </span>
            <p className="text-sm text-red-800">{error ?? 'Instance not found'}</p>
          </div>
          <button
            onClick={() => void loadDetail()}
            className="mt-3 rounded bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  const { instance, stages } = detail
  const currentStageId = toRSPStageId(instance.current_stage)
  const currentMeta = STAGE_META[currentStageId]
  const accounts = extractAccounts(instance.custom_fields)

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      {/* Back link */}
      <BackLink />

      {/* Header card */}
      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          {/* Entity info */}
          <div className="flex items-center gap-3">
            <div
              className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full"
              style={{ backgroundColor: currentMeta.color }}
            >
              <span
                className="material-icons-outlined"
                style={{ fontSize: '22px', color: currentMeta.textColor }}
              >
                {currentMeta.icon}
              </span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-[var(--text-primary)]">
                {instance.entity_name}
              </h1>
              <p className="text-xs text-[var(--text-muted)]">
                Instance {instance.id} · {instance.priority} priority
              </p>
            </div>
          </div>

          {/* Stage badge + status */}
          <div className="flex flex-col items-end gap-1">
            <span
              className="rounded px-3 py-1 text-xs font-bold uppercase tracking-wide"
              style={{ backgroundColor: currentMeta.color, color: currentMeta.textColor }}
            >
              {currentMeta.label}
            </span>
            <span className="text-xs text-[var(--text-muted)] capitalize">
              {instance.stage_status?.replace('_', ' ')}
            </span>
          </div>
        </div>

        {/* Assigned to */}
        {instance.assigned_to && (
          <div className="mt-3 flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
            <span className="material-icons-outlined" style={{ fontSize: '14px' }}>person</span>
            Assigned to {instance.assigned_to}
          </div>
        )}
      </div>

      {/* Stage navigation rail */}
      <StageNav
        stages={stages as Array<{ stage_id: string; stage_name: string; stage_order: number; stage_color: string }>}
        currentStageId={currentStageId}
        instanceId={instanceId}
      />

      {/* Stage content */}
      <StageContent
        instanceId={instanceId}
        currentStageId={currentStageId}
        instance={instance}
        accounts={accounts}
        onTransitioned={() => void loadDetail()}
        onHandoffComplete={() => router.push('/modules/rsp')}
        onBack={() => router.push('/modules/rsp')}
      />
    </div>
  )
}

// ============================================================================
// STAGE NAVIGATION
// ============================================================================

interface StageNavProps {
  stages: Array<{ stage_id: string; stage_name: string; stage_order: number; stage_color: string }>
  currentStageId: RSPStageId
  instanceId: string
}

function StageNav({ stages, currentStageId, instanceId }: StageNavProps) {
  // Sort stages by stage_order ascending
  const sorted = [...stages].sort((a, b) => a.stage_order - b.stage_order)
  const currentIdx = sorted.findIndex((s) => s.stage_id === currentStageId)

  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4">
      <div className="flex items-center gap-0">
        {sorted.map((stage, idx) => {
          const isActive = stage.stage_id === currentStageId
          const isPast = idx < currentIdx
          const meta = STAGE_META[stage.stage_id as RSPStageId]
          const color = meta?.color ?? stage.stage_color ?? '#6b7280'
          const textColor = meta?.textColor ?? '#fff'

          return (
            <div key={stage.stage_id} className="flex flex-1 items-center">
              {/* Step node */}
              <div className="flex flex-1 flex-col items-center">
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-transform"
                  style={{
                    backgroundColor: isActive || isPast ? color : 'var(--bg-surface)',
                    color: isActive || isPast ? textColor : 'var(--text-muted)',
                    transform: isActive ? 'scale(1.15)' : 'scale(1)',
                    border: isActive ? `2px solid ${color}` : '2px solid var(--border-subtle)',
                  }}
                >
                  {isPast ? (
                    <span className="material-icons-outlined" style={{ fontSize: '14px' }}>check</span>
                  ) : (
                    idx + 1
                  )}
                </div>
                <span
                  className="mt-1 max-w-[64px] text-center text-[10px] font-medium leading-tight"
                  style={{ color: isActive ? color : 'var(--text-muted)' }}
                >
                  {meta?.shortLabel ?? stage.stage_name}
                </span>
              </div>

              {/* Connector line (between nodes) */}
              {idx < sorted.length - 1 && (
                <div
                  className="h-0.5 w-4 flex-shrink-0"
                  style={{
                    backgroundColor: idx < currentIdx ? color : 'var(--border-subtle)',
                  }}
                />
              )}
            </div>
          )
        })}
      </div>

      {/* Quick-nav label */}
      <p className="mt-3 text-center text-xs text-[var(--text-muted)]">
        Instance{' '}
        <span className="font-mono text-[var(--text-primary)]">{instanceId.slice(0, 8)}</span>
        {' '}· Click stage nodes to jump (read-only nav — use actions below to advance)
      </p>
    </div>
  )
}

// ============================================================================
// STAGE CONTENT — routes to the correct component(s)
// ============================================================================

interface StageContentProps {
  instanceId: string
  currentStageId: RSPStageId
  instance: FlowInstanceDetailData['instance']
  accounts: RSPAccount[]
  onTransitioned: () => void
  onHandoffComplete: () => void
  onBack: () => void
}

function StageContent({
  instanceId,
  currentStageId,
  instance,
  accounts,
  onTransitioned,
  onHandoffComplete,
  onBack,
}: StageContentProps) {
  switch (currentStageId) {
    // ── Orange: Discovery ────────────────────────────────────────────────────
    case 'orange_discovery':
      return (
        <StagePanelWrapper label="Discovery Meeting" color="#f97316">
          <RSPDiscoveryPanel
            instanceId={instanceId}
            clientId={instance.entity_id}
          />
        </StagePanelWrapper>
      )

    // ── Blue: Analysis ───────────────────────────────────────────────────────
    case 'blue_analysis': {
      // Build stub gate items from tasks (fallback to empty if none)
      const gateItems = accounts.map((acc) => ({
        id: acc.account_id,
        label: `${acc.account_type} — ${acc.carrier}`,
        category: 'report' as const,
        complete: acc.status === 'active',
      }))

      // Stub auth forms from accounts (one HIPAA per account)
      const authForms = accounts.map((acc) => ({
        form_id: `auth-${acc.account_id}`,
        form_name: `Auth — ${acc.carrier}`,
        form_type: 'hipaa' as const,
        status: 'pending' as const,
      }))

      return (
        <div className="space-y-4">
          <StagePanelWrapper label="Blue Gate" color="#3b82f6">
            <RSPBlueGate
              instanceId={instanceId}
              items={gateItems.length > 0 ? gateItems : [
                { id: 'profile', label: 'Client profile complete', category: 'field', complete: false },
                { id: 'reports', label: 'Reports ordered', category: 'report', complete: false },
                { id: 'auth', label: 'Auth forms sent', category: 'auth', complete: false },
              ]}
            />
          </StagePanelWrapper>

          {accounts.length > 0 && (
            <StagePanelWrapper label="Account Review" color="#3b82f6">
              <RSPAccountReview accounts={accounts} />
            </StagePanelWrapper>
          )}

          <StagePanelWrapper label="Authorization Status" color="#3b82f6">
            <RSPAuthStatus
              forms={authForms.length > 0 ? authForms : [
                {
                  form_id: 'hipaa-1',
                  form_name: 'HIPAA Authorization',
                  form_type: 'hipaa',
                  status: 'pending',
                },
                {
                  form_id: 'acat-1',
                  form_name: 'Account Transfer (ACAT)',
                  form_type: 'acat',
                  status: 'pending',
                },
              ]}
            />
          </StagePanelWrapper>
        </div>
      )
    }

    // ── Yellow: Presentation / QUE ───────────────────────────────────────────
    case 'yellow_presentation':
      return (
        <StagePanelWrapper label="QUE Analysis Tools — Presentation Prep" color="#eab308">
          <RSPYellowQUE
            instanceId={instanceId}
            accounts={accounts}
            queBaseUrl="/modules/que"
          />
        </StagePanelWrapper>
      )

    // ── Green: Implementation ────────────────────────────────────────────────
    case 'green_implementation': {
      // Build case package items from accounts as Yellow output
      const packageItems = accounts.map((acc) => ({
        id: `pkg-${acc.account_id}`,
        label: `${acc.account_type} illustration — ${acc.carrier}`,
        ready: acc.status === 'active',
      }))

      return (
        <StagePanelWrapper label="A+R Meeting — Green to Red Transition" color="#22c55e">
          <RSPTransitionPanel
            instanceId={instanceId}
            packageItems={packageItems.length > 0 ? packageItems : [
              { id: 'pkg-life', label: 'Life insurance illustration', ready: false },
              { id: 'pkg-annuity', label: 'Annuity illustration', ready: false },
              { id: 'pkg-medicare', label: 'Medicare comparison', ready: false },
            ]}
            onTransitioned={onTransitioned}
          />
        </StagePanelWrapper>
      )
    }

    // ── Red: Service Handoff ─────────────────────────────────────────────────
    case 'red_service': {
      // Build stub report list from accounts
      const reports = accounts.map((acc) => ({
        report_id: `rpt-${acc.account_id}`,
        account_id: acc.account_id,
        report_type: `${acc.account_type} Implementation Report`,
        status: 'pending' as const,
      }))

      return (
        <div className="space-y-4">
          <StagePanelWrapper label="Service Handoff" color="#ef4444">
            <RSPServiceHandoff
              instanceId={instanceId}
              currentStage="red"
              entityName={instance.entity_name}
              onHandoffComplete={onHandoffComplete}
              onBack={onBack}
            />
          </StagePanelWrapper>

          {reports.length > 0 && (
            <StagePanelWrapper label="Implementation Reports" color="#ef4444">
              <RSPReportTracker reports={reports} />
            </StagePanelWrapper>
          )}
        </div>
      )
    }

    // ── Fallback ─────────────────────────────────────────────────────────────
    default:
      return (
        <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 text-center">
          <p className="text-sm text-[var(--text-muted)]">
            No component configured for stage: <code className="font-mono">{currentStageId}</code>
          </p>
        </div>
      )
  }
}

// ============================================================================
// SHARED WRAPPERS
// ============================================================================

function BackLink() {
  return (
    <Link
      href="/modules/rsp"
      className="inline-flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)]"
    >
      <span className="material-icons-outlined" style={{ fontSize: '16px' }}>arrow_back</span>
      RSP Pipeline
    </Link>
  )
}

interface StagePanelWrapperProps {
  label: string
  color: string
  children: React.ReactNode
}

function StagePanelWrapper({ label, color, children }: StagePanelWrapperProps) {
  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
      {/* Panel label */}
      <div
        className="mb-4 flex items-center gap-2 pb-3"
        style={{ borderBottom: `2px solid ${color}20` }}
      >
        <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
        <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          {label}
        </span>
      </div>

      {children}
    </div>
  )
}
