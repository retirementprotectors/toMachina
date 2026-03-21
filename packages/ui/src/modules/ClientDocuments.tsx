'use client'

import { useState, useEffect, useCallback } from 'react'
import { fetchWithAuth } from './fetchWithAuth'

/**
 * Client Documents Checklist — shows expected documents on the Client Detail page.
 * Displays full checklist: found docs are clickable (preview), missing docs show gap.
 * Reads from document_link_config + document_index via API.
 */

interface ClientDocumentsProps {
  clientId: string
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

export function ClientDocuments({ clientId }: ClientDocumentsProps) {
  const [docs, setDocs] = useState<LinkedDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [previewFile, setPreviewFile] = useState<{ id: string; name: string; mimeType: string } | null>(null)

  const loadDocs = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetchWithAuth(`/api/document-index/client/${clientId}`)
      const json = await res.json()
      if (json.success) setDocs(json.data || [])
    } catch {
      // Silently fail
    } finally {
      setLoading(false)
    }
  }, [clientId])

  useEffect(() => {
    loadDocs()
  }, [loadDocs])

  if (loading) {
    return (
      <div className="flex gap-2 flex-wrap">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-9 w-28 rounded-lg bg-[var(--bg-surface)] animate-pulse" />
        ))}
      </div>
    )
  }

  if (docs.length === 0) return null

  const found = docs.filter(d => d.document)
  const missing = docs.filter(d => !d.document)

  return (
    <>
      <div className="flex flex-wrap gap-1.5">
        {found.map((doc) => (
          <button
            key={doc.id}
            onClick={() => setPreviewFile({
              id: doc.document!.file_id,
              name: doc.document!.file_name,
              mimeType: doc.document!.mime_type,
            })}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:border-[var(--portal)] hover:text-[var(--portal)] transition-colors"
            title={`Preview ${doc.display_name} — ${doc.document!.file_name}`}
          >
            <span className="material-icons-outlined text-emerald-500" style={{ fontSize: '14px' }}>
              check_circle
            </span>
            <span>{doc.display_name}</span>
          </button>
        ))}
        {missing.map((doc) => (
          <span
            key={doc.id}
            className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-[var(--border)] px-2.5 py-1.5 text-xs text-[var(--text-muted)]"
            title={`No ${doc.display_name} on file — upload to Client subfolder in ACF`}
          >
            <span className="material-icons-outlined" style={{ fontSize: '14px' }}>
              radio_button_unchecked
            </span>
            <span>{doc.display_name}</span>
          </span>
        ))}
      </div>

      {/* Preview Panel */}
      {previewFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setPreviewFile(null)}
        >
          <div
            className="relative w-full max-w-4xl h-[80vh] rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] shadow-2xl overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)]">
              <span className="text-sm font-medium text-[var(--text-primary)] truncate">{previewFile.name}</span>
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={`/api/acf/file/${previewFile.id}/download`}
                  download
                  className="flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-card)] transition-colors"
                >
                  <span className="material-icons-outlined" style={{ fontSize: '14px' }}>download</span>
                  Download
                </a>
                <button
                  onClick={() => setPreviewFile(null)}
                  className="rounded-lg p-1.5 hover:bg-[var(--bg-card)] text-[var(--text-muted)] transition-colors"
                >
                  <span className="material-icons-outlined" style={{ fontSize: '20px' }}>close</span>
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-hidden">
              <iframe
                src={`https://drive.google.com/file/d/${previewFile.id}/preview`}
                className="w-full h-full border-0"
                allow="autoplay"
                sandbox="allow-scripts allow-same-origin"
              />
            </div>
          </div>
        </div>
      )}
    </>
  )
}
