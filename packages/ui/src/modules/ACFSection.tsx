'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { ACFSubfolderDetail, ACFDriveFile } from '@tomachina/core'
import { fetchWithAuth } from './fetchWithAuth'

/**
 * ACF Section — rendered on Contact detail page.
 * Shows ACF status, subfolder accordion, drag-and-drop upload, Create buttons.
 *
 * Drag-and-drop: files dragged onto a subfolder row upload directly to that subfolder.
 * Files dragged onto the global zone get auto-classified to the right subfolder.
 */

// ── File Classification (mirrors batch-move-acf-files.ts rules) ──────
function classifyFileName(name: string): string {
  const n = name.toLowerCase()
  // Client — static person docs
  if (/\b(driver|DL\b|photo.id|state.id|licen)/i.test(n)) return 'Client'
  if (/\b(void|voided).*(check|cheque)/i.test(n)) return 'Client'
  if (/\b(social.security|ss.card|ssn)/i.test(n)) return 'Client'
  if (/\b(medicare.*(card|id)|cms.card)/i.test(n)) return 'Client'
  if (/\bai3\b/i.test(n) && !/template/i.test(n)) return 'Client'
  if (/\b(fact.find|client.profile|intake.form|hipaa|poa\b|power.of.attorney)/i.test(n)) return 'Client'
  if (/\b(tax.return|1040|w-?2\b|1099|birth.cert|passport)/i.test(n)) return 'Client'
  // NewBiz
  if (/\b(application|app\b.*signed|new.business)/i.test(n) && !/template/i.test(n)) return 'NewBiz'
  if (/\b1035/i.test(n)) return 'NewBiz'
  if (/\b(transfer|toa|acat)\b/i.test(n)) return 'NewBiz'
  if (/\b(delivery.receipt|replacement|suitability|enrollment|signed|executed)/i.test(n)) return 'NewBiz'
  // Cases
  if (/\b(comparison|illustration|analysis|quote|proposal|discovery.meeting)/i.test(n)) return 'Cases'
  // Account
  if (/\b(statement|confirm|annual.review|account.summary|performance|distribution)/i.test(n)) return 'Account'
  // Reactive (default)
  return 'Reactive'
}

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

interface UploadQueueItem {
  file: File
  subfolder: string
  status: 'pending' | 'uploading' | 'done' | 'error'
}

export function ACFSection({ clientId }: ACFSectionProps) {
  const [detail, setDetail] = useState<ACFDetailData | null>(null)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [expandedFolder, setExpandedFolder] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadTarget, setUploadTarget] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState<string | null>(null) // subfolder name or '__global__'
  const [uploadQueue, setUploadQueue] = useState<UploadQueueItem[]>([])
  const [previewFile, setPreviewFile] = useState<{ id: string; name: string; mimeType: string } | null>(null)
  const [movingFile, setMovingFile] = useState<{ id: string; name: string; fromSubfolder: string } | null>(null)
  const sectionRef = useRef<HTMLDivElement>(null)
  const dragCounterRef = useRef(0)

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

  // ── Drag & Drop Handlers ──────────────────────────────────────────
  const uploadFile = useCallback(async (file: File, subfolder: string): Promise<boolean> => {
    if (file.size > 25 * 1024 * 1024) return false // 25MB limit

    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const result = reader.result as string
        resolve(result.split(',')[1])
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
    return json.success === true
  }, [clientId])

  const handleDropFiles = useCallback(async (files: File[], targetSubfolder?: string) => {
    if (files.length === 0) return

    // Build upload queue — classify each file if no target specified
    const queue: UploadQueueItem[] = files.map(file => ({
      file,
      subfolder: targetSubfolder || classifyFileName(file.name),
      status: 'pending' as const,
    }))

    setUploadQueue(queue)
    setUploading(true)

    // Process sequentially to avoid overwhelming the API
    for (let i = 0; i < queue.length; i++) {
      const item = queue[i]
      setUploadQueue(prev => prev.map((p, idx) => idx === i ? { ...p, status: 'uploading' } : p))
      setUploadTarget(item.subfolder)

      try {
        const ok = await uploadFile(item.file, item.subfolder)
        setUploadQueue(prev => prev.map((p, idx) => idx === i ? { ...p, status: ok ? 'done' : 'error' } : p))
      } catch {
        setUploadQueue(prev => prev.map((p, idx) => idx === i ? { ...p, status: 'error' } : p))
      }
    }

    setUploading(false)
    setUploadTarget(null)
    await loadDetail()

    // Clear queue after 3 seconds
    setTimeout(() => setUploadQueue([]), 3000)
  }, [uploadFile, loadDetail])

  // Global section drag events
  const handleSectionDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    dragCounterRef.current++
    if (e.dataTransfer.types.includes('Files')) {
      setDragOver('__global__')
    }
  }, [])

  const handleSectionDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    dragCounterRef.current--
    if (dragCounterRef.current === 0) {
      setDragOver(null)
    }
  }, [])

  const handleSectionDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }, [])

  const handleSectionDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    dragCounterRef.current = 0
    setDragOver(null)
    const files = Array.from(e.dataTransfer.files)
    handleDropFiles(files) // auto-classify
  }, [handleDropFiles])

  // Per-subfolder drag events
  const handleSubfolderDragEnter = useCallback((e: React.DragEvent, sfName: string) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.dataTransfer.types.includes('Files')) {
      setDragOver(sfName)
    }
  }, [])

  const handleSubfolderDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'copy'
  }, [])

  const handleSubfolderDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    // Only clear if leaving the subfolder row (not entering a child)
    const relatedTarget = e.relatedTarget as HTMLElement | null
    if (!e.currentTarget.contains(relatedTarget)) {
      setDragOver(prev => prev === (e.currentTarget as HTMLElement).dataset.subfolder ? '__global__' : prev)
    }
  }, [])

  const handleSubfolderDrop = useCallback((e: React.DragEvent, sfName: string) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current = 0
    setDragOver(null)
    const files = Array.from(e.dataTransfer.files)
    handleDropFiles(files, sfName) // explicit target
  }, [handleDropFiles])

  // ── Move file between subfolders ─────────────────────────────────
  const handleMove = useCallback(async (fileId: string, fromSubfolder: string, toSubfolder: string) => {
    try {
      const res = await fetchWithAuth(`/api/acf/${clientId}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_id: fileId, from_subfolder: fromSubfolder, to_subfolder: toSubfolder }),
      })
      const json = await res.json()
      if (json.success) {
        setMovingFile(null)
        await loadDetail()
      }
    } catch {
      // Silently fail
    }
  }, [clientId, loadDetail])

  // ── Download file through our API ──────────────────────────────
  const handleDownload = useCallback((fileId: string, fileName: string) => {
    // Create a temporary link that hits our download proxy
    const link = document.createElement('a')
    link.href = `/api/acf/file/${fileId}/download`
    link.download = fileName
    link.click()
  }, [])

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
    <div
      ref={sectionRef}
      className={`rounded-xl border-2 transition-colors p-5 ${
        dragOver === '__global__'
          ? 'border-[var(--portal)] bg-[color-mix(in_srgb,var(--portal)_5%,var(--bg-card))]'
          : 'border-[var(--border-subtle)] bg-[var(--bg-card)]'
      }`}
      onDragEnter={handleSectionDragEnter}
      onDragLeave={handleSectionDragLeave}
      onDragOver={handleSectionDragOver}
      onDrop={handleSectionDrop}
    >
      {/* Global drop overlay */}
      {dragOver === '__global__' && (
        <div className="mb-4 flex items-center gap-3 rounded-lg border border-dashed border-[var(--portal)] bg-[color-mix(in_srgb,var(--portal)_8%,transparent)] px-4 py-3">
          <span className="material-icons-outlined text-[var(--portal)]" style={{ fontSize: '20px' }}>cloud_upload</span>
          <div>
            <p className="text-sm font-medium text-[var(--portal)]">Drop files to upload</p>
            <p className="text-xs text-[var(--text-muted)]">Files will be auto-classified to the right subfolder, or drop on a specific subfolder below</p>
          </div>
        </div>
      )}

      {/* Upload progress toast */}
      {uploadQueue.length > 0 && (
        <div className="mb-4 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3 space-y-1.5">
          {uploadQueue.map((item, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span className="material-icons-outlined" style={{ fontSize: '14px' }}>
                {item.status === 'pending' ? 'schedule' :
                 item.status === 'uploading' ? 'sync' :
                 item.status === 'done' ? 'check_circle' : 'error'}
              </span>
              <span className={`flex-1 truncate ${item.status === 'done' ? 'text-emerald-400' : item.status === 'error' ? 'text-red-400' : 'text-[var(--text-secondary)]'}`}>
                {item.file.name}
              </span>
              <span className="text-[var(--text-muted)] shrink-0">
                → {item.subfolder}
              </span>
            </div>
          ))}
        </div>
      )}

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
          <div
            key={sf.id}
            data-subfolder={sf.name}
            className={`rounded-lg border-2 overflow-hidden transition-colors ${
              dragOver === sf.name
                ? 'border-[var(--portal)] bg-[color-mix(in_srgb,var(--portal)_8%,transparent)]'
                : 'border-[var(--border-subtle)]'
            }`}
            onDragEnter={(e) => handleSubfolderDragEnter(e, sf.name)}
            onDragOver={handleSubfolderDragOver}
            onDragLeave={handleSubfolderDragLeave}
            onDrop={(e) => handleSubfolderDrop(e, sf.name)}
          >
            <button
              onClick={() => setExpandedFolder(expandedFolder === sf.id ? null : sf.id)}
              className="flex w-full items-center justify-between px-4 py-2.5 text-left hover:bg-[var(--bg-surface)] transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className={`material-icons-outlined ${dragOver === sf.name ? 'text-[var(--portal)]' : 'text-[var(--text-muted)]'}`} style={{ fontSize: '16px' }}>
                  {dragOver === sf.name ? 'drive_file_move' : expandedFolder === sf.id ? 'folder_open' : 'folder'}
                </span>
                <span className={`text-sm font-medium ${dragOver === sf.name ? 'text-[var(--portal)]' : 'text-[var(--text-primary)]'}`}>
                  {dragOver === sf.name ? `Drop files into ${sf.name}` : sf.name}
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
                  <div
                    key={f.id}
                    className="flex items-center gap-3 px-4 py-2 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] transition-colors border-b border-[var(--border-subtle)] last:border-b-0 group"
                  >
                    <span className="material-icons-outlined text-[var(--text-muted)]" style={{ fontSize: '14px' }}>
                      {mimeIcon(f.mimeType)}
                    </span>
                    <button
                      onClick={() => setPreviewFile({ id: f.id, name: f.name, mimeType: f.mimeType })}
                      className="flex-1 truncate text-left hover:text-[var(--portal)] transition-colors"
                      title="Preview file"
                    >
                      {f.name}
                    </button>
                    <span className="text-[var(--text-muted)] shrink-0">{formatSize(f.size)}</span>
                    <span className="text-[var(--text-muted)] shrink-0">
                      {new Date(f.modifiedTime).toLocaleDateString()}
                    </span>
                    {/* Action buttons — visible on hover */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <button
                        onClick={() => setPreviewFile({ id: f.id, name: f.name, mimeType: f.mimeType })}
                        className="rounded p-1 hover:bg-[var(--bg-card)] text-[var(--text-muted)] hover:text-[var(--portal)]"
                        title="Preview"
                      >
                        <span className="material-icons-outlined" style={{ fontSize: '14px' }}>visibility</span>
                      </button>
                      <button
                        onClick={() => handleDownload(f.id, f.name)}
                        className="rounded p-1 hover:bg-[var(--bg-card)] text-[var(--text-muted)] hover:text-[var(--portal)]"
                        title="Download"
                      >
                        <span className="material-icons-outlined" style={{ fontSize: '14px' }}>download</span>
                      </button>
                      <button
                        onClick={() => setMovingFile({ id: f.id, name: f.name, fromSubfolder: sf.name })}
                        className="rounded p-1 hover:bg-[var(--bg-card)] text-[var(--text-muted)] hover:text-[var(--portal)]"
                        title="Move to another subfolder"
                      >
                        <span className="material-icons-outlined" style={{ fontSize: '14px' }}>drive_file_move</span>
                      </button>
                    </div>
                  </div>
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

      {/* ── Preview Panel (slide-up overlay) ──────────────────────── */}
      {previewFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setPreviewFile(null)}
        >
          <div
            className="relative w-full max-w-4xl h-[80vh] rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] shadow-2xl overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Preview header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)]">
              <div className="flex items-center gap-3 min-w-0">
                <span className="material-icons-outlined text-[var(--portal)]" style={{ fontSize: '20px' }}>
                  {mimeIcon(previewFile.mimeType)}
                </span>
                <span className="text-sm font-medium text-[var(--text-primary)] truncate">{previewFile.name}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => handleDownload(previewFile.id, previewFile.name)}
                  className="flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-card)] transition-colors"
                >
                  <span className="material-icons-outlined" style={{ fontSize: '14px' }}>download</span>
                  Download
                </button>
                <button
                  onClick={() => setPreviewFile(null)}
                  className="rounded-lg p-1.5 hover:bg-[var(--bg-card)] text-[var(--text-muted)] transition-colors"
                >
                  <span className="material-icons-outlined" style={{ fontSize: '20px' }}>close</span>
                </button>
              </div>
            </div>
            {/* Preview content */}
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

      {/* ── Move File Modal ───────────────────────────────────────── */}
      {movingFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setMovingFile(null)}
        >
          <div
            className="w-full max-w-sm rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] shadow-2xl p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <span className="material-icons-outlined text-[var(--portal)]" style={{ fontSize: '20px' }}>drive_file_move</span>
              <div>
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">Move File</h3>
                <p className="text-xs text-[var(--text-muted)] truncate max-w-[280px]">{movingFile.name}</p>
              </div>
            </div>
            <p className="text-xs text-[var(--text-muted)] mb-3">
              Currently in <span className="font-medium text-[var(--text-secondary)]">{movingFile.fromSubfolder}</span>. Move to:
            </p>
            <div className="space-y-1.5">
              {detail.subfolders
                .filter(sf => sf.name !== movingFile.fromSubfolder)
                .map(sf => (
                  <button
                    key={sf.id}
                    onClick={() => handleMove(movingFile.id, movingFile.fromSubfolder, sf.name)}
                    className="flex w-full items-center gap-3 rounded-lg px-4 py-2.5 text-sm text-left text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] hover:text-[var(--portal)] transition-colors border border-[var(--border-subtle)]"
                  >
                    <span className="material-icons-outlined" style={{ fontSize: '16px' }}>folder</span>
                    {sf.name}
                    <span className="text-[var(--text-muted)] text-xs ml-auto">{sf.file_count} files</span>
                  </button>
                ))}
            </div>
            <button
              onClick={() => setMovingFile(null)}
              className="mt-4 w-full rounded-lg border border-[var(--border-subtle)] px-4 py-2 text-xs font-medium text-[var(--text-muted)] hover:bg-[var(--bg-surface)] transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
