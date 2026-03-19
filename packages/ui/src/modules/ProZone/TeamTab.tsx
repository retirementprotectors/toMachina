'use client'

import { useEntitlements } from '@tomachina/auth'
import SpecialistConfigEditor from './SpecialistConfigEditor'

// ---------------------------------------------------------------------------
// Permission constants
// ---------------------------------------------------------------------------

const EDIT_LEVELS = new Set(['OWNER', 'EXECUTIVE'])
const VIEW_LEVELS = new Set(['OWNER', 'EXECUTIVE', 'LEADER'])

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface TeamTabProps {
  portal: string
  specialistId: string | null
}

// ---------------------------------------------------------------------------
// TeamTab — Surfaces SpecialistConfigEditor with permission gate
// ---------------------------------------------------------------------------

export default function TeamTab({ portal, specialistId }: TeamTabProps) {
  const { ctx, loading } = useEntitlements()
  const userLevel = (ctx.userLevel || '').toUpperCase()

  const canView = VIEW_LEVELS.has(userLevel)
  const canEdit = EDIT_LEVELS.has(userLevel)

  // Show loading state while entitlements resolve
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div
          className="h-6 w-6 animate-spin rounded-full border-2 border-t-transparent"
          style={{ borderColor: 'var(--app-prozone, #0ea5e9)', borderTopColor: 'transparent' }}
        />
        <span className="ml-3 text-sm text-[var(--text-muted)]">Checking permissions...</span>
      </div>
    )
  }

  // Below Leader level — access restricted
  if (!canView) {
    return (
      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-5 py-12 text-center">
        <span className="material-icons-outlined text-[var(--text-muted)]" style={{ fontSize: '32px' }}>lock</span>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          Specialist configuration requires Leader access or above.
        </p>
      </div>
    )
  }

  // No specialist selected — prompt to pick one
  if (!specialistId) {
    return (
      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-5 py-12 text-center">
        <span className="material-icons-outlined text-[var(--text-muted)]" style={{ fontSize: '32px' }}>groups</span>
        <p className="mt-2 text-sm text-[var(--text-muted)]">Select a specialist above to view configuration.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* View-only banner for Leaders */}
      {!canEdit && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-2.5">
          <span className="material-icons-outlined text-amber-400" style={{ fontSize: '16px' }}>visibility</span>
          <span className="text-xs text-amber-400">View only — editing requires Owner or Executive access</span>
        </div>
      )}
      <SpecialistConfigEditor
        portal={portal as 'prodashx' | 'riimo' | 'sentinel'}
        configId={specialistId}
        readOnly={!canEdit}
      />
    </div>
  )
}
