'use client'

/* ─── ConnectSpacesTab — Placeholder ─────────────────────────────────────────
 *
 * TKO-UX-001: Empty placeholder. Full 2-pane Spaces implementation ships in
 * TKO-UX-002. This file exists so the shell imports compile cleanly.
 * ─────────────────────────────────────────────────────────────────────────── */

export function ConnectSpacesTab() {
  return (
    <div className="flex flex-1 items-center justify-center p-6 text-center">
      <div>
        <span className="mb-2 block text-2xl" aria-hidden="true">💬</span>
        <p className="text-sm font-semibold text-[var(--text-primary)]">Spaces</p>
        <p className="mt-1 text-xs text-[var(--text-muted)]">
          Team channels — coming in TKO-UX-002
        </p>
      </div>
    </div>
  )
}
