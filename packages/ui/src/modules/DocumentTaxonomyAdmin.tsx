'use client'

import { useState, useEffect, useCallback } from 'react'
import { fetchWithAuth } from './fetchWithAuth'

/**
 * Document Taxonomy Admin — manage document type definitions.
 * Reads/writes Firestore document_taxonomy collection via API.
 */

interface TaxonomyEntry {
  id: string
  document_type: string
  short: string
  acf_subfolder: string
  pipeline: string
  owner_role: string
  priority: string
  active: boolean
}

const SUBFOLDERS = ['Client', 'Cases', 'NewBiz', 'Account', 'Reactive']
const PIPELINES = ['REACTIVE', 'PRO', 'NewBiz']
const ROLES = ['COR', 'AST', 'SPC']

export function DocumentTaxonomyAdmin() {
  const [entries, setEntries] = useState<TaxonomyEntry[]>([])
  const [loading, setLoading] = useState(true)

  const loadEntries = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetchWithAuth('/api/document-index/taxonomy')
      const json = await res.json()
      if (json.success) {
        const sorted = (json.data || []).sort((a: TaxonomyEntry, b: TaxonomyEntry) =>
          a.document_type.localeCompare(b.document_type)
        )
        setEntries(sorted)
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadEntries()
  }, [loadEntries])

  if (loading) {
    return (
      <div className="space-y-2 animate-pulse">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-10 rounded-lg bg-[var(--bg-surface)]" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-[var(--text-primary)]">Document Taxonomy</h3>
          <p className="text-xs text-[var(--text-muted)]">{entries.length} document types configured</p>
        </div>
      </div>

      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-surface)]">
              <th className="px-3 py-2 text-left font-medium text-[var(--text-muted)]">Document Type</th>
              <th className="px-3 py-2 text-left font-medium text-[var(--text-muted)]">Subfolder</th>
              <th className="px-3 py-2 text-left font-medium text-[var(--text-muted)]">Pipeline</th>
              <th className="px-3 py-2 text-left font-medium text-[var(--text-muted)]">Owner</th>
              <th className="px-3 py-2 text-center font-medium text-[var(--text-muted)]">Active</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id} className="border-b border-[var(--border-subtle)] last:border-b-0 hover:bg-[var(--bg-surface)] transition-colors">
                <td className="px-3 py-2">
                  <span className="font-medium text-[var(--text-primary)]">{entry.document_type}</span>
                </td>
                <td className="px-3 py-2">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    entry.acf_subfolder === 'Client' ? 'bg-blue-500/10 text-blue-400' :
                    entry.acf_subfolder === 'Cases' ? 'bg-purple-500/10 text-purple-400' :
                    entry.acf_subfolder === 'NewBiz' ? 'bg-emerald-500/10 text-emerald-400' :
                    entry.acf_subfolder === 'Account' ? 'bg-amber-500/10 text-amber-400' :
                    'bg-red-500/10 text-red-400'
                  }`}>
                    {entry.acf_subfolder}
                  </span>
                </td>
                <td className="px-3 py-2 text-[var(--text-muted)]">{entry.pipeline}</td>
                <td className="px-3 py-2 text-[var(--text-muted)]">{entry.owner_role}</td>
                <td className="px-3 py-2 text-center">
                  <span className={`inline-block h-2 w-2 rounded-full ${entry.active ? 'bg-emerald-500' : 'bg-red-500'}`} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
