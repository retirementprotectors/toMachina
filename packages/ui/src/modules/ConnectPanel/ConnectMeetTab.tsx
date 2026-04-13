'use client'

/* ─── ConnectMeetTab — Placeholder ───────────────────────────────────────────
 *
 * TKO-UX-001: Empty placeholder. Full Meet tab (instant meet CTA + calendar list
 * + transcript drawer) ships in TKO-UX-004. This file exists so the shell
 * imports compile cleanly.
 * ─────────────────────────────────────────────────────────────────────────── */

export function ConnectMeetTab() {
  return (
    <div className="flex flex-1 items-center justify-center p-6 text-center">
      <div>
        <span className="mb-2 block text-2xl" aria-hidden="true">📹</span>
        <p className="text-sm font-semibold text-[var(--text-primary)]">Meet</p>
        <p className="mt-1 text-xs text-[var(--text-muted)]">
          Instant meetings &amp; calendar — coming in TKO-UX-004
        </p>
      </div>
    </div>
  )
}
