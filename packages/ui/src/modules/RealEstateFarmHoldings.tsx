'use client'

/**
 * RealEstateFarmHoldings — per-client farmland valuation panel.
 *
 * Sprint: SPR-FARMLAND-VALUATION-001 (FV-008)
 * Depends on: FV-007 types, FV-006 API (/api/clients/:clientId/farm-holdings-valued)
 *
 * Renders one row per `client.farm_holdings[]` entry with:
 *   county, state, acres, ownership_type, estimated_value,
 *   source badge (ISU_EXTENSION | USDA_NASS | ENSEMBLE_ISU_NASS),
 *   confidence badge (HIGH = green, MEDIUM = yellow, LOW = red-ish),
 *   as-of year.
 *
 * Clicking the estimated_value opens a provenance drawer showing the raw
 * FarmlandValueRow(s) that fed the number. Per-row pencil affordance opens
 * a casework override modal (dispatched as event — implementation deferred,
 * matches ClientDocuments upload affordance pattern).
 *
 * States:
 *   - `client.farm_holdings` missing / empty → render nothing (section hidden)
 *   - Loading → skeleton rows
 *   - Per-row `insufficient_data: true` → "Data not yet available — seeds
 *     run annually Jan 15" + casework override affordance
 *   - `quality_tier: null` → "Tier: Blended avg (edit if known)" with
 *     pencil affordance (FV-007 GAP 3 ruling)
 *
 * Theming: portal-branded via `var(--portal)` CSS variable (same component,
 * different accent color per portal). Same render shape across ProDash /
 * RIIMO / SENTINEL.
 */

import { useState, useEffect, useCallback } from 'react'
import { fetchValidated } from './fetchValidated'
import type {
  FarmHolding,
  FarmlandValuationResponse,
  FarmlandValueSource,
  ValueConfidence,
} from '@tomachina/core'

export interface RealEstateFarmHoldingsProps {
  clientId: string
  /** Portal context — currently decorative; theming comes from CSS vars. */
  portal?: 'prodash' | 'riimo' | 'sentinel'
  /** Optional prefetched farm_holdings (from client doc); if omitted, panel
   *  still fetches the valuation batch endpoint which carries them. */
  farmHoldings?: FarmHolding[]
}

interface ValuedEntry {
  farm_holding: FarmHolding
  valuation: FarmlandValuationResponse
}

interface BatchResponse {
  client_id: string
  year: number
  holdings: ValuedEntry[]
}

export function RealEstateFarmHoldings({ clientId, farmHoldings }: RealEstateFarmHoldingsProps) {
  const [data, setData] = useState<BatchResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [provenance, setProvenance] = useState<ValuedEntry | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetchValidated<BatchResponse>(`/api/clients/${clientId}/farm-holdings-valued`)
      if (res.success) setData(res.data ?? null)
    } catch {
      // Silent — provenance drawer and error banner deferred to a later pass.
    } finally {
      setLoading(false)
    }
  }, [clientId])

  useEffect(() => { load() }, [load])

  // Hide section entirely when client has no farm holdings declared and the
  // batch endpoint returned none either. Matches ClientDocuments pattern.
  const holdings = data?.holdings ?? []
  const declared = farmHoldings ?? []
  if (!loading && holdings.length === 0 && declared.length === 0) return null

  return (
    <>
      <section className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
        <header className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="material-icons-outlined text-[var(--portal)]" style={{ fontSize: '20px' }}>
              agriculture
            </span>
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">
              Farmland Holdings
            </h3>
            {data?.year != null && (
              <span className="text-xs text-[var(--text-muted)]">· {data.year} values</span>
            )}
          </div>
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('farm-holding-add', { detail: { clientId } }))}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] px-2.5 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:border-[var(--portal)] hover:text-[var(--portal)] transition-colors"
            title="Add farm holding"
          >
            <span className="material-icons-outlined" style={{ fontSize: '14px' }}>add_circle_outline</span>
            <span>Add</span>
          </button>
        </header>

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="h-14 rounded-lg bg-[var(--bg-surface)] animate-pulse" />
            ))}
          </div>
        ) : (
          <ul className="space-y-2">
            {holdings.map((entry, idx) => (
              <HoldingRow
                key={`${entry.farm_holding.county}-${entry.farm_holding.state}-${idx}`}
                entry={entry}
                onOpenProvenance={() => setProvenance(entry)}
                onEdit={() => window.dispatchEvent(new CustomEvent('farm-holding-edit', {
                  detail: { clientId, farm_holding: entry.farm_holding, index: idx },
                }))}
              />
            ))}
          </ul>
        )}
      </section>

      {provenance && (
        <ProvenanceDrawer entry={provenance} onClose={() => setProvenance(null)} />
      )}
    </>
  )
}

/* ─── Row ─────────────────────────────────────────────────────────────── */

function HoldingRow({
  entry,
  onOpenProvenance,
  onEdit,
}: {
  entry: ValuedEntry
  onOpenProvenance: () => void
  onEdit: () => void
}) {
  const fh = entry.farm_holding
  const v = entry.valuation
  const isInsufficient = 'insufficient_data' in v
  const tierNullNote = fh.quality_tier == null
    ? 'Tier: Blended avg (edit if known)'
    : `Tier: ${fh.quality_tier}`

  return (
    <li className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-3">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-sm font-medium text-[var(--text-primary)]">
            <span>{fh.county} County, {fh.state}</span>
            {fh.acres != null && (
              <span className="text-xs text-[var(--text-muted)]">· {fh.acres.toLocaleString()} ac</span>
            )}
            {fh.ownership_type && (
              <span className="rounded-md bg-[var(--bg-card)] px-1.5 py-0.5 text-[11px] font-medium text-[var(--text-secondary)]">
                {fh.ownership_type}
              </span>
            )}
          </div>
          <button
            onClick={onEdit}
            className="mt-1 inline-flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-[var(--portal)] transition-colors"
            title="Edit tier / override value"
          >
            <span>{tierNullNote}</span>
            <span className="material-icons-outlined" style={{ fontSize: '12px' }}>edit</span>
          </button>
        </div>

        <div className="shrink-0 text-right">
          {isInsufficient ? (
            <InsufficientBadge onOverride={onEdit} />
          ) : (
            <SuccessValue
              v={v}
              acres={fh.acres ?? null}
              onClick={onOpenProvenance}
            />
          )}
        </div>
      </div>
    </li>
  )
}

/* ─── Success value (per-acre + total + badges) ──────────────────────── */

function SuccessValue({
  v,
  acres,
  onClick,
}: {
  v: Extract<FarmlandValuationResponse, { value_per_acre: number }>
  acres: number | null
  onClick: () => void
}) {
  const totalDollars = acres != null ? Math.round(v.value_per_acre * acres) : null
  return (
    <button
      onClick={onClick}
      className="group flex flex-col items-end gap-1 text-right transition-colors"
      title="View valuation provenance"
    >
      <span className="text-lg font-semibold text-[var(--text-primary)] group-hover:text-[var(--portal)]">
        {totalDollars != null ? currency(totalDollars) : `${currency(v.value_per_acre)}/ac`}
      </span>
      {totalDollars != null && (
        <span className="text-[11px] text-[var(--text-muted)]">
          {currency(v.value_per_acre)}/ac · {v.year}
        </span>
      )}
      <div className="flex items-center gap-1">
        <SourceBadge source={v.primary_source} />
        <ConfidenceBadge confidence={v.confidence} />
      </div>
    </button>
  )
}

function InsufficientBadge({ onOverride }: { onOverride: () => void }) {
  return (
    <div className="flex flex-col items-end gap-1 text-right">
      <span className="text-xs text-[var(--text-muted)] max-w-[220px]">
        Data not yet available — seeds run annually Jan 15
      </span>
      <button
        onClick={onOverride}
        className="inline-flex items-center gap-1 rounded-md border border-dashed border-[var(--border)] px-2 py-0.5 text-[11px] font-medium text-[var(--text-muted)] hover:border-[var(--portal)] hover:text-[var(--portal)] transition-colors"
        title="Casework override"
      >
        <span className="material-icons-outlined" style={{ fontSize: '12px' }}>edit</span>
        Enter value
      </button>
    </div>
  )
}

/* ─── Badges ─────────────────────────────────────────────────────────── */

function SourceBadge({ source }: { source: FarmlandValueSource }) {
  const label =
    source === 'ISU_EXTENSION' ? 'ISU'
    : source === 'USDA_NASS' ? 'NASS'
    : source
  return (
    <span className="rounded-md bg-[var(--bg-card)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--text-secondary)]">
      {label}
    </span>
  )
}

function ConfidenceBadge({ confidence }: { confidence: ValueConfidence }) {
  // HIGH = green, MEDIUM = yellow, LOW = red-ish (per disco Tab 4)
  const cls =
    confidence === 'HIGH' ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
    : confidence === 'MEDIUM' ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
    : 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
  return (
    <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${cls}`}>
      {confidence}
    </span>
  )
}

/* ─── Provenance drawer ─────────────────────────────────────────────── */

function ProvenanceDrawer({ entry, onClose }: { entry: ValuedEntry; onClose: () => void }) {
  const v = entry.valuation
  const isInsufficient = 'insufficient_data' in v
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-[var(--border-subtle)] px-5 py-3">
          <span className="text-sm font-semibold text-[var(--text-primary)]">
            {entry.farm_holding.county} County, {entry.farm_holding.state} — Valuation Provenance
          </span>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-[var(--bg-surface)] text-[var(--text-muted)]">
            <span className="material-icons-outlined" style={{ fontSize: '20px' }}>close</span>
          </button>
        </header>
        <div className="p-5 text-xs text-[var(--text-secondary)]">
          {isInsufficient ? (
            <div className="space-y-2">
              <p className="font-medium">No cached value available.</p>
              <p className="text-[var(--text-muted)]">Reason: <code className="text-[11px]">{v.reason}</code></p>
              <p className="text-[var(--text-muted)]">Request:</p>
              <pre className="rounded-md bg-[var(--bg-surface)] p-3 text-[11px] overflow-auto">
{JSON.stringify(v.requested, null, 2)}
              </pre>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Value / acre" value={currency(v.value_per_acre)} />
                <Field label="Year" value={String(v.year)} />
                <Field label="As-of" value={v.as_of} />
                <Field label="Primary source" value={v.primary_source} />
                <Field label="Confidence" value={v.confidence} />
                {v.tier_method && <Field label="Tier method" value={v.tier_method} />}
                {v.cross_check_source && (
                  <Field label="Cross-check source" value={v.cross_check_source} />
                )}
                {v.cross_check_value_per_acre != null && (
                  <Field label="Cross-check $/ac" value={currency(v.cross_check_value_per_acre)} />
                )}
                {v.delta != null && (
                  <Field label="Delta" value={`${(v.delta * 100).toFixed(1)}%`} />
                )}
                {v.force_refreshed && <Field label="Force refreshed" value="yes" />}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">{label}</div>
      <div className="text-sm font-medium text-[var(--text-primary)]">{value}</div>
    </div>
  )
}

/* ─── Helpers ───────────────────────────────────────────────────────── */

function currency(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}
