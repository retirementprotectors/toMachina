'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { ACFSubfolderDetail, ACFDriveFile } from '@tomachina/core'
import { fetchValidated } from './fetchValidated'

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
  const [deleteFile, setDeleteFile] = useState<{ id: string; name: string } | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState<'tree' | 'grid'>(() => {
    if (typeof window !== 'undefined') return (localStorage.getItem('acf-view-mode') as 'tree' | 'grid') || 'tree'
    return 'tree'
  })
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [gridSort, setGridSort] = useState<{ col: string; dir: 'asc' | 'desc' }>({ col: 'name', dir: 'asc' })
  const [docConfigs, setDocConfigs] = useState<Array<{ id: string; display_name: string; file_patterns: string[]; required?: boolean }>>([])
  const sectionRef = useRef<HTMLDivElement>(null)
  const dragCounterRef = useRef(0)

  const loadDetail = useCallback(async () => {
    setLoading(true)
    try {
      const result = await fetchValidated<ACFDetailData>(`/api/acf/${clientId}`)
      if (result.success) setDetail(result.data ?? null)
    } catch {
      // Silently fail
    } finally {
      setLoading(false)
    }
  }, [clientId])

  useEffect(() => {
    loadDetail()
    // Load document configs for completeness bar (TRK-579)
    fetchValidated<Array<{ id: string; display_name: string; file_patterns: string[]; required?: boolean; visible?: boolean }>>('/api/document-index/config')
      .then(result => { if (result.success) setDocConfigs((result.data || []).filter(c => c.required && c.visible !== false)) })
      .catch(() => {})
  }, [loadDetail])

  const handleCreate = async () => {
    setCreating(true)
    try {
      const result = await fetchValidated(`/api/acf/${clientId}/create`, { method: 'POST', headers: { 'Content-Type': 'application/json' } })
      if (result.success) {
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

        const result = await fetchValidated(`/api/acf/${clientId}/upload`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            file_name: file.name,
            file_data: base64,
            mime_type: file.type || 'application/octet-stream',
            target_subfolder: subfolder,
          }),
        })
        if (result.success) {
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

    const result = await fetchValidated(`/api/acf/${clientId}/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        file_name: file.name,
        file_data: base64,
        mime_type: file.type || 'application/octet-stream',
        target_subfolder: subfolder,
      }),
    })
    return result.success === true
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
      const result = await fetchValidated(`/api/acf/${clientId}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_id: fileId, from_subfolder: fromSubfolder, to_subfolder: toSubfolder }),
      })
      if (result.success) {
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

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteFile) return
    setDeleting(true)
    try {
      const res = await fetchValidated(`/api/acf/file/${deleteFile.id}`, { method: 'DELETE' })
            if (res.success) {
        // Remove file from local state optimistically
        setDetail(prev => {
          if (!prev) return prev
          return {
            ...prev,
            subfolders: prev.subfolders.map(sf => ({
              ...sf,
              files: sf.files.filter(f => f.id !== deleteFile.id),
              file_count: sf.files.filter(f => f.id !== deleteFile.id).length,
            })),
            root_files: prev.root_files?.filter(f => f.id !== deleteFile.id),
          }
        })
        if (previewFile?.id === deleteFile.id) setPreviewFile(null)
      }
    } catch {
      // Silently fail
    } finally {
      setDeleting(false)
      setDeleteFile(null)
    }
  }, [deleteFile, previewFile])

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
  const isComplete = detail.subfolders.length >= 5 && totalFiles > 0

  // Subfolder badge colors (TRK-576)
  const subfolderColors: Record<string, string> = {
    Client: '#3b82f6',
    Cases: '#a78bfa',
    NewBiz: '#22c55e',
    Account: '#f59e0b',
    Reactive: '#ef4444',
  }

  // Search filtering (TRK-572)
  const sq = searchQuery.toLowerCase()
  const filteredSubfolders = detail.subfolders.map(sf => ({
    ...sf,
    files: sq ? sf.files.filter(f => f.name.toLowerCase().includes(sq)) : sf.files,
  }))
  const filteredRootFiles = sq
    ? (detail.root_files || []).filter(f => f.name.toLowerCase().includes(sq))
    : (detail.root_files || [])
  const matchingSubfolderIds = sq
    ? new Set(filteredSubfolders.filter(sf => sf.files.length > 0).map(sf => sf.id))
    : null

  // Grid view: flat file list from all subfolders + root (TRK-578, TM-S13-05)
  function flattenSubfolderFiles(sfs: ACFSubfolderDetail[], prefix = ''): Array<ACFDriveFile & { subfolder: string }> {
    return sfs.flatMap(sf => {
      const path = prefix ? `${prefix}/${sf.name}` : sf.name
      const own = sf.files.map(f => ({ ...f, subfolder: path }))
      const nested = sf.subfolders ? flattenSubfolderFiles(sf.subfolders, path) : []
      return [...own, ...nested]
    })
  }
  const allFiles = [
    ...(detail.root_files || []).map(f => ({ ...f, subfolder: '(root)' })),
    ...flattenSubfolderFiles(detail.subfolders),
  ]
  const filteredAllFiles = sq
    ? allFiles.filter(f => f.name.toLowerCase().includes(sq))
    : allFiles
  const sortedAllFiles = [...filteredAllFiles].sort((a, b) => {
    const dir = gridSort.dir === 'asc' ? 1 : -1
    switch (gridSort.col) {
      case 'name': return a.name.localeCompare(b.name) * dir
      case 'subfolder': return a.subfolder.localeCompare(b.subfolder) * dir
      case 'date': return (new Date(a.modifiedTime).getTime() - new Date(b.modifiedTime).getTime()) * dir
      case 'size': return (a.size - b.size) * dir
      default: return 0
    }
  })

  const toggleSort = (col: string) => {
    setGridSort(prev => prev.col === col ? { col, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'asc' })
  }

  // Completeness bar (TRK-579) — compare required doc configs against actual files
  const allFileNames = allFiles.map(f => f.name.toLowerCase())
  const completenessData = docConfigs.length > 0 ? docConfigs.map(cfg => {
    const found = cfg.file_patterns.some(p => {
      const pattern = p.replace(/\*/g, '').toLowerCase()
      return allFileNames.some(n => n.includes(pattern))
    })
    return { ...cfg, found }
  }) : null
  const foundCount = completenessData?.filter(d => d.found).length ?? 0
  const totalRequired = completenessData?.length ?? 0
  const completePct = totalRequired > 0 ? Math.round((foundCount / totalRequired) * 100) : 0
  const barColor = completePct < 34 ? '#ef4444' : completePct < 67 ? '#f59e0b' : '#22c55e'

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
        <div className="flex items-center gap-2">
          {/* View Full ACF link */}
          <a
            href={`/acf/${clientId}`}
            className="flex items-center gap-1 rounded-md border border-[var(--border-subtle)] px-2.5 py-1.5 text-xs font-medium text-[var(--portal)] transition-colors hover:bg-[var(--bg-hover)]"
          >
            <span className="material-icons-outlined" style={{ fontSize: '14px' }}>open_in_new</span>
            View Full ACF
          </a>
          {/* Search */}
          <div className="relative">
            <span className="material-icons-outlined absolute left-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" style={{ fontSize: '14px' }}>search</span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search files..."
              className="w-40 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] py-1.5 pl-7 pr-7 text-xs text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--portal)]"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                <span className="material-icons-outlined" style={{ fontSize: '14px' }}>close</span>
              </button>
            )}
          </div>
          {/* View toggle */}
          <div className="flex items-center rounded-md border border-[var(--border-subtle)] overflow-hidden">
            <button
              onClick={() => { setViewMode('tree'); localStorage.setItem('acf-view-mode', 'tree') }}
              className={`p-1.5 transition-colors ${viewMode === 'tree' ? 'bg-[var(--portal)] text-white' : 'text-[var(--text-muted)] hover:bg-[var(--bg-surface)]'}`}
              title="Tree view"
            >
              <span className="material-icons-outlined" style={{ fontSize: '16px' }}>folder_open</span>
            </button>
            <button
              onClick={() => { setViewMode('grid'); localStorage.setItem('acf-view-mode', 'grid') }}
              className={`p-1.5 transition-colors ${viewMode === 'grid' ? 'bg-[var(--portal)] text-white' : 'text-[var(--text-muted)] hover:bg-[var(--bg-surface)]'}`}
              title="Grid view"
            >
              <span className="material-icons-outlined" style={{ fontSize: '16px' }}>view_list</span>
            </button>
          </div>
        </div>
      </div>

      {/* Completeness bar (TRK-579) */}
      {completenessData && totalRequired > 0 && (
        <div className="mb-4 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-[var(--text-primary)]">
              {foundCount} / {totalRequired} required documents
            </span>
            <span className="text-xs font-bold" style={{ color: barColor }}>{completePct}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-[var(--bg-base)] overflow-hidden">
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${completePct}%`, background: barColor }} />
          </div>
          {completenessData.filter(d => !d.found).length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {completenessData.filter(d => !d.found).map(d => (
                <span key={d.id} className="inline-flex items-center gap-1 rounded-md border border-dashed border-[var(--border)] px-2 py-0.5 text-[10px] text-[var(--text-muted)]">
                  <span className="material-icons-outlined" style={{ fontSize: '10px' }}>radio_button_unchecked</span>
                  {d.display_name}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Root files (Ai3, etc.) — click opens preview */}
      {detail.root_files && detail.root_files.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {detail.root_files.map((f) => (
            <button
              key={f.id}
              onClick={() => setPreviewFile({ id: f.id, name: f.name, mimeType: f.mimeType })}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:border-[var(--portal)] hover:text-[var(--portal)] transition-colors"
            >
              <span className="material-icons-outlined" style={{ fontSize: '14px' }}>
                {mimeIcon(f.mimeType)}
              </span>
              {f.name}
            </button>
          ))}
        </div>
      )}

      {/* Subfolder accordion (Tree view) */}
      {viewMode === 'tree' && (
      <div className="space-y-1">
        {filteredSubfolders.map((sf) => {
          const sfColor = subfolderColors[sf.name] || 'var(--portal)'
          const isExpanded = expandedFolder === sf.id || (matchingSubfolderIds?.has(sf.id) ?? false)
          const isEmpty = sf.files.length === 0
          return (
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
                  {dragOver === sf.name ? 'drive_file_move' : isExpanded ? 'folder_open' : 'folder'}
                </span>
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold"
                  style={{
                    background: `${sfColor}15`,
                    color: sfColor,
                    opacity: sf.file_count === 0 ? 0.5 : 1,
                  }}
                >
                  {dragOver === sf.name ? `Drop into ${sf.name}` : sf.name}
                  <span className="text-[10px] font-normal">({sf.file_count})</span>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleUpload(sf.name)
                  }}
                  disabled={uploading}
                  className="flex items-center gap-1.5 rounded-md bg-[var(--portal)] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:brightness-110 disabled:opacity-50"
                  title={`Upload file to ${sf.name}`}
                >
                  <span className="material-icons-outlined" style={{ fontSize: '14px' }}>
                    {uploading && uploadTarget === sf.name ? 'hourglass_empty' : 'cloud_upload'}
                  </span>
                  {uploading && uploadTarget === sf.name ? 'Uploading...' : 'Upload'}
                </button>
                <span
                  className="material-icons-outlined text-[var(--text-muted)] transition-transform"
                  style={{
                    fontSize: '16px',
                    transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                  }}
                >
                  expand_more
                </span>
              </div>
            </button>

            {/* Expanded file list + nested subfolders (TM-S13-05) */}
            {isExpanded && (sf.files.length > 0 || (sf.subfolders && sf.subfolders.length > 0)) && (
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
                      <button
                        onClick={() => setDeleteFile({ id: f.id, name: f.name })}
                        className="rounded p-1 hover:bg-red-500/10 text-[var(--text-muted)] hover:text-red-400"
                        title="Delete file"
                      >
                        <span className="material-icons-outlined" style={{ fontSize: '14px' }}>delete</span>
                      </button>
                    </div>
                  </div>
                ))}
                {/* Nested subfolders — indented tree rendering */}
                {sf.subfolders && sf.subfolders.map((child) => (
                  <details key={child.id} className="border-b border-[var(--border-subtle)] last:border-b-0">
                    <summary className="flex items-center gap-2 px-4 py-2 pl-8 text-xs cursor-pointer hover:bg-[var(--bg-surface)] transition-colors">
                      <span className="material-icons-outlined text-[var(--text-muted)]" style={{ fontSize: '14px' }}>folder</span>
                      <span className="font-medium text-[var(--text-secondary)]">{child.name}</span>
                      <span className="text-[10px] text-[var(--text-muted)]">({child.file_count})</span>
                    </summary>
                    <div className="bg-[var(--bg-base)]">
                      {child.files.map((cf) => (
                        <div key={cf.id} className="flex items-center gap-3 px-4 py-1.5 pl-12 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] transition-colors group">
                          <span className="material-icons-outlined text-[var(--text-muted)]" style={{ fontSize: '14px' }}>{mimeIcon(cf.mimeType)}</span>
                          <button onClick={() => setPreviewFile({ id: cf.id, name: cf.name, mimeType: cf.mimeType })} className="flex-1 truncate text-left hover:text-[var(--portal)] transition-colors">{cf.name}</button>
                          <span className="text-[var(--text-muted)] shrink-0">{formatSize(cf.size)}</span>
                          <span className="text-[var(--text-muted)] shrink-0">{new Date(cf.modifiedTime).toLocaleDateString()}</span>
                        </div>
                      ))}
                      {child.subfolders && child.subfolders.map((grandchild) => (
                        <details key={grandchild.id} className="border-t border-[var(--border-subtle)]">
                          <summary className="flex items-center gap-2 px-4 py-1.5 pl-16 text-xs cursor-pointer hover:bg-[var(--bg-surface)] transition-colors">
                            <span className="material-icons-outlined text-[var(--text-muted)]" style={{ fontSize: '14px' }}>folder</span>
                            <span className="font-medium text-[var(--text-secondary)]">{grandchild.name}</span>
                            <span className="text-[10px] text-[var(--text-muted)]">({grandchild.file_count})</span>
                          </summary>
                          <div className="bg-[var(--bg-base)]">
                            {grandchild.files.map((gf) => (
                              <div key={gf.id} className="flex items-center gap-3 px-4 py-1.5 pl-20 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] transition-colors group">
                                <span className="material-icons-outlined text-[var(--text-muted)]" style={{ fontSize: '14px' }}>{mimeIcon(gf.mimeType)}</span>
                                <button onClick={() => setPreviewFile({ id: gf.id, name: gf.name, mimeType: gf.mimeType })} className="flex-1 truncate text-left hover:text-[var(--portal)] transition-colors">{gf.name}</button>
                                <span className="text-[var(--text-muted)] shrink-0">{formatSize(gf.size)}</span>
                                <span className="text-[var(--text-muted)] shrink-0">{new Date(gf.modifiedTime).toLocaleDateString()}</span>
                              </div>
                            ))}
                          </div>
                        </details>
                      ))}
                    </div>
                  </details>
                ))}
              </div>
            )}

            {isExpanded && sf.files.length === 0 && (!sf.subfolders || sf.subfolders.length === 0) && (
              <div className="border-t border-[var(--border-subtle)] bg-[var(--bg-base)] px-4 py-3 text-xs text-[var(--text-muted)] italic">
                No files in this subfolder
              </div>
            )}
          </div>
          )
        })}
      </div>
      )}

      {/* Grid view (TRK-578) */}
      {viewMode === 'grid' && (
        <div className="rounded-lg border border-[var(--border-subtle)] overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-[var(--bg-surface)] text-[var(--text-muted)]">
                {[
                  { key: 'name', label: 'Name' },
                  { key: 'subfolder', label: 'Subfolder' },
                  { key: 'date', label: 'Modified' },
                  { key: 'size', label: 'Size' },
                ].map(col => (
                  <th
                    key={col.key}
                    onClick={() => toggleSort(col.key)}
                    className="px-3 py-2 text-left font-medium cursor-pointer hover:text-[var(--text-primary)] transition-colors select-none"
                  >
                    {col.label}
                    {gridSort.col === col.key && (
                      <span className="material-icons-outlined ml-0.5 align-middle" style={{ fontSize: '12px' }}>
                        {gridSort.dir === 'asc' ? 'arrow_upward' : 'arrow_downward'}
                      </span>
                    )}
                  </th>
                ))}
                <th className="px-3 py-2 w-20" />
              </tr>
            </thead>
            <tbody>
              {sortedAllFiles.map(f => {
                const sfColor = subfolderColors[f.subfolder] || 'var(--text-muted)'
                return (
                  <tr key={f.id} className="border-t border-[var(--border-subtle)] hover:bg-[var(--bg-surface)] transition-colors group">
                    <td className="px-3 py-2">
                      <button
                        onClick={() => setPreviewFile({ id: f.id, name: f.name, mimeType: f.mimeType })}
                        className="flex items-center gap-2 hover:text-[var(--portal)] transition-colors text-left"
                      >
                        <span className="material-icons-outlined text-[var(--text-muted)]" style={{ fontSize: '14px' }}>
                          {mimeIcon(f.mimeType)}
                        </span>
                        <span className="truncate max-w-[200px]">{f.name}</span>
                      </button>
                    </td>
                    <td className="px-3 py-2">
                      <span className="inline-block rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ background: `${sfColor}15`, color: sfColor }}>
                        {f.subfolder}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-[var(--text-muted)]">{new Date(f.modifiedTime).toLocaleDateString()}</td>
                    <td className="px-3 py-2 text-[var(--text-muted)]">{formatSize(f.size)}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => handleDownload(f.id, f.name)} className="rounded p-1 hover:bg-[var(--bg-card)] text-[var(--text-muted)] hover:text-[var(--portal)]" title="Download">
                          <span className="material-icons-outlined" style={{ fontSize: '14px' }}>download</span>
                        </button>
                        <button onClick={() => setDeleteFile({ id: f.id, name: f.name })} className="rounded p-1 hover:bg-red-500/10 text-[var(--text-muted)] hover:text-red-400" title="Delete">
                          <span className="material-icons-outlined" style={{ fontSize: '14px' }}>delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {sortedAllFiles.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-[var(--text-muted)] italic">
                    {searchQuery ? 'No files match your search' : 'No files in ACF'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Search no-results message (tree view) */}
      {viewMode === 'tree' && searchQuery && filteredSubfolders.every(sf => sf.files.length === 0) && filteredRootFiles.length === 0 && (
        <div className="rounded-lg border border-[var(--border-subtle)] px-4 py-6 text-center text-xs text-[var(--text-muted)] italic">
          No files match &ldquo;{searchQuery}&rdquo;
        </div>
      )}

      {/* ── Preview Panel (fullscreen-capable overlay) ─────────────── */}
      {previewFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => { if (isFullscreen) { setIsFullscreen(false) } else { setPreviewFile(null) } }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') { if (isFullscreen) { setIsFullscreen(false) } else { setPreviewFile(null) } }
            if (e.key === 'f' || e.key === 'F') { setIsFullscreen(p => !p) }
          }}
          tabIndex={0}
          ref={(el) => el?.focus()}
        >
          <div
            className={`relative overflow-hidden flex flex-col transition-all duration-200 ${
              isFullscreen
                ? 'w-screen h-screen'
                : 'w-[95vw] max-w-6xl h-[90vh] rounded-xl border border-[var(--border-subtle)] shadow-2xl'
            } bg-[var(--bg-card)]`}
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
                  onClick={() => setDeleteFile({ id: previewFile.id, name: previewFile.name })}
                  className="flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  <span className="material-icons-outlined" style={{ fontSize: '14px' }}>delete</span>
                  Delete
                </button>
                <button
                  onClick={() => handleDownload(previewFile.id, previewFile.name)}
                  className="flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-card)] transition-colors"
                >
                  <span className="material-icons-outlined" style={{ fontSize: '14px' }}>download</span>
                  Download
                </button>
                <button
                  onClick={() => setIsFullscreen(p => !p)}
                  className="rounded-lg p-1.5 hover:bg-[var(--bg-card)] text-[var(--text-muted)] transition-colors"
                  title={isFullscreen ? 'Exit fullscreen (F)' : 'Fullscreen (F)'}
                >
                  <span className="material-icons-outlined" style={{ fontSize: '18px' }}>
                    {isFullscreen ? 'fullscreen_exit' : 'fullscreen'}
                  </span>
                </button>
                <button
                  onClick={() => { setIsFullscreen(false); setPreviewFile(null) }}
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

      {/* ── Delete Confirmation Modal ──────────────────────────────── */}
      {deleteFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => !deleting && setDeleteFile(null)}
        >
          <div
            className="w-full max-w-sm rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] shadow-2xl p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <span className="material-icons-outlined text-red-400" style={{ fontSize: '20px' }}>delete</span>
              <div>
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">Delete File</h3>
                <p className="text-xs text-[var(--text-muted)] truncate max-w-[280px]">{deleteFile.name}</p>
              </div>
            </div>
            <p className="text-xs text-[var(--text-muted)] mb-4">
              This moves the file to trash. It can be recovered from Google Drive trash within 30 days.
            </p>
            <div className="flex items-center gap-3 justify-end">
              <button
                onClick={() => setDeleteFile(null)}
                disabled={deleting}
                className="rounded-lg border border-[var(--border-subtle)] px-4 py-2 text-xs font-medium text-[var(--text-muted)] hover:bg-[var(--bg-surface)] transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={deleting}
                className="rounded-lg bg-red-500 px-4 py-2 text-xs font-medium text-white hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
