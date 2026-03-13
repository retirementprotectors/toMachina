'use client'

import { useState, useMemo, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ApiAccessTable } from './components/ApiAccessTable'
import { PortalAccessTable } from './components/PortalAccessTable'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AccessStatus = 'connected' | 'pending' | 'expired' | 'not_started'
type AccessType = 'api' | 'portal'
type AccessCategory = 'medicare' | 'annuity' | 'life' | 'investment' | 'government' | 'other'

interface AccessItem {
  access_id: string
  client_id: string
  type: AccessType
  service_name: string
  category: AccessCategory
  status: AccessStatus
  portal_url?: string
  username?: string
  last_verified?: string
  last_login?: string
  notes?: string
  created_at: string
  updated_at: string
}

// ---------------------------------------------------------------------------
// Static seed data (UI shell — Firestore integration can come later)
// ---------------------------------------------------------------------------

const SEED_DATA: AccessItem[] = [
  // APIs
  {
    access_id: 'api-001',
    client_id: 'demo',
    type: 'api',
    service_name: 'Medicare.gov',
    category: 'medicare',
    status: 'connected',
    last_verified: '2026-01-15',
    notes: 'Part A & B lookup — verified via CMS API',
    created_at: '2025-01-01',
    updated_at: '2026-01-15',
  },
  {
    access_id: 'api-002',
    client_id: 'demo',
    type: 'api',
    service_name: 'Social Security',
    category: 'government',
    status: 'pending',
    last_verified: undefined,
    notes: 'SSA.gov — awaiting authorization from client',
    created_at: '2025-01-01',
    updated_at: '2025-06-01',
  },
  {
    access_id: 'api-003',
    client_id: 'demo',
    type: 'api',
    service_name: 'State Insurance Commissioner',
    category: 'government',
    status: 'not_started',
    last_verified: undefined,
    notes: undefined,
    created_at: '2025-01-01',
    updated_at: '2025-01-01',
  },
  // Portals
  {
    access_id: 'portal-001',
    client_id: 'demo',
    type: 'portal',
    service_name: 'Athene Annuity',
    category: 'annuity',
    status: 'connected',
    portal_url: 'https://www.athene.com/annuity-owners',
    username: 'jsmith@email.com',
    last_verified: '2026-02-01',
    last_login: '2026-02-28',
    notes: 'Phone 2FA on file',
    created_at: '2025-01-01',
    updated_at: '2026-02-28',
  },
  {
    access_id: 'portal-002',
    client_id: 'demo',
    type: 'portal',
    service_name: 'American Equity',
    category: 'annuity',
    status: 'expired',
    portal_url: 'https://www.american-equity.com',
    username: 'jsmith1943',
    last_verified: '2025-08-10',
    last_login: '2025-08-10',
    notes: 'Password expired — client needs to reset',
    created_at: '2025-01-01',
    updated_at: '2025-08-10',
  },
  {
    access_id: 'portal-003',
    client_id: 'demo',
    type: 'portal',
    service_name: 'Nationwide Life',
    category: 'life',
    status: 'connected',
    portal_url: 'https://www.nationwide.com',
    username: 'john.smith.43',
    last_verified: '2026-01-20',
    last_login: '2026-03-01',
    notes: undefined,
    created_at: '2025-01-01',
    updated_at: '2026-03-01',
  },
  {
    access_id: 'portal-004',
    client_id: 'demo',
    type: 'portal',
    service_name: 'Humana Medicare',
    category: 'medicare',
    status: 'pending',
    portal_url: 'https://www.humana.com/login',
    username: undefined,
    last_verified: undefined,
    last_login: undefined,
    notes: 'Waiting for enrollment confirmation',
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
  },
  {
    access_id: 'portal-005',
    client_id: 'demo',
    type: 'portal',
    service_name: 'Schwab Advisor Services',
    category: 'investment',
    status: 'connected',
    portal_url: 'https://www.schwab.com',
    username: 'jsmith@retire.com',
    last_verified: '2026-02-15',
    last_login: '2026-03-10',
    notes: 'RIA account — tied to Gradient',
    created_at: '2025-06-01',
    updated_at: '2026-03-10',
  },
  {
    access_id: 'portal-006',
    client_id: 'demo',
    type: 'portal',
    service_name: 'RBC Clearing',
    category: 'investment',
    status: 'not_started',
    portal_url: 'https://www.rbccm.com',
    username: undefined,
    last_verified: undefined,
    last_login: undefined,
    notes: 'BD account — pending setup',
    created_at: '2025-06-01',
    updated_at: '2025-06-01',
  },
]

// ---------------------------------------------------------------------------
// Summary Stats
// ---------------------------------------------------------------------------

function SummaryBar({ items }: { items: AccessItem[] }) {
  const stats = useMemo(() => {
    const connected = items.filter((i) => i.status === 'connected').length
    const pending = items.filter((i) => i.status === 'pending').length
    const expired = items.filter((i) => i.status === 'expired').length
    const notStarted = items.filter((i) => i.status === 'not_started').length
    return { connected, pending, expired, notStarted, total: items.length }
  }, [items])

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <StatCard label="Connected" value={stats.connected} className="text-green-500" icon="check_circle" />
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
// Main Access Center Content
// ---------------------------------------------------------------------------

function AccessCenterContent() {
  const searchParams = useSearchParams()
  const clientId = searchParams.get('clientId')

  const [activeTab, setActiveTab] = useState<'apis' | 'portals'>('portals')
  const [items, setItems] = useState<AccessItem[]>(SEED_DATA)

  // If clientId provided, scope to that client; otherwise show all
  const displayItems = clientId
    ? items.filter((i) => i.client_id === clientId || i.client_id === 'demo')
    : items

  const apiItems = displayItems.filter((i) => i.type === 'api')
  const portalItems = displayItems.filter((i) => i.type === 'portal')

  const pendingCount = displayItems.filter(
    (i) => i.status === 'pending' || i.status === 'expired' || i.status === 'not_started'
  ).length

  const handleVerify = async (accessId: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.access_id === accessId
          ? { ...item, status: 'connected' as AccessStatus, last_verified: new Date().toISOString(), updated_at: new Date().toISOString() }
          : item
      )
    )
  }

  const handleUpdateCredentials = (accessId: string, username: string, notes: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.access_id === accessId
          ? { ...item, username, notes, updated_at: new Date().toISOString() }
          : item
      )
    )
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href={clientId ? `/contacts/${clientId}` : '/service-centers'}
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
          {clientId ? (
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Showing access items for client <span className="font-mono text-[var(--text-secondary)]">{clientId}</span>
            </p>
          ) : (
            <p className="mt-1 text-sm text-[var(--text-muted)]">All client portal and API access status</p>
          )}
        </div>
      </div>

      {/* Summary */}
      <SummaryBar items={displayItems} />

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[var(--border)]">
        {(
          [
            { key: 'portals', label: 'Portals', icon: 'vpn_key', count: portalItems.length },
            { key: 'apis', label: 'APIs', icon: 'api', count: apiItems.length },
          ] as const
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
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
              activeTab === tab.key
                ? 'bg-[var(--portal)]/15 text-[var(--portal)]'
                : 'bg-[var(--bg-surface)] text-[var(--text-muted)]'
            }`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'apis' && (
        <ApiAccessTable
          items={apiItems}
          onVerify={handleVerify}
        />
      )}

      {activeTab === 'portals' && (
        <PortalAccessTable
          items={portalItems}
          onVerify={handleVerify}
          onUpdateCredentials={handleUpdateCredentials}
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
