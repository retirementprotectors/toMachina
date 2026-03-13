'use client'

import { useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { query, orderBy, type Query, type DocumentData } from 'firebase/firestore'
import { useCollection } from '@tomachina/db'
import { collections } from '@tomachina/db/src/firestore'

interface ClientRow {
  _id: string
  client_id: string
  first_name: string
  last_name: string
  email?: string
  phone?: string
  dob?: string
  agent_name?: string
  account_types?: string[]
}

const clientsQuery: Query<DocumentData> = query(collections.clients(), orderBy('last_name'))

export default function AnnuitySalesCenterPage() {
  const router = useRouter()
  const { data: allClients, loading } = useCollection<ClientRow>(clientsQuery, 'annuity-clients')
  const [search, setSearch] = useState('')

  const annuityClients = useMemo(() => {
    let result = allClients.filter(c =>
      (c.account_types || []).some(t => (t || '').toLowerCase() === 'annuity')
    )
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(c => {
        const name = `${c.first_name || ''} ${c.last_name || ''}`.toLowerCase()
        return name.includes(q) || (c.email || '').toLowerCase().includes(q)
      })
    }
    return result
  }, [allClients, search])

  const handleRowClick = useCallback((client: ClientRow) => {
    router.push(`/contacts/${client._id || client.client_id}`)
  }, [router])

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Annuity</h1>
        <div className="mt-6 flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--portal)] border-t-transparent" />
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Annuity</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            {annuityClients.length} client{annuityClients.length !== 1 ? 's' : ''} with annuity accounts
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="mt-4">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search annuity clients..."
          className="w-full max-w-sm rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] px-4 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--portal)] focus:outline-none"
        />
      </div>

      {/* Client Table */}
      {annuityClients.length > 0 ? (
        <div className="mt-4 overflow-x-auto rounded-lg border border-[var(--border)]">
          <table className="w-full text-sm">
            <thead className="bg-[var(--bg-secondary)]">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-[var(--text-muted)]">Client</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-[var(--text-muted)]">Contact</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-[var(--text-muted)]">Agent</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-[var(--text-muted)]">DOB</th>
              </tr>
            </thead>
            <tbody>
              {annuityClients.slice(0, 50).map(c => (
                <tr
                  key={c._id || c.client_id}
                  onClick={() => handleRowClick(c)}
                  className="cursor-pointer border-t border-[var(--border)] transition-colors hover:bg-[var(--bg-hover)]"
                >
                  <td className="px-4 py-3 font-medium text-[var(--text-primary)]">{c.first_name} {c.last_name}</td>
                  <td className="px-4 py-3 text-[var(--text-secondary)]">{c.email || c.phone || '—'}</td>
                  <td className="px-4 py-3 text-[var(--text-secondary)]">{c.agent_name || '—'}</td>
                  <td className="px-4 py-3 text-[var(--text-secondary)]">{c.dob || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="mt-6 flex flex-col items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] py-16">
          <span className="material-icons-outlined text-4xl text-[var(--text-muted)]">savings</span>
          <p className="mt-3 text-sm text-[var(--text-muted)]">
            {search ? 'No annuity clients match your search.' : 'No clients with annuity accounts found.'}
          </p>
        </div>
      )}

      {/* Rate Comparison Placeholder */}
      <div className="mt-6 rounded-xl border border-dashed border-[var(--border)] bg-[var(--bg-secondary)] p-6">
        <div className="flex items-center gap-3">
          <span className="material-icons-outlined text-2xl text-[var(--text-muted)]">compare_arrows</span>
          <div>
            <p className="text-sm font-medium text-[var(--text-primary)]">Annuity Rate Comparison</p>
            <p className="text-xs text-[var(--text-muted)]">
              FIA and MYGA rate comparison tools — integration planned. Contact your manager for current quoting workflows.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
