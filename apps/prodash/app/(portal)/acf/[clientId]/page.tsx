'use client'

import { use, useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { getAuth } from 'firebase/auth'
import type { ACFSubfolderDetail, ACFDriveFile } from '@tomachina/core'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ACFDetailResponse {
  exists: boolean
  folder_id?: string
  folder_url?: string | null
  subfolders: ACFSubfolderDetail[]
  root_files?: ACFDriveFile[]
  drive_limited?: boolean
}

interface ClientData {
  first_name?: string
  last_name?: string
  client_id?: string
  acf_folder_id?: string
  acf_folder_url?: string
}

// The 5 canonical ACF subfolder tabs
const ACF_TABS = ['Client', 'NewBiz', 'Cases', 'Account', 'Reactive'] as const
type ACFTab = (typeof ACF_TABS)[number]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getToken(): Promise<string | null> {
  const auth = getAuth()
  return auth.currentUser?.getIdToken() ?? null
}

function formatDate(iso: string | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' })
}

function formatSize(bytes: string | number | undefined): string {
  if (!bytes) return '—'
  const b = typeof bytes === 'string' ? parseInt(bytes, 10) : bytes
  if (isNaN(b)) return '—'
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / (1024 * 1024)).toFixed(1)} MB`
}

function mimeIcon(mimeType: string): string {
  if (mimeType.includes('pdf')) return 'picture_as_pdf'
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType.includes('csv')) return 'table_chart'
  if (mimeType.includes('document') || mimeType.includes('word')) return 'description'
  if (mimeType.includes('image')) return 'image'
  if (mimeType.includes('folder')) return 'folder'
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return 'slideshow'
  return 'insert_drive_file'
}

function drivePreviewUrl(fileId: string, mimeType: string): string {
  if (mimeType.includes('spreadsheet') || mimeType.includes('document') || mimeType.includes('presentation')) {
    return `https://docs.google.com/file/d/${fileId}/preview`
  }
  return `https://drive.google.com/file/d/${fileId}/preview`
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ACFDetailPage({
  params,
}: {
  params: Promise<{ clientId: string }>
}) {
  const { clientId } = use(params)

  const [detail, setDetail] = useState<ACFDetailResponse | null>(null)
  const [client, setClient] = useState<ClientData | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<ACFTab>('Client')

  // Dedup state
  const [dismissedDupes, setDismissedDupes] = useState<Set<string>>(new Set())

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const token = await getToken()
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}

      const [detailRes, clientRes] = await Promise.all([
        fetch(`/api/acf/${clientId}`, { headers }),
        fetch(`/api/clients/${clientId}`, { headers }),
      ])

      if (detailRes.ok) {
        const json = await detailRes.json()
        if (json.success) setDetail(json.data as ACFDetailResponse)
      }

      if (clientRes.ok) {
        const json = await clientRes.json()
        if (json.success) setClient(json.data as ClientData)
      }
    } catch {
      // Silently fail — degraded state shown in UI
    } finally {
      setLoading(false)
    }
  }, [clientId])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleDismissDupe = useCallback(async (matchClientId: string) => {
    try {
      const token = await getToken()
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      }
      await fetch(`/api/acf/${clientId}/dismiss-duplicate`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ match_client_id: matchClientId }),
      })
      setDismissedDupes((prev) => new Set([...prev, matchClientId]))
    } catch {
      // Silently fail
    }
  }, [clientId])

  // --- Find active tab subfolder ---
  const activeSubfolder = detail?.subfolders?.find((sf) => sf.name === activeTab)
  const activeFiles: ACFDriveFile[] = activeSubfolder?.files ?? []

  // --- Metrics ---
  const totalDocs = detail?.subfolders?.reduce((sum, sf) => sum + (sf.files?.length ?? 0), 0) ?? 0
  const subCount = detail?.subfolders?.length ?? 0
  const lastModified = detail?.subfolders
    ?.flatMap((sf) => sf.files ?? [])
    .map((f) => f.modifiedTime)
    .filter(Boolean)
    .sort()
    .at(-1)

  const clientName = client
    ? `${client.last_name || '—'}, ${client.first_name || '—'}`
    : clientId

  // --- Loading skeleton ---
  if (loading) {
    return (
      <div className="mx-auto max-w-6xl animate-pulse space-y-6">
        <BackLink />
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-6">
          <div className="space-y-3">
            <div className="h-7 w-64 rounded bg-[var(--bg-surface)]" />
            <div className="h-4 w-48 rounded bg-[var(--bg-surface)]" />
          </div>
        </div>
        <div className="flex gap-2">
          {ACF_TABS.map((t) => (
            <div key={t} className="h-9 w-24 rounded-full bg-[var(--bg-surface)]" />
          ))}
        </div>
        <div className="h-64 rounded-xl bg-[var(--bg-card)]" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <BackLink />

      {/* Dedup banner — shown when detail has possible duplicates (future: from API) */}
      {/* Placeholder — dedup detection wired to API when acf/duplicates endpoint exists */}

      {/* Header card */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">
              ACF — {clientName}
            </h1>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              {totalDocs} document{totalDocs !== 1 ? 's' : ''} · {subCount}/5 subfolders
              {lastModified ? ` · Last modified ${formatDate(lastModified)}` : ''}
            </p>
            {detail?.drive_limited && (
              <p className="mt-1 text-xs text-amber-400">
                Drive access limited — folder linked but content unverifiable. Open in Drive to browse files.
              </p>
            )}
          </div>

          {/* Cross-link buttons */}
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/contacts/${clientId}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-secondary)] transition-colors hover:border-[var(--portal)] hover:text-[var(--portal)]"
            >
              <span className="material-icons-outlined" style={{ fontSize: '16px' }}>person</span>
              Contact
            </Link>
            <Link
              href={`/accounts?client=${clientId}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-secondary)] transition-colors hover:border-[var(--portal)] hover:text-[var(--portal)]"
            >
              <span className="material-icons-outlined" style={{ fontSize: '16px' }}>account_balance</span>
              Accounts
            </Link>
            {detail?.folder_url && (
              <a
                href={detail.folder_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-secondary)] transition-colors hover:border-[var(--portal)] hover:text-[var(--portal)]"
              >
                <span className="material-icons-outlined" style={{ fontSize: '16px' }}>open_in_new</span>
                Open in Drive
              </a>
            )}
          </div>
        </div>
      </div>

      {/* No ACF state */}
      {!detail?.exists && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--bg-card)] py-20 text-center">
          <span className="material-icons-outlined text-5xl text-[var(--text-muted)]">folder_off</span>
          <h2 className="mt-4 text-xl font-semibold text-[var(--text-primary)]">No ACF folder found</h2>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            This client does not have an Active Client File in Drive.
          </p>
          <Link
            href={`/contacts/${clientId}`}
            className="mt-6 rounded-lg bg-[var(--portal)] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:brightness-110"
          >
            Go to Contact
          </Link>
        </div>
      )}

      {/* Tab bar + file list */}
      {detail?.exists && (
        <>
          {/* Tab bar */}
          <div className="flex gap-1 overflow-x-auto">
            {ACF_TABS.map((tab) => {
              const sf = detail.subfolders?.find((s) => s.name === tab)
              const count = sf?.files?.length ?? 0
              const isActive = activeTab === tab
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-[var(--portal)] text-white'
                      : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {tab}
                  {sf ? (
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                        isActive ? 'bg-white/20 text-white' : 'bg-[var(--bg-surface)] text-[var(--text-muted)]'
                      }`}
                    >
                      {count}
                    </span>
                  ) : (
                    <span className="rounded-full bg-red-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-red-400">
                      missing
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {/* File list */}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)]">
            {!activeSubfolder ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <span className="material-icons-outlined text-4xl text-amber-400">folder_off</span>
                <p className="mt-3 text-sm font-medium text-[var(--text-primary)]">
                  "{activeTab}" subfolder is missing
                </p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  This subfolder hasn&apos;t been created in Drive yet.
                </p>
              </div>
            ) : activeFiles.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <span className="material-icons-outlined text-4xl text-[var(--text-muted)]">inbox</span>
                <p className="mt-3 text-sm text-[var(--text-muted)]">No files in {activeTab}</p>
              </div>
            ) : (
              <div className="divide-y divide-[var(--border)]">
                {/* File list header */}
                <div className="grid grid-cols-[1fr_auto_auto] gap-4 px-4 py-2.5 text-xs font-semibold uppercase text-[var(--portal)] bg-[var(--bg-surface)] rounded-t-xl">
                  <span>Name</span>
                  <span className="w-24 text-right">Modified</span>
                  <span className="w-16 text-right">Size</span>
                </div>

                {activeFiles.map((file) => (
                  <div
                    key={file.id}
                    className="grid grid-cols-[1fr_auto_auto] items-center gap-4 px-4 py-3 transition-colors hover:bg-[var(--bg-hover)]"
                  >
                    {/* File name + icon — clicking opens preview */}
                    <a
                      href={drivePreviewUrl(file.id, file.mimeType)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex min-w-0 items-center gap-2 text-sm text-[var(--text-primary)] hover:text-[var(--portal)]"
                    >
                      <span
                        className="material-icons-outlined shrink-0 text-[var(--text-muted)]"
                        style={{ fontSize: '18px' }}
                      >
                        {mimeIcon(file.mimeType)}
                      </span>
                      <span className="truncate">{file.name}</span>
                    </a>

                    {/* Modified date */}
                    <span className="w-24 text-right text-xs text-[var(--text-muted)]">
                      {formatDate(file.modifiedTime)}
                    </span>

                    {/* Size */}
                    <span className="w-16 text-right text-xs text-[var(--text-muted)]">
                      {formatSize(file.size)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Root files (Ai3 etc.) */}
          {(detail.root_files?.length ?? 0) > 0 && (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)]">
              <div className="border-b border-[var(--border)] bg-[var(--bg-surface)] px-4 py-2.5 rounded-t-xl">
                <p className="text-xs font-semibold uppercase text-[var(--portal)]">Root Files</p>
              </div>
              <div className="divide-y divide-[var(--border)]">
                {detail.root_files!.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--bg-hover)]"
                  >
                    <a
                      href={drivePreviewUrl(file.id, file.mimeType)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex min-w-0 items-center gap-2 text-sm text-[var(--text-primary)] hover:text-[var(--portal)]"
                    >
                      <span
                        className="material-icons-outlined shrink-0 text-[var(--text-muted)]"
                        style={{ fontSize: '18px' }}
                      >
                        {mimeIcon(file.mimeType)}
                      </span>
                      <span className="truncate">{file.name}</span>
                    </a>
                    <span className="ml-auto text-xs text-[var(--text-muted)]">
                      {formatDate(file.modifiedTime)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function BackLink() {
  return (
    <Link
      href="/acf"
      className="inline-flex items-center gap-1.5 text-sm text-[var(--text-muted)] transition-colors hover:text-[var(--portal)]"
    >
      <span className="material-icons-outlined text-[18px]">arrow_back</span>
      Back to ACF
    </Link>
  )
}
