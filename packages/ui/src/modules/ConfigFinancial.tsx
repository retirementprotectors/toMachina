'use client'

import { useState, useMemo } from 'react'
import { TableEditor } from './ConfigRegistry'

/* ═══ Styles ═══ */

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

/* ═══ Types ═══ */

interface ConfigData {
  key: string
  type: string
  category: string
  [field: string]: unknown
}

interface ConfigFinancialProps {
  configKey: string
  configData: ConfigData
  onUpdate: (data: ConfigData) => void
}

const FILING_STATUSES = [
  { key: 'mfj', label: 'MFJ' },
  { key: 'single', label: 'Single' },
  { key: 'mfs', label: 'MFS' },
  { key: 'hoh', label: 'HoH' },
  { key: 'widow', label: 'Widow' },
]

/* ═══ Shared Sub-Components ═══ */

function YearSelector({ years, selected, onSelect, onCopy }: {
  years: string[]
  selected: string
  onSelect: (y: string) => void
  onCopy: () => void
}) {
  const nextYear = String(parseInt(selected) + 1)
  const canCopy = !years.includes(nextYear)
  return (
    <div className="flex items-center gap-3 mb-3">
      <label className="text-[10px] font-medium uppercase tracking-wide" style={{ color: s.textMuted }}>Year</label>
      <select value={selected} onChange={e => onSelect(e.target.value)}
        className="rounded-lg border px-3 py-1.5 text-sm focus:outline-none"
        style={{ borderColor: s.border, background: s.surface, color: s.text }}>
        {years.map(y => <option key={y} value={y}>{y}</option>)}
      </select>
      <button onClick={onCopy} disabled={!canCopy}
        className="flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-medium disabled:opacity-30"
        style={{ borderColor: s.border, color: s.textSecondary }}>
        <span className="material-icons-outlined" style={{ fontSize: '14px' }}>content_copy</span>
        Copy to {nextYear}
      </button>
    </div>
  )
}

function FilingStatusTabs({ selected, onSelect }: {
  selected: string
  onSelect: (s: string) => void
}) {
  return (
    <div className="flex gap-1 mb-3">
      {FILING_STATUSES.map(fs => (
        <button key={fs.key} onClick={() => onSelect(fs.key)}
          className="rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
          style={selected === fs.key
            ? { background: s.portal, color: '#fff' }
            : { background: s.surface, color: s.textMuted }}>
          {fs.label}
        </button>
      ))}
    </div>
  )
}

/* ═══ Tax Brackets Editor (TRK-CFG-008) ═══ */

function TaxBracketsEditor({ configData, onUpdate }: Omit<ConfigFinancialProps, 'configKey'>) {
  const years = (configData.years || {}) as Record<string, Record<string, unknown>>
  const yearKeys = useMemo(() => Object.keys(years).sort().reverse(), [years])
  const [selectedYear, setSelectedYear] = useState(yearKeys[0] || '2025')
  const [filingStatus, setFilingStatus] = useState('mfj')
  const [showStates, setShowStates] = useState(false)

  const yearData = years[selectedYear] || {}
  const allBrackets = (yearData.brackets || {}) as Record<string, Record<string, unknown>[]>
  const brackets = allBrackets[filingStatus] || []
  const stdDed = (yearData.standard_deduction || {}) as Record<string, number>
  const stateRates = (configData.state_tax_rates || {}) as Record<string, Record<string, unknown>>

  const updateBrackets = (newBrackets: Record<string, unknown>[]) => {
    const newAllBrackets = { ...allBrackets, [filingStatus]: newBrackets }
    const newYearData = { ...yearData, brackets: newAllBrackets }
    const newYears = { ...years, [selectedYear]: newYearData }
    onUpdate({ ...configData, years: newYears })
  }

  const updateStdDed = (status: string, value: string) => {
    const num = parseFloat(value.replace(/,/g, '')) || 0
    const newStdDed = { ...stdDed, [status]: num }
    const newYearData = { ...yearData, standard_deduction: newStdDed }
    const newYears = { ...years, [selectedYear]: newYearData }
    onUpdate({ ...configData, years: newYears })
  }

  const copyToNewYear = () => {
    const nextYear = String(parseInt(selectedYear) + 1)
    if (years[nextYear]) return
    const newYears = { ...years, [nextYear]: JSON.parse(JSON.stringify(yearData)) }
    onUpdate({ ...configData, years: newYears })
    setSelectedYear(nextYear)
  }

  // State tax rate entries for TableEditor
  const stateEntries = useMemo(() =>
    Object.entries(stateRates).map(([code, data]) => ({ code, ...(data as Record<string, unknown>) })),
    [stateRates],
  )

  const updateStateRate = (index: number, field: string, value: string) => {
    const entry = stateEntries[index]
    if (!entry) return
    const code = entry.code as string
    const current = stateRates[code] || {}
    let parsed: unknown = value
    if (field === 'rate') parsed = parseFloat(value) || 0
    if (field === 'retirementExempt') parsed = value.toLowerCase() === 'true'
    const newStateRates = { ...stateRates, [code]: { ...current, [field]: parsed } }
    onUpdate({ ...configData, state_tax_rates: newStateRates })
  }

  return (
    <div className="space-y-4">
      <YearSelector years={yearKeys} selected={selectedYear} onSelect={setSelectedYear} onCopy={copyToNewYear} />
      <FilingStatusTabs selected={filingStatus} onSelect={setFilingStatus} />

      {/* Bracket Table */}
      <div>
        <h4 className="text-xs font-medium uppercase tracking-wide mb-2" style={{ color: s.textMuted }}>
          Federal Brackets — {FILING_STATUSES.find(f => f.key === filingStatus)?.label}
        </h4>
        <TableEditor
          entries={brackets}
          columns={[
            { key: 'min', label: 'Min ($)' },
            { key: 'max', label: 'Max ($)' },
            { key: 'rate', label: 'Rate %' },
          ]}
          onUpdate={(index, field, value) => {
            const updated = [...brackets]
            if (field === 'max' && (value === '' || value.includes('∞'))) {
              updated[index] = { ...updated[index], max: null }
            } else {
              updated[index] = { ...updated[index], [field]: parseFloat(value.replace(/,/g, '')) || 0 }
            }
            updateBrackets(updated)
          }}
          onAdd={() => {
            const lastMax = brackets.length > 0 ? (brackets[brackets.length - 1]?.max as number | null) : 0
            updateBrackets([...brackets, { min: lastMax ?? 0, max: null, rate: 0 }])
          }}
          onDelete={(index) => updateBrackets(brackets.filter((_, i) => i !== index))}
        />
      </div>

      {/* Standard Deduction */}
      <div>
        <h4 className="text-xs font-medium uppercase tracking-wide mb-2" style={{ color: s.textMuted }}>
          Standard Deduction — {selectedYear}
        </h4>
        <div className="grid grid-cols-5 gap-2">
          {FILING_STATUSES.map(fs => (
            <div key={fs.key} className="space-y-1">
              <label className="text-[10px] font-medium" style={{ color: s.textMuted }}>{fs.label}</label>
              <input type="text" value={stdDed[fs.key] ?? 0}
                onChange={e => updateStdDed(fs.key, e.target.value)}
                className="w-full rounded-lg border px-2 py-1.5 text-sm font-mono focus:outline-none"
                style={{ borderColor: s.border, background: s.surface, color: s.text }} />
            </div>
          ))}
        </div>
      </div>

      {/* State Tax Rates (collapsible) */}
      <div>
        <button onClick={() => setShowStates(!showStates)}
          className="flex items-center gap-1 text-xs font-medium" style={{ color: s.textSecondary }}>
          <span className="material-icons-outlined" style={{ fontSize: '14px' }}>
            {showStates ? 'expand_less' : 'expand_more'}
          </span>
          State Tax Rates ({stateEntries.length} states)
        </button>
        {showStates && (
          <div className="mt-2">
            <TableEditor
              entries={stateEntries}
              columns={[
                { key: 'code', label: 'State', editable: false },
                { key: 'name', label: 'Name' },
                { key: 'rate', label: 'Rate %' },
                { key: 'retirementExempt', label: 'Ret. Exempt' },
              ]}
              onUpdate={updateStateRate}
              onAdd={() => {}}
              onDelete={() => {}}
              hideAdd
              hideDelete
            />
          </div>
        )}
      </div>
    </div>
  )
}

/* ═══ IRMAA Brackets Editor (TRK-CFG-009) ═══ */

function IrmaaBracketsEditor({ configData, onUpdate }: Omit<ConfigFinancialProps, 'configKey'>) {
  const years = (configData.years || {}) as Record<string, Record<string, unknown>>
  const yearKeys = useMemo(() => Object.keys(years).sort().reverse(), [years])
  const [selectedYear, setSelectedYear] = useState(yearKeys[0] || '2025')
  const [filingStatus, setFilingStatus] = useState('mfj')

  const yearData = years[selectedYear] || {}
  const allBrackets = (yearData.brackets || {}) as Record<string, Record<string, unknown>[]>
  const brackets = allBrackets[filingStatus] || []

  const updateBrackets = (newBrackets: Record<string, unknown>[]) => {
    const newAllBrackets = { ...allBrackets, [filingStatus]: newBrackets }
    const newYearData = { ...yearData, brackets: newAllBrackets }
    const newYears = { ...years, [selectedYear]: newYearData }
    onUpdate({ ...configData, years: newYears })
  }

  const copyToNewYear = () => {
    const nextYear = String(parseInt(selectedYear) + 1)
    if (years[nextYear]) return
    const newYears = { ...years, [nextYear]: JSON.parse(JSON.stringify(yearData)) }
    onUpdate({ ...configData, years: newYears })
    setSelectedYear(nextYear)
  }

  return (
    <div className="space-y-4">
      <YearSelector years={yearKeys} selected={selectedYear} onSelect={setSelectedYear} onCopy={copyToNewYear} />
      <FilingStatusTabs selected={filingStatus} onSelect={setFilingStatus} />

      <TableEditor
        entries={brackets}
        columns={[
          { key: 'tier', label: 'Tier' },
          { key: 'magiMin', label: 'MAGI Min ($)' },
          { key: 'magiMax', label: 'MAGI Max ($)' },
          { key: 'partBMonthly', label: 'Part B Surcharge ($)' },
          { key: 'partDMonthly', label: 'Part D Surcharge ($)' },
        ]}
        onUpdate={(index, field, value) => {
          const updated = [...brackets]
          if (field === 'tier') {
            updated[index] = { ...updated[index], tier: value }
          } else if (field === 'magiMax' && (value === '' || value.includes('∞'))) {
            updated[index] = { ...updated[index], magiMax: null }
          } else {
            updated[index] = { ...updated[index], [field]: parseFloat(value.replace(/,/g, '')) || 0 }
          }
          updateBrackets(updated)
        }}
        onAdd={() => {
          const lastMax = brackets.length > 0 ? (brackets[brackets.length - 1]?.magiMax as number | null) : 0
          updateBrackets([...brackets, { tier: '', magiMin: lastMax ?? 0, magiMax: null, partBMonthly: 0, partDMonthly: 0 }])
        }}
        onDelete={(index) => updateBrackets(brackets.filter((_, i) => i !== index))}
      />
    </div>
  )
}

/* ═══ Carrier Products Editor (TRK-CFG-010) ═══ */

function CarrierProductsEditor({ configData, onUpdate }: Omit<ConfigFinancialProps, 'configKey'>) {
  const rawProducts = (configData.products || []) as Record<string, unknown>[]

  // Transform features array → comma-separated string for display in TableEditor
  const displayProducts = useMemo(() =>
    rawProducts.map(p => ({
      ...p,
      features: Array.isArray(p.features) ? (p.features as string[]).join(', ') : String(p.features || ''),
    })),
    [rawProducts],
  )

  return (
    <TableEditor
      entries={displayProducts}
      columns={[
        { key: 'carrier', label: 'Carrier' },
        { key: 'product', label: 'Product Name' },
        { key: 'type', label: 'Type' },
        { key: 'surrenderYears', label: 'Surrender Yrs' },
        { key: 'bonus', label: 'Bonus %' },
        { key: 'features', label: 'Features (comma-separated)' },
      ]}
      onUpdate={(index, field, value) => {
        const updated = [...rawProducts]
        if (field === 'features') {
          updated[index] = { ...updated[index], features: value.split(',').map(s => s.trim()).filter(Boolean) }
        } else if (field === 'surrenderYears') {
          updated[index] = { ...updated[index], [field]: parseInt(value) || 0 }
        } else if (field === 'bonus') {
          updated[index] = { ...updated[index], [field]: parseFloat(value) || 0 }
        } else {
          updated[index] = { ...updated[index], [field]: value }
        }
        onUpdate({ ...configData, products: updated })
      }}
      onAdd={() => {
        onUpdate({
          ...configData,
          products: [...rawProducts, { carrier: '', product: '', type: 'FIA', surrenderYears: 10, bonus: 0, features: [] }],
        })
      }}
      onDelete={(index) => {
        onUpdate({ ...configData, products: rawProducts.filter((_, i) => i !== index) })
      }}
    />
  )
}

/* ═══ Main ConfigFinancial ═══ */

export function ConfigFinancial({ configKey, configData, onUpdate }: ConfigFinancialProps) {
  switch (configKey) {
    case 'tax_brackets':
      return <TaxBracketsEditor configData={configData} onUpdate={onUpdate} />
    case 'irmaa_brackets':
      return <IrmaaBracketsEditor configData={configData} onUpdate={onUpdate} />
    case 'carrier_products':
      return <CarrierProductsEditor configData={configData} onUpdate={onUpdate} />
    default:
      return (
        <div className="text-center py-8 text-sm" style={{ color: s.textMuted }}>
          Unknown financial config: <strong>{configKey}</strong>
        </div>
      )
  }
}
