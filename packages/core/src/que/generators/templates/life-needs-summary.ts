/**
 * Life Needs — Summary Template (Life & Estate Wire Expansion, Track 2)
 * Tier 1: Household needs totals, per-member net gap, premium estimate.
 */

import type { GeneratorInput } from '../types'
import { getBaseStyles, formatCurrency, formatPercent, renderHeader, renderFooter, escapeHtml } from '../shared-styles'

export function renderLifeNeedsSummary(input: GeneratorInput): string {
  const { analysis, household, preparedBy, preparedDate } = input
  const m = analysis.metrics
  const d = analysis.details as Record<string, unknown>
  const memberBreakdowns = (d.memberBreakdowns ?? []) as Array<{
    member: string
    age: number
    incomeNeed: number
    debtNeed: number
    collegeFunding: number
    miscCashNeed: number
    survivorCashNeed: number
    survivorIncomeNeed: number
    grossNeed: number
    existingCoverage: number
    netNeed: number
    monthlyPremiumEstimate: number
  }>

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><title>Life Needs Analysis — ${escapeHtml(household.clientNames)}</title>
<style>${getBaseStyles()}</style></head><body>
${renderHeader('Life Insurance Needs Analysis', household.clientNames, preparedBy, preparedDate)}

<div class="metric-cards">
  <div class="metric-card">
    <div class="label">Total Household Need</div>
    <div class="value">${formatCurrency(Number(m.totalHouseholdNeed ?? 0))}</div>
  </div>
  <div class="metric-card">
    <div class="label">Existing Coverage</div>
    <div class="value">${formatCurrency(Number(m.totalExistingCoverage ?? 0))}</div>
  </div>
  <div class="metric-card">
    <div class="label">Net Gap</div>
    <div class="value ${Number(m.totalNetNeed ?? 0) > 0 ? 'red' : 'green'}">${formatCurrency(Number(m.totalNetNeed ?? 0))}</div>
  </div>
  <div class="metric-card">
    <div class="label">Coverage Ratio</div>
    <div class="value ${Number(m.coverageRatio ?? 0) < 0.5 ? 'red' : ''}">${formatPercent(Number(m.coverageRatio ?? 0) * 100, 0)}</div>
  </div>
</div>

<div class="section">
  <div class="section-title">Needs Summary by Member</div>
  <table>
    <thead>
      <tr>
        <th>Member</th>
        <th>Age</th>
        <th>Gross Need</th>
        <th>Existing Coverage</th>
        <th>Net Gap</th>
        <th>Est. Monthly Premium</th>
      </tr>
    </thead>
    <tbody>
      ${memberBreakdowns.map((b) => `
      <tr class="${b.netNeed > 0 ? 'highlight-row' : ''}">
        <td><strong>${escapeHtml(b.member)}</strong></td>
        <td>${b.age}</td>
        <td>${formatCurrency(b.grossNeed)}</td>
        <td>${formatCurrency(b.existingCoverage)}</td>
        <td><strong style="color:${b.netNeed > 0 ? '#c44' : '#1a7a3a'}">${formatCurrency(b.netNeed)}</strong></td>
        <td>~${formatCurrency(b.monthlyPremiumEstimate)}/mo</td>
      </tr>`).join('')}
      <tr class="total-row">
        <td colspan="2">Household Total</td>
        <td>${formatCurrency(Number(m.totalHouseholdNeed ?? 0))}</td>
        <td>${formatCurrency(Number(m.totalExistingCoverage ?? 0))}</td>
        <td>${formatCurrency(Number(m.totalNetNeed ?? 0))}</td>
        <td></td>
      </tr>
    </tbody>
  </table>
</div>

<div class="opp-box ${Number(m.totalNetNeed ?? 0) > 0 ? 'yellow' : ''}">
  <div class="opp-title">Recommendation</div>
  <p>${escapeHtml(analysis.recommendation)}</p>
</div>

${analysis.warnings.length > 0 ? `
<div class="section">
  <div class="section-title">Alerts</div>
  <ul style="padding-left:16px;font-size:9pt">${analysis.warnings.map((w) => `<li style="color:#c44">${escapeHtml(w)}</li>`).join('')}</ul>
</div>` : ''}

${renderFooter(household.clientNames, preparedDate)}
</body></html>`
}
