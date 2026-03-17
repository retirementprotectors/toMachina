/**
 * Income LATER — Detail Template (TRK-13413)
 * Tier 2/3: Year-by-year benefit base growth + tax math.
 */

import type { GeneratorInput } from '../types'
import { getBaseStyles, formatCurrency, formatPercent, renderHeader, renderFooter, escapeHtml } from '../shared-styles'

export function renderIncomeLaterDetail(input: GeneratorInput): string {
  const { analysis, household, preparedBy, preparedDate } = input
  const d = analysis.details as Record<string, unknown>
  const projections = (d.projections ?? []) as Array<{
    account: string; carrier: string; currentBase: number; rollupRate: number; method: string; currentIncome: number;
    projections: Array<{ yearsDeferred: number; futureBase: number; futureIncome: number; additionalIncome: number }>
  }>
  const taxAnalysis = (d.taxAnalysis ?? {}) as Record<string, unknown>

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><title>Income LATER Detail — ${escapeHtml(household.clientNames)}</title>
<style>${getBaseStyles()}</style></head><body>
${renderHeader('Deferred Income — Detailed Projections', household.clientNames, preparedBy, preparedDate)}

${projections.map((p) => `
<div class="section">
  <div class="section-title">${escapeHtml(p.account)}</div>
  <p style="font-size:9pt;margin-bottom:6px">Current Benefit Base: <strong>${formatCurrency(p.currentBase)}</strong> | Rollup Rate: <strong>${formatPercent(p.rollupRate)}</strong> (${p.method}) | Current Income: <strong>${formatCurrency(p.currentIncome)}/year</strong></p>
  <table>
    <thead><tr><th>Years Deferred</th><th>Future Benefit Base</th><th>Future Annual Income</th><th>Additional Income</th></tr></thead>
    <tbody>
      <tr><td>0 (Now)</td><td>${formatCurrency(p.currentBase)}</td><td>${formatCurrency(p.currentIncome)}</td><td>—</td></tr>
      ${p.projections.map((r) => `<tr${r.additionalIncome > 0 ? ' class="highlight-row"' : ''}><td>${r.yearsDeferred}</td><td>${formatCurrency(r.futureBase)}</td><td><strong>${formatCurrency(r.futureIncome)}</strong></td><td style="color:#1a7a3a">+${formatCurrency(r.additionalIncome)}</td></tr>`).join('')}
    </tbody>
  </table>
</div>`).join('')}

${Object.keys(taxAnalysis).length > 0 ? `
<div class="section">
  <div class="section-title">Tax Impact Analysis</div>
  <div class="two-col">
    <div>
      <p style="font-size:9pt"><strong>Without GMIB Activation:</strong></p>
      <p style="font-size:9pt">Provisional Income: ${formatCurrency(Number(taxAnalysis.currentProvisionalIncome ?? 0))}</p>
      <p style="font-size:9pt">Marginal Rate: ${formatPercent(Number(taxAnalysis.currentMarginalRate ?? 0))}</p>
    </div>
    <div>
      <p style="font-size:9pt"><strong>With GMIB Activation:</strong></p>
      <p style="font-size:9pt">Provisional Income: ${formatCurrency(Number(taxAnalysis.withGmibProvisionalIncome ?? 0))}</p>
      <p style="font-size:9pt">Marginal Rate: ${formatPercent(Number(taxAnalysis.withGmibMarginalRate ?? 0))}</p>
      <p style="font-size:9pt">Additional Federal Tax: <strong>${formatCurrency(Number(taxAnalysis.additionalFederalTax ?? 0))}</strong></p>
      <p style="font-size:9pt">Net Income After Tax: <strong style="color:#1a7a3a">${formatCurrency(Number(taxAnalysis.netIncomeAfterTax ?? 0))}</strong></p>
    </div>
  </div>
</div>` : ''}

<div class="opp-box">
  <div class="opp-title">Detailed Recommendation</div>
  <p>${escapeHtml(analysis.recommendation)}</p>
  <ul>${analysis.findings.map((f) => `<li style="font-size:8.5pt">${escapeHtml(f)}</li>`).join('')}</ul>
</div>

${renderFooter(household.clientNames, preparedDate)}
</body></html>`
}
