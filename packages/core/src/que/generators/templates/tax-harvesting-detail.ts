/**
 * Tax Harvesting — Detail Template (TRK-13425)
 * Tier 2/3: Position-by-position with cost basis detail.
 * COMPLIANCE: Includes RPI + Signal Advisors Wealth disclosure.
 */

import type { GeneratorInput } from '../types'
import { getTaxHarvestingDisclosure } from '../disclosures'
import { getBaseStyles, formatCurrency, formatPercent, renderHeader, renderFooter, escapeHtml } from '../shared-styles'

export function renderTaxHarvestingDetail(input: GeneratorInput): string {
  const { analysis, household, preparedBy, preparedDate } = input
  const m = analysis.metrics
  const d = analysis.details as Record<string, unknown>
  const fullLiquidation = (d.fullLiquidation ?? {}) as {
    selectedLots?: Array<{ id: string; description?: string; marketValue: number; costBasis: number; gain: number; gainPercent: number; sellAmount: number; estimatedTax: number }>
    totalProceeds?: number; totalGain?: number; totalTax?: number; effectiveTaxRate?: number
  }
  const lossPositions = (d.lossPositions ?? []) as Array<{ account: string; marketValue: number; costBasis: number; loss: number }>

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><title>Tax Harvesting Detail — ${escapeHtml(household.clientNames)}</title>
<style>${getBaseStyles()}</style></head><body>
${renderHeader('Tax-Efficient Liquidation — Position Detail', household.clientNames, preparedBy, preparedDate)}

${fullLiquidation.selectedLots && fullLiquidation.selectedLots.length > 0 ? `
<div class="section">
  <div class="section-title">Position-by-Position Analysis (Sorted by Gain %)</div>
  <table>
    <thead><tr><th>Position</th><th>Market Value</th><th>Cost Basis</th><th>Gain</th><th>Gain %</th><th>Est. Tax</th></tr></thead>
    <tbody>
      ${fullLiquidation.selectedLots.map((lot) => `<tr${lot.gain <= 0 ? ' class="highlight-row"' : ''}><td>${escapeHtml(lot.description ?? lot.id)}</td><td>${formatCurrency(lot.marketValue)}</td><td>${formatCurrency(lot.costBasis)}</td><td${lot.gain <= 0 ? ' style="color:#1a7a3a"' : ''}>${formatCurrency(lot.gain)}</td><td>${formatPercent(lot.gainPercent)}</td><td>${formatCurrency(lot.estimatedTax)}</td></tr>`).join('')}
      <tr class="total-row">
        <td>TOTAL</td>
        <td>${formatCurrency(fullLiquidation.totalProceeds ?? 0)}</td>
        <td></td>
        <td>${formatCurrency(fullLiquidation.totalGain ?? 0)}</td>
        <td></td>
        <td>${formatCurrency(fullLiquidation.totalTax ?? 0)}</td>
      </tr>
    </tbody>
  </table>
  <p style="font-size:8pt;color:#666;margin-top:4px">Effective tax rate on full liquidation: <strong>${formatPercent(fullLiquidation.effectiveTaxRate ?? 0)}</strong>. NQ strategy: sell lowest-gain lots first to minimize tax.</p>
</div>` : ''}

${lossPositions.length > 0 ? `
<div class="section">
  <div class="section-title">Loss Positions (Harvest First)</div>
  <table>
    <thead><tr><th>Account</th><th>Market Value</th><th>Cost Basis</th><th>Loss</th></tr></thead>
    <tbody>
      ${lossPositions.map((lp) => `<tr class="highlight-row"><td>${escapeHtml(lp.account)}</td><td>${formatCurrency(lp.marketValue)}</td><td>${formatCurrency(lp.costBasis)}</td><td style="color:#1a7a3a">${formatCurrency(lp.loss)}</td></tr>`).join('')}
    </tbody>
  </table>
  <p style="font-size:8pt;color:#666;margin-top:4px">Losses offset capital gains first, then up to $3,000 in ordinary income. Remaining losses carry forward.</p>
</div>` : ''}

<div class="section">
  <div class="section-title">Portfolio Summary</div>
  <table>
    <thead><tr><th>Metric</th><th>Value</th></tr></thead>
    <tbody>
      <tr><td>Total NQ Portfolio</td><td><strong>${formatCurrency(Number(m.totalNqValue ?? 0))}</strong></td></tr>
      <tr><td>Total Cost Basis</td><td>${formatCurrency(Number(m.totalCostBasis ?? 0))}</td></tr>
      <tr><td>Unrealized Gain</td><td>${formatCurrency(Number(m.unrealizedGain ?? 0))}</td></tr>
      <tr><td>Loss Positions</td><td style="color:#1a7a3a">${formatCurrency(Number(m.totalLossPositions ?? 0))}</td></tr>
      <tr class="highlight-row"><td>Full Liquidation Tax</td><td><strong>${formatCurrency(Number(m.fullLiquidationTax ?? 0))}</strong></td></tr>
    </tbody>
  </table>
</div>

<div class="opp-box">
  <div class="opp-title">Detailed Recommendation</div>
  <p>${escapeHtml(analysis.recommendation)}</p>
  <ul>${analysis.findings.map((f) => `<li style="font-size:8.5pt">${escapeHtml(f)}</li>`).join('')}</ul>
</div>

<div class="disclosure">${escapeHtml(getTaxHarvestingDisclosure())}</div>

${renderFooter(household.clientNames, preparedDate)}
</body></html>`
}
