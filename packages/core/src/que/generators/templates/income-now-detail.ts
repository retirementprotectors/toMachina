/**
 * Income NOW — Detail Template (TRK-13411)
 * Tier 2/3: Year-by-year projection with fee breakdown.
 */

import type { GeneratorInput } from '../types'
import { getBaseStyles, formatCurrency, formatPercent, renderHeader, renderFooter, escapeHtml } from '../shared-styles'

export function renderIncomeNowDetail(input: GeneratorInput): string {
  const { analysis, household, preparedBy, preparedDate } = input
  const m = analysis.metrics
  const d = analysis.details as Record<string, unknown>
  const dormant = (d.dormantDetails ?? []) as Array<{ account: string; annualIncome: number; monthlyIncome: number }>
  const rmdDetails = (d.rmdDetails ?? []) as Array<{ account: string; rmd: number; factor: number }>
  const bepDetails = (d.bepDetails ?? []) as Array<{ account: string; breakevenPercent: number; isUnsustainable: boolean }>

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><title>Income NOW Detail — ${escapeHtml(household.clientNames)}</title>
<style>${getBaseStyles()}</style></head><body>
${renderHeader('Income Activation — Detailed Analysis', household.clientNames, preparedBy, preparedDate)}

<div class="section">
  <div class="section-title">Dormant Income Rider Detail</div>
  <table>
    <thead><tr><th>Account</th><th>Annual Income</th><th>Monthly Income</th><th>Status</th></tr></thead>
    <tbody>
      ${dormant.map((r) => `<tr class="highlight-row"><td>${escapeHtml(r.account)}</td><td><strong>${formatCurrency(r.annualIncome)}</strong></td><td>${formatCurrency(r.monthlyIncome)}</td><td>Dormant — Ready</td></tr>`).join('')}
    </tbody>
  </table>
</div>

${rmdDetails.length > 0 ? `
<div class="section">
  <div class="section-title">RMD Requirements by Account</div>
  <table>
    <thead><tr><th>Account</th><th>RMD Amount</th><th>IRS Factor</th></tr></thead>
    <tbody>
      ${rmdDetails.map((r) => `<tr><td>${escapeHtml(r.account)}</td><td>${formatCurrency(r.rmd)}</td><td>${r.factor.toFixed(1)}</td></tr>`).join('')}
      <tr class="total-row"><td>Total RMD</td><td>${formatCurrency(Number(m.totalRmd ?? 0))}</td><td></td></tr>
    </tbody>
  </table>
</div>` : ''}

${bepDetails.length > 0 ? `
<div class="section">
  <div class="section-title">Portfolio Sustainability — Breakeven Equity</div>
  <table>
    <thead><tr><th>Account</th><th>Breakeven %</th><th>Sustainable?</th></tr></thead>
    <tbody>
      ${bepDetails.map((r) => `<tr class="${r.isUnsustainable ? 'highlight-row' : ''}"><td>${escapeHtml(r.account)}</td><td><strong>${formatPercent(r.breakevenPercent)}</strong></td><td>${r.isUnsustainable ? '<span style="color:#c44">NO — Depletion Risk</span>' : '<span style="color:#1a7a3a">Yes</span>'}</td></tr>`).join('')}
    </tbody>
  </table>
  <p style="font-size:8pt;color:#666;margin-top:4px">Breakeven equity &gt; 7% indicates the portfolio cannot sustain current withdrawals at historical market returns.</p>
</div>` : ''}

<div class="section">
  <div class="section-title">Findings</div>
  <ul style="padding-left:16px;font-size:9pt">${analysis.findings.map((f) => `<li>${escapeHtml(f)}</li>`).join('')}</ul>
</div>

<div class="opp-box">
  <div class="opp-title">Recommendation</div>
  <p>${escapeHtml(analysis.recommendation)}</p>
</div>

${renderFooter(household.clientNames, preparedDate)}
</body></html>`
}
