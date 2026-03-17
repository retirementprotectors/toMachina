/**
 * ROTH Conversion — Summary Template (TRK-13422)
 * Tier 1: Before/after bracket comparison.
 */

import type { GeneratorInput } from '../types'
import { getBaseStyles, formatCurrency, formatPercent, renderHeader, renderFooter, escapeHtml } from '../shared-styles'

export function renderRothConversionSummary(input: GeneratorInput): string {
  const { analysis, household, preparedBy, preparedDate } = input
  const m = analysis.metrics

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><title>Roth Conversion — ${escapeHtml(household.clientNames)}</title>
<style>${getBaseStyles()}</style></head><body>
${renderHeader('Roth Conversion Analysis', household.clientNames, preparedBy, preparedDate)}

<div class="metric-cards">
  <div class="metric-card">
    <div class="label">Traditional IRA Balance</div>
    <div class="value">${formatCurrency(Number(m.totalIraBalance ?? 0))}</div>
  </div>
  <div class="metric-card">
    <div class="label">Current Marginal Rate</div>
    <div class="value">${formatPercent(Number(m.currentMarginalRate ?? 0))}</div>
  </div>
  <div class="metric-card">
    <div class="label">Optimal Conversion</div>
    <div class="value green">${formatCurrency(Number(m.optimalConversion ?? 0))}</div>
  </div>
  <div class="metric-card">
    <div class="label">Break-Even Years</div>
    <div class="value">${m.breakEvenYears ?? 'N/A'}</div>
  </div>
</div>

<div class="section">
  <div class="section-title">Before vs After Conversion</div>
  <table>
    <thead><tr><th>Metric</th><th>Without Conversion</th><th>With Optimal Conversion</th></tr></thead>
    <tbody>
      <tr><td>Marginal Tax Bracket</td><td>${formatPercent(Number(m.currentMarginalRate ?? 0))}</td><td>${formatPercent(Number(m.optimalEffectiveRate ?? 0))}</td></tr>
      <tr><td>IRMAA Tier</td><td>${escapeHtml(String(m.currentIrmaaTier ?? 'Standard'))}</td><td>See detailed scenarios</td></tr>
      <tr class="highlight-row"><td>Optimal Amount</td><td>—</td><td><strong>${formatCurrency(Number(m.optimalConversion ?? 0))}</strong></td></tr>
      <tr class="highlight-row"><td>Effective Conversion Rate</td><td>—</td><td><strong>${formatPercent(Number(m.optimalEffectiveRate ?? 0))}</strong></td></tr>
    </tbody>
  </table>
</div>

<div class="opp-box">
  <div class="opp-title">Recommendation</div>
  <p>${escapeHtml(analysis.recommendation)}</p>
</div>

${analysis.warnings.length > 0 ? `
<div class="opp-box yellow">
  <div class="opp-title">Caution</div>
  <ul>${analysis.warnings.map((w) => `<li>${escapeHtml(w)}</li>`).join('')}</ul>
</div>` : ''}

${renderFooter(household.clientNames, preparedDate)}
</body></html>`
}
