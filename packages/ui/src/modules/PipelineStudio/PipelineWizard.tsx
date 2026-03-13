'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { fetchWithAuth } from '../fetchWithAuth'

// ============================================================================
// PipelineWizard — Create new pipeline dialog
// ============================================================================

export interface PipelineWizardProps {
  open: boolean
  onClose: () => void
  onCreate: (pipelineKey: string) => void
  apiBase?: string
}

const DOMAINS = [
  'SECURITIES',
  'LIFE',
  'ANNUITY',
  'MEDICARE',
  'RETIREMENT',
  'LEGACY',
] as const

const PORTALS = [
  'PRODASHX',
  'RIIMO',
  'SENTINEL',
] as const

interface CreateResponse {
  success: boolean
  data?: { pipeline_key: string }
  error?: string
}

/* --- Key generator --- */

function generateKey(name: string): string {
  return name
    .toUpperCase()
    .replace(/[^A-Z0-9\s_-]/g, '')
    .replace(/[\s-]+/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_|_$/g, '')
}

/* --- Main Component --- */

export default function PipelineWizard({
  open,
  onClose,
  onCreate,
  apiBase = '/api',
}: PipelineWizardProps) {
  const [name, setName] = useState('')
  const [key, setKey] = useState('')
  const [keyEdited, setKeyEdited] = useState(false)
  const [domain, setDomain] = useState<string>(DOMAINS[0])
  const [portal, setPortal] = useState<string>(PORTALS[0])
  const [icon, setIcon] = useState('route')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const overlayRef = useRef<HTMLDivElement>(null)

  /* --- Auto-generate key from name --- */
  useEffect(() => {
    if (!keyEdited && name) {
      setKey(generateKey(name))
    }
  }, [name, keyEdited])

  /* --- Reset on open --- */
  useEffect(() => {
    if (open) {
      setName('')
      setKey('')
      setKeyEdited(false)
      setDomain(DOMAINS[0])
      setPortal(PORTALS[0])
      setIcon('route')
      setSaving(false)
      setError(null)
    }
  }, [open])

  /* --- Handle create --- */
  const handleCreate = useCallback(async () => {
    if (!name.trim() || !key.trim()) {
      setError('Name and key are required')
      return
    }

    try {
      setSaving(true)
      setError(null)

      const res = await fetchWithAuth(`${apiBase}/flow/admin/pipelines`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pipeline_key: key.trim(),
          pipeline_name: name.trim(),
          domain,
          portal: portal.toLowerCase(),
          icon: icon.trim() || 'route',
          status: 'draft',
        }),
      })

      const json: CreateResponse = await res.json()

      if (!json.success) {
        setError(json.error || 'Failed to create pipeline')
        return
      }

      onCreate(json.data?.pipeline_key || key.trim())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error')
    } finally {
      setSaving(false)
    }
  }, [name, key, domain, portal, icon, apiBase, onCreate])

  /* --- Click outside to close --- */
  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === overlayRef.current) onClose()
    },
    [onClose]
  )

  /* --- Escape to close --- */
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
    >
      <div className="w-full max-w-lg rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-6 py-4">
          <div className="flex items-center gap-3">
            <span
              className="flex h-8 w-8 items-center justify-center rounded-lg"
              style={{ backgroundColor: '#14b8a6', color: '#ffffff' }}
            >
              <span className="material-icons-outlined" style={{ fontSize: '18px' }}>add</span>
            </span>
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Create Pipeline</h2>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-secondary)]"
          >
            <span className="material-icons-outlined" style={{ fontSize: '20px' }}>close</span>
          </button>
        </div>

        {/* Form */}
        <div className="space-y-4 px-6 py-5">
          {/* Name */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
              Pipeline Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., NBX - Investments"
              className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--portal)]"
              autoFocus
            />
          </div>

          {/* Key */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
              Pipeline Key
              <span className="ml-1 text-[10px] font-normal text-[var(--text-muted)]">
                (auto-generated, editable)
              </span>
            </label>
            <input
              type="text"
              value={key}
              onChange={(e) => {
                setKey(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''))
                setKeyEdited(true)
              }}
              placeholder="NBX_INVESTMENTS"
              className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 font-mono text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--portal)]"
            />
          </div>

          {/* Domain + Portal row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
                Domain
              </label>
              <select
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--portal)]"
              >
                {DOMAINS.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
                Portal
              </label>
              <select
                value={portal}
                onChange={(e) => setPortal(e.target.value)}
                className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--portal)]"
              >
                {PORTALS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Icon */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
              Icon
              <span className="ml-1 text-[10px] font-normal text-[var(--text-muted)]">
                (Material Icon name)
              </span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                placeholder="route"
                className="flex-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--portal)]"
              />
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                style={{ backgroundColor: 'var(--portal-glow)' }}
              >
                <span className="material-icons-outlined" style={{ fontSize: '20px', color: 'var(--portal)' }}>
                  {icon || 'route'}
                </span>
              </span>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">
              <span className="material-icons-outlined" style={{ fontSize: '14px' }}>error_outline</span>
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-[var(--border-subtle)] px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-lg border border-[var(--border-subtle)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-surface)]"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={saving || !name.trim() || !key.trim()}
            className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50"
            style={{ backgroundColor: '#14b8a6' }}
          >
            {saving ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Creating...
              </>
            ) : (
              <>
                <span className="material-icons-outlined" style={{ fontSize: '16px' }}>add</span>
                Create Pipeline
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
