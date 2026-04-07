/**
 * Life Needs — Detail Template (Life & Estate Wire Expansion, Track 2)
 * Tier 2/3: Full needs breakdown per member — income, debt, college, misc, survivor.
 */

import type { GeneratorInput } from '../types'
import { getBaseStyles, formatCurrency, renderHeader, renderFooter, escapeHtml } from '../shared-styles'

export function renderLifeNeedsDetail(input: GeneratorInput): string {
  const { analysis, household, preparedBy, preparedDate } = input
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
<html lang="en"><head><meta charset="UTF-8"><title>Life Needs Detail — ${escapeHtml(household.clientNames)}</title>
<style>${getBaseStyles()}</style></head><body>
${renderHeader('Life Insurance Needs — Detailed Breakdown', household.clientNames, preparedBy, preparedDate)}

${memberBreakdowns.map((b) => `
<div class="section">
  <div class="section-title">${escapeHtml(b.member)} — Age ${b.age} | Net Gap: ${formatCurrency(b.netNeed)}</div>
  <table>
    <thead><tr><th>Need Component</th><th>Amount</th><th>Notes</th></tr></thead>
    <tbody>
      <tr><td>Income Replacement Need</td><td>${formatCurrency(b.incomeNeed)}</td><td>70% income × years to 65</td></tr>
      <tr class="highlight-row"><td>Debt Payoff Need</td><td>${formatCurrency(b.debtNeed)}</td><td>Mortgage + consumer debt</td></tr>
      <tr><td>Education Funding</td><td>${formatCurrency(b.collegeFunding)}</td><td>4-year college cost per dependent child</td></tr>
      <tr class="highlight-row"><td>Final Expenses + Emergency Fund</td><td>${formatCurrency(b.miscCashNeed)}</td><td>Burial, estate costs, 6-month buffer</td></tr>
      <tr><td>Survivor Immediate Cash Need</td><td>${formatCurrency(b.survivorCashNeed)}</td><td>3-month survivor liquidity</td></tr>
      <tr class="highlight-row"><td>Survivor Ongoing Income Gap</td><td>${formatCurrency(b.survivorIncomeNeed)}</td><td>Income replacement for surviving spouse</td></tr>
      <tr class="total-row"><td>Gross Need (before offsets)</td><td>${formatCurrency(b.grossNeed)}</td><td></td></tr>
      <tr><td>Existing Coverage Offset</td><td style="color:#1a7a3a">(${formatCurrency(b.existingCoverage)})</td><td>Current life policies</td></tr>
      <tr class="total-row"><td><strong>Net Coverage Gap</strong></td><td><strong style="color:${b.netNeed > 0 ? '#ff8' : '#aef'}">${formatCurrency(b.netNeed)}</strong></td><td></td></tr>
      <tr><td>Estimated Monthly Premium</td><td>~${formatCurrency(b.monthlyPremiumEstimate)}/mo</td><td>20-year term estimate</td></tr>
    </tbody>
  </table>
</div>`).join('')}

<div class="section">
  <div class="section-title">Key Findings</div>
  <ul style="padding-left:16px;font-size:9pt">${analysis.findings.map((f) => `<li>${escapeHtml(f)}</li>`).join('')}</ul>
</div>

<div class="opp-box">
  <div class="opp-title">Recommendation</div>
  <p>${escapeHtml(analysis.recommendation)}</p>
</div>

<div class="disclosure">
  Life insurance needs analysis based on household data provided. Income replacement estimates use 70% income multiplier through age 65. College funding assumes 6.8% annual education inflation. Premium estimates are illustrative; actual premiums depend on underwriting outcome. This is not an application for insurance.
</div>

${renderFooter(household.clientNames, preparedDate)}
</body></html>`
}
