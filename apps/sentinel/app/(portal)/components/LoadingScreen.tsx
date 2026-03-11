'use client'

export function LoadingScreen() {
  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center gap-4"
      style={{ background: 'var(--bg-deepest)' }}
    >
      <div
        className="h-10 w-10 animate-spin rounded-full border-[3px] border-t-transparent"
        style={{ borderColor: 'var(--portal)', borderTopColor: 'transparent' }}
      />
      <p className="text-sm text-[var(--text-muted)]">Loading...</p>
    </div>
  )
}
