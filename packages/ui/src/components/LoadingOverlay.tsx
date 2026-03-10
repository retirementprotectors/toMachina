'use client'

interface LoadingOverlayProps {
  visible: boolean
  message?: string
}

export function LoadingOverlay({ visible, message = 'Loading...' }: LoadingOverlayProps) {
  if (!visible) return null

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40">
      <div className="flex flex-col items-center gap-3 rounded-lg bg-[var(--bg-surface)] px-8 py-6 shadow-xl">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--portal)] border-t-transparent" />
        <p className="text-sm text-[var(--text-secondary)]">{message}</p>
      </div>
    </div>
  )
}
