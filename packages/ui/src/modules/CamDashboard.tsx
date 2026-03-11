'use client'

import { useMemo, useState } from 'react'
import { query, collection, where, type Query, type DocumentData } from 'firebase/firestore'
import { useAuth, buildEntitlementContext } from '@tomachina/auth'
import { useCollection } from '@tomachina/db'
import { getDb } from '@tomachina/db/src/firestore'
import { calculateFYC, calculateRenewal, calculateNPV } from '@tomachina/core'

// ============================================================================
// Types
// ============================================================================

interface CamDashboardProps {
  portal: string
}

interface RevenueRecord {
  _id: string
  revenue_id?: string
  agent_id?: string
  agent_name?: string
  writing_agent?: string
  carrier_name?: string
  carrier?: string
  product_type?: string
  commission_type?: string
  revenue_type?: string
  amount?: number
  commission_amount?: number
  revenue_amount?: number
  premium?: number
  total_premium?: number
  period?: string
  status?: string
  policy_status?: string
  source?: string
  created_at?: string
  payment_date?: string
  policy_number?: string
}

interface CompGridRecord {
  _id: string
  grid_id?: string
  carrier_id?: string
  carrier_name?: string
  product_type?: string
  product_name?: string
  rate?: number
  rate_type?: string
  effective_date?: string
  notes?: string
}

interface DiscrepancyRecord {
  _id: string
  discrepancy_id?: string
  revenue_id?: string
  agent_id?: string
  carrier?: string
  product_type?: string
  period?: string
  actual_amount?: number
  calculated_amount?: number
  difference?: number
  status?: string
  created_at?: string
}

type TabKey = 'overview' | 'carriers' | 'agents' | 'comp-grids' | 'projections' | 'reconciliation' | 'pipeline'

// ============================================================================
// Helpers
// ============================================================================

function fmt(num: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(num)
}

function parseAmt(r: RevenueRecord): number {
  const raw = r.amount ?? r.commission_amount ?? r.revenue_amount ?? r.total_premium ?? r.premium ?? 0
  const num = typeof raw === 'number' ? raw : parseFloat(String(raw).replace(/[$,\s]/g, ''))
  return isNaN(num) ? 0 : num
}

function str(val: unknown): string {
  return val == null ? '' : String(val)
}

function pctStr(n: number, d: number): string {
  return d > 0 ? `${((n / d) * 100).toFixed(1)}%` : '0%'
}

function rateDisplay(rate: number | undefined, rateType: string | undefined): string {
  if (rate == null) return '-'
  if (rateType === 'flat') return fmt(rate)
  return `${(rate * 100).toFixed(1)}%`
}

function rateColor(rate: number | undefined, rateType: string | undefined): string {
  if (rate == null) return 'var(--text-muted)'
  const normalized = rateType === 'flat' ? Math.min(rate / 1000, 1) : Math.min(rate, 1)
  if (normalized > 0.5) return 'var(--success)'
  if (normalized > 0.2) return 'var(--portal)'
  return 'var(--text-secondary)'
}

// ============================================================================
// Sub-components
// ============================================================================

function StatCard({ label, value, sub, icon, accent }: { label: string; value: string; sub?: string; icon: string; accent: string }) {
  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ backgroundColor: `${accent}20` }}>
          <span className="material-icons-outlined" style={{ color: accent, fontSize: '20px' }}>{icon}</span>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">{label}</p>
          <p className="text-2xl font-bold text-[var(--text-primary)]">{value}</p>
          {sub && <p className="text-xs text-[var(--text-muted)]">{sub}</p>}
        </div>
      </div>
    </div>
  )
}

function BarRow({ label, value, pct, sub }: { label: string; value: string; pct: number; sub?: string }) {
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <div className="truncate">
          <span className="text-[var(--text-secondary)]">{label}</span>
          {sub && <span className="ml-1.5 text-xs text-[var(--text-muted)]">{sub}</span>}
        </div>
        <span className="ml-2 whitespace-nowrap font-medium text-[var(--text-primary)]">{value}</span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[var(--bg-surface)]">
        <div className="h-full rounded-full transition-all" style={{ width: `${Math.max(2, pct * 100)}%`, backgroundColor: 'var(--portal)' }} />
      </div>
    </div>
  )
}

function TabButton({ active, label, onClick, badge }: { active: boolean; label: string; onClick: () => void; badge?: number }) {
  return (
    <div className="relative">
      <button
        onClick={onClick}
        className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
          active ? 'bg-[var(--portal)] text-white' : 'text-[var(--text-muted)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-secondary)]'
        }`}
      >
        {label}
      </button>
      {badge != null && badge > 0 && (
        <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--error)] px-1 text-[9px] font-bold text-white">
          {badge}
        </span>
      )}
    </div>
  )
}

function EmptyState({ icon, message }: { icon: string; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] py-16">
      <span className="material-icons-outlined text-4xl text-[var(--text-muted)]">{icon}</span>
      <p className="mt-3 text-sm text-[var(--text-muted)]">{message}</p>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = { open: 'var(--warning)', accepted: 'var(--success)', adjusted: 'var(--portal)', disputed: 'var(--error)' }
  const color = colors[status] || 'var(--text-muted)'
  return (
    <span className="inline-block rounded-full px-2 py-0.5 text-[10px] font-medium uppercase" style={{ backgroundColor: `${color}20`, color }}>{status}</span>
  )
}

// ============================================================================
// Main Component
// ============================================================================

export function CamDashboard({ portal }: CamDashboardProps) {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<TabKey>('overview')
  const [selectedCarrier, setSelectedCarrier] = useState<string | null>(null)
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null)
  const [gridFilter, setGridFilter] = useState<string>('all')
  const [projVolume, setProjVolume] = useState('10')
  const [projPremium, setProjPremium] = useState('5000')
  const [projProduct, setProjProduct] = useState('MAPD')
  const [projCarrier, setProjCarrier] = useState('')

  const entitlementCtx = useMemo(() => buildEntitlementContext(user), [user])

  // ─── Queries ───
  const revenueQ = useMemo<Query<DocumentData>>(() => query(collection(getDb(), 'revenue')), [])
  const compGridQ = useMemo<Query<DocumentData> | null>(() => {
    try { return query(collection(getDb(), 'comp_grids')) } catch { return null }
  }, [])
  const discrepancyQ = useMemo<Query<DocumentData> | null>(() => {
    try { return query(collection(getDb(), 'commission_discrepancies'), where('status', '==', 'open')) } catch { return null }
  }, [])

  const { data: revenue, loading: revLoading, error: revError } = useCollection<RevenueRecord>(revenueQ, 'cam-revenue')
  const { data: compGrids, loading: cgLoading } = useCollection<CompGridRecord>(compGridQ, 'cam-comp-grids')
  const { data: discrepancies } = useCollection<DiscrepancyRecord>(discrepancyQ, 'cam-discrepancies')

  // ─── Aggregations ───
  const stats = useMemo(() => {
    if (revLoading) return null
    let totalAmount = 0
    const byCarrier: Record<string, { total: number; fyc: number; renewal: number; count: number }> = {}
    const byAgent: Record<string, { total: number; count: number; name: string }> = {}
    const byType: Record<string, number> = {}
    const byPeriod: Record<string, number> = {}
    const byMonth: Record<number, number> = {}
    for (let m = 1; m <= 12; m++) byMonth[m] = 0
    let prevMonthTotal = 0, currMonthTotal = 0
    const now = new Date()
    const currMK = now.toISOString().slice(0, 7)
    const prevMK = new Date(now.getFullYear(), now.getMonth() - 1).toISOString().slice(0, 7)

    revenue.forEach((r) => {
      const amount = parseAmt(r)
      totalAmount += amount
      const carrier = str(r.carrier_name || r.carrier) || 'Unknown'
      if (!byCarrier[carrier]) byCarrier[carrier] = { total: 0, fyc: 0, renewal: 0, count: 0 }
      byCarrier[carrier].total += amount
      byCarrier[carrier].count += 1
      const rt = str(r.revenue_type || r.commission_type).toLowerCase()
      if (rt.includes('fyc') || rt.includes('first')) byCarrier[carrier].fyc += amount
      else if (rt.includes('renewal') || rt.includes('ren')) byCarrier[carrier].renewal += amount

      const ak = str(r.agent_id) || 'unknown'
      if (!byAgent[ak]) byAgent[ak] = { total: 0, count: 0, name: str(r.agent_name || r.writing_agent) || ak }
      byAgent[ak].total += amount
      byAgent[ak].count += 1

      const type = str(r.revenue_type || r.commission_type || r.product_type) || 'Other'
      byType[type] = (byType[type] || 0) + amount
      const period = str(r.period) || 'Unknown'
      byPeriod[period] = (byPeriod[period] || 0) + amount
      const ds = str(r.created_at || r.payment_date)
      const mo = parseInt(ds.slice(5, 7))
      if (mo >= 1 && mo <= 12) byMonth[mo] += amount
      const mk = ds.slice(0, 7)
      if (mk === currMK) currMonthTotal += amount
      else if (mk === prevMK) prevMonthTotal += amount
    })
    return { totalAmount, totalRecords: revenue.length, carrierCount: Object.keys(byCarrier).length, agentCount: Object.keys(byAgent).length, byCarrier, byAgent, byType, byPeriod, byMonth, currMonthTotal, prevMonthTotal }
  }, [revenue, revLoading])

  const topCarriers = useMemo(() => stats ? Object.entries(stats.byCarrier).sort((a, b) => b[1].total - a[1].total) : [], [stats])
  const topAgents = useMemo(() => stats ? Object.entries(stats.byAgent).sort((a, b) => b[1].total - a[1].total) : [], [stats])
  const byType = useMemo(() => stats ? Object.entries(stats.byType).sort((a, b) => b[1] - a[1]) : [], [stats])

  const gridsByProduct = useMemo(() => {
    const grouped: Record<string, CompGridRecord[]> = {}
    compGrids.forEach((cg) => { const pt = cg.product_type || 'Unknown'; if (!grouped[pt]) grouped[pt] = []; grouped[pt].push(cg) })
    return grouped
  }, [compGrids])

  const projResult = useMemo(() => {
    const vol = parseInt(projVolume) || 0
    const prem = parseFloat(projPremium) || 0
    const fyc = calculateFYC(prem * vol, 0.05)
    const years = [1, 2, 3, 4, 5].map((y) => ({ year: y, renewal: calculateRenewal(prem * vol, 0.02, y) }))
    const totalStream = fyc + years.reduce((s, y) => s + y.renewal, 0)
    const npv = calculateNPV([fyc, ...years.map((y) => y.renewal)], 0.08)
    return { fyc, years, totalStream, npv }
  }, [projVolume, projPremium])

  const sparkData = useMemo(() => stats ? Object.entries(stats.byMonth).sort(([a], [b]) => parseInt(a) - parseInt(b)).map(([, v]) => v) : [], [stats])
  const sparkMax = Math.max(...sparkData, 1)

  // ─── Loading / Error / Empty ───
  if (revLoading) {
    return (
      <div className="mx-auto max-w-6xl animate-pulse space-y-4">
        <div className="h-8 w-48 rounded bg-[var(--bg-surface)]" />
        <div className="grid gap-4 sm:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 rounded-xl bg-[var(--bg-card)]" />)}</div>
      </div>
    )
  }
  if (revError) {
    return (
      <div className="mx-auto max-w-6xl">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">CAM</h1>
        <div className="mt-6 rounded-xl border border-[var(--error)] bg-[rgba(239,68,68,0.05)] p-6 text-sm text-[var(--text-secondary)]">Failed to load revenue data: {revError.message}</div>
      </div>
    )
  }
  if (!stats || stats.totalRecords === 0) {
    return (
      <div className="mx-auto max-w-6xl">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">CAM</h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">Commission Accounting Machine</p>
        <div className="mt-6"><EmptyState icon="payments" message="No revenue data available." /></div>
      </div>
    )
  }

  const monthDelta = stats.prevMonthTotal > 0 ? ((stats.currMonthTotal - stats.prevMonthTotal) / stats.prevMonthTotal * 100).toFixed(1) : null

  const tabs: { key: TabKey; label: string; badge?: number }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'carriers', label: 'Carriers' },
    { key: 'agents', label: 'Agents' },
    { key: 'comp-grids', label: 'Comp Grids' },
    { key: 'projections', label: 'Projections' },
    { key: 'reconciliation', label: 'Reconciliation', badge: discrepancies.length },
    { key: 'pipeline', label: 'Pipeline' },
  ]

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">CAM</h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">Commission Accounting Machine — Revenue intelligence</p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Revenue" value={fmt(stats.totalAmount)} sub={monthDelta ? `${parseFloat(monthDelta) >= 0 ? '+' : ''}${monthDelta}% vs last month` : undefined} icon="payments" accent="#10b981" />
        <StatCard label="This Month" value={fmt(stats.currMonthTotal)} icon="today" accent="#3b82f6" />
        <StatCard label="Carriers" value={stats.carrierCount.toString()} icon="business" accent="#a78bfa" />
        <StatCard label="Agents" value={stats.agentCount.toString()} icon="groups" accent="#f59e0b" />
      </div>

      {/* Sparkline */}
      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4">
        <p className="mb-2 text-xs uppercase tracking-wider text-[var(--text-muted)]">Revenue Trend (12 months)</p>
        <div className="flex h-12 items-end gap-1">
          {sparkData.map((val, i) => (
            <div key={i} className="flex-1 rounded-t transition-all" style={{ height: `${Math.max(4, (val / sparkMax) * 100)}%`, backgroundColor: 'var(--portal)', opacity: 0.6 + (i / 12) * 0.4 }} title={`Month ${i + 1}: ${fmt(val)}`} />
          ))}
        </div>
        <div className="mt-1 flex justify-between text-[10px] text-[var(--text-muted)]">
          <span>Jan</span><span>Feb</span><span>Mar</span><span>Apr</span><span>May</span><span>Jun</span>
          <span>Jul</span><span>Aug</span><span>Sep</span><span>Oct</span><span>Nov</span><span>Dec</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-1.5">
        {tabs.map((t) => <TabButton key={t.key} active={activeTab === t.key} label={t.label} onClick={() => setActiveTab(t.key)} badge={t.badge} />)}
      </div>

      {/* ═══ TAB 1: OVERVIEW ═══ */}
      {activeTab === 'overview' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">Top 5 Carriers</h3>
            <div className="space-y-2.5">
              {topCarriers.slice(0, 5).map(([name, data]) => (
                <BarRow key={name} label={name} value={fmt(data.total)} pct={data.total / (topCarriers[0]?.[1].total || 1)} sub={`${data.count} records`} />
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">Top 5 Agents</h3>
            <div className="space-y-2.5">
              {topAgents.slice(0, 5).map(([key, data]) => (
                <BarRow key={key} label={data.name} value={fmt(data.total)} pct={data.total / (topAgents[0]?.[1].total || 1)} sub={`${data.count} records`} />
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 lg:col-span-2">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">Revenue by Type</h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {byType.map(([type, amount]) => (
                <div key={type} className="flex items-center justify-between rounded-lg bg-[var(--bg-surface)] px-4 py-3">
                  <span className="text-sm text-[var(--text-secondary)]">{type}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[var(--text-muted)]">{pctStr(amount, stats.totalAmount)}</span>
                    <span className="text-sm font-semibold text-[var(--text-primary)]">{fmt(amount)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ═══ TAB 2: CARRIERS ═══ */}
      {activeTab === 'carriers' && (
        <div className="flex gap-4">
          <div className={`rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 ${selectedCarrier ? 'w-1/2' : 'flex-1'}`}>
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">All Carriers ({topCarriers.length})</h3>
            <div className="max-h-[500px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-[var(--border-subtle)] text-left text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
                  <th className="pb-2 pr-3">#</th><th className="pb-2 pr-3">Carrier</th><th className="pb-2 pr-3 text-right">Total</th><th className="pb-2 pr-3 text-right">FYC</th><th className="pb-2 text-right">Renewal</th>
                </tr></thead>
                <tbody>
                  {topCarriers.map(([name, data], i) => (
                    <tr key={name} className={`cursor-pointer border-b border-[var(--border-subtle)] transition-colors hover:bg-[var(--bg-hover)] ${selectedCarrier === name ? 'bg-[var(--portal-glow)]' : ''}`} onClick={() => setSelectedCarrier(selectedCarrier === name ? null : name)}>
                      <td className="py-2 pr-3 text-xs text-[var(--text-muted)]">{i + 1}</td>
                      <td className="py-2 pr-3 font-medium text-[var(--text-primary)]">{name}</td>
                      <td className="py-2 pr-3 text-right text-[var(--text-primary)]">{fmt(data.total)}</td>
                      <td className="py-2 pr-3 text-right text-[var(--text-secondary)]">{fmt(data.fyc)}</td>
                      <td className="py-2 text-right text-[var(--text-secondary)]">{fmt(data.renewal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          {selectedCarrier && stats.byCarrier[selectedCarrier] && (
            <div className="w-1/2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-[var(--text-primary)]">{selectedCarrier}</h3>
                <button onClick={() => setSelectedCarrier(null)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                  <span className="material-icons-outlined" style={{ fontSize: '18px' }}>close</span>
                </button>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-[var(--bg-surface)] p-3"><p className="text-xs text-[var(--text-muted)]">Total Revenue</p><p className="text-lg font-bold text-[var(--text-primary)]">{fmt(stats.byCarrier[selectedCarrier].total)}</p></div>
                <div className="rounded-lg bg-[var(--bg-surface)] p-3"><p className="text-xs text-[var(--text-muted)]">Policies</p><p className="text-lg font-bold text-[var(--text-primary)]">{stats.byCarrier[selectedCarrier].count}</p></div>
                <div className="rounded-lg bg-[var(--bg-surface)] p-3"><p className="text-xs text-[var(--text-muted)]">FYC Revenue</p><p className="text-lg font-bold text-[var(--text-primary)]">{fmt(stats.byCarrier[selectedCarrier].fyc)}</p></div>
                <div className="rounded-lg bg-[var(--bg-surface)] p-3"><p className="text-xs text-[var(--text-muted)]">Renewal Revenue</p><p className="text-lg font-bold text-[var(--text-primary)]">{fmt(stats.byCarrier[selectedCarrier].renewal)}</p></div>
              </div>
              <div className="mt-4"><p className="text-xs text-[var(--text-muted)]">Revenue Share</p>
                <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-[var(--bg-surface)]"><div className="h-full rounded-full" style={{ width: `${(stats.byCarrier[selectedCarrier].total / stats.totalAmount) * 100}%`, backgroundColor: 'var(--portal)' }} /></div>
                <p className="mt-1 text-xs text-[var(--text-muted)]">{pctStr(stats.byCarrier[selectedCarrier].total, stats.totalAmount)} of total</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ TAB 3: AGENTS ═══ */}
      {activeTab === 'agents' && (
        <div className="flex gap-4">
          <div className={`rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 ${selectedAgent ? 'w-1/2' : 'flex-1'}`}>
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">All Agents ({topAgents.length})</h3>
            <div className="max-h-[500px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-[var(--border-subtle)] text-left text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
                  <th className="pb-2 pr-3">#</th><th className="pb-2 pr-3">Agent</th><th className="pb-2 pr-3 text-right">Revenue</th><th className="pb-2 text-right">Policies</th>
                </tr></thead>
                <tbody>
                  {topAgents.map(([key, data], i) => (
                    <tr key={key} className={`cursor-pointer border-b border-[var(--border-subtle)] transition-colors hover:bg-[var(--bg-hover)] ${selectedAgent === key ? 'bg-[var(--portal-glow)]' : ''}`} onClick={() => setSelectedAgent(selectedAgent === key ? null : key)}>
                      <td className="py-2 pr-3 text-xs text-[var(--text-muted)]">{i + 1}</td>
                      <td className="py-2 pr-3 font-medium text-[var(--text-primary)]">{data.name}</td>
                      <td className="py-2 pr-3 text-right text-[var(--text-primary)]">{fmt(data.total)}</td>
                      <td className="py-2 text-right text-[var(--text-secondary)]">{data.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          {selectedAgent && stats.byAgent[selectedAgent] && (
            <div className="w-1/2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-[var(--text-primary)]">{stats.byAgent[selectedAgent].name}</h3>
                <button onClick={() => setSelectedAgent(null)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"><span className="material-icons-outlined" style={{ fontSize: '18px' }}>close</span></button>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-[var(--bg-surface)] p-3"><p className="text-xs text-[var(--text-muted)]">Total Revenue</p><p className="text-lg font-bold text-[var(--text-primary)]">{fmt(stats.byAgent[selectedAgent].total)}</p></div>
                <div className="rounded-lg bg-[var(--bg-surface)] p-3"><p className="text-xs text-[var(--text-muted)]">Policies</p><p className="text-lg font-bold text-[var(--text-primary)]">{stats.byAgent[selectedAgent].count}</p></div>
              </div>
              <p className="mt-3 text-xs text-[var(--text-muted)]">Agent ID: {selectedAgent}</p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">Revenue share: {pctStr(stats.byAgent[selectedAgent].total, stats.totalAmount)}</p>
            </div>
          )}
        </div>
      )}

      {/* ═══ TAB 4: COMP GRIDS ═══ */}
      {activeTab === 'comp-grids' && (
        <div className="space-y-4">
          <div className="flex gap-2">
            {['all', ...Object.keys(gridsByProduct)].map((pt) => (
              <button key={pt} onClick={() => setGridFilter(pt)} className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${gridFilter === pt ? 'bg-[var(--portal)] text-white' : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'}`}>{pt === 'all' ? 'All Types' : pt}</button>
            ))}
          </div>
          {cgLoading ? (
            <div className="flex items-center justify-center py-12"><div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--portal)] border-t-transparent" /></div>
          ) : compGrids.length === 0 ? (
            <EmptyState icon="grid_on" message="No comp grid data. Run: npx tsx scripts/load-comp-grids.ts" />
          ) : (
            Object.entries(gridsByProduct).filter(([pt]) => gridFilter === 'all' || pt === gridFilter).map(([productType, grids]) => (
              <div key={productType} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
                <h3 className="mb-3 text-sm font-semibold text-[var(--text-primary)]">{grids[0]?.product_name || productType}<span className="ml-2 text-xs font-normal text-[var(--text-muted)]">{grids.length} carriers</span></h3>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {grids.sort((a, b) => (b.rate || 0) - (a.rate || 0)).map((cg) => (
                    <div key={cg._id} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3">
                      <p className="text-sm font-medium text-[var(--text-primary)]">{cg.carrier_name || cg.carrier_id}</p>
                      <p className="mt-1 text-xl font-bold" style={{ color: rateColor(cg.rate, cg.rate_type) }}>{rateDisplay(cg.rate, cg.rate_type)}</p>
                      <p className="mt-0.5 text-[10px] text-[var(--text-muted)]">{cg.rate_type === 'flat' ? 'per enrollment' : 'of premium'} · eff. {cg.effective_date || 'N/A'}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ═══ TAB 5: PROJECTIONS ═══ */}
      {activeTab === 'projections' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">Commission Projection Calculator</h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div><label className="text-xs font-medium text-[var(--text-muted)]">Product Type</label>
                <select value={projProduct} onChange={(e) => setProjProduct(e.target.value)} className="mt-1 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--portal)]">
                  <option value="MAPD">Medicare Advantage</option><option value="MEDSUPP">Medicare Supplement</option><option value="LIFE">Life Insurance</option><option value="ANNUITY">Annuities</option><option value="PDP">Prescription Drug Plan</option>
                </select></div>
              <div><label className="text-xs font-medium text-[var(--text-muted)]">Carrier</label>
                <input type="text" value={projCarrier} onChange={(e) => setProjCarrier(e.target.value)} placeholder="e.g. Humana" className="mt-1 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--portal)]" /></div>
              <div><label className="text-xs font-medium text-[var(--text-muted)]">Volume (policies)</label>
                <input type="number" value={projVolume} onChange={(e) => setProjVolume(e.target.value)} className="mt-1 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--portal)]" /></div>
              <div><label className="text-xs font-medium text-[var(--text-muted)]">Premium per policy ($)</label>
                <input type="number" value={projPremium} onChange={(e) => setProjPremium(e.target.value)} className="mt-1 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--portal)]" /></div>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5"><p className="text-xs uppercase tracking-wider text-[var(--text-muted)]">FYC (Year 1)</p><p className="mt-1 text-2xl font-bold text-[var(--text-primary)]">{fmt(projResult.fyc)}</p><p className="mt-0.5 text-xs text-[var(--text-muted)]">5% FYC rate</p></div>
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5"><p className="text-xs uppercase tracking-wider text-[var(--text-muted)]">5-Year Total</p><p className="mt-1 text-2xl font-bold text-[var(--text-primary)]">{fmt(projResult.totalStream)}</p><p className="mt-0.5 text-xs text-[var(--text-muted)]">FYC + 5yr renewal at 2%</p></div>
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5"><p className="text-xs uppercase tracking-wider text-[var(--text-muted)]">NPV (8% discount)</p><p className="mt-1 text-2xl font-bold text-[var(--text-primary)]">{fmt(projResult.npv)}</p><p className="mt-0.5 text-xs text-[var(--text-muted)]">Present value</p></div>
          </div>
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">Year-by-Year</h3>
            <div className="flex items-end gap-3">
              <div className="flex-1"><p className="text-xs text-[var(--text-muted)]">FYC</p><div className="mt-1 rounded bg-[var(--portal)]" style={{ height: `${Math.max(8, (projResult.fyc / Math.max(projResult.fyc, 1)) * 80)}px` }} /><p className="mt-1 text-xs font-medium text-[var(--text-primary)]">{fmt(projResult.fyc)}</p></div>
              {projResult.years.map((y) => (
                <div key={y.year} className="flex-1"><p className="text-xs text-[var(--text-muted)]">Yr {y.year}</p><div className="mt-1 rounded bg-[var(--portal)]" style={{ height: `${Math.max(8, (y.renewal / Math.max(projResult.fyc, 1)) * 80)}px`, opacity: 0.7 }} /><p className="mt-1 text-xs font-medium text-[var(--text-primary)]">{fmt(y.renewal)}</p></div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ═══ TAB 6: RECONCILIATION ═══ */}
      {activeTab === 'reconciliation' && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">Commission Discrepancies ({discrepancies.length} open)</h3>
          {discrepancies.length === 0 ? (
            <EmptyState icon="check_circle" message="No open discrepancies. Run reconciliation via the API to check." />
          ) : (
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)]">
              <div className="max-h-[500px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-[var(--bg-card)]"><tr className="border-b border-[var(--border-subtle)] text-left text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
                    <th className="px-4 py-2">Status</th><th className="px-4 py-2">Agent</th><th className="px-4 py-2">Carrier</th><th className="px-4 py-2">Period</th><th className="px-4 py-2 text-right">Actual</th><th className="px-4 py-2 text-right">Calculated</th><th className="px-4 py-2 text-right">Diff</th>
                  </tr></thead>
                  <tbody>
                    {discrepancies.map((d) => (
                      <tr key={d._id} className="border-b border-[var(--border-subtle)] hover:bg-[var(--bg-hover)]">
                        <td className="px-4 py-2.5"><StatusBadge status={d.status || 'open'} /></td>
                        <td className="px-4 py-2.5 text-[var(--text-primary)]">{d.agent_id || '-'}</td>
                        <td className="px-4 py-2.5 text-[var(--text-secondary)]">{d.carrier || '-'}</td>
                        <td className="px-4 py-2.5 text-[var(--text-secondary)]">{d.period || '-'}</td>
                        <td className="px-4 py-2.5 text-right text-[var(--text-primary)]">{fmt(d.actual_amount || 0)}</td>
                        <td className="px-4 py-2.5 text-right text-[var(--text-secondary)]">{fmt(d.calculated_amount || 0)}</td>
                        <td className="px-4 py-2.5 text-right font-medium" style={{ color: 'var(--error)' }}>{fmt(d.difference || 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ TAB 7: PIPELINE ═══ */}
      {activeTab === 'pipeline' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">Pipeline Funnel</h3>
            <div className="flex gap-2">
              {[
                { label: 'Submitted', statuses: ['submitted', 'pending'], color: 'var(--warning)', prob: 0.3 },
                { label: 'Issued', statuses: ['issued'], color: 'var(--portal)', prob: 0.7 },
                { label: 'Active', statuses: ['active'], color: 'var(--success)', prob: 1.0 },
              ].map((stage) => {
                const stageRevenue = revenue.filter((r) => stage.statuses.includes(str(r.status || r.policy_status).toLowerCase()))
                const stageTotal = stageRevenue.reduce((s, r) => s + parseAmt(r), 0)
                return (
                  <div key={stage.label} className="flex-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 text-center">
                    <p className="text-xs uppercase tracking-wider text-[var(--text-muted)]">{stage.label}</p>
                    <p className="mt-2 text-xl font-bold text-[var(--text-primary)]">{fmt(stageTotal)}</p>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">{stageRevenue.length} records</p>
                    <div className="mx-auto mt-2 h-1 w-16 rounded-full" style={{ backgroundColor: stage.color }} />
                  </div>
                )
              })}
            </div>
          </div>
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">Revenue by Period</h3>
            {Object.keys(stats.byPeriod).length === 0 ? (
              <p className="text-sm text-[var(--text-muted)]">No period data.</p>
            ) : (
              <div className="space-y-2.5">
                {Object.entries(stats.byPeriod).sort(([a], [b]) => b.localeCompare(a)).slice(0, 12).map(([period, amount]) => (
                  <BarRow key={period} label={period} value={fmt(amount)} pct={amount / (Math.max(...Object.values(stats.byPeriod)) || 1)} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
