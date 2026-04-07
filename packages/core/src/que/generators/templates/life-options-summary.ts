/**
 * Life Options — Summary Template (Life & Estate Wire Expansion, Track 2)
 * Tier 1: 3-option side-by-side comparison — A (Final Expenses), B (Income Replacement), C (IUL).
 */

import type { GeneratorInput } from '../types'
import { getBaseStyles, formatCurrency, renderHeader, renderFooter, escapeHtml } from '../shared-styles'

export function renderLifeOptionsSummary(input: GeneratorInput): string {
  const { analysis, household, preparedBy, preparedDate } = input
  const m = analysis.metrics
  const d = analysis.details as Record<string, unknown>
  const memberOptions = (d.memberOptions ?? []) as Array<{
    member: string
    age: number
    totalNeed: number
    optionA: { label: string; faceAmount: number; monthlyPremium: number; termYears: number | null; carrier: string; product: string; livingBenefits: boolean }
    optionB: { label: string; faceAmount: number; monthlyPremium: number; termYears: number | null; carrier: string; product: string; livingBenefits: boolean }
    optionC: { label: string; faceAmount: number; monthlyPremium: number; termYears: number | null; carrier: string; product: string; livingBenefits: boolean; cashValueAt10Years: number }
  }>

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><title>Life Options — ${escapeHtml(household.clientNames)}</title>
<style>${getBaseStyles()}</style></head><body>
${renderHeader('Life Insurance Options', household.clientNames, preparedBy, preparedDate)}

<div class="metric-cards">
  <div class="metric-card">
    <div class="label">Option A — Final Expenses</div>
    <div class="value">${formatCurrency(Number(m.totalOptionAMonthly ?? 0))}<span style="font-size:9pt;font-weight:400">/mo</span></div>
  </div>
  <div class="metric-card">
    <div class="label">Option B — Income Replacement</div>
    <div class="value">${formatCurrency(Number(m.totalOptionBMonthly ?? 0))}<span style="font-size:9pt;font-weight:400">/mo</span></div>
  </div>
  <div class="metric-card">
    <div class="label">Option C — Swiss-Army IUL</div>
    <div class="value green">${formatCurrency(Number(m.totalOptionCMonthly ?? 0))}<span style="font-size:9pt;font-weight:400">/mo</span></div>
  </div>
  <div class="metric-card">
    <div class="label">B vs C Difference</div>
    <div class="value">${formatCurrency(Number(m.deltaBC ?? 0))}<span style="font-size:9pt;font-weight:400">/mo</span></div>
  </div>
</div>

${memberOptions.map((mo) => `
<div class="section">
  <div class="section-title">${escapeHtml(mo.member)} — Age ${mo.age} | Total Need: ${formatCurrency(mo.totalNeed)}</div>
  <table>
    <thead>
      <tr>
        <th>Option</th>
        <th>Face Amount</th>
        <th>Term</th>
        <th>Carrier / Product</th>
        <th>Monthly Premium</th>
        <th>Living Benefits</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>A — Final Expenses</strong></td>
        <td>${formatCurrency(mo.optionA.faceAmount)}</td>
        <td>${mo.optionA.termYears ? `${mo.optionA.termYears}-yr Term` : 'Permanent'}</td>
        <td>${escapeHtml(mo.optionA.carrier)} ${escapeHtml(mo.optionA.product)}</td>
        <td>${formatCurrency(mo.optionA.monthlyPremium)}/mo</td>
        <td>No</td>
      </tr>
      <tr class="highlight-row">
        <td><strong>B — Income Replacement</strong></td>
        <td>${formatCurrency(mo.optionB.faceAmount)}</td>
        <td>${mo.optionB.termYears ? `${mo.optionB.termYears}-yr Term` : 'Permanent'}</td>
        <td>${escapeHtml(mo.optionB.carrier)} ${escapeHtml(mo.optionB.product)}</td>
        <td>${formatCurrency(mo.optionB.monthlyPremium)}/mo</td>
        <td>No</td>
      </tr>
      <tr style="background:#f0f6ff">
        <td><strong>C — Swiss-Army IUL ★</strong></td>
        <td>${formatCurrency(mo.optionC.faceAmount)}</td>
        <td>Permanent</td>
        <td>${escapeHtml(mo.optionC.carrier)} ${escapeHtml(mo.optionC.product)}</td>
        <td><strong>${formatCurrency(mo.optionC.monthlyPremium)}/mo</strong></td>
        <td><strong style="color:#1a7a3a">Yes</strong></td>
      </tr>
    </tbody>
  </table>
</div>`).join('')}

<div class="opp-box blue">
  <div class="opp-title">Recommendation</div>
  <p>${escapeHtml(analysis.recommendation)}</p>
</div>

${renderFooter(household.clientNames, preparedDate)}
</body></html>`
}
