'use client'

import { useState } from 'react'
import { fetchWithAuth } from './fetchWithAuth'

/**
 * ACF Audit Admin — Admin page for bulk ACF audit and rebuild.
 * Run Audit → see results → select clients → execute rebuild.
 */

interface ACFAuditAdminProps {
  portal: string
}

interface AuditResult {
  total_clients: number
  with_acf: number
  missing_acf: number
  broken_links: number
  incomplete_acf: number
  orphaned_acfs: number
  clients_missing_acf: string[]
  clients_broken: string[]
  clients_incomplete: string[]
}

interface RebuildResult {
  processed: number
  created: number
  fixed: number
  skipped: number
  errors: Array<{ client_id: string; error: string }>
}

type AuditTab = 'missing' | 'broken' | 'incomplete'

export function ACFAuditAdmin({ portal }: ACFAuditAdminProps) {
  const [audit, setAudit] = useState<AuditResult | null>(null)
  const [auditing, setAuditing] = useState(false)
  const [rebuilding, setRebuilding] = useState(false)
  const [rebuildResult, setRebuildResult] = useState<RebuildResult | null>(null)
  const [activeTab, setActiveTab] = useState<AuditTab>('missing')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [mode, setMode] = useState<'create_missing' | 'fix_broken' | 'full_rebuild'>('create_missing')
  const [dryRun, setDryRun] = useState(true)

  const runAudit = async () => {
    setAuditing(true)
    setAudit(null)
    setRebuildResult(null)
    setSelectedIds(new Set())
    try {
      const res = await fetchWithAuth('/api/acf/audit', { method: 'POST' })
      const json = await res.json()
      if (json.success) setAudit(json.data)
    } catch {
      // Silently fail
    } finally {
      setAuditing(false)
    }
  }

  const runRebuild = async () => {
    if (selectedIds.size === 0) return
    setRebuilding(true)
    setRebuildResult(null)
    try {
      const res = await fetchWithAuth('/api/acf/rebuild', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_ids: Array.from(selectedIds),
          mode,
          dry_run: dryRun,
        }),
      })
      const json = await res.json()
      if (json.success) setRebuildResult(json.data)
    } catch {
      // Silently fail
    } finally {
      setRebuilding(false)
    }
  }

  const getTabClients = (): string[] => {
    if (!audit) return []
    switch (activeTab) {
      case 'missing':
        return audit.clients_missing_acf
      case 'broken':
        return audit.clients_broken
      case 'incomplete':
        return audit.clients_incomplete
    }
  }

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedIds(next)
  }

  const selectAll = () => {
    const ids = getTabClients()
    setSelectedIds(new Set(ids))
  }

  const deselectAll = () => {
    setSelectedIds(new Set())
  }

  const tabClients = getTabClients()

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-[var(--text-primary)]">ACF Audit & Rebuild</h3>
          <p className="text-xs text-[var(--text-muted)]">Find and fix missing, broken, or incomplete Active Client Files</p>
        </div>
        <button
          onClick={runAudit}
          disabled={auditing}
          className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors hover:brightness-110 disabled:opacity-50"
          style={{ background: 'var(--portal)' }}
        >
          <span className="material-icons-outlined" style={{ fontSize: '16px' }}>
            {auditing ? 'hourglass_top' : 'fact_check'}
          </span>
          {auditing ? 'Auditing...' : 'Run Audit'}
        </button>
      </div>

      {/* Audit summary */}
      {audit && (
        <div className="grid grid-cols-5 gap-3">
          {[
            { label: 'Total Clients', value: audit.total_clients, icon: 'people', color: 'text-[var(--text-primary)]' },
            { label: 'With ACF', value: audit.with_acf, icon: 'check_circle', color: 'text-emerald-500' },
            { label: 'Missing ACF', value: audit.missing_acf, icon: 'cancel', color: 'text-red-400' },
            { label: 'Broken Links', value: audit.broken_links, icon: 'link_off', color: 'text-amber-500' },
            { label: 'Incomplete', value: audit.incomplete_acf, icon: 'warning', color: 'text-amber-500' },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-3 text-center">
              <span className={`material-icons-outlined ${s.color}`} style={{ fontSize: '20px' }}>{s.icon}</span>
              <div className="mt-1 text-lg font-bold text-[var(--text-primary)]">{s.value}</div>
              <div className="text-xs text-[var(--text-muted)]">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Result tabs */}
      {audit && (
        <>
          <div className="flex gap-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-1.5">
            {([
              { key: 'missing' as AuditTab, label: `Missing (${audit.missing_acf})`, icon: 'cancel' },
              { key: 'broken' as AuditTab, label: `Broken (${audit.broken_links})`, icon: 'link_off' },
              { key: 'incomplete' as AuditTab, label: `Incomplete (${audit.incomplete_acf})`, icon: 'warning' },
            ]).map((tab) => (
              <button
                key={tab.key}
                onClick={() => { setActiveTab(tab.key); setSelectedIds(new Set()) }}
                className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  activeTab === tab.key
                    ? 'text-white'
                    : 'text-[var(--text-muted)] hover:bg-[var(--bg-surface)]'
                }`}
                style={activeTab === tab.key ? { background: 'var(--portal)' } : undefined}
              >
                <span className="material-icons-outlined" style={{ fontSize: '16px' }}>{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>

          {/* Client list */}
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] overflow-hidden">
            {tabClients.length === 0 ? (
              <div className="p-6 text-center text-sm text-[var(--text-muted)]">
                No clients in this category
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)]">
                  <div className="flex items-center gap-3">
                    <button onClick={selectAll} className="text-xs text-[var(--portal)] hover:underline">
                      Select All
                    </button>
                    <button onClick={deselectAll} className="text-xs text-[var(--text-muted)] hover:underline">
                      Deselect All
                    </button>
                    <span className="text-xs text-[var(--text-muted)]">
                      {selectedIds.size} selected
                    </span>
                  </div>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {tabClients.map((id) => (
                    <label
                      key={id}
                      className="flex items-center gap-3 px-4 py-2 text-sm cursor-pointer hover:bg-[var(--bg-surface)] border-b border-[var(--border-subtle)] last:border-b-0"
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.has(id)}
                        onChange={() => toggleSelect(id)}
                        className="rounded border-[var(--border-subtle)]"
                      />
                      <span className="font-mono text-xs text-[var(--text-secondary)]">{id}</span>
                    </label>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Rebuild controls */}
          {selectedIds.size > 0 && (
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 space-y-3">
              <h4 className="text-sm font-medium text-[var(--text-secondary)]">Rebuild Options</h4>
              <div className="flex items-center gap-4">
                <select
                  value={mode}
                  onChange={(e) => setMode(e.target.value as typeof mode)}
                  className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none"
                >
                  <option value="create_missing">Create Missing</option>
                  <option value="fix_broken">Fix Broken</option>
                  <option value="full_rebuild">Full Rebuild</option>
                </select>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={dryRun}
                    onChange={(e) => setDryRun(e.target.checked)}
                    className="rounded border-[var(--border-subtle)]"
                  />
                  <span className="text-sm text-[var(--text-secondary)]">Dry Run</span>
                </label>
                <button
                  onClick={runRebuild}
                  disabled={rebuilding}
                  className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors hover:brightness-110 disabled:opacity-50"
                  style={{ background: 'var(--portal)' }}
                >
                  <span className="material-icons-outlined" style={{ fontSize: '16px' }}>
                    {rebuilding ? 'hourglass_top' : 'build'}
                  </span>
                  {rebuilding ? 'Rebuilding...' : `Rebuild ${selectedIds.size} client(s)`}
                </button>
              </div>
            </div>
          )}

          {/* Rebuild results */}
          {rebuildResult && (
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 space-y-2">
              <h4 className="text-sm font-medium text-[var(--text-secondary)]">
                Rebuild Results {dryRun && <span className="text-amber-500">(Dry Run)</span>}
              </h4>
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: 'Processed', value: rebuildResult.processed },
                  { label: 'Created', value: rebuildResult.created },
                  { label: 'Fixed', value: rebuildResult.fixed },
                  { label: 'Skipped', value: rebuildResult.skipped },
                ].map((s) => (
                  <div key={s.label} className="text-center rounded-lg bg-[var(--bg-surface)] p-2">
                    <div className="text-lg font-bold text-[var(--text-primary)]">{s.value}</div>
                    <div className="text-xs text-[var(--text-muted)]">{s.label}</div>
                  </div>
                ))}
              </div>
              {rebuildResult.errors.length > 0 && (
                <div className="mt-2 rounded-lg bg-red-950/20 border border-red-800/30 p-3">
                  <h5 className="text-xs font-medium text-red-400 mb-1">Errors ({rebuildResult.errors.length})</h5>
                  {rebuildResult.errors.map((e, i) => (
                    <div key={i} className="text-xs text-red-300">
                      <span className="font-mono">{e.client_id}</span>: {e.error}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
