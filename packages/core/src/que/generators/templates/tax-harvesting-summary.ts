/**
 * Tax Harvesting — Summary Template (TRK-13424)
 * Tier 1: Lot selection table + effective rate.
 * COMPLIANCE: Includes RPI + Signal Advisors Wealth disclosure.
 */

import type { GeneratorInput } from '../types'
import { TAX_HARVESTING_DISCLOSURE } from '../types'
import { getBaseStyles, formatCurrency, formatPercent, renderHeader, renderFooter, escapeHtml } from '../shared-styles'

export function renderTaxHarvestingSummary(input: GeneratorInput): string {
  const { analysis, household, preparedBy, preparedDate } = input
  const m = analysis.metrics
  const d = analysis.details as Record<string, unknown>
  const lotAnalyses = (d.lotAnalyses ?? []) as Array<{ targetAmount: number; totalProceeds: number; totalTax: number; effectiveTaxRate: number; selectedLotCount: number }>

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><title>Tax Harvesting — ${escapeHtml(household.clientNames)}</title>
<style>${getBaseStyles()}</style></head><body>
${renderHeader('Tax-Efficient Liquidation Analysis', household.clientNames, preparedBy, preparedDate)}

<div class="metric-cards">
  <div class="metric-card">
    <div class="label">NQ Portfolio Value</div>
    <div class="value">${formatCurrency(Number(m.totalNqValue ?? 0))}</div>
  </div>
  <div class="metric-card">
    <div class="label">Unrealized Gain</div>
    <div class="value">${formatCurrency(Number(m.unrealizedGain ?? 0))}</div>
  </div>
  <div class="metric-card">
    <div class="label">Loss Positions</div>
    <div class="value green">${formatCurrency(Number(m.totalLossPositions ?? 0))}</div>
  </div>
  <div class="metric-card">
    <div class="label">Full Liquidation Rate</div>
    <div class="value">${formatPercent(Number(m.fullLiquidationRate ?? 0))}</div>
  </div>
</div>

<div class="section">
  <div class="section-title">Liquidation Scenarios</div>
  <table>
    <thead><tr><th>Target Amount</th><th>Proceeds</th><th>Estimated Tax</th><th>Effective Rate</th><th>Lots Sold</th></tr></thead>
    <tbody>
      ${lotAnalyses.map((la) => `<tr class="highlight-row"><td>${formatCurrency(la.targetAmount)}</td><td>${formatCurrency(la.totalProceeds)}</td><td>${formatCurrency(la.totalTax)}</td><td><strong>${formatPercent(la.effectiveTaxRate)}</strong></td><td>${la.selectedLotCount}</td></tr>`).join('')}
    </tbody>
  </table>
</div>

<div class="opp-box">
  <div class="opp-title">Strategy</div>
  <p>${escapeHtml(analysis.recommendation)}</p>
</div>

${analysis.warnings.length > 0 ? `
<div class="opp-box yellow">
  <div class="opp-title">Warnings</div>
  <ul>${analysis.warnings.map((w) => `<li>${escapeHtml(w)}</li>`).join('')}</ul>
</div>` : ''}

<div class="disclosure">${escapeHtml(TAX_HARVESTING_DISCLOSURE)}</div>

${renderFooter(household.clientNames, preparedDate)}
</body></html>`
}
