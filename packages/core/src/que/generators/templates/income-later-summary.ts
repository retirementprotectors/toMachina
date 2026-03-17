/**
 * Income LATER — Summary Template (TRK-13412)
 * Tier 1: Rollup advantage + 3-option comparison.
 */

import type { GeneratorInput } from '../types'
import { getBaseStyles, formatCurrency, renderHeader, renderFooter, escapeHtml } from '../shared-styles'

export function renderIncomeLaterSummary(input: GeneratorInput): string {
  const { analysis, household, preparedBy, preparedDate } = input
  const m = analysis.metrics
  const d = analysis.details as Record<string, unknown>
  const threeOptions = d.threeOptions as Record<string, { strategy: string; annualIncome: number; description: string }> | undefined

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><title>Income LATER — ${escapeHtml(household.clientNames)}</title>
<style>${getBaseStyles()}</style></head><body>
${renderHeader('Deferred Income Strategy', household.clientNames, preparedBy, preparedDate)}

<div class="metric-cards">
  <div class="metric-card">
    <div class="label">Current Guaranteed Income</div>
    <div class="value">${formatCurrency(Number(m.currentGuaranteedIncome ?? 0))}</div>
  </div>
  <div class="metric-card">
    <div class="label">Additional from Deferral</div>
    <div class="value green">${formatCurrency(Number(m.bestAdditionalIncome ?? 0))}</div>
  </div>
  <div class="metric-card">
    <div class="label">Rollup Accounts</div>
    <div class="value">${m.rollupAccountCount ?? 0}</div>
  </div>
  <div class="metric-card">
    <div class="label">Max Deferral Years</div>
    <div class="value">${m.maxDeferralYears ?? 0}</div>
  </div>
</div>

${threeOptions ? `
<div class="section">
  <div class="section-title">Three-Option Framework</div>
  <table>
    <thead><tr><th>Option</th><th>Strategy</th><th>Annual Income</th><th>Description</th></tr></thead>
    <tbody>
      <tr><td><strong>A</strong></td><td>${escapeHtml(threeOptions.optionA.strategy)}</td><td>${formatCurrency(threeOptions.optionA.annualIncome)}</td><td style="font-size:8.5pt">${escapeHtml(threeOptions.optionA.description)}</td></tr>
      <tr class="highlight-row"><td><strong>B</strong></td><td>${escapeHtml(threeOptions.optionB.strategy)}</td><td><strong>${formatCurrency(threeOptions.optionB.annualIncome)}</strong></td><td style="font-size:8.5pt">${escapeHtml(threeOptions.optionB.description)}</td></tr>
      <tr><td><strong>C</strong></td><td>${escapeHtml(threeOptions.optionC.strategy)}</td><td>${formatCurrency(threeOptions.optionC.annualIncome)}</td><td style="font-size:8.5pt">${escapeHtml(threeOptions.optionC.description)}</td></tr>
    </tbody>
  </table>
</div>` : ''}

<div class="opp-box">
  <div class="opp-title">Recommendation</div>
  <p>${escapeHtml(analysis.recommendation)}</p>
</div>

${analysis.warnings.length > 0 ? `
<div class="opp-box yellow">
  <div class="opp-title">Tax Considerations</div>
  <ul>${analysis.warnings.map((w) => `<li>${escapeHtml(w)}</li>`).join('')}</ul>
</div>` : ''}

${renderFooter(household.clientNames, preparedDate)}
</body></html>`
}
