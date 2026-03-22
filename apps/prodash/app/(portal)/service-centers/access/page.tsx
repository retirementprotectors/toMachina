'use client'

import { useState, useMemo, useEffect, useRef, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { getAuth } from 'firebase/auth'
import {
  collection,
  query as fsQuery,
  where,
  orderBy,
  limit,
  getDocs,
} from 'firebase/firestore'
import { getDb } from '@tomachina/db'
import type { AccessItem, AccessStatus, AccessType, AccessCategory } from '@tomachina/core'
import { ApiAccessTable } from './components/ApiAccessTable'
import { PortalAccessTable } from './components/PortalAccessTable'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getToken(): Promise<string | undefined> {
  const auth = getAuth()
  return auth.currentUser?.getIdToken() ?? undefined
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<{ success: boolean; data?: T; error?: string }> {
  const token = await getToken()
  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  })
  return res.json()
}

// ---------------------------------------------------------------------------
// Client Search (debounced, multi-strategy Firestore query)
// ---------------------------------------------------------------------------

interface ClientSearchResult {
  id: string
  first_name: string
  last_name: string
  client_status: string
  city?: string
  state?: string
  email?: string
  phone?: string
}

/**
 * Determines query type from user input:
 * - '@' in query => email search
 * - purely digits (after stripping dashes/parens/spaces) => phone search
 * - otherwise => name search (last_name + first_name)
 */
function detectQueryType(q: string): 'email' | 'phone' | 'name' {
  if (q.includes('@')) return 'email'
  const digits = q.replace(/[\s\-().+]/g, '')
  if (/^\d+$/.test(digits) && digits.length >= 3) return 'phone'
  return 'name'
}

async function searchClients(q: string): Promise<ClientSearchResult[]> {
  const db = getDb()
  const clientsRef = collection(db, 'clients')
  const queryType = detectQueryType(q)

  if (queryType === 'email') {
    // Exact email match (emails are stored lowercase)
    const emailQ = fsQuery(
      clientsRef,
      where('email', '==', q.trim().toLowerCase()),
      limit(10)
    )
    const snap = await getDocs(emailQ)
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as ClientSearchResult))
  }

  if (queryType === 'phone') {
    // Strip non-digits and search by phone field
    const digits = q.replace(/[\s\-().+]/g, '')
    const phoneQ = fsQuery(
      clientsRef,
      where('phone', '>=', digits),
      where('phone', '<=', digits + '\uf8ff'),
      limit(10)
    )
    const snap = await getDocs(phoneQ)
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as ClientSearchResult))
  }

  // Name search: try last_name prefix AND first_name prefix in parallel
  const upper = q.charAt(0).toUpperCase() + q.slice(1).toLowerCase()
  const lastNameQ = fsQuery(
    clientsRef,
    where('last_name', '>=', upper),
    where('last_name', '<=', upper + '\uf8ff'),
    orderBy('last_name', 'asc'),
    limit(10)
  )
  const firstNameQ = fsQuery(
    clientsRef,
    where('first_name', '>=', upper),
    where('first_name', '<=', upper + '\uf8ff'),
    orderBy('first_name', 'asc'),
    limit(10)
  )

  const [lastSnap, firstSnap] = await Promise.all([
    getDocs(lastNameQ),
    getDocs(firstNameQ),
  ])

  // Merge + deduplicate
  const seen = new Set<string>()
  const merged: ClientSearchResult[] = []

  for (const d of lastSnap.docs) {
    if (!seen.has(d.id)) {
      seen.add(d.id)
      merged.push({ id: d.id, ...d.data() } as ClientSearchResult)
    }
  }
  for (const d of firstSnap.docs) {
    if (!seen.has(d.id)) {
      seen.add(d.id)
      merged.push({ id: d.id, ...d.data() } as ClientSearchResult)
    }
  }

  return merged.slice(0, 10)
}

function ClientSearch({ onSelect }: { onSelect: (clientId: string, name: string) => void }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ClientSearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const search = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); setError(null); return }
    setLoading(true)
    setError(null)
    try {
      const data = await searchClients(q)
      setResults(data)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Search failed'
      // Surface index errors to the user instead of silently swallowing
      if (msg.includes('FAILED_PRECONDITION') || msg.includes('index')) {
        setError('Search indexes are being built. Please try again in a few minutes.')
      } else {
        setError('Search failed. Please try again.')
      }
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [])

  const handleChange = (val: string) => {
    setQuery(val)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => search(val), 300)
  }

  const queryType = query.length >= 2 ? detectQueryType(query) : 'name'
  const placeholderMap: Record<string, string> = {
    name: 'Search by name, email, or phone...',
    email: 'Searching by email...',
    phone: 'Searching by phone...',
  }

  return (
    <div className="mx-auto max-w-lg">
      <div className="flex flex-col items-center gap-4 py-12">
        <span className="material-icons-outlined text-5xl text-[var(--text-muted)]">person_search</span>
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">Select a Client</h2>
        <p className="text-sm text-[var(--text-muted)]">Search by name, email address, or phone number</p>
        <div className="relative w-full">
          <span className="material-icons-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-[var(--text-muted)]">search</span>
          <input
            type="text"
            value={query}
            onChange={(e) => handleChange(e.target.value)}
            placeholder={placeholderMap[queryType]}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] py-2.5 pl-10 pr-3 text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--portal)]"
          />
          {loading && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--portal)] border-t-transparent" />
            </div>
          )}
        </div>
        {results.length > 0 && (
          <div className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-card)] shadow-lg overflow-hidden">
            {results.map((c) => (
              <button
                key={c.id}
                onClick={() => onSelect(c.id, `${c.first_name} ${c.last_name}`)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-[var(--bg-hover)] transition-colors border-b border-[var(--border)] last:border-b-0"
              >
                <span className="material-icons-outlined text-[20px] text-[var(--text-muted)]">person</span>
                <div>
                  <p className="text-sm font-medium text-[var(--text-primary)]">{c.first_name} {c.last_name}</p>
                  <p className="text-xs text-[var(--text-muted)]">
                    {c.client_status}{c.city ? ` \u2022 ${c.city}, ${c.state}` : ''}
                    {c.email ? ` \u2022 ${c.email}` : ''}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-[var(--error)] bg-[var(--error)]/10 px-4 py-3">
            <span className="material-icons-outlined text-[18px] text-[var(--error)]">error_outline</span>
            <p className="text-sm text-[var(--error)]">{error}</p>
          </div>
        )}
        {query.length >= 2 && !loading && !error && results.length === 0 && (
          <p className="text-sm text-[var(--text-muted)]">No clients found for &ldquo;{query}&rdquo;</p>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Add Access Modal
// ---------------------------------------------------------------------------

function AddAccessModal({ onSave, onClose }: {
  onSave: (item: Partial<AccessItem>) => void
  onClose: () => void
}) {
  const [type, setType] = useState<AccessType>('portal')
  const [serviceName, setServiceName] = useState('')
  const [category, setCategory] = useState<AccessCategory>('annuity')
  const [productType, setProductType] = useState('')
  const [portalUrl, setPortalUrl] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!serviceName.trim()) return
    setSaving(true)
    try {
      await onSave({
        type,
        service_name: serviceName.trim(),
        category,
        product_type: productType.trim() || undefined,
        portal_url: portalUrl.trim() || undefined,
      })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">Add Access Item</h3>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]">
            <span className="material-icons-outlined text-[20px]">close</span>
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Type</label>
            <div className="flex gap-2">
              {(['portal', 'api'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  className={`rounded-md px-4 py-2 text-sm font-medium border transition-all ${type === t ? 'border-[var(--portal)] text-[var(--portal)] bg-[var(--portal)]/10' : 'border-[var(--border)] text-[var(--text-secondary)]'}`}
                >
                  {t === 'portal' ? 'Portal' : 'API'}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Service Name</label>
            <input
              type="text"
              value={serviceName}
              onChange={(e) => setServiceName(e.target.value)}
              placeholder="e.g. Athene Annuity"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--portal)]"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Category</label>
            <div className="flex flex-wrap gap-1.5">
              {(['medicare', 'annuity', 'life', 'investment', 'financial', 'government', 'other'] as const).map((c) => (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize border transition-all ${category === c ? 'border-[var(--portal)] text-[var(--portal)] bg-[var(--portal)]/10' : 'border-[var(--border)] text-[var(--text-secondary)]'}`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Product Type</label>
            <input
              type="text"
              value={productType}
              onChange={(e) => setProductType(e.target.value)}
              placeholder="e.g. FIA, MYGA, MAPD"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--portal)]"
            />
          </div>
          {type === 'portal' && (
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Portal URL</label>
              <input
                type="url"
                value={portalUrl}
                onChange={(e) => setPortalUrl(e.target.value)}
                placeholder="https://..."
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--portal)]"
              />
            </div>
          )}
        </div>
        <div className="mt-6 flex items-center justify-end gap-2">
          <button onClick={onClose} className="rounded-md h-[34px] px-4 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!serviceName.trim() || saving}
            className="inline-flex items-center gap-1.5 rounded-md h-[34px] px-4 text-sm font-medium bg-[var(--portal)] text-white transition-all hover:brightness-110 disabled:opacity-50"
          >
            {saving ? (
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <span className="material-icons-outlined text-[14px]">add</span>
            )}
            Add
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Summary Stats
// ---------------------------------------------------------------------------

function SummaryBar({ items }: { items: AccessItem[] }) {
  const stats = useMemo(() => {
    const active = items.filter((i) => i.status === 'active').length
    const pending = items.filter((i) => i.status === 'pending').length
    const expired = items.filter((i) => i.status === 'expired').length
    const notStarted = items.filter((i) => i.status === 'not_started').length
    return { active, pending, expired, notStarted, total: items.length }
  }, [items])

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <StatCard label="Active" value={stats.active} className="text-green-500" icon="check_circle" />
      <StatCard label="Pending" value={stats.pending} className="text-yellow-500" icon="schedule" />
      <StatCard label="Expired" value={stats.expired} className="text-red-500" icon="error" />
      <StatCard label="Not Started" value={stats.notStarted} className="text-[var(--text-muted)]" icon="radio_button_unchecked" />
    </div>
  )
}

function StatCard({ label, value, className, icon }: { label: string; value: number; className: string; icon: string }) {
  return (
    <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4">
      <div className="flex items-center gap-2">
        <span className={`material-icons-outlined text-[20px] ${className}`}>{icon}</span>
        <p className="text-xs text-[var(--text-muted)]">{label}</p>
      </div>
      <p className={`mt-1 text-2xl font-bold ${className}`}>{value}</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// OAuth Integrations (TRK-056 — stub for Sprint 10)
// ---------------------------------------------------------------------------

const OAUTH_SERVICES = [
  {
    name: 'SSA',
    fullName: 'Social Security Administration',
    description: 'Access client benefit statements, earnings records, and SSA correspondence.',
    icon: 'account_balance',
    status: 'not_connected' as const,
  },
  {
    name: 'CMS Medicare',
    fullName: 'Centers for Medicare & Medicaid Services',
    description: 'Pull enrollment data, plan details, and coverage history from CMS.',
    icon: 'health_and_safety',
    status: 'not_connected' as const,
  },
  {
    name: 'DST Vision',
    fullName: 'DST Vision Data Aggregator',
    description: 'Aggregate directly held mutual fund and variable annuity account data.',
    icon: 'insights',
    status: 'not_connected' as const,
  },
]

function OAuthIntegrations() {
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const handleConnect = (serviceName: string) => {
    setToastMessage(`OAuth integration for ${serviceName} coming soon`)
    setTimeout(() => setToastMessage(null), 3000)
  }

  return (
    <div className="space-y-3">
      {toastMessage && (
        <div className="flex items-center gap-2 rounded-lg border border-[var(--portal)] bg-[var(--portal)]/10 px-4 py-3 text-sm text-[var(--portal)]">
          <span className="material-icons-outlined text-[18px]">info</span>
          {toastMessage}
        </div>
      )}
      {OAUTH_SERVICES.map((service) => (
        <div
          key={service.name}
          className="flex items-center justify-between rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-5 py-4"
        >
          <div className="flex items-center gap-3">
            <span
              className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--bg-surface)]"
            >
              <span className="material-icons-outlined text-[22px] text-[var(--text-muted)]">
                {service.icon}
              </span>
            </span>
            <div>
              <h4 className="text-sm font-semibold text-[var(--text-primary)]">{service.name}</h4>
              <p className="text-xs text-[var(--text-muted)]">{service.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--bg-surface)] px-2.5 py-1 text-[10px] font-medium text-[var(--text-muted)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--text-muted)]" />
              Not Connected
            </span>
            <button
              onClick={() => handleConnect(service.name)}
              className="inline-flex items-center gap-1.5 rounded-md h-[34px] px-4 text-sm font-medium border border-[var(--border)] text-[var(--text-secondary)] transition-all hover:border-[var(--portal)] hover:text-[var(--portal)]"
            >
              <span className="material-icons-outlined text-[14px]">link</span>
              Connect
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Access Center Content
// ---------------------------------------------------------------------------

function AccessCenterContent() {
  const searchParams = useSearchParams()
  const urlClientId = searchParams.get('clientId')

  const [clientId, setClientId] = useState<string | null>(urlClientId)
  const [clientName, setClientName] = useState<string>('')
  const [activeTab, setActiveTab] = useState<'apis' | 'portals' | 'integrations'>('portals')
  const [items, setItems] = useState<AccessItem[]>([])
  const [loading, setLoading] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [autoGenerating, setAutoGenerating] = useState(false)

  // Fetch access items when clientId changes
  const fetchItems = useCallback(async (cid: string) => {
    setLoading(true)
    try {
      const json = await apiFetch<AccessItem[]>(`/api/access/${cid}`)
      if (json.success && json.data) {
        setItems(Array.isArray(json.data) ? json.data : [])
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (clientId) {
      fetchItems(clientId)
    }
  }, [clientId, fetchItems])

  // If no client selected, show client search
  if (!clientId) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <ClientSearch onSelect={(id, name) => { setClientId(id); setClientName(name) }} />
      </div>
    )
  }

  const apiItems = items.filter((i) => i.type === 'api')
  const portalItems = items.filter((i) => i.type === 'portal')

  const pendingCount = items.filter(
    (i) => i.status === 'pending' || i.status === 'expired' || i.status === 'not_started'
  ).length

  // Handlers
  const handleVerify = async (accessId: string) => {
    await apiFetch(`/api/access/${clientId}/${accessId}`, {
      method: 'PUT',
      body: JSON.stringify({
        status: 'active',
        last_verified: new Date().toISOString(),
      }),
    })
    await fetchItems(clientId)
  }

  const handleUpdateCredentials = async (accessId: string, username: string, notes: string) => {
    await apiFetch(`/api/access/${clientId}/${accessId}`, {
      method: 'PUT',
      body: JSON.stringify({ username, notes }),
    })
    await fetchItems(clientId)
  }

  const handleAuthCycle = async (accessId: string, newStatus: string) => {
    await apiFetch(`/api/access/${clientId}/${accessId}`, {
      method: 'PUT',
      body: JSON.stringify({ auth_status: newStatus }),
    })
    await fetchItems(clientId)
  }

  const handleAutoGenerate = async () => {
    setAutoGenerating(true)
    try {
      await apiFetch(`/api/access/${clientId}/auto-generate`, { method: 'POST' })
      await fetchItems(clientId)
    } finally {
      setAutoGenerating(false)
    }
  }

  const handleAddAccess = async (partial: Partial<AccessItem>) => {
    await apiFetch(`/api/access/${clientId}`, {
      method: 'POST',
      body: JSON.stringify(partial),
    })
    await fetchItems(clientId)
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href={urlClientId ? `/contacts/${clientId}` : '/service-centers'}
              className="text-[var(--text-muted)] hover:text-[var(--portal)] transition-colors"
            >
              <span className="material-icons-outlined text-[20px]">arrow_back</span>
            </Link>
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">Access Center</h1>
            {pendingCount > 0 && (
              <span className="rounded-full bg-amber-500 px-2.5 py-0.5 text-xs font-semibold text-white">
                {pendingCount} need attention
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            {clientName ? (
              <>Access items for <span className="font-medium text-[var(--text-secondary)]">{clientName}</span></>
            ) : (
              <>Showing access items for client <span className="font-mono text-[var(--text-secondary)]">{clientId}</span></>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleAutoGenerate}
            disabled={autoGenerating}
            className="inline-flex items-center gap-1.5 rounded-md h-[36px] px-4 text-sm font-medium border border-[var(--border)] text-[var(--text-secondary)] transition-all hover:border-[var(--portal)] hover:text-[var(--portal)] disabled:opacity-50"
          >
            {autoGenerating ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--portal)] border-t-transparent" />
            ) : (
              <span className="material-icons-outlined text-[16px]">auto_awesome</span>
            )}
            Auto-Generate
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-1.5 rounded-md h-[36px] px-4 text-sm font-medium bg-[var(--portal)] text-white transition-all hover:brightness-110"
          >
            <span className="material-icons-outlined text-[16px]">add</span>
            Add Access
          </button>
        </div>
      </div>

      {/* Loading */}
      {loading ? (
        <div className="flex flex-col items-center gap-3 py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--portal)] border-t-transparent" />
          <p className="text-sm text-[var(--text-muted)]">Loading access items...</p>
        </div>
      ) : (
        <>
          {/* Summary */}
          <SummaryBar items={items} />

          {/* Tabs */}
          <div className="flex gap-1 border-b border-[var(--border)]">
            {(
              [
                { key: 'portals' as const, label: 'Portals', icon: 'vpn_key', count: portalItems.length },
                { key: 'apis' as const, label: 'APIs', icon: 'api', count: apiItems.length },
                { key: 'integrations' as const, label: 'Integrations', icon: 'cable', count: undefined },
              ]
            ).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`inline-flex items-center gap-1.5 rounded-t-md px-4 py-2.5 text-sm font-medium transition-all border-b-2 -mb-px ${
                  activeTab === tab.key
                    ? 'border-[var(--portal)] text-[var(--portal)]'
                    : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                }`}
              >
                <span className="material-icons-outlined text-[16px]">{tab.icon}</span>
                {tab.label}
                {tab.count !== undefined && (
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                    activeTab === tab.key
                      ? 'bg-[var(--portal)]/15 text-[var(--portal)]'
                      : 'bg-[var(--bg-surface)] text-[var(--text-muted)]'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Tab content */}
          {activeTab === 'apis' && (
            <ApiAccessTable
              items={apiItems}
              onVerify={handleVerify}
              onAuthCycle={handleAuthCycle}
            />
          )}

          {activeTab === 'portals' && (
            <PortalAccessTable
              items={portalItems}
              onVerify={handleVerify}
              onUpdateCredentials={handleUpdateCredentials}
              onAuthCycle={handleAuthCycle}
            />
          )}

          {activeTab === 'integrations' && (
            <OAuthIntegrations />
          )}
        </>
      )}

      {/* Add Access Modal */}
      {showAddModal && (
        <AddAccessModal
          onSave={handleAddAccess}
          onClose={() => setShowAddModal(false)}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page export with Suspense (required for useSearchParams)
// ---------------------------------------------------------------------------

export default function AccessCenterPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-6xl py-20 flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--portal)] border-t-transparent" />
          <p className="text-sm text-[var(--text-muted)]">Loading Access Center...</p>
        </div>
      }
    >
      <AccessCenterContent />
    </Suspense>
  )
}
