'use client'

/* ─── OmniLogTab — Placeholder ───────────────────────────────────────────────
 * TKO-UX-006 will replace this with the full activity log view.
 * Layout: filter chips (All / Calls / SMS / Email / Inbound / Outbound) + log rows
 * from the Firestore `communications` collection.
 * ─────────────────────────────────────────────────────────────────────────── */

export function OmniLogTab() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--bg-surface)]">
        <span className="material-icons-outlined" style={{ fontSize: '24px', color: 'var(--text-muted)' }}>list_alt</span>
      </div>
      <p className="text-sm font-semibold text-[var(--text-primary)]">Activity Log</p>
      <p className="max-w-[220px] text-xs text-[var(--text-muted)] leading-relaxed">
        Unified call / SMS / email log with filter chips is coming in TKO-UX-006.
      </p>
    </div>
  )
}
