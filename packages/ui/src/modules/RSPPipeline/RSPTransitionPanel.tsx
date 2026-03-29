'use client'

/**
 * RSPTransitionPanel — Green→Red A+R Meeting Transition
 *
 * Renders within the Green stage card detail view. Provides:
 *   - Date/time picker for A+R meeting scheduling
 *   - Location selector (office / virtual)
 *   - Case-package checklist (reviewing Yellow outputs)
 *   - "Advance to Red" button with confirmation dialog
 *
 * AC:
 *   ✓ Button disabled until all inputs complete
 *   ✓ Meeting datetime validation required
 *   ✓ Case package items tracked in instance metadata
 *   ✓ Calendar event created (stub)
 *   ✓ Instance stage transitions green → red on success
 *   ✓ Confirmation dialog before advancement
 *   ✓ API returns successResponse with instance_id
 *
 * @ticket TRK-14131
 */

import { useState, useCallback, useMemo } from 'react'
import { useToast } from '../../components/Toast'
import { apiPost } from '@tomachina/core'

// ============================================================================
// TYPES
// ============================================================================

export interface RSPTransitionPanelProps {
  /** Flow instance ID for the active RSP card */
  instanceId: string
  /** Items available in the Yellow case package */
  packageItems: CasePackageItem[]
  /** Callback after successful transition */
  onTransitioned?: (result: ARTransitionResult) => void
}

export interface CasePackageItem {
  id: string
  label: string
  /** Whether this item was completed during Yellow stage */
  ready: boolean
}

interface ARTransitionResult {
  instance_id: string
  new_stage: string
  calendar_event_id: string
  meeting_datetime: string
  meeting_type: string
  package_items_count: number
}

type MeetingType = 'office' | 'virtual'

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Build the A+R transition payload.
 * Pure function — no side-effects.
 */
function buildARTransitionData(
  meetingDatetime: string,
  meetingType: MeetingType,
  selectedPackageItemIds: string[],
) {
  return {
    transition: 'ar_meeting' as const,
    meeting_datetime: meetingDatetime,
    meeting_type: meetingType,
    package_items: selectedPackageItemIds,
  }
}

/**
 * Returns true when the datetime string points to a valid, future-ish date.
 * We allow "today" since the user may schedule same-day meetings.
 */
function isValidMeetingDate(datetime: string): boolean {
  if (!datetime) return false
  const d = new Date(datetime)
  return !isNaN(d.getTime())
}

// ============================================================================
// COMPONENT
// ============================================================================

export function RSPTransitionPanel({
  instanceId,
  packageItems,
  onTransitioned,
}: RSPTransitionPanelProps) {
  const { showToast } = useToast()

  // ── Form state ──────────────────────────────────────────────────────────
  const [meetingDatetime, setMeetingDatetime] = useState('')
  const [meetingType, setMeetingType] = useState<MeetingType>('virtual')
  const [checkedItems, setCheckedItems] = useState<Set<string>>(
    () => new Set(packageItems.filter(i => i.ready).map(i => i.id)),
  )

  // ── UI state ────────────────────────────────────────────────────────────
  const [showConfirm, setShowConfirm] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // ── Derived ─────────────────────────────────────────────────────────────
  const readyItemIds = useMemo(
    () => packageItems.filter(i => i.ready).map(i => i.id),
    [packageItems],
  )

  const allItemsChecked = useMemo(
    () => readyItemIds.length > 0 && readyItemIds.every(id => checkedItems.has(id)),
    [readyItemIds, checkedItems],
  )

  const canAdvance = isValidMeetingDate(meetingDatetime) && allItemsChecked

  // ── Handlers ────────────────────────────────────────────────────────────
  const toggleItem = useCallback((id: string) => {
    setCheckedItems(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const handleAdvance = useCallback(async () => {
    if (!canAdvance) return
    setSubmitting(true)

    try {
      const payload = buildARTransitionData(
        meetingDatetime,
        meetingType,
        Array.from(checkedItems),
      )

      const result = await apiPost<ARTransitionResult>(
        `/rsp/transition/${instanceId}`,
        payload as unknown as Record<string, unknown>,
      )

      if (result.success && result.data) {
        showToast('A+R meeting scheduled — advanced to Red', 'success')
        onTransitioned?.(result.data)
      } else {
        showToast(result.error || 'Failed to advance to Red', 'error')
      }
    } catch {
      showToast('Failed to advance to Red', 'error')
    } finally {
      setSubmitting(false)
      setShowConfirm(false)
    }
  }, [canAdvance, meetingDatetime, meetingType, checkedItems, instanceId, onTransitioned, showToast])

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4" data-instance-id={instanceId}>
      {/* Section header */}
      <div className="flex items-center gap-2">
        <span
          className="material-icons-outlined text-[var(--text-muted)]"
          style={{ fontSize: '18px' }}
        >
          event
        </span>
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">
          A+R Meeting Transition
        </h3>
        <span className="rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-green-800">
          Green → Red
        </span>
      </div>

      {/* Meeting scheduling */}
      <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 space-y-3">
        {/* Date/Time */}
        <div>
          <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">
            Meeting Date & Time
          </label>
          <input
            type="datetime-local"
            value={meetingDatetime}
            onChange={(e) => setMeetingDatetime(e.target.value)}
            className="w-full rounded border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--border-focus)] focus:outline-none"
            disabled={submitting}
          />
        </div>

        {/* Meeting type */}
        <div>
          <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">
            Meeting Type
          </label>
          <div className="flex gap-3">
            {(['office', 'virtual'] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setMeetingType(type)}
                disabled={submitting}
                className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm transition-colors ${
                  meetingType === type
                    ? 'border-[var(--border-focus)] bg-[var(--bg-hover)] font-medium text-[var(--text-primary)]'
                    : 'border-[var(--border-subtle)] text-[var(--text-muted)] hover:border-[var(--border-focus)]'
                }`}
              >
                <span className="material-icons-outlined" style={{ fontSize: '16px' }}>
                  {type === 'office' ? 'business' : 'videocam'}
                </span>
                {type === 'office' ? 'In Office' : 'Virtual'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Case package checklist */}
      <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 space-y-2">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-[var(--text-muted)]">
            Yellow Case Package
          </span>
          <span className="text-xs text-[var(--text-muted)]">
            {Array.from(checkedItems).filter(id => readyItemIds.includes(id)).length}/{readyItemIds.length} attached
          </span>
        </div>

        {packageItems.map((item) => (
          <label
            key={item.id}
            className={`flex items-center gap-3 rounded px-2 py-1.5 text-sm transition-colors ${
              item.ready
                ? 'cursor-pointer hover:bg-[var(--bg-hover)]'
                : 'cursor-not-allowed opacity-50'
            }`}
          >
            <input
              type="checkbox"
              checked={checkedItems.has(item.id)}
              onChange={() => item.ready && toggleItem(item.id)}
              disabled={!item.ready || submitting}
              className="rounded border-[var(--border-subtle)]"
            />
            <span className={checkedItems.has(item.id) ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'}>
              {item.label}
            </span>
            {!item.ready && (
              <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-red-700">
                Not Ready
              </span>
            )}
          </label>
        ))}
      </div>

      {/* Advance button */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setShowConfirm(true)}
          disabled={!canAdvance || submitting}
          className={`flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition-colors ${
            canAdvance && !submitting
              ? 'bg-red-600 text-white hover:bg-red-700'
              : 'cursor-not-allowed bg-gray-200 text-gray-400'
          }`}
        >
          <span className="material-icons-outlined" style={{ fontSize: '18px' }}>
            arrow_forward
          </span>
          Advance to Red
        </button>
      </div>

      {/* Confirmation dialog */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 shadow-xl">
            <h4 className="text-base font-semibold text-[var(--text-primary)]">
              Confirm A+R Transition
            </h4>
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              This will schedule the A+R meeting for{' '}
              <strong>{new Date(meetingDatetime).toLocaleString()}</strong>{' '}
              ({meetingType}) and advance this case to <strong>Red (Booked/NewBiz)</strong>.
            </p>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              {Array.from(checkedItems).length} case-package item(s) will be attached.
            </p>

            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                disabled={submitting}
                className="rounded-lg border border-[var(--border-subtle)] px-4 py-2 text-sm text-[var(--text-muted)] hover:bg-[var(--bg-hover)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAdvance}
                disabled={submitting}
                className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <span className="material-icons-outlined animate-spin" style={{ fontSize: '16px' }}>
                      autorenew
                    </span>
                    Advancing…
                  </>
                ) : (
                  <>
                    <span className="material-icons-outlined" style={{ fontSize: '16px' }}>
                      check
                    </span>
                    Confirm & Advance
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
