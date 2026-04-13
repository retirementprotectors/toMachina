'use client'

import { useMemo, useState, useCallback } from 'react'
import { query, type Query, type DocumentData } from 'firebase/firestore'
import { useCollection } from '@tomachina/db'
import { collections } from '@tomachina/db/src/firestore'
import { calculateMec, type MecInput, calculateSph, type SphInput } from '@tomachina/core'
import { calculateBookValue, calculateDCF, calculateNPV, projectRevenue, projectCashFlow } from '@tomachina/core'
import { Modal, AppWrapper } from '@tomachina/ui'

const revenueQuery: Query<DocumentData> = query(collections.revenue())
const agentsQuery: Query<DocumentData> = query(collections.agents())
const opportunitiesQuery: Query<DocumentData> = query(collections.opportunities())

interface RevenueRecord { _id: string; agent_name?: string; carrier?: string; product_type?: string; premium?: number; total_premium?: number; amount?: number }
interface AgentRecord { _id: string; agent_name?: string; first_name?: string; last_name?: string; status?: string }
interface OpportunityRecord { _id: string; stage?: string; deal_value?: number; estimated_value?: number }

function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

type ActiveCalc = 'mec' | 'prp' | 'sph' | 'valuation' | null

export default function DavidHubPage() {
  const { data: revenue, loading: revLoading } = useCollection<RevenueRecord>(revenueQuery, 'david-revenue')
  const { data: agents, loading: agentsLoading } = useCollection<AgentRecord>(agentsQuery, 'david-agents')
  const { data: opps, loading: oppsLoading } = useCollection<OpportunityRecord>(opportunitiesQuery, 'david-opps')
  const [activeCalc, setActiveCalc] = useState<ActiveCalc>(null)

  const metrics = useMemo(() => {
    let totalRevenue = 0
    revenue.forEach((r) => {
      const amount = Number(r.total_premium || r.premium || r.amount || 0)
      if (!isNaN(amount)) totalRevenue += amount
    })
    let pipelineValue = 0, openDeals = 0
    opps.forEach((o) => {
      const stage = (o.stage || '').toLowerCase()
      if (!stage.includes('closed')) {
        openDeals++
        const val = Number(o.deal_value || o.estimated_value || 0)
        if (!isNaN(val)) pipelineValue += val
      }
    })
    const activeAgents = agents.filter((a) => (a.status || '').toLowerCase() === 'active').length
    return { totalRevenue, pipelineValue, openDeals, activeAgents, totalAgents: agents.length }
  }, [revenue, agents, opps])

  const handleCloseCalc = useCallback(() => setActiveCalc(null), [])

  return (
    <AppWrapper appKey="david-hub">
    <div className="mx-auto max-w-6xl">
      <h1 className="text-2xl font-bold text-[var(--text-primary)]">DAVID HUB</h1>
      <p className="mt-1 text-sm text-[var(--text-muted)]">B2B command center — entry calculators and deal evaluation</p>

      {/* Key Metrics */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard icon="payments" label="Total Revenue" value={formatCurrency(metrics.totalRevenue)} loading={revLoading} />
        <MetricCard icon="trending_up" label="Pipeline Value" value={formatCurrency(metrics.pipelineValue)} loading={oppsLoading} subtitle={`${metrics.openDeals} open deals`} />
        <MetricCard icon="people" label="Active Agents" value={metrics.activeAgents.toLocaleString()} loading={agentsLoading} subtitle={`of ${metrics.totalAgents} total`} />
        <MetricCard icon="receipt_long" label="Revenue Records" value={revenue.length.toLocaleString()} loading={revLoading} />
      </div>

      {/* Calculator Cards */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">Entry Calculators</h2>
        <p className="mt-0.5 text-xs text-[var(--text-muted)]">M&amp;A deal evaluation tools</p>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <CalculatorCard icon="analytics" title="MEC Calculator" description="Modified Endowment Contract analysis for life insurance deal evaluation" onClick={() => setActiveCalc('mec')} />
          <CalculatorCard icon="price_check" title="PRP Evaluator" description="Producer Revenue Projection for book-of-business valuation" onClick={() => setActiveCalc('prp')} />
          <CalculatorCard icon="timeline" title="SPH Projections" description="Single Premium Hybrid modeling for LTC/life blocks" onClick={() => setActiveCalc('sph')} />
          <CalculatorCard icon="account_balance" title="Deal Valuation" description="Comprehensive M&amp;A deal valuation with DCF and NPV analysis" onClick={() => setActiveCalc('valuation')} />
        </div>
      </div>

      {/* Calculator Modals */}
      {activeCalc === 'mec' && <MecCalculator open onClose={handleCloseCalc} />}
      {activeCalc === 'prp' && <PrpCalculator open onClose={handleCloseCalc} />}
      {activeCalc === 'sph' && <SphCalculator open onClose={handleCloseCalc} />}
      {activeCalc === 'valuation' && <ValuationCalculator open onClose={handleCloseCalc} />}
    </div>
    </AppWrapper>
  )
}

/* ─── MEC Calculator ─── */
function MecCalculator({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [inputs, setInputs] = useState<MecInput>({ premiumPaid: 0, faceAmount: 0, policyYear: 1, sevenPayLimit: 0 })
  const [result, setResult] = useState<ReturnType<typeof calculateMec> | null>(null)

  const handleCalculate = () => {
    setResult(calculateMec(inputs))
  }

  return (
    <Modal open={open} onClose={onClose} title="MEC Calculator" size="lg">
      <div className="space-y-4">
        <p className="text-xs text-[var(--text-muted)]">Determine if a life insurance policy is a Modified Endowment Contract under the 7-pay test.</p>
        <div className="grid grid-cols-2 gap-4">
          <NumberInput label="Cumulative Premium Paid ($)" value={inputs.premiumPaid} onChange={(v) => setInputs({ ...inputs, premiumPaid: v })} />
          <NumberInput label="Face Amount ($)" value={inputs.faceAmount} onChange={(v) => setInputs({ ...inputs, faceAmount: v })} />
          <NumberInput label="Policy Year (1-7)" value={inputs.policyYear} onChange={(v) => setInputs({ ...inputs, policyYear: v })} />
          <NumberInput label="Annual 7-Pay Limit ($)" value={inputs.sevenPayLimit} onChange={(v) => setInputs({ ...inputs, sevenPayLimit: v })} />
        </div>
        <button onClick={handleCalculate} className="w-full rounded-lg py-2.5 text-sm font-medium text-white" style={{ background: 'var(--portal)' }}>
          Calculate
        </button>
        {result && (
          <div className={`rounded-xl border p-4 ${result.isMec ? 'border-[var(--error)] bg-[rgba(239,68,68,0.05)]' : 'border-[var(--success)] bg-[rgba(34,197,94,0.05)]'}`}>
            <div className="flex items-center gap-2">
              <span className="material-icons-outlined" style={{ fontSize: '20px', color: result.isMec ? 'var(--error)' : 'var(--success)' }}>
                {result.isMec ? 'warning' : 'check_circle'}
              </span>
              <span className="text-sm font-bold" style={{ color: result.isMec ? 'var(--error)' : 'var(--success)' }}>
                {result.isMec ? 'IS a MEC' : 'NOT a MEC'}
              </span>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-3">
              <ResultField label="Cumulative Premium" value={formatCurrency(result.cumulativePremium)} />
              <ResultField label="7-Pay Limit (Year)" value={formatCurrency(result.sevenPayLimit)} />
              <ResultField label="Remaining Room" value={formatCurrency(result.remainingRoom)} />
              <ResultField label="% Used" value={`${result.percentUsed}%`} />
              <ResultField label="Policy Year" value={result.policyYear.toString()} />
            </div>
            <p className="mt-3 text-xs text-[var(--text-secondary)]">{result.guidance}</p>
          </div>
        )}
      </div>
    </Modal>
  )
}

/* ─── PRP Calculator ─── */
function PrpCalculator({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [bookSize, setBookSize] = useState(0)
  const [annualPremium, setAnnualPremium] = useState(0)
  const [growthRate, setGrowthRate] = useState(5)
  const [retentionRate, setRetentionRate] = useState(90)
  const [years, setYears] = useState(5)
  const [result, setResult] = useState<Array<{ year: number; revenue: number; retained: number; cumulative: number }> | null>(null)

  const handleCalculate = () => {
    const rows: Array<{ year: number; revenue: number; retained: number; cumulative: number }> = []
    let base = annualPremium > 0 ? annualPremium : bookSize * 0.12 // Assume 12% commission on book if no premium given
    let cumulative = 0
    const gr = growthRate / 100
    const rr = retentionRate / 100
    for (let y = 1; y <= years; y++) {
      const revenue = Math.round(base * Math.pow(1 + gr, y - 1))
      const retained = Math.round(revenue * Math.pow(rr, y - 1))
      cumulative += retained
      rows.push({ year: y, revenue, retained, cumulative })
    }
    setResult(rows)
  }

  return (
    <Modal open={open} onClose={onClose} title="PRP Evaluator" size="lg">
      <div className="space-y-4">
        <p className="text-xs text-[var(--text-muted)]">Project producer revenue forward with growth and retention modeling.</p>
        <div className="grid grid-cols-2 gap-4">
          <NumberInput label="Current Book Size ($)" value={bookSize} onChange={setBookSize} />
          <NumberInput label="Annual Premium ($)" value={annualPremium} onChange={setAnnualPremium} />
          <NumberInput label="Growth Rate (%)" value={growthRate} onChange={setGrowthRate} />
          <NumberInput label="Retention Rate (%)" value={retentionRate} onChange={setRetentionRate} />
          <NumberInput label="Projection Years" value={years} onChange={setYears} />
        </div>
        <button onClick={handleCalculate} className="w-full rounded-lg py-2.5 text-sm font-medium text-white" style={{ background: 'var(--portal)' }}>
          Project Revenue
        </button>
        {result && (
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] text-left text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
                  <th className="pb-2 pr-4">Year</th>
                  <th className="pb-2 pr-4 text-right">Gross Revenue</th>
                  <th className="pb-2 pr-4 text-right">After Retention</th>
                  <th className="pb-2 text-right">Cumulative</th>
                </tr>
              </thead>
              <tbody>
                {result.map((r) => (
                  <tr key={r.year} className="border-b border-[var(--border-subtle)]">
                    <td className="py-2 pr-4 font-medium text-[var(--text-primary)]">Year {r.year}</td>
                    <td className="py-2 pr-4 text-right text-[var(--text-secondary)]">{formatCurrency(r.revenue)}</td>
                    <td className="py-2 pr-4 text-right text-[var(--text-secondary)]">{formatCurrency(r.retained)}</td>
                    <td className="py-2 text-right font-medium text-[var(--text-primary)]">{formatCurrency(r.cumulative)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-3 flex items-center justify-between border-t border-[var(--border-subtle)] pt-3">
              <span className="text-sm font-medium text-[var(--text-secondary)]">Total Projected Revenue</span>
              <span className="text-lg font-bold text-[var(--text-primary)]">{formatCurrency(result[result.length - 1]?.cumulative || 0)}</span>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}

/* ─── SPH Calculator ─── */
function SphCalculator({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [inputs, setInputs] = useState<SphInput>({ singlePremium: 0, interestRate: 3, benefitPeriod: 10, inflationRate: 2 })
  const [result, setResult] = useState<ReturnType<typeof calculateSph> | null>(null)

  const handleCalculate = () => {
    setResult(calculateSph({
      ...inputs,
      interestRate: inputs.interestRate / 100,
      inflationRate: inputs.inflationRate / 100,
    }))
  }

  return (
    <Modal open={open} onClose={onClose} title="SPH Projections" size="xl">
      <div className="space-y-4">
        <p className="text-xs text-[var(--text-muted)]">Project Single Premium Hybrid benefit values over time for hybrid life/LTC policies.</p>
        <div className="grid grid-cols-2 gap-4">
          <NumberInput label="Single Premium ($)" value={inputs.singlePremium} onChange={(v) => setInputs({ ...inputs, singlePremium: v })} />
          <NumberInput label="Interest Rate (%)" value={inputs.interestRate} onChange={(v) => setInputs({ ...inputs, interestRate: v })} />
          <NumberInput label="Benefit Period (years)" value={inputs.benefitPeriod} onChange={(v) => setInputs({ ...inputs, benefitPeriod: v })} />
          <NumberInput label="Inflation Rate (%)" value={inputs.inflationRate} onChange={(v) => setInputs({ ...inputs, inflationRate: v })} />
        </div>
        <button onClick={handleCalculate} className="w-full rounded-lg py-2.5 text-sm font-medium text-white" style={{ background: 'var(--portal)' }}>
          Project Benefits
        </button>
        {result && (
          <div className="space-y-3">
            {/* Summary */}
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4">
              <div className="grid grid-cols-3 gap-3">
                <ResultField label="Total LTC Benefit" value={formatCurrency(result.totalLtcBenefit)} />
                <ResultField label="Peak Death Benefit" value={formatCurrency(result.peakDeathBenefit)} />
                <ResultField label="Break-Even Year" value={result.breakEvenYear ? `Year ${result.breakEvenYear}` : 'N/A'} />
              </div>
              <p className="mt-3 text-xs text-[var(--text-secondary)]">{result.summary}</p>
            </div>
            {/* Schedule Table */}
            <div className="max-h-[300px] overflow-y-auto rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-[var(--bg-surface)]">
                  <tr className="border-b border-[var(--border-subtle)] text-left text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
                    <th className="px-4 py-2">Year</th>
                    <th className="px-4 py-2 text-right">Account Value</th>
                    <th className="px-4 py-2 text-right">Death Benefit</th>
                    <th className="px-4 py-2 text-right">LTC Benefit</th>
                    <th className="px-4 py-2 text-right">Surrender Value</th>
                  </tr>
                </thead>
                <tbody>
                  {result.projections.map((p) => (
                    <tr key={p.year} className="border-b border-[var(--border-subtle)]">
                      <td className="px-4 py-2 font-medium text-[var(--text-primary)]">{p.year}</td>
                      <td className="px-4 py-2 text-right text-[var(--text-secondary)]">{formatCurrency(p.accountValue)}</td>
                      <td className="px-4 py-2 text-right text-[var(--text-secondary)]">{formatCurrency(p.deathBenefit)}</td>
                      <td className="px-4 py-2 text-right text-[var(--text-secondary)]">{formatCurrency(p.ltcBenefit)}</td>
                      <td className="px-4 py-2 text-right font-medium text-[var(--text-primary)]">{formatCurrency(p.surrenderValue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}

/* ─── Deal Valuation Calculator ─── */
function ValuationCalculator({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [annualRevenue, setAnnualRevenue] = useState(0)
  const [growthRate, setGrowthRate] = useState(5)
  const [multipleLow, setMultipleLow] = useState(1.5)
  const [multipleHigh, setMultipleHigh] = useState(3.0)
  const [discountRate, setDiscountRate] = useState(10)
  const [projYears, setProjYears] = useState(5)
  const [result, setResult] = useState<{
    bookLow: number; bookMid: number; bookHigh: number
    dcfValue: number; npvValue: number
    projections: Array<{ year: number; revenue: number; cumulative: number }>
  } | null>(null)

  const handleCalculate = () => {
    const midMultiple = (multipleLow + multipleHigh) / 2
    const bookLow = calculateBookValue(annualRevenue, multipleLow)
    const bookMid = calculateBookValue(annualRevenue, midMultiple)
    const bookHigh = calculateBookValue(annualRevenue, multipleHigh)

    // Project cashflows for DCF
    const gr = growthRate / 100
    const dr = discountRate / 100
    const cashflows: number[] = []
    for (let y = 1; y <= projYears; y++) {
      cashflows.push(Math.round(annualRevenue * Math.pow(1 + gr, y - 1)))
    }
    const dcfValue = calculateDCF(cashflows, dr)
    const npvValue = calculateNPV(cashflows, dr)

    const projections = cashflows.map((cf, i) => ({
      year: i + 1,
      revenue: cf,
      cumulative: cashflows.slice(0, i + 1).reduce((a, b) => a + b, 0),
    }))

    setResult({ bookLow, bookMid, bookHigh, dcfValue, npvValue, projections })
  }

  return (
    <Modal open={open} onClose={onClose} title="Deal Valuation" size="xl">
      <div className="space-y-4">
        <p className="text-xs text-[var(--text-muted)]">Comprehensive M&amp;A deal valuation using book value multiples, DCF, and NPV analysis.</p>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          <NumberInput label="Annual Revenue ($)" value={annualRevenue} onChange={setAnnualRevenue} />
          <NumberInput label="Growth Rate (%)" value={growthRate} onChange={setGrowthRate} />
          <NumberInput label="Discount Rate (%)" value={discountRate} onChange={setDiscountRate} />
          <NumberInput label="Low Multiple (x)" value={multipleLow} onChange={setMultipleLow} step={0.1} />
          <NumberInput label="High Multiple (x)" value={multipleHigh} onChange={setMultipleHigh} step={0.1} />
          <NumberInput label="Projection Years" value={projYears} onChange={setProjYears} />
        </div>
        <button onClick={handleCalculate} className="w-full rounded-lg py-2.5 text-sm font-medium text-white" style={{ background: 'var(--portal)' }}>
          Run Valuation
        </button>
        {result && (
          <div className="space-y-4">
            {/* Valuation Range */}
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4">
              <h3 className="mb-3 text-sm font-semibold text-[var(--text-primary)]">Valuation Range</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="rounded-lg bg-[var(--bg-card)] p-3 text-center">
                  <p className="text-[10px] font-medium uppercase text-[var(--text-muted)]">Low ({multipleLow}x)</p>
                  <p className="mt-1 text-lg font-bold text-[var(--text-primary)]">{formatCurrency(result.bookLow)}</p>
                </div>
                <div className="rounded-lg p-3 text-center" style={{ background: 'var(--portal-glow)', border: '1px solid var(--portal)' }}>
                  <p className="text-[10px] font-medium uppercase" style={{ color: 'var(--portal)' }}>Mid ({((multipleLow + multipleHigh) / 2).toFixed(1)}x)</p>
                  <p className="mt-1 text-lg font-bold text-[var(--text-primary)]">{formatCurrency(result.bookMid)}</p>
                </div>
                <div className="rounded-lg bg-[var(--bg-card)] p-3 text-center">
                  <p className="text-[10px] font-medium uppercase text-[var(--text-muted)]">High ({multipleHigh}x)</p>
                  <p className="mt-1 text-lg font-bold text-[var(--text-primary)]">{formatCurrency(result.bookHigh)}</p>
                </div>
              </div>
            </div>

            {/* DCF Analysis */}
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4">
              <h3 className="mb-3 text-sm font-semibold text-[var(--text-primary)]">DCF Analysis</h3>
              <div className="grid grid-cols-2 gap-4">
                <ResultField label="DCF Valuation" value={formatCurrency(result.dcfValue)} />
                <ResultField label="NPV of Cash Flows" value={formatCurrency(result.npvValue)} />
              </div>
            </div>

            {/* Projection Table */}
            <div className="max-h-[250px] overflow-y-auto rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-[var(--bg-surface)]">
                  <tr className="border-b border-[var(--border-subtle)] text-left text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
                    <th className="px-4 py-2">Year</th>
                    <th className="px-4 py-2 text-right">Projected Revenue</th>
                    <th className="px-4 py-2 text-right">Cumulative</th>
                  </tr>
                </thead>
                <tbody>
                  {result.projections.map((p) => (
                    <tr key={p.year} className="border-b border-[var(--border-subtle)]">
                      <td className="px-4 py-2 font-medium text-[var(--text-primary)]">Year {p.year}</td>
                      <td className="px-4 py-2 text-right text-[var(--text-secondary)]">{formatCurrency(p.revenue)}</td>
                      <td className="px-4 py-2 text-right font-medium text-[var(--text-primary)]">{formatCurrency(p.cumulative)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}

/* ─── Shared Sub-components ─── */

function MetricCard({ icon, label, value, loading, subtitle }: {
  icon: string; label: string; value: string; loading: boolean; subtitle?: string
}) {
  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
      <div className="flex items-center gap-2">
        <span className="material-icons-outlined" style={{ fontSize: '18px', color: 'var(--portal)' }}>{icon}</span>
        <span className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">{label}</span>
      </div>
      {loading ? (
        <div className="mt-2 h-8 w-20 animate-pulse rounded bg-[var(--bg-surface)]" />
      ) : (
        <>
          <p className="mt-2 text-2xl font-bold text-[var(--text-primary)]">{value}</p>
          {subtitle && <p className="text-xs text-[var(--text-muted)]">{subtitle}</p>}
        </>
      )}
    </div>
  )
}

function CalculatorCard({ icon, title, description, onClick }: {
  icon: string; title: string; description: string; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-start gap-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 text-left transition-all hover:border-[var(--portal)] hover:bg-[var(--bg-card-hover)]"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg" style={{ background: 'var(--portal-glow)' }}>
        <span className="material-icons-outlined" style={{ fontSize: '22px', color: 'var(--portal)' }}>{icon}</span>
      </span>
      <div className="flex-1">
        <p className="text-sm font-semibold text-[var(--text-primary)]">{title}</p>
        <p className="mt-1 text-xs text-[var(--text-muted)]">{description}</p>
      </div>
      <span className="material-icons-outlined text-[var(--text-muted)]" style={{ fontSize: '18px' }}>arrow_forward</span>
    </button>
  )
}

function NumberInput({ label, value, onChange, step }: {
  label: string; value: number; onChange: (v: number) => void; step?: number
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">{label}</label>
      <input
        type="number"
        value={value || ''}
        step={step}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--portal)]"
      />
    </div>
  )
}

function ResultField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">{label}</p>
      <p className="mt-0.5 text-sm font-bold text-[var(--text-primary)]">{value}</p>
    </div>
  )
}
