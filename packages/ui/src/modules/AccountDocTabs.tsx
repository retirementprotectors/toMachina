'use client'

import { useState, useEffect, useCallback } from 'react'
import { getAuth } from 'firebase/auth'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DocFile {
  id: string
  name: string
  mimeType: string
  modifiedTime: string
  size?: string
}

interface GroupedFiles {
  subfolder: string
  files: DocFile[]
}

interface AccountDocTabsProps {
  clientId: string
  policyNumber: string
}

// ---------------------------------------------------------------------------
// Tab mapping: ACF subfolder → Account doc tab label
// ---------------------------------------------------------------------------

const TAB_MAP: Array<{ label: string; subfolder: string }> = [
  { label: 'NewBiz', subfolder: 'NewBiz' },
  { label: 'Active', subfolder: 'Account' },
  { label: 'Cases', subfolder: 'Cases' },
  { label: 'Reactive', subfolder: 'Reactive' },
]

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AccountDocTabs({ clientId, policyNumber }: AccountDocTabsProps) {
  const [groups, setGroups] = useState<GroupedFiles[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState(0)

  const fetchFiles = useCallback(async () => {
    if (!clientId || !policyNumber) return
    try {
      setLoading(true)
      const auth = getAuth()
      const user = auth.currentUser
      const token = user ? await user.getIdToken() : null
      const res = await fetch(
        `/api/acf/${clientId}/files-by-policy/${encodeURIComponent(policyNumber)}`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      )
      if (!res.ok) return
      const json = await res.json()
      if (json.success && json.data?.files) {
        setGroups(json.data.files as GroupedFiles[])
      }
    } catch {
      // Silent — component degrades to empty state
    } finally {
      setLoading(false)
    }
  }, [clientId, policyNumber])

  useEffect(() => { fetchFiles() }, [fetchFiles])

  // Map groups to tabs
  const tabData = TAB_MAP.map((tab) => {
    const match = groups.find(
      (g) => g.subfolder.toLowerCase() === tab.subfolder.toLowerCase()
    )
    return { ...tab, files: match?.files || [] }
  })

  const currentFiles = tabData[activeTab]?.files || []

  if (loading) {
    return (
      <div className="py-4 text-center text-sm text-[var(--text-muted)]">
        Loading documents...
      </div>
    )
  }

  if (groups.length === 0) {
    return (
      <div className="py-4 text-center text-sm text-[var(--text-muted)]">
        No documents found for policy {policyNumber}
      </div>
    )
  }

  return (
    <div className="mt-4">
      {/* Tab bar */}
      <div className="flex border-b border-[var(--border)]">
        {tabData.map((tab, idx) => (
          <button
            key={tab.subfolder}
            onClick={() => setActiveTab(idx)}
            className={`px-4 py-2 text-xs font-medium transition-colors ${
              idx === activeTab
                ? 'border-b-2 border-[var(--portal)] text-[var(--portal)]'
                : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
            }`}
          >
            {tab.label} ({tab.files.length})
          </button>
        ))}
      </div>

      {/* File list */}
      <div className="py-2">
        {currentFiles.length === 0 ? (
          <p className="py-3 text-center text-xs text-[var(--text-muted)]">
            No documents in this category
          </p>
        ) : (
          currentFiles.map((file) => (
            <a
              key={file.id}
              href={`https://drive.google.com/file/d/${file.id}/preview`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 border-b border-[var(--border)]/50 px-3 py-2 text-sm transition-colors hover:bg-[var(--bg-hover)]"
            >
              <span
                className="material-icons-outlined"
                style={{ fontSize: '16px', color: 'var(--text-muted)' }}
              >
                description
              </span>
              <span className="min-w-0 flex-1 truncate">{file.name}</span>
              <span className="shrink-0 text-xs text-[var(--text-muted)]">
                {file.modifiedTime
                  ? new Date(file.modifiedTime).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })
                  : ''}
              </span>
              {file.size && (
                <span className="shrink-0 text-xs text-[var(--text-muted)]">
                  {formatSize(file.size)}
                </span>
              )}
            </a>
          ))
        )}
      </div>
    </div>
  )
}

function formatSize(bytes: string): string {
  const num = parseInt(bytes)
  if (isNaN(num)) return bytes
  if (num < 1024) return `${num} B`
  if (num < 1024 * 1024) return `${(num / 1024).toFixed(0)} KB`
  return `${(num / (1024 * 1024)).toFixed(1)} MB`
}
