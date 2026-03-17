/**
 * Income NOW — Summary Template (TRK-13410)
 * Tier 1 one-pager: Current vs proposed income, fee comparison, income gap/surplus.
 */

import type { GeneratorInput } from '../types'
import { getBaseStyles, formatCurrency, formatPercent, renderHeader, renderFooter, escapeHtml } from '../shared-styles'

export function renderIncomeNowSummary(input: GeneratorInput): string {
  const { analysis, household, preparedBy, preparedDate } = input
  const m = analysis.metrics
  const d = analysis.details as Record<string, unknown>
  const dormant = (d.dormantDetails ?? []) as Array<{ account: string; annualIncome: number; monthlyIncome: number }>

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><title>Income NOW — ${escapeHtml(household.clientNames)}</title>
<style>${getBaseStyles()}</style></head><body>
${renderHeader('Income Activation Analysis', household.clientNames, preparedBy, preparedDate)}

<div class="metric-cards">
  <div class="metric-card">
    <div class="label">Current Household Income</div>
    <div class="value">${formatCurrency(Number(m.totalHouseholdIncome ?? 0))}</div>
  </div>
  <div class="metric-card">
    <div class="label">Dormant Guaranteed Income</div>
    <div class="value green">${formatCurrency(Number(m.totalDormantIncome ?? 0))}</div>
  </div>
  <div class="metric-card">
    <div class="label">Active Rider Income</div>
    <div class="value">${formatCurrency(Number(m.totalActiveIncome ?? 0))}</div>
  </div>
  <div class="metric-card">
    <div class="label">Breakeven Equity</div>
    <div class="value ${Number(m.worstBreakevenPercent ?? 0) > 7 ? 'red' : ''}">${formatPercent(Number(m.worstBreakevenPercent ?? 0), 1)}</div>
  </div>
</div>

${dormant.length > 0 ? `
<div class="section">
  <div class="section-title">Dormant Income Riders — Ready to Activate</div>
  <table>
    <thead><tr><th>Account</th><th>Annual Income</th><th>Monthly Income</th></tr></thead>
    <tbody>
      ${dormant.map((r) => `<tr class="highlight-row"><td>${escapeHtml(r.account)}</td><td><strong>${formatCurrency(r.annualIncome)}</strong></td><td>${formatCurrency(r.monthlyIncome)}</td></tr>`).join('')}
      <tr class="total-row"><td>Total Dormant Income</td><td>${formatCurrency(Number(m.totalDormantIncome ?? 0))}</td><td>${formatCurrency(Number(m.totalDormantIncome ?? 0) / 12)}</td></tr>
    </tbody>
  </table>
</div>` : ''}

${Number(m.totalRmd ?? 0) > 0 ? `
<div class="section">
  <div class="section-title">Required Minimum Distributions</div>
  <p style="font-size:9pt;margin-bottom:6px">Total annual RMD requirement: <strong>${formatCurrency(Number(m.totalRmd))}</strong></p>
</div>` : ''}

<div class="opp-box ${Number(m.worstBreakevenPercent ?? 0) > 7 ? 'yellow' : ''}">
  <div class="opp-title">Recommendation</div>
  <p>${escapeHtml(analysis.recommendation)}</p>
</div>

${analysis.warnings.length > 0 ? `
<div class="section">
  <div class="section-title">Warnings</div>
  <ul style="padding-left:16px;font-size:9pt">${analysis.warnings.map((w) => `<li>${escapeHtml(w)}</li>`).join('')}</ul>
</div>` : ''}

${renderFooter(household.clientNames, preparedDate)}
</body></html>`
}
