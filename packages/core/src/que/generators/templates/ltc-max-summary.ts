/**
 * LTC MAX — Summary Template (TRK-13418)
 * Tier 1: 4-phase access pool summary.
 */

import type { GeneratorInput } from '../types'
import { getBaseStyles, formatCurrency, renderHeader, renderFooter, escapeHtml } from '../shared-styles'

export function renderLtcMaxSummary(input: GeneratorInput): string {
  const { analysis, household, preparedBy, preparedDate } = input
  const m = analysis.metrics
  const d = analysis.details as Record<string, unknown>
  const phases = (d.phases ?? []) as Array<{ phase: string; qualification: string; annualAccess: number; description: string; contracts: string[] }>

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><title>LTC MAX — ${escapeHtml(household.clientNames)}</title>
<style>${getBaseStyles()}</style></head><body>
${renderHeader('Long-Term Care Access Analysis', household.clientNames, preparedBy, preparedDate)}

<div class="metric-cards">
  <div class="metric-card">
    <div class="label">Total LTC Pool</div>
    <div class="value green">${formatCurrency(Number(m.totalLtcPool ?? 0))}</div>
  </div>
  <div class="metric-card">
    <div class="label">Contracts with LTC</div>
    <div class="value">${m.contractCount ?? 0}</div>
  </div>
  <div class="metric-card">
    <div class="label">Annual Rider Fees</div>
    <div class="value">${formatCurrency(Number(m.totalAnnualFees ?? 0))}</div>
  </div>
  <div class="metric-card">
    <div class="label">Break-Even (Months)</div>
    <div class="value">${Number(m.breakEvenMonths ?? 0) > 0 ? m.breakEvenMonths : 'N/A'}</div>
  </div>
</div>

<div class="section">
  <div class="section-title">4-Phase LTC Access Framework</div>
  <table>
    <thead><tr><th>Phase</th><th>Qualification</th><th>Annual Access</th><th>Description</th></tr></thead>
    <tbody>
      ${phases.map((p) => `<tr${p.annualAccess > 0 ? ' class="highlight-row"' : ''}><td><strong>${escapeHtml(p.phase)}</strong></td><td>${escapeHtml(p.qualification)}</td><td><strong>${formatCurrency(p.annualAccess)}</strong></td><td style="font-size:8.5pt">${escapeHtml(p.description)}</td></tr>`).join('')}
      <tr class="total-row"><td colspan="2">Total LTC Access Pool</td><td>${formatCurrency(Number(m.totalLtcPool ?? 0))}</td><td></td></tr>
    </tbody>
  </table>
</div>

<div class="opp-box">
  <div class="opp-title">Recommendation</div>
  <p>${escapeHtml(analysis.recommendation)}</p>
</div>

${renderFooter(household.clientNames, preparedDate)}
</body></html>`
}
