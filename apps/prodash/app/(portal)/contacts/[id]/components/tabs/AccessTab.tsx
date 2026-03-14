'use client'

import { useState, useMemo, Suspense } from 'react'
import { ApiAccessTable } from '../../../../service-centers/access/components/ApiAccessTable'
import { PortalAccessTable } from '../../../../service-centers/access/components/PortalAccessTable'

// ---------------------------------------------------------------------------
// Types (mirrored from Access Center page)
// ---------------------------------------------------------------------------

type AccessStatus = 'connected' | 'pending' | 'expired' | 'not_started'
type AccessType = 'api' | 'portal'
type AccessCategory = 'medicare' | 'annuity' | 'life' | 'investment' | 'government' | 'other'

interface AccessItem {
  access_id: string
  client_id: string
  type: AccessType
  service_name: string
  subcategory?: string
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
// Static seed data (same as Access Center — will be replaced with Firestore)
// ---------------------------------------------------------------------------

const SEED_DATA: AccessItem[] = [
  {
    access_id: 'api-001', client_id: 'demo', type: 'api',
    service_name: 'cms.gov', subcategory: 'Original Medicare', category: 'medicare', status: 'connected',
    last_verified: '2026-01-15', notes: 'Part A & B lookup — verified via CMS API',
    created_at: '2025-01-01', updated_at: '2026-01-15',
  },
  {
    access_id: 'api-002', client_id: 'demo', type: 'api',
    service_name: 'ssa.gov', subcategory: 'Social Security', category: 'government', status: 'pending',
    notes: 'SSA.gov — awaiting authorization from client',
    created_at: '2025-01-01', updated_at: '2025-06-01',
  },
  {
    access_id: 'portal-001', client_id: 'demo', type: 'portal',
    service_name: 'Athene Annuity', category: 'annuity', status: 'connected',
    portal_url: 'https://www.athene.com/annuity-owners', username: 'jsmith@email.com',
    last_verified: '2026-02-01', last_login: '2026-02-28', notes: 'Phone 2FA on file',
    created_at: '2025-01-01', updated_at: '2026-02-28',
  },
  {
    access_id: 'portal-002', client_id: 'demo', type: 'portal',
    service_name: 'American Equity', category: 'annuity', status: 'expired',
    portal_url: 'https://www.american-equity.com', username: 'jsmith1943',
    last_verified: '2025-08-10', last_login: '2025-08-10',
    notes: 'Password expired — client needs to reset',
    created_at: '2025-01-01', updated_at: '2025-08-10',
  },
  {
    access_id: 'portal-003', client_id: 'demo', type: 'portal',
    service_name: 'Nationwide Life', category: 'life', status: 'connected',
    portal_url: 'https://www.nationwide.com', username: 'john.smith.43',
    last_verified: '2026-01-20', last_login: '2026-03-01',
    created_at: '2025-01-01', updated_at: '2026-03-01',
  },
  {
    access_id: 'portal-004', client_id: 'demo', type: 'portal',
    service_name: 'Humana Medicare', category: 'medicare', status: 'pending',
    portal_url: 'https://www.humana.com/login',
    notes: 'Waiting for enrollment confirmation',
    created_at: '2026-01-01', updated_at: '2026-01-01',
  },
]

// ---------------------------------------------------------------------------
// AccessTab — renders Access Center scoped to a client, inline in Client360
// ---------------------------------------------------------------------------

interface AccessTabProps {
  clientId: string
}

function AccessTabContent({ clientId }: AccessTabProps) {
  const [activeTab, setActiveTab] = useState<'apis' | 'portals'>('portals')
  const [items, setItems] = useState<AccessItem[]>(SEED_DATA)

  const displayItems = items.filter((i) => i.client_id === clientId || i.client_id === 'demo')
  const apiItems = displayItems.filter((i) => i.type === 'api')
  const portalItems = displayItems.filter((i) => i.type === 'portal')

  const stats = useMemo(() => {
    const connected = displayItems.filter((i) => i.status === 'connected').length
    const pending = displayItems.filter((i) => i.status === 'pending').length
    const expired = displayItems.filter((i) => i.status === 'expired').length
    const notStarted = displayItems.filter((i) => i.status === 'not_started').length
    return { connected, pending, expired, notStarted }
  }, [displayItems])

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
    <div className="space-y-5">
      {/* Summary chips */}
      <div className="flex flex-wrap gap-3">
        <StatChip label="Connected" value={stats.connected} color="text-green-500" icon="check_circle" />
        <StatChip label="Pending" value={stats.pending} color="text-yellow-500" icon="schedule" />
        <StatChip label="Expired" value={stats.expired} color="text-red-500" icon="error" />
        <StatChip label="Not Started" value={stats.notStarted} color="text-[var(--text-muted)]" icon="radio_button_unchecked" />
      </div>

      {/* Sub-tabs: Portals / APIs */}
      <div className="flex gap-1 border-b border-[var(--border)]">
        {([
          { key: 'portals' as const, label: 'Portals', icon: 'vpn_key', count: portalItems.length },
          { key: 'apis' as const, label: 'APIs', icon: 'api', count: apiItems.length },
        ]).map((tab) => (
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

      {activeTab === 'apis' && (
        <ApiAccessTable items={apiItems} onVerify={handleVerify} />
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

function StatChip({ label, value, color, icon }: { label: string; value: number; color: string; icon: string }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 py-2">
      <span className={`material-icons-outlined text-[16px] ${color}`}>{icon}</span>
      <span className="text-xs text-[var(--text-muted)]">{label}</span>
      <span className={`text-sm font-bold ${color}`}>{value}</span>
    </div>
  )
}

export function AccessTab({ clientId }: AccessTabProps) {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--portal)] border-t-transparent" />
        </div>
      }
    >
      <AccessTabContent clientId={clientId} />
    </Suspense>
  )
}
