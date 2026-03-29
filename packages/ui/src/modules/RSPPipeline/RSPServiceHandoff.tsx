'use client'

/**
 * RSPServiceHandoff — Red→Service Handoff UI (Implementation Meeting)
 *
 * Rendered when an RSP instance reaches the RED stage. Allows the user
 * to execute the service_handoff transition which:
 *   1. Generates the NewBiz kit via DEX
 *   2. Auto-creates service pipeline cards per activated product line
 *   3. Marks the RSP instance as complete
 *
 * AC:
 *   ✓ DEX generates NewBiz kit
 *   ✓ Auto-creates service pipeline cards (RMD, Beni, Access, Comms)
 *   ✓ Implementation → NewBiz kit → service cards created
 *   ✓ Best-effort on missing pipelines (partial success allowed)
 *   ✓ Toast feedback on success/error
 *
 * @ticket TRK-14132
 */

import { useState, useCallback } from 'react'
import { useToast } from '../../components/Toast'
import { apiPost } from '@tomachina/core'

// ============================================================================
// TYPES
// ============================================================================

export interface RSPServiceHandoffProps {
  /** RSP flow instance ID */
  instanceId: string
  /** Current stage of the RSP instance */
  currentStage: string
  /** Entity name (client/household) for display */
  entityName: string
  /** Called after successful handoff with result data */
  onHandoffComplete?: (result: ServiceHandoffResult) => void
  /** Called when user wants to navigate back */
  onBack?: () => void
}

interface ServiceCardResult {
  instance_id: string
  pipeline_key: string
  label: string
  product_line: string
}

export interface ServiceHandoffResult {
  instance_id: string
  newbiz_kit_id: string | null
  service_cards: ServiceCardResult[]
  status: 'complete'
}

// ============================================================================
// PRODUCT LINE DISPLAY CONFIG
// ============================================================================

const PRODUCT_LINE_META: Record<string, { icon: string; color: string }> = {
  LIFE: { icon: 'health_and_safety', color: 'var(--success)' },
  ANNUITY: { icon: 'savings', color: 'var(--info)' },
  MEDICARE: { icon: 'local_hospital', color: 'var(--portal)' },
  INVESTMENT: { icon: 'trending_up', color: 'var(--warning)' },
}

// ============================================================================
// COMPONENT
// ============================================================================

export function RSPServiceHandoff({
  instanceId,
  currentStage,
  entityName,
  onHandoffComplete,
  onBack,
}: RSPServiceHandoffProps) {
  const { showToast } = useToast()
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ServiceHandoffResult | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)

  const isRedStage = currentStage === 'red'

  // ── Execute handoff ──────────────────────────────────────────────────
  const executeHandoff = useCallback(async () => {
    if (!isRedStage || loading) return

    setLoading(true)

    try {
      const response = await apiPost<ServiceHandoffResult>(
        `/rsp/transition/${instanceId}`,
        { transition: 'service_handoff' },
      )

      if (response.success && response.data) {
        setResult(response.data)
        const cardCount = response.data.service_cards.length
        showToast(
          `Service handoff complete — ${cardCount} service card${cardCount !== 1 ? 's' : ''} created`,
          'success',
        )
        onHandoffComplete?.(response.data)
      } else {
        showToast(response.error || 'Service handoff failed', 'error')
      }
    } catch {
      showToast('Service handoff failed — please try again', 'error')
    } finally {
      setLoading(false)
      setShowConfirm(false)
    }
  }, [instanceId, isRedStage, loading, onHandoffComplete, showToast])

  // ── Completed state ──────────────────────────────────────────────────
  if (result) {
    return (
      <div className="space-y-4" data-instance-id={instanceId}>
        {/* Success header */}
        <div className="rounded-lg border border-green-300 bg-green-50 p-4">
          <div className="flex items-center gap-3">
            <span
              className="material-icons-outlined text-green-600"
              style={{ fontSize: '28px' }}
            >
              check_circle
            </span>
            <div>
              <h3 className="text-base font-semibold text-green-900">
                Service Handoff Complete
              </h3>
              <p className="mt-0.5 text-sm text-green-700">
                {entityName} has been transitioned to ongoing service management.
              </p>
            </div>
          </div>
        </div>

        {/* NewBiz Kit status */}
        <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4">
          <div className="flex items-center gap-2 text-sm">
            <span
              className="material-icons-outlined text-[var(--text-muted)]"
              style={{ fontSize: '18px' }}
            >
              description
            </span>
            <span className="font-medium text-[var(--text-primary)]">NewBiz Kit</span>
            {result.newbiz_kit_id ? (
              <span className="rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-green-800">
                Created
              </span>
            ) : (
              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-800">
                Skipped
              </span>
            )}
          </div>
          {result.newbiz_kit_id && (
            <p className="mt-1 pl-[26px] text-xs text-[var(--text-muted)]">
              Package ID: {result.newbiz_kit_id}
            </p>
          )}
        </div>

        {/* Service Cards Created */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span
              className="material-icons-outlined text-[var(--text-muted)]"
              style={{ fontSize: '18px' }}
            >
              dashboard
            </span>
            <h4 className="text-sm font-semibold text-[var(--text-primary)]">
              Service Pipeline Cards ({result.service_cards.length})
            </h4>
          </div>

          {result.service_cards.length === 0 ? (
            <p className="pl-[26px] text-xs text-[var(--text-muted)]">
              No service cards created — no activated product lines detected.
            </p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {result.service_cards.map((card) => {
                const meta = PRODUCT_LINE_META[card.product_line] || {
                  icon: 'article',
                  color: 'var(--text-muted)',
                }
                return (
                  <div
                    key={card.instance_id}
                    className="flex items-start gap-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] p-3"
                  >
                    <span
                      className="material-icons-outlined mt-0.5"
                      style={{ fontSize: '20px', color: meta.color }}
                    >
                      {meta.icon}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-[var(--text-primary)]">
                        {card.label}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-[var(--text-muted)]">
                        {card.pipeline_key} &middot; {card.instance_id}
                      </p>
                    </div>
                    <span
                      className="material-icons-outlined mt-0.5 text-green-500"
                      style={{ fontSize: '16px' }}
                    >
                      check
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Done button */}
        {onBack && (
          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={onBack}
              className="rounded-md bg-[var(--portal)] px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90"
            >
              Done
            </button>
          </div>
        )}
      </div>
    )
  }

  // ── Pre-handoff state ──────────────────────────────────────────────────
  return (
    <div className="space-y-4" data-instance-id={instanceId}>
      {/* Section header */}
      <div className="flex items-center gap-2">
        <span
          className="material-icons-outlined text-[var(--text-muted)]"
          style={{ fontSize: '18px' }}
        >
          handshake
        </span>
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">
          Implementation Meeting — Service Handoff
        </h3>
        <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-800">
          Red → Service
        </span>
      </div>

      {/* Description */}
      <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4">
        <p className="text-sm text-[var(--text-primary)]">
          Completing this transition for <strong>{entityName}</strong> will:
        </p>
        <ul className="mt-2 space-y-1.5 text-sm text-[var(--text-muted)]">
          <li className="flex items-start gap-2">
            <span
              className="material-icons-outlined mt-0.5"
              style={{ fontSize: '14px', color: 'var(--info)' }}
            >
              description
            </span>
            Generate the <strong>NewBiz Kit</strong> via DEX (implementation paperwork)
          </li>
          <li className="flex items-start gap-2">
            <span
              className="material-icons-outlined mt-0.5"
              style={{ fontSize: '14px', color: 'var(--info)' }}
            >
              dashboard
            </span>
            Auto-create <strong>Service Pipeline Cards</strong> per activated product line
          </li>
          <li className="flex items-start gap-2">
            <span
              className="material-icons-outlined mt-0.5"
              style={{ fontSize: '14px', color: 'var(--info)' }}
            >
              check_circle
            </span>
            Mark this RSP case as <strong>Complete</strong>
          </li>
        </ul>
      </div>

      {/* Not ready warning */}
      {!isRedStage && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3">
          <div className="flex items-center gap-2">
            <span
              className="material-icons-outlined text-amber-600"
              style={{ fontSize: '18px' }}
            >
              warning
            </span>
            <p className="text-sm text-amber-800">
              Service handoff is only available when the instance is in the <strong>Red</strong> stage.
              Current stage: <strong>{currentStage}</strong>
            </p>
          </div>
        </div>
      )}

      {/* Advance button */}
      <div className="flex items-center gap-3 justify-end">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="rounded-lg border border-[var(--border-subtle)] px-4 py-2 text-sm text-[var(--text-muted)] hover:bg-[var(--bg-hover)]"
          >
            Back
          </button>
        )}
        <button
          type="button"
          onClick={() => setShowConfirm(true)}
          disabled={!isRedStage || loading}
          className={`flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition-colors ${
            isRedStage && !loading
              ? 'bg-[var(--portal)] text-white hover:opacity-90'
              : 'cursor-not-allowed bg-gray-200 text-gray-400'
          }`}
        >
          <span className="material-icons-outlined" style={{ fontSize: '18px' }}>
            send
          </span>
          Complete Service Handoff
        </button>
      </div>

      {/* Confirmation dialog */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 shadow-xl">
            <h4 className="text-base font-semibold text-[var(--text-primary)]">
              Confirm Service Handoff
            </h4>
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              This will generate the NewBiz kit, create service pipeline cards for
              each activated product line, and mark <strong>{entityName}</strong> as
              complete in the RSP pipeline.
            </p>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              This action cannot be undone.
            </p>

            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                disabled={loading}
                className="rounded-lg border border-[var(--border-subtle)] px-4 py-2 text-sm text-[var(--text-muted)] hover:bg-[var(--bg-hover)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeHandoff}
                disabled={loading}
                className="flex items-center gap-2 rounded-lg bg-[var(--portal)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <span className="material-icons-outlined animate-spin" style={{ fontSize: '16px' }}>
                      autorenew
                    </span>
                    Processing…
                  </>
                ) : (
                  <>
                    <span className="material-icons-outlined" style={{ fontSize: '16px' }}>
                      check
                    </span>
                    Confirm Handoff
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
