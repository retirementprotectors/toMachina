'use client'

import { useState, useEffect, useCallback } from 'react'
import { fetchWithAuth } from './fetchWithAuth'

/**
 * Account Documents — shows linked documents on the Account Detail page.
 * Product-type-aware: Medicare accounts show enrollment docs, retirement show statements.
 */

interface AccountDocumentsProps {
  accountId: string
}

interface LinkedDoc {
  id: string
  display_name: string
  icon: string
  priority: number
  document: {
    file_id: string
    file_name: string
    drive_url: string
    mime_type: string
    modified_at: string
  } | null
  count: number
}

export function AccountDocuments({ accountId }: AccountDocumentsProps) {
  const [docs, setDocs] = useState<LinkedDoc[]>([])
  const [loading, setLoading] = useState(true)

  const loadDocs = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetchWithAuth(`/api/document-index/account/${accountId}`)
      const json = await res.json()
      if (json.success) setDocs(json.data || [])
    } catch {
      // Silently fail
    } finally {
      setLoading(false)
    }
  }, [accountId])

  useEffect(() => {
    loadDocs()
  }, [loadDocs])

  if (loading) {
    return (
      <div className="flex gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-16 w-32 rounded-lg bg-[var(--bg-surface)] animate-pulse" />
        ))}
      </div>
    )
  }

  if (docs.length === 0) return null

  return (
    <div className="flex flex-wrap gap-2">
      {docs.map((doc) => (
        <a
          key={doc.id}
          href={doc.document?.drive_url || '#'}
          target={doc.document ? '_blank' : undefined}
          rel="noopener noreferrer"
          className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
            doc.document
              ? 'border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:border-[var(--portal)] hover:text-[var(--portal)]'
              : 'border-dashed border-[var(--border)] bg-transparent text-[var(--text-muted)] cursor-default'
          }`}
          title={doc.document ? `Open ${doc.display_name} — ${doc.document.file_name}` : `No ${doc.display_name} on file`}
          onClick={doc.document ? undefined : (e) => e.preventDefault()}
        >
          <span className="material-icons-outlined" style={{ fontSize: '16px' }}>
            {doc.icon}
          </span>
          <span>{doc.display_name}</span>
          {doc.count > 1 && (
            <span className="rounded-full bg-[var(--portal)]/10 px-1.5 text-[10px] text-[var(--portal)]">
              {doc.count}
            </span>
          )}
          {doc.document && (
            <span className="material-icons-outlined text-[var(--portal)]" style={{ fontSize: '12px' }}>
              open_in_new
            </span>
          )}
        </a>
      ))}
    </div>
  )
}
