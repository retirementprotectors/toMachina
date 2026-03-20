'use client'

import { useState, useMemo, useEffect, useCallback, Suspense } from 'react'
import { getAuth } from 'firebase/auth'
import type { AccessItem } from '@tomachina/core'
import { ApiAccessTable } from '../../../../service-centers/access/components/ApiAccessTable'
import { PortalAccessTable } from '../../../../service-centers/access/components/PortalAccessTable'

// ---------------------------------------------------------------------------
// API Helper
// ---------------------------------------------------------------------------

async function apiFetch<T>(path: string, options?: RequestInit): Promise<{ success: boolean; data?: T; error?: string }> {
  const auth = getAuth()
  const token = await auth.currentUser?.getIdToken()
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
// AccessTab — renders Access Center scoped to a client, inline in Client360
// ---------------------------------------------------------------------------

interface AccessTabProps {
  clientId: string
}

function AccessTabContent({ clientId }: AccessTabProps) {
  const [activeTab, setActiveTab] = useState<'apis' | 'portals'>('portals')
  const [items, setItems] = useState<AccessItem[]>([])
  const [loading, setLoading] = useState(true)
  const [autoGenerating, setAutoGenerating] = useState(false)

  const fetchItems = useCallback(async () => {
    setLoading(true)
    try {
      const json = await apiFetch<AccessItem[]>(`/api/access/${clientId}`)
      if (json.success && json.data) {
        setItems(Array.isArray(json.data) ? json.data : [])
      }
    } finally {
      setLoading(false)
    }
  }, [clientId])

  useEffect(() => {
    fetchItems()
  }, [fetchItems])

  const apiItems = items.filter((i) => i.type === 'api')
  const portalItems = items.filter((i) => i.type === 'portal')

  const stats = useMemo(() => {
    const active = items.filter((i) => i.status === 'active').length
    const pending = items.filter((i) => i.status === 'pending').length
    const expired = items.filter((i) => i.status === 'expired').length
    const notStarted = items.filter((i) => i.status === 'not_started').length
    return { active, pending, expired, notStarted }
  }, [items])

  const handleVerify = async (accessId: string) => {
    await apiFetch(`/api/access/${clientId}/${accessId}`, {
      method: 'PUT',
      body: JSON.stringify({
        status: 'active',
        last_verified: new Date().toISOString(),
      }),
    })
    await fetchItems()
  }

  const handleUpdateCredentials = async (accessId: string, username: string, notes: string) => {
    await apiFetch(`/api/access/${clientId}/${accessId}`, {
      method: 'PUT',
      body: JSON.stringify({ username, notes }),
    })
    await fetchItems()
  }

  const handleAuthCycle = async (accessId: string, newStatus: string) => {
    await apiFetch(`/api/access/${clientId}/${accessId}`, {
      method: 'PUT',
      body: JSON.stringify({ auth_status: newStatus }),
    })
    await fetchItems()
  }

  const handleAutoGenerate = async () => {
    setAutoGenerating(true)
    try {
      await apiFetch(`/api/access/${clientId}/auto-generate`, { method: 'POST' })
      await fetchItems()
    } finally {
      setAutoGenerating(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--portal)] border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Auto-Generate button + Summary chips */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-3">
          <StatChip label="Active" value={stats.active} color="text-green-500" icon="check_circle" />
          <StatChip label="Pending" value={stats.pending} color="text-yellow-500" icon="schedule" />
          <StatChip label="Expired" value={stats.expired} color="text-red-500" icon="error" />
          <StatChip label="Not Started" value={stats.notStarted} color="text-[var(--text-muted)]" icon="radio_button_unchecked" />
        </div>
        <button
          onClick={handleAutoGenerate}
          disabled={autoGenerating}
          className="inline-flex items-center gap-1.5 rounded-md h-[34px] px-3 text-xs font-medium border border-[var(--border)] text-[var(--text-secondary)] transition-all hover:border-[var(--portal)] hover:text-[var(--portal)] disabled:opacity-50"
        >
          {autoGenerating ? (
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-[var(--portal)] border-t-transparent" />
          ) : (
            <span className="material-icons-outlined text-[14px]">auto_awesome</span>
          )}
          Auto-Generate from Accounts
        </button>
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
