'use client'

import { useState, useEffect, useCallback } from 'react'
import { fetchWithAuth } from './fetchWithAuth'

/* ═══ Types ═══ */

interface ApiRouteInfo {
  file: string
  endpoints: number
  operations: string[]
  collections: string[]
  frontend_consumers: string[]
  status: 'full_stack' | 'backend_only'
}

interface CloudFunctionInfo {
  name: string
  type: 'http' | 'scheduled' | 'firestore_trigger' | 'unknown'
  schedule?: string
  region: string
  memory: string
  timeout: number
  source_file: string
  description: string
}

interface EnvVarInfo {
  name: string
  services: string[]
  has_value: boolean
  source: string
  sensitive: boolean
}

interface HookifyRuleInfo {
  name: string
  enabled: boolean
  event: string
  action: string
  tier: 'block' | 'warn' | 'intent' | 'quality_gate' | 'unknown'
  description: string
}

interface ScanStats {
  route_files: number
  ui_files: number
  portal_pages: number
  collections_found: number
  api_routes_found: number
  cloud_functions_found: number
  env_vars_found: number
  hookify_rules_found: number
  scanned_at: string
}

interface PlatformStatus {
  api_routes: Record<string, ApiRouteInfo>
  cloud_functions: CloudFunctionInfo[]
  env_vars: EnvVarInfo[]
  hookify_rules: HookifyRuleInfo[]
  scan_stats: ScanStats
}

type PlatformView = 'api-routes' | 'cloud-functions' | 'env-vars' | 'hookify'

/* ═══ Constants ═══ */

const s = {
  bg: 'var(--bg, #0f1219)',
  surface: 'var(--bg-surface, #1c2333)',
  card: 'var(--bg-card, #161d2d)',
  border: 'var(--border-color, #2a3347)',
  text: 'var(--text-primary, #e2e8f0)',
  textSecondary: 'var(--text-secondary, #94a3b8)',
  textMuted: 'var(--text-muted, #64748b)',
  portal: 'var(--portal, #4a7ab5)',
}

const VIEW_TABS: Array<{ key: PlatformView; label: string; icon: string }> = [
  { key: 'api-routes', label: 'API Routes', icon: 'api' },
  { key: 'cloud-functions', label: 'Cloud Functions', icon: 'cloud' },
  { key: 'env-vars', label: 'Environment', icon: 'vpn_key' },
  { key: 'hookify', label: 'Hookify Rules', icon: 'security' },
]

const TIER_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  block: { label: 'Block', color: 'rgb(239,68,68)', bg: 'rgba(239,68,68,0.12)' },
  warn: { label: 'Warn', color: 'rgb(245,158,11)', bg: 'rgba(245,158,11,0.12)' },
  intent: { label: 'Intent', color: 'rgb(99,102,241)', bg: 'rgba(99,102,241,0.12)' },
  quality_gate: { label: 'Gate', color: 'rgb(168,85,247)', bg: 'rgba(168,85,247,0.12)' },
  unknown: { label: '?', color: '#64748b', bg: 'rgba(100,116,139,0.12)' },
}

const FN_TYPE_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  scheduled: { label: 'Scheduled', color: 'rgb(99,102,241)', bg: 'rgba(99,102,241,0.12)', icon: 'schedule' },
  http: { label: 'HTTP', color: 'rgb(34,197,94)', bg: 'rgba(34,197,94,0.12)', icon: 'http' },
  firestore_trigger: { label: 'Trigger', color: 'rgb(245,158,11)', bg: 'rgba(245,158,11,0.12)', icon: 'bolt' },
  unknown: { label: 'Unknown', color: '#64748b', bg: 'rgba(100,116,139,0.12)', icon: 'help' },
}

/* ═══ Component ═══ */

interface PlatformAdminProps { portal: string }

export function PlatformAdmin({ portal }: PlatformAdminProps) {
  const [view, setView] = useState<PlatformView>('api-routes')
  const [data, setData] = useState<PlatformStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [routeFilter, setRouteFilter] = useState<'all' | 'wired' | 'orphaned'>('all')
  const [envFilter, setEnvFilter] = useState<'all' | 'secrets' | 'empty' | 'set'>('all')
  const [fnFilter, setFnFilter] = useState<'all' | 'scheduled' | 'http' | 'firestore_trigger'>('all')
  const [hookifyFilter, setHookifyFilter] = useState<string>('')

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetchWithAuth('/api/firestore-config/platform-status')
      const json = await res.json()
      if (json.success) setData(json.data)
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-12 rounded-xl bg-[var(--bg-surface)]" />
        {[1, 2, 3, 4].map(i => <div key={i} className="h-16 rounded-xl bg-[var(--bg-surface)]" />)}
      </div>
    )
  }

  if (!data) return <div className="text-center py-12 text-[var(--text-muted)]">Failed to load platform status</div>

  const routes = Object.values(data.api_routes)
  const wiredRoutes = routes.filter(r => r.status === 'full_stack')
  const orphanedRoutes = routes.filter(r => r.status === 'backend_only')

  return (
    <div className="space-y-5">
      {/* Scan Stats Bar */}
      {data.scan_stats && (
        <div className="flex items-center gap-5 flex-wrap text-[11px]" style={{ color: s.textMuted }}>
          <span className="material-icons-outlined" style={{ fontSize: '14px', color: s.portal }}>radar</span>
          <span><strong style={{ color: s.textSecondary }}>{data.scan_stats.api_routes_found}</strong> routes</span>
          <span><strong style={{ color: s.textSecondary }}>{data.scan_stats.cloud_functions_found}</strong> functions</span>
          <span><strong style={{ color: s.textSecondary }}>{data.scan_stats.env_vars_found}</strong> env vars</span>
          <span><strong style={{ color: s.textSecondary }}>{data.scan_stats.hookify_rules_found}</strong> hookify rules</span>
          {data.scan_stats.scanned_at && <span>Scanned: {new Date(data.scan_stats.scanned_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>}
        </div>
      )}

      {/* View Tabs */}
      <div className="flex gap-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-1.5 overflow-x-auto">
        {VIEW_TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setView(tab.key)}
            className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              view === tab.key ? 'text-white' : 'text-[var(--text-muted)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-secondary)]'
            }`}
            style={view === tab.key ? { background: s.portal } : undefined}
          >
            <span className="material-icons-outlined" style={{ fontSize: '16px' }}>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ═══ API Routes View ═══ */}
      {view === 'api-routes' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold" style={{ color: s.textSecondary }}>{routes.length} routes</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: 'rgba(34,197,94,0.12)', color: 'rgb(34,197,94)' }}>{wiredRoutes.length} wired</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: 'rgba(239,68,68,0.12)', color: 'rgb(239,68,68)' }}>{orphanedRoutes.length} orphaned</span>
            </div>
            <div className="flex gap-1">
              {(['all', 'wired', 'orphaned'] as const).map(f => (
                <button key={f} onClick={() => setRouteFilter(f)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${routeFilter === f ? 'text-white' : 'text-[var(--text-muted)] hover:bg-[var(--bg-surface)]'}`}
                  style={routeFilter === f ? { background: s.portal } : undefined}>
                  {f === 'all' ? 'All' : f === 'wired' ? 'Wired' : 'Orphaned'}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl border overflow-hidden" style={{ borderColor: s.border }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: s.surface }}>
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 10, fontWeight: 600, color: s.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Route File</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center', fontSize: 10, fontWeight: 600, color: s.textMuted, textTransform: 'uppercase' }}>Endpoints</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 10, fontWeight: 600, color: s.textMuted, textTransform: 'uppercase' }}>Operations</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 10, fontWeight: 600, color: s.textMuted, textTransform: 'uppercase' }}>Collections</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 10, fontWeight: 600, color: s.textMuted, textTransform: 'uppercase' }}>Frontend Consumers</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center', fontSize: 10, fontWeight: 600, color: s.textMuted, textTransform: 'uppercase' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {routes
                  .filter(r => routeFilter === 'all' || (routeFilter === 'wired' ? r.status === 'full_stack' : r.status === 'backend_only'))
                  .sort((a, b) => (a.status === b.status ? a.file.localeCompare(b.file) : a.status === 'full_stack' ? -1 : 1))
                  .map(route => (
                  <tr key={route.file} style={{ borderBottom: `1px solid ${s.border}` }}
                    onMouseEnter={e => { e.currentTarget.style.background = s.surface }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
                    <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: 12, fontWeight: 500 }}>{route.file}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'center', fontSize: 12, fontWeight: 600 }}>{route.endpoints}</td>
                    <td style={{ padding: '8px 12px' }}>
                      <div className="flex gap-1 flex-wrap">
                        {route.operations.map(op => (
                          <span key={op} className="text-[9px] px-1.5 py-0.5 rounded font-medium" style={{ background: s.surface, color: s.textSecondary }}>{op}</span>
                        ))}
                      </div>
                    </td>
                    <td style={{ padding: '8px 12px', fontSize: 11, color: s.textMuted, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {route.collections.slice(0, 3).join(', ')}{route.collections.length > 3 ? ` +${route.collections.length - 3}` : ''}
                    </td>
                    <td style={{ padding: '8px 12px' }}>
                      {route.frontend_consumers.length > 0 ? (
                        <div className="flex gap-1 flex-wrap">
                          {route.frontend_consumers.slice(0, 2).map(c => (
                            <span key={c} className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ background: 'rgba(34,197,94,0.08)', color: 'rgb(34,197,94)' }}>{c}</span>
                          ))}
                          {route.frontend_consumers.length > 2 && <span className="text-[10px]" style={{ color: s.textMuted }}>+{route.frontend_consumers.length - 2}</span>}
                        </div>
                      ) : (
                        <span className="text-[10px]" style={{ color: s.textMuted }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{
                        background: route.status === 'full_stack' ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
                        color: route.status === 'full_stack' ? 'rgb(34,197,94)' : 'rgb(239,68,68)',
                      }}>{route.status === 'full_stack' ? 'Wired' : 'Orphaned'}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══ Cloud Functions View ═══ */}
      {view === 'cloud-functions' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold" style={{ color: s.textSecondary }}>{data.cloud_functions.length} functions</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ ...FN_TYPE_CONFIG.scheduled }}>{data.cloud_functions.filter(f => f.type === 'scheduled').length} scheduled</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ ...FN_TYPE_CONFIG.http }}>{data.cloud_functions.filter(f => f.type === 'http').length} HTTP</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ ...FN_TYPE_CONFIG.firestore_trigger }}>{data.cloud_functions.filter(f => f.type === 'firestore_trigger').length} triggers</span>
            </div>
            <div className="flex gap-1">
              {(['all', 'scheduled', 'http', 'firestore_trigger'] as const).map(f => (
                <button key={f} onClick={() => setFnFilter(f)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${fnFilter === f ? 'text-white' : 'text-[var(--text-muted)] hover:bg-[var(--bg-surface)]'}`}
                  style={fnFilter === f ? { background: s.portal } : undefined}>
                  {f === 'all' ? 'All' : f === 'firestore_trigger' ? 'Triggers' : f === 'http' ? 'HTTP' : 'Scheduled'}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {data.cloud_functions.filter(fn => fnFilter === 'all' || fn.type === fnFilter).map(fn => {
              const cfg = FN_TYPE_CONFIG[fn.type] || FN_TYPE_CONFIG.unknown
              return (
                <div key={fn.name} className="rounded-xl border p-4 space-y-2" style={{ borderColor: s.border, background: s.card }}>
                  <div className="flex items-center gap-2">
                    <span className="material-icons-outlined" style={{ fontSize: '16px', color: cfg.color }}>{cfg.icon}</span>
                    <span className="text-sm font-semibold" style={{ color: s.text }}>{fn.name}</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded font-medium ml-auto" style={{ background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
                  </div>
                  <div className="flex items-center gap-4 flex-wrap text-[11px]" style={{ color: s.textMuted }}>
                    {fn.schedule && <span className="flex items-center gap-1"><span className="material-icons-outlined" style={{ fontSize: '12px' }}>schedule</span>{fn.schedule}</span>}
                    <span>{fn.memory}</span>
                    <span>{fn.timeout}s timeout</span>
                    <span className="font-mono">{fn.source_file}</span>
                  </div>
                  {fn.description && <p className="text-[11px]" style={{ color: s.textSecondary }}>{fn.description}</p>}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ═══ Environment Variables View ═══ */}
      {view === 'env-vars' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold" style={{ color: s.textSecondary }}>{data.env_vars.length} variables</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: 'rgba(239,68,68,0.12)', color: 'rgb(239,68,68)' }}>{data.env_vars.filter(v => v.sensitive).length} secrets</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: 'rgba(245,158,11,0.12)', color: 'rgb(245,158,11)' }}>{data.env_vars.filter(v => !v.has_value).length} empty</span>
            </div>
            <div className="flex gap-1">
              {(['all', 'secrets', 'empty', 'set'] as const).map(f => (
                <button key={f} onClick={() => setEnvFilter(f)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${envFilter === f ? 'text-white' : 'text-[var(--text-muted)] hover:bg-[var(--bg-surface)]'}`}
                  style={envFilter === f ? { background: s.portal } : undefined}>
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl border overflow-hidden" style={{ borderColor: s.border }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: s.surface }}>
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 10, fontWeight: 600, color: s.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Variable</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 10, fontWeight: 600, color: s.textMuted, textTransform: 'uppercase' }}>Services</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 10, fontWeight: 600, color: s.textMuted, textTransform: 'uppercase' }}>Source</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center', fontSize: 10, fontWeight: 600, color: s.textMuted, textTransform: 'uppercase' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.env_vars
                  .filter(v => {
                    if (envFilter === 'secrets') return v.sensitive
                    if (envFilter === 'empty') return !v.has_value && !v.sensitive
                    if (envFilter === 'set') return v.has_value && !v.sensitive
                    return true
                  })
                  .map(ev => (
                  <tr key={ev.name} style={{ borderBottom: `1px solid ${s.border}` }}
                    onMouseEnter={e => { e.currentTarget.style.background = s.surface }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
                    <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: 12, fontWeight: 500 }}>{ev.name}</td>
                    <td style={{ padding: '8px 12px' }}>
                      <div className="flex gap-1 flex-wrap">
                        {ev.services.map(svc => (
                          <span key={svc} className="text-[9px] px-1.5 py-0.5 rounded font-medium" style={{ background: s.surface, color: s.textSecondary }}>{svc}</span>
                        ))}
                      </div>
                    </td>
                    <td style={{ padding: '8px 12px', fontSize: 11, color: s.textMuted }}>{ev.source.replace(/_/g, ' ')}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                      {ev.sensitive ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: 'rgba(239,68,68,0.12)', color: 'rgb(239,68,68)' }}>Secret</span>
                      ) : ev.has_value ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: 'rgba(34,197,94,0.12)', color: 'rgb(34,197,94)' }}>Set</span>
                      ) : (
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: 'rgba(245,158,11,0.12)', color: 'rgb(245,158,11)' }}>Empty</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══ Hookify Rules View ═══ */}
      {view === 'hookify' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold" style={{ color: s.textSecondary }}>{data.hookify_rules.length} rules</span>
              {Object.entries(TIER_CONFIG).filter(([k]) => k !== 'unknown').map(([tier, cfg]) => {
                const count = data.hookify_rules.filter(r => r.tier === tier).length
                if (count === 0) return null
                return <span key={tier} className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: cfg.bg, color: cfg.color }}>{count} {cfg.label}</span>
              })}
            </div>
            <div className="flex gap-1">
              {['', 'block', 'warn', 'intent', 'quality_gate'].map(f => (
                <button key={f} onClick={() => setHookifyFilter(f)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${hookifyFilter === f ? 'text-white' : 'text-[var(--text-muted)] hover:bg-[var(--bg-surface)]'}`}
                  style={hookifyFilter === f ? { background: s.portal } : undefined}>
                  {f === '' ? 'All' : TIER_CONFIG[f]?.label || f}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            {data.hookify_rules
              .filter(r => !hookifyFilter || r.tier === hookifyFilter)
              .map(rule => {
                const cfg = TIER_CONFIG[rule.tier] || TIER_CONFIG.unknown
                return (
                  <div key={rule.name} className="flex items-center gap-3 rounded-lg border px-4 py-3 transition-colors hover:bg-[var(--bg-surface)]" style={{ borderColor: s.border }}>
                    <span className="material-icons-outlined" style={{ fontSize: '16px', color: rule.enabled ? cfg.color : s.textMuted }}>
                      {rule.tier === 'block' ? 'block' : rule.tier === 'warn' ? 'warning' : rule.tier === 'intent' ? 'psychology' : rule.tier === 'quality_gate' ? 'verified' : 'rule'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate" style={{ color: rule.enabled ? s.text : s.textMuted }}>{rule.name}</span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded font-medium" style={{ background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
                        {!rule.enabled && <span className="text-[9px] px-1.5 py-0.5 rounded font-medium" style={{ background: 'rgba(239,68,68,0.12)', color: 'rgb(239,68,68)' }}>OFF</span>}
                      </div>
                      {rule.description && <p className="text-[11px] truncate" style={{ color: s.textMuted }}>{rule.description}</p>}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] shrink-0" style={{ color: s.textMuted }}>
                      <span className="px-1.5 py-0.5 rounded" style={{ background: s.surface }}>{rule.event}</span>
                      <span className="px-1.5 py-0.5 rounded" style={{ background: s.surface }}>{rule.action}</span>
                    </div>
                  </div>
                )
              })}
          </div>
        </div>
      )}
    </div>
  )
}
