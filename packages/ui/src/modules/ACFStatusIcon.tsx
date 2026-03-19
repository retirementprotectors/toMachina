'use client'

import { useState, useEffect } from 'react'

/**
 * ACF Status Icon — shows in Contact grid ACF column.
 * Green check = complete, Yellow warning = incomplete, Red X = missing/broken.
 */

interface ACFStatusIconProps {
  clientId: string
  gdriveFolderUrl?: string | null
}

interface StatusData {
  exists: boolean
  complete: boolean
  subfolder_count: number
  document_count: number
  last_updated: string | null
}

export function ACFStatusIcon({ clientId, gdriveFolderUrl }: ACFStatusIconProps) {
  const [status, setStatus] = useState<StatusData | null>(null)
  const [loading, setLoading] = useState(false)
  const [showTooltip, setShowTooltip] = useState(false)

  useEffect(() => {
    if (!gdriveFolderUrl) return

    let cancelled = false
    setLoading(true)

    fetch(`/api/acf/status/${clientId}`)
      .then((r) => r.json())
      .then((res) => {
        if (!cancelled && res.success) setStatus(res.data)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [clientId, gdriveFolderUrl])

  // No ACF at all
  if (!gdriveFolderUrl) {
    return (
      <span
        className="material-icons-outlined text-[18px] text-red-400"
        title="No ACF folder"
      >
        cancel
      </span>
    )
  }

  // Loading
  if (loading || !status) {
    return (
      <a
        href={gdriveFolderUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="inline-flex items-center justify-center text-[var(--portal)] hover:brightness-110 transition-colors"
        title="Open Active Client File"
      >
        <span className="material-icons-outlined text-[18px]">folder_open</span>
      </a>
    )
  }

  // Status-based icon
  const icon = status.exists && status.complete
    ? 'check_circle'
    : status.exists
      ? 'warning'
      : 'cancel'

  const color = status.exists && status.complete
    ? 'text-emerald-500'
    : status.exists
      ? 'text-amber-500'
      : 'text-red-400'

  const label = status.exists && status.complete
    ? 'ACF Complete'
    : status.exists
      ? 'ACF Incomplete'
      : 'ACF Missing / Broken'

  return (
    <div className="relative inline-flex">
      <a
        href={gdriveFolderUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className={`inline-flex items-center justify-center ${color} hover:brightness-110 transition-colors`}
        title={label}
      >
        <span className="material-icons-outlined text-[18px]">{icon}</span>
      </a>

      {/* Tooltip */}
      {showTooltip && status.exists && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 whitespace-nowrap rounded-lg bg-[var(--bg-card)] border border-[var(--border-subtle)] px-3 py-2 text-xs shadow-lg">
          <div className="font-medium text-[var(--text-primary)]">{label}</div>
          <div className="text-[var(--text-muted)] mt-0.5">
            {status.subfolder_count} subfolders · {status.document_count} docs
          </div>
          {status.last_updated && (
            <div className="text-[var(--text-muted)]">
              Updated {new Date(status.last_updated).toLocaleDateString()}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
