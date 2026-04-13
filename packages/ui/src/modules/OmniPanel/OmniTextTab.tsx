'use client'

/* ─── OmniTextTab — Placeholder ──────────────────────────────────────────────
 * TKO-UX-006 will replace this with the full conversation-first 2-pane SMS view.
 * Layout: left rail (conversations grouped by phone) + right thread + compose.
 * ─────────────────────────────────────────────────────────────────────────── */

export function OmniTextTab() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--bg-surface)]">
        <span className="material-icons-outlined" style={{ fontSize: '24px', color: 'var(--text-muted)' }}>sms</span>
      </div>
      <p className="text-sm font-semibold text-[var(--text-primary)]">SMS Conversations</p>
      <p className="max-w-[220px] text-xs text-[var(--text-muted)] leading-relaxed">
        Conversation-first SMS threads are coming in TKO-UX-006.
      </p>
    </div>
  )
}
