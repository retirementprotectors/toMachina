'use client'

import { useState, useEffect, useCallback } from 'react'
import type { VoltronLionDomain } from '@tomachina/core'

// ── Types ──────────────────────────────────────────────────────────────

interface ClientSearchResult {
  id: string
  display_name: string
  email?: string
}

interface WireOption {
  wire_id: string
  name: string
  domain: VoltronLionDomain
}

const DOMAIN_WIRES: WireOption[] = [
  { wire_id: 'AEP_ENROLLMENT', name: 'AEP Enrollment', domain: 'medicare' },
  { wire_id: 'ANNUAL_REVIEW', name: 'Annual Review', domain: 'general' },
  { wire_id: 'NEW_BUSINESS', name: 'New Business', domain: 'general' },
  { wire_id: 'ONBOARD_AGENCY', name: 'Onboard Agency', domain: 'general' },
  { wire_id: 'WIRE_INCOME_NOW', name: 'Income Now', domain: 'annuity' },
  { wire_id: 'WIRE_INCOME_LATER', name: 'Income Later', domain: 'annuity' },
  { wire_id: 'WIRE_GROWTH_MAX', name: 'Growth Max', domain: 'investment' },
  { wire_id: 'WIRE_TAX_HARVEST', name: 'Tax Harvest', domain: 'investment' },
  { wire_id: 'WIRE_ROTH_CONVERSION', name: 'Roth Conversion', domain: 'investment' },
  { wire_id: 'WIRE_ESTATE_MAX', name: 'Estate Max', domain: 'life-estate' },
  { wire_id: 'WIRE_LTC_MAX', name: 'LTC Max', domain: 'legacy-ltc' },
]

const LION_DOMAINS: { value: VoltronLionDomain | 'all'; label: string }[] = [
  { value: 'all', label: 'All Domains' },
  { value: 'medicare', label: 'Medicare' },
  { value: 'annuity', label: 'Annuity' },
  { value: 'investment', label: 'Investment' },
  { value: 'life-estate', label: 'Life & Estate' },
  { value: 'legacy-ltc', label: 'Legacy/LTC' },
  { value: 'general', label: 'General' },
]

const colors = {
  bg: '#0a0e17',
  bgHover: '#1a2236',
  border: '#1e293b',
  text: '#e2e8f0',
  textMuted: '#94a3b8',
  blue: '#3b82f6',
  blueGlow: 'rgba(59,130,246,0.15)',
  green: '#22c55e',
  red: '#ef4444',
  orange: '#f59e0b',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  background: colors.bg,
  border: `1px solid ${colors.border}`,
  borderRadius: 6,
  color: colors.text,
  fontSize: '0.85rem',
  outline: 'none',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.72rem',
  fontWeight: 700,
  textTransform: 'uppercase' as const,
  letterSpacing: '1px',
  color: colors.blue,
  marginBottom: 6,
}

// ── Component ──────────────────────────────────────────────────────────

export function RunWirePanel() {
  const [clientSearch, setClientSearch] = useState('')
  const [clientResults, setClientResults] = useState<ClientSearchResult[]>([])
  const [selectedClient, setSelectedClient] = useState<ClientSearchResult | null>(null)
  const [domainFilter, setDomainFilter] = useState<VoltronLionDomain | 'all'>('all')
  const [selectedWire, setSelectedWire] = useState<string>('')
  const [executing, setExecuting] = useState(false)
  const [result, setResult] = useState<{ success: boolean; data?: unknown; error?: string; case_id?: string } | null>(null)
  const [searching, setSearching] = useState(false)

  // Title-case normalize for Firestore search
  const normalizeSearch = (str: string) =>
    str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()

  // Client search with debounce
  const searchClients = useCallback(async (query: string) => {
    if (query.length < 2) {
      setClientResults([])
      return
    }
    setSearching(true)
    try {
      const normalized = normalizeSearch(query)
      const res = await fetch(`/api/clients?search=${encodeURIComponent(normalized)}&limit=10`)
      if (res.ok) {
        const json = await res.json()
        const clients = (json.data ?? []).map((c: Record<string, unknown>) => ({
          id: String(c.id || c.client_id || ''),
          display_name: `${c.first_name || ''} ${c.last_name || ''}`.trim() || String(c.id || ''),
          email: c.email as string | undefined,
        }))
        setClientResults(clients)
      }
    } catch {
      setClientResults([])
    } finally {
      setSearching(false)
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => searchClients(clientSearch), 300)
    return () => clearTimeout(timer)
  }, [clientSearch, searchClients])

  const filteredWires = domainFilter === 'all'
    ? DOMAIN_WIRES
    : DOMAIN_WIRES.filter(w => w.domain === domainFilter)

  async function executeWire() {
    if (!selectedClient || !selectedWire) return
    setExecuting(true)
    setResult(null)

    try {
      const res = await fetch('/api/voltron/wire/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Intake-Channel': 'command_center',
        },
        body: JSON.stringify({
          wire_id: selectedWire,
          client_id: selectedClient.id,
          params: {},
        }),
      })

      const json = await res.json()
      if (json.success) {
        setResult({ success: true, data: json.data, case_id: json.data?.case_id })
      } else {
        setResult({ success: false, error: json.error || 'Execution failed' })
      }
    } catch (err) {
      setResult({ success: false, error: err instanceof Error ? err.message : 'Network error' })
    } finally {
      setExecuting(false)
    }
  }

  return (
    <div style={{ padding: 20 }}>
      <div style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 700, color: colors.text, margin: '0 0 4px' }}>
          Run Wire
        </h3>
        <p style={{ fontSize: '0.8rem', color: colors.textMuted, margin: 0 }}>
          Select a client and wire to execute directly
        </p>
      </div>

      {/* Client Search */}
      <div style={{ marginBottom: 16, position: 'relative' }}>
        <label style={labelStyle}>Client</label>
        {selectedClient ? (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
            background: colors.bgHover, border: `1px solid ${colors.border}`,
            borderRadius: 6,
          }}>
            <span style={{ color: colors.text, fontSize: '0.85rem', flex: 1 }}>
              {selectedClient.display_name}
            </span>
            <button
              onClick={() => { setSelectedClient(null); setClientSearch('') }}
              style={{
                background: 'none', border: 'none', color: colors.textMuted,
                cursor: 'pointer', fontSize: '0.85rem',
              }}
            >
              &times;
            </button>
          </div>
        ) : (
          <>
            <input
              type="text"
              value={clientSearch}
              onChange={e => setClientSearch(e.target.value)}
              placeholder="Search clients by name..."
              style={inputStyle}
            />
            {(clientResults.length > 0 || searching) && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10,
                background: '#111827', border: `1px solid ${colors.border}`,
                borderRadius: 6, maxHeight: 200, overflowY: 'auto', marginTop: 4,
              }}>
                {searching ? (
                  <div style={{ padding: '10px 12px', color: colors.textMuted, fontSize: '0.82rem' }}>
                    Searching...
                  </div>
                ) : clientResults.map(c => (
                  <button
                    key={c.id}
                    onClick={() => {
                      setSelectedClient(c)
                      setClientSearch('')
                      setClientResults([])
                    }}
                    style={{
                      display: 'block', width: '100%', padding: '8px 12px',
                      background: 'transparent', border: 'none', textAlign: 'left',
                      color: colors.text, fontSize: '0.82rem', cursor: 'pointer',
                      borderBottom: `1px solid ${colors.border}`,
                    }}
                  >
                    {c.display_name}
                    {c.email && <span style={{ color: colors.textMuted, marginLeft: 8 }}>{c.email}</span>}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Domain Filter + Wire Selector */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        <div>
          <label style={labelStyle}>Domain Filter</label>
          <select
            value={domainFilter}
            onChange={e => { setDomainFilter(e.target.value as VoltronLionDomain | 'all'); setSelectedWire('') }}
            style={inputStyle}
          >
            {LION_DOMAINS.map(d => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Wire</label>
          <select
            value={selectedWire}
            onChange={e => setSelectedWire(e.target.value)}
            style={inputStyle}
          >
            <option value="">Select wire...</option>
            {filteredWires.map(w => (
              <option key={w.wire_id} value={w.wire_id}>{w.name} ({w.domain})</option>
            ))}
          </select>
        </div>
      </div>

      {/* Execute Button */}
      <button
        onClick={executeWire}
        disabled={executing || !selectedClient || !selectedWire}
        style={{
          padding: '10px 24px',
          background: executing || !selectedClient || !selectedWire ? colors.bgHover : colors.blue,
          color: '#fff',
          border: 'none',
          borderRadius: 6,
          fontSize: '0.85rem',
          fontWeight: 600,
          cursor: executing || !selectedClient || !selectedWire ? 'not-allowed' : 'pointer',
          opacity: executing || !selectedClient || !selectedWire ? 0.5 : 1,
        }}
      >
        {executing ? 'Executing...' : 'Execute Wire'}
      </button>

      {/* Result */}
      {result && (
        <div style={{
          marginTop: 16, padding: 16,
          background: result.success ? `${colors.green}10` : `${colors.red}10`,
          border: `1px solid ${result.success ? `${colors.green}30` : `${colors.red}30`}`,
          borderRadius: 8,
        }}>
          <div style={{
            fontSize: '0.82rem', fontWeight: 700, marginBottom: 8,
            color: result.success ? colors.green : colors.red,
          }}>
            {result.success ? 'Wire Executed Successfully' : 'Wire Execution Failed'}
          </div>
          {result.case_id && (
            <div style={{ fontSize: '0.78rem', color: colors.textMuted, marginBottom: 6 }}>
              Case ID: <code style={{ color: colors.blue }}>{result.case_id}</code>
            </div>
          )}
          {result.error && (
            <div style={{ fontSize: '0.82rem', color: colors.red }}>
              {result.error}
            </div>
          )}
          {result.data != null && (
            <details style={{ marginTop: 8 }}>
              <summary style={{ fontSize: '0.78rem', color: colors.textMuted, cursor: 'pointer' }}>
                Wire Output
              </summary>
              <pre style={{
                fontSize: '0.72rem', color: colors.textMuted, marginTop: 8,
                background: colors.bg, padding: 12, borderRadius: 6, overflow: 'auto',
                maxHeight: 300,
              }}>
                {JSON.stringify(result.data, null, 2)}
              </pre>
            </details>
          )}
        </div>
      )}
    </div>
  )
}
