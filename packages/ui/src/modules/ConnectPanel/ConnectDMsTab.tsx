'use client'

/* ─── ConnectDMsTab — Placeholder ────────────────────────────────────────────
 *
 * TKO-UX-001: Empty placeholder. Full 2-pane DM + presence implementation ships
 * in TKO-UX-003. This file exists so the shell imports compile cleanly.
 * ─────────────────────────────────────────────────────────────────────────── */

export function ConnectDMsTab() {
  return (
    <div className="flex flex-1 items-center justify-center p-6 text-center">
      <div>
        <span className="mb-2 block text-2xl" aria-hidden="true">👤</span>
        <p className="text-sm font-semibold text-[var(--text-primary)]">Direct Messages</p>
        <p className="mt-1 text-xs text-[var(--text-muted)]">
          1:1 conversations — coming in TKO-UX-003
        </p>
      </div>
    </div>
  )
}
