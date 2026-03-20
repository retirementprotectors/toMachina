'use client'

import { useState, useEffect, useCallback } from 'react'
import type { ACFSubfolderDetail, ACFDriveFile } from '@tomachina/core'
import { fetchWithAuth } from './fetchWithAuth'

/**
 * ACF Section — rendered on Contact detail page.
 * Shows ACF status, subfolder accordion, Open in Drive, Upload, Create buttons.
 */

interface ACFSectionProps {
  clientId: string
}

interface ACFDetailData {
  exists: boolean
  broken?: boolean
  folder_id?: string
  folder_url?: string | null
  subfolders: ACFSubfolderDetail[]
  root_files?: ACFDriveFile[]
}

export function ACFSection({ clientId }: ACFSectionProps) {
  const [detail, setDetail] = useState<ACFDetailData | null>(null)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [expandedFolder, setExpandedFolder] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadTarget, setUploadTarget] = useState<string | null>(null)

  const loadDetail = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetchWithAuth(`/api/acf/${clientId}`)
      const json = await res.json()
      if (json.success) setDetail(json.data)
    } catch {
      // Silently fail
    } finally {
      setLoading(false)
    }
  }, [clientId])

  useEffect(() => {
    loadDetail()
  }, [loadDetail])

  const handleCreate = async () => {
    setCreating(true)
    try {
      const res = await fetchWithAuth(`/api/acf/${clientId}/create`, { method: 'POST', headers: { 'Content-Type': 'application/json' } })
      const json = await res.json()
      if (json.success) {
        await loadDetail()
      }
    } catch {
      // Silently fail
    } finally {
      setCreating(false)
    }
  }

  const handleUpload = async (subfolder: string) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.pdf,.doc,.docx,.xls,.xlsx,.csv,.png,.jpg,.jpeg,.gif,.txt'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return

      if (file.size > 10 * 1024 * 1024) {
        return // 10MB limit
      }

      setUploading(true)
      setUploadTarget(subfolder)
      try {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => {
            const result = reader.result as string
            resolve(result.split(',')[1]) // strip data:...;base64, prefix
          }
          reader.onerror = reject
          reader.readAsDataURL(file)
        })

        const res = await fetchWithAuth(`/api/acf/${clientId}/upload`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            file_name: file.name,
            file_data: base64,
            mime_type: file.type || 'application/octet-stream',
            target_subfolder: subfolder,
          }),
        })
        const json = await res.json()
        if (json.success) {
          await loadDetail()
        }
      } catch {
        // Silently fail
      } finally {
        setUploading(false)
        setUploadTarget(null)
      }
    }
    input.click()
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const mimeIcon = (mimeType: string) => {
    if (mimeType.includes('spreadsheet')) return 'table_chart'
    if (mimeType.includes('document')) return 'description'
    if (mimeType.includes('presentation')) return 'slideshow'
    if (mimeType.includes('pdf')) return 'picture_as_pdf'
    if (mimeType.includes('image')) return 'image'
    return 'insert_drive_file'
  }

  // Loading skeleton
  if (loading) {
    return (
      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-5 w-5 rounded bg-[var(--bg-surface)] animate-pulse" />
          <div className="h-5 w-32 rounded bg-[var(--bg-surface)] animate-pulse" />
        </div>
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-10 rounded bg-[var(--bg-surface)] animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  // Missing ACF
  if (!detail || !detail.exists) {
    return (
      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="material-icons-outlined text-red-400" style={{ fontSize: '20px' }}>
              folder_off
            </span>
            <div>
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                Active Client File
              </h3>
              <p className="text-xs text-[var(--text-muted)]">
                {detail?.broken ? 'ACF folder is broken or inaccessible' : 'No ACF folder exists for this client'}
              </p>
            </div>
          </div>
          <button
            onClick={handleCreate}
            disabled={creating}
            className="flex items-center gap-1.5 rounded-lg bg-[var(--portal)] px-4 py-2 text-sm font-medium text-white transition-colors hover:brightness-110 disabled:opacity-50"
          >
            <span className="material-icons-outlined" style={{ fontSize: '16px' }}>
              create_new_folder
            </span>
            {creating ? 'Creating...' : 'Create ACF'}
          </button>
        </div>
      </div>
    )
  }

  // Full ACF detail
  const totalFiles = detail.subfolders.reduce((sum, sf) => sum + sf.file_count, 0) + (detail.root_files?.length || 0)
  const isComplete = detail.subfolders.length >= 5 && (detail.root_files || []).some(f => f.mimeType.includes('spreadsheet') && f.name.toLowerCase().includes('ai3'))

  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span
            className={`material-icons-outlined ${isComplete ? 'text-emerald-500' : 'text-amber-500'}`}
            style={{ fontSize: '20px' }}
          >
            {isComplete ? 'check_circle' : 'warning'}
          </span>
          <div>
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">
              Active Client File
            </h3>
            <p className="text-xs text-[var(--text-muted)]">
              {detail.subfolders.length} subfolders · {totalFiles} documents · {isComplete ? 'Complete' : 'Incomplete'}
            </p>
          </div>
        </div>
        {detail.folder_url && (
          <a
            href={detail.folder_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-surface)]"
          >
            <span className="material-icons-outlined" style={{ fontSize: '14px' }}>open_in_new</span>
            Open in Drive
          </a>
        )}
      </div>

      {/* Root files (Ai3, etc.) */}
      {detail.root_files && detail.root_files.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {detail.root_files.map((f) => (
            <a
              key={f.id}
              href={`https://drive.google.com/file/d/${f.id}/view`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:border-[var(--portal)] transition-colors"
            >
              <span className="material-icons-outlined" style={{ fontSize: '14px' }}>
                {mimeIcon(f.mimeType)}
              </span>
              {f.name}
            </a>
          ))}
        </div>
      )}

      {/* Subfolder accordion */}
      <div className="space-y-1">
        {detail.subfolders.map((sf) => (
          <div key={sf.id} className="rounded-lg border border-[var(--border-subtle)] overflow-hidden">
            <button
              onClick={() => setExpandedFolder(expandedFolder === sf.id ? null : sf.id)}
              className="flex w-full items-center justify-between px-4 py-2.5 text-left hover:bg-[var(--bg-surface)] transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="material-icons-outlined text-[var(--text-muted)]" style={{ fontSize: '16px' }}>
                  {expandedFolder === sf.id ? 'folder_open' : 'folder'}
                </span>
                <span className="text-sm font-medium text-[var(--text-primary)]">
                  {sf.name}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleUpload(sf.name)
                  }}
                  disabled={uploading}
                  className="flex items-center gap-1 rounded-md border border-[var(--border-subtle)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-muted)] transition-colors hover:border-[var(--portal)] hover:text-[var(--portal)] disabled:opacity-50"
                  title={`Upload file to ${sf.name}`}
                >
                  <span className="material-icons-outlined" style={{ fontSize: '12px' }}>
                    {uploading && uploadTarget === sf.name ? 'hourglass_empty' : 'upload_file'}
                  </span>
                  {uploading && uploadTarget === sf.name ? 'Uploading...' : 'Upload'}
                </button>
                <span className="text-xs text-[var(--text-muted)]">
                  {sf.file_count} {sf.file_count === 1 ? 'file' : 'files'}
                </span>
                <span
                  className="material-icons-outlined text-[var(--text-muted)] transition-transform"
                  style={{
                    fontSize: '16px',
                    transform: expandedFolder === sf.id ? 'rotate(180deg)' : 'rotate(0deg)',
                  }}
                >
                  expand_more
                </span>
              </div>
            </button>

            {/* Expanded file list */}
            {expandedFolder === sf.id && sf.files.length > 0 && (
              <div className="border-t border-[var(--border-subtle)] bg-[var(--bg-base)]">
                {sf.files.map((f) => (
                  <a
                    key={f.id}
                    href={`https://drive.google.com/file/d/${f.id}/view`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 px-4 py-2 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] transition-colors border-b border-[var(--border-subtle)] last:border-b-0"
                  >
                    <span className="material-icons-outlined text-[var(--text-muted)]" style={{ fontSize: '14px' }}>
                      {mimeIcon(f.mimeType)}
                    </span>
                    <span className="flex-1 truncate">{f.name}</span>
                    <span className="text-[var(--text-muted)] shrink-0">{formatSize(f.size)}</span>
                    <span className="text-[var(--text-muted)] shrink-0">
                      {new Date(f.modifiedTime).toLocaleDateString()}
                    </span>
                  </a>
                ))}
              </div>
            )}

            {expandedFolder === sf.id && sf.files.length === 0 && (
              <div className="border-t border-[var(--border-subtle)] bg-[var(--bg-base)] px-4 py-3 text-xs text-[var(--text-muted)] italic">
                No files in this subfolder
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
