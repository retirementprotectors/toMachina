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
}

interface SubfolderDetail {
  id: string
  name: string
  file_count: number
  files: DocFile[]
}

interface QuickDocButtonsProps {
  /** 'contact' shows Client subfolder docs. 'account' shows policy-filtered docs. */
  mode: 'contact' | 'account'
  clientId: string
  /** Required for mode='account' — policy number to filter files by */
  policyNumber?: string
}

// ---------------------------------------------------------------------------
// Doc type definitions per mode
// ---------------------------------------------------------------------------

interface DocDef {
  id: string
  label: string
  pattern: RegExp
  subfolder?: string
}

const CONTACT_DOCS: DocDef[] = [
  { id: 'medicare_card', label: 'Medicare Card', pattern: /medicare.*(card|id)|cms.card/i },
  { id: 'drivers_license', label: "Driver's License", pattern: /driver|license|dl[_\s]/i },
  { id: 'ai3', label: 'AI3', pattern: /ai3|annual.*info/i },
  { id: 'hipaa', label: 'HIPAA Auth', pattern: /hipaa|authorization/i },
  { id: 'poa', label: 'POA', pattern: /power.*attorney|poa/i },
]

const ACCOUNT_DOCS: DocDef[] = [
  { id: 'latest_statement', label: 'Latest Statement', pattern: /statement|confirm/i, subfolder: 'Account' },
  { id: 'policy_doc', label: 'Policy Doc', pattern: /policy|contract|certificate/i, subfolder: 'Account' },
  { id: 'application', label: 'Application', pattern: /application|app.*form/i, subfolder: 'NewBiz' },
  { id: 'annual_review', label: 'Annual Review', pattern: /annual.*review|review/i, subfolder: 'Account' },
]

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function QuickDocButtons({ mode, clientId, policyNumber }: QuickDocButtonsProps) {
  const [resolvedDocs, setResolvedDocs] = useState<
    Record<string, { file_id: string; name: string } | null>
  >({})
  const [loading, setLoading] = useState(true)

  const docs = mode === 'contact' ? CONTACT_DOCS : ACCOUNT_DOCS

  const resolve = useCallback(async () => {
    if (!clientId) return
    try {
      setLoading(true)
      const auth = getAuth()
      const user = auth.currentUser
      const token = user ? await user.getIdToken() : null

      if (mode === 'contact') {
        // Fetch full ACF detail, look in Client subfolder
        const res = await fetch(`/api/acf/${clientId}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })
        if (!res.ok) return
        const json = await res.json()
        if (!json.success || !json.data?.subfolders) return

        const clientSf = (json.data.subfolders as SubfolderDetail[]).find(
          (sf) => sf.name === 'Client'
        )
        const files = clientSf?.files || []

        const result: Record<string, { file_id: string; name: string } | null> = {}
        for (const doc of CONTACT_DOCS) {
          const match = files.find((f: DocFile) => doc.pattern.test(f.name))
          result[doc.id] = match ? { file_id: match.id, name: match.name } : null
        }
        setResolvedDocs(result)
      } else if (mode === 'account' && policyNumber) {
        // Fetch files by policy
        const res = await fetch(
          `/api/acf/${clientId}/files-by-policy/${encodeURIComponent(policyNumber)}`,
          { headers: token ? { Authorization: `Bearer ${token}` } : {} }
        )
        if (!res.ok) return
        const json = await res.json()
        if (!json.success || !json.data?.files) return

        const groups = json.data.files as Array<{ subfolder: string; files: DocFile[] }>
        const allFiles = groups.flatMap((g) =>
          g.files.map((f) => ({ ...f, subfolder: g.subfolder }))
        )

        const result: Record<string, { file_id: string; name: string } | null> = {}
        for (const doc of ACCOUNT_DOCS) {
          const candidates = doc.subfolder
            ? allFiles.filter((f) => f.subfolder === doc.subfolder && doc.pattern.test(f.name))
            : allFiles.filter((f) => doc.pattern.test(f.name))

          // Pick most recent
          const sorted = candidates.sort(
            (a, b) => (b.modifiedTime || '').localeCompare(a.modifiedTime || '')
          )
          result[doc.id] = sorted[0] ? { file_id: sorted[0].id, name: sorted[0].name } : null
        }
        setResolvedDocs(result)
      }
    } catch {
      // Silent — buttons degrade to all-gray
    } finally {
      setLoading(false)
    }
  }, [clientId, policyNumber, mode])

  useEffect(() => { resolve() }, [resolve])

  if (loading) return null

  return (
    <div className="flex flex-wrap gap-1.5">
      {docs.map((doc) => {
        const resolved = resolvedDocs[doc.id]
        const found = !!resolved

        if (found) {
          return (
            <a
              key={doc.id}
              href={`https://drive.google.com/file/d/${resolved.file_id}/preview`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors"
              style={{
                background: 'rgba(74,122,181,0.12)',
                color: 'var(--portal)',
                borderColor: 'rgba(74,122,181,0.3)',
              }}
              title={resolved.name}
            >
              <span className="material-icons-outlined" style={{ fontSize: '14px' }}>description</span>
              {doc.label}
            </a>
          )
        }

        return (
          <span
            key={doc.id}
            className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--text-muted)] opacity-50"
          >
            <span className="material-icons-outlined" style={{ fontSize: '14px' }}>description</span>
            {doc.label}
          </span>
        )
      })}
    </div>
  )
}
