/**
 * Life Options — Detail Template (Life & Estate Wire Expansion, Track 2)
 * Tier 2/3: Full pros/cons, cash value comparison, net outlay at 10 years.
 */

import type { GeneratorInput } from '../types'
import { getBaseStyles, formatCurrency, renderHeader, renderFooter, escapeHtml } from '../shared-styles'

export function renderLifeOptionsDetail(input: GeneratorInput): string {
  const { analysis, household, preparedBy, preparedDate } = input
  const m = analysis.metrics
  const d = analysis.details as Record<string, unknown>
  const memberOptions = (d.memberOptions ?? []) as Array<{
    member: string
    age: number
    totalNeed: number
    optionA: { label: string; description: string; faceAmount: number; monthlyPremium: number; annualPremium: number; termYears: number | null; carrier: string; product: string; pros: string[]; cons: string[]; cashValueAt10Years: number; netOutlayAt10Years: number; livingBenefits: boolean }
    optionB: { label: string; description: string; faceAmount: number; monthlyPremium: number; annualPremium: number; termYears: number | null; carrier: string; product: string; pros: string[]; cons: string[]; cashValueAt10Years: number; netOutlayAt10Years: number; livingBenefits: boolean }
    optionC: { label: string; description: string; faceAmount: number; monthlyPremium: number; annualPremium: number; termYears: number | null; carrier: string; product: string; pros: string[]; cons: string[]; cashValueAt10Years: number; netOutlayAt10Years: number; livingBenefits: boolean }
  }>

  const renderOption = (opt: typeof memberOptions[0]['optionA'], color: string) => `
    <div style="border:1.5px solid ${color};border-radius:4px;padding:8px 10px;margin-bottom:8px">
      <div style="font-weight:700;color:#1a3158;margin-bottom:4px">${escapeHtml(opt.label)}</div>
      <div style="font-size:8.5pt;color:#555;margin-bottom:6px">${escapeHtml(opt.description)}</div>
      <table>
        <tbody>
          <tr><td style="width:45%"><strong>Face Amount</strong></td><td>${formatCurrency(opt.faceAmount)}</td></tr>
          <tr><td><strong>Monthly Premium</strong></td><td><strong>${formatCurrency(opt.monthlyPremium)}/mo</strong></td></tr>
          <tr><td><strong>Annual Premium</strong></td><td>${formatCurrency(opt.annualPremium)}/yr</td></tr>
          <tr><td><strong>10-Yr Premium Outlay</strong></td><td>${formatCurrency(opt.annualPremium * 10)}</td></tr>
          ${opt.cashValueAt10Years > 0 ? `<tr><td><strong>10-Yr Cash Value</strong></td><td style="color:#1a7a3a">${formatCurrency(opt.cashValueAt10Years)}</td></tr>` : ''}
          <tr><td><strong>10-Yr Net Outlay</strong></td><td>${formatCurrency(opt.netOutlayAt10Years)}</td></tr>
          <tr><td><strong>Living Benefits</strong></td><td>${opt.livingBenefits ? '<span style="color:#1a7a3a;font-weight:700">Yes — Chronic/Terminal/Critical</span>' : 'No'}</td></tr>
        </tbody>
      </table>
      <div style="margin-top:6px;display:flex;gap:10px">
        <div style="flex:1">
          <div style="font-size:7.5pt;font-weight:700;color:#1a7a3a;text-transform:uppercase;margin-bottom:3px">Pros</div>
          <ul style="padding-left:12px;font-size:8pt;margin:0">${opt.pros.map((p) => `<li>${escapeHtml(p)}</li>`).join('')}</ul>
        </div>
        <div style="flex:1">
          <div style="font-size:7.5pt;font-weight:700;color:#c44;text-transform:uppercase;margin-bottom:3px">Cons</div>
          <ul style="padding-left:12px;font-size:8pt;margin:0">${opt.cons.map((c) => `<li>${escapeHtml(c)}</li>`).join('')}</ul>
        </div>
      </div>
    </div>`

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><title>Life Options Detail — ${escapeHtml(household.clientNames)}</title>
<style>${getBaseStyles()}</style></head><body>
${renderHeader('Life Insurance Options — Detailed Comparison', household.clientNames, preparedBy, preparedDate)}

${memberOptions.map((mo) => `
<div class="section">
  <div class="section-title">${escapeHtml(mo.member)} — Age ${mo.age} | Total Need: ${formatCurrency(mo.totalNeed)}</div>
  ${renderOption(mo.optionA, '#aaa')}
  ${renderOption(mo.optionB, '#4a7ab5')}
  ${renderOption(mo.optionC, '#2a7d4f')}
</div>`).join('')}

<div class="section">
  <div class="section-title">Household Premium Summary</div>
  <table>
    <thead><tr><th>Option</th><th>Monthly (Household)</th><th>Annual (Household)</th><th>10-Year Total</th></tr></thead>
    <tbody>
      <tr><td>A — Final Expenses</td><td>${formatCurrency(Number(m.totalOptionAMonthly ?? 0))}/mo</td><td>${formatCurrency(Number(m.totalOptionAMonthly ?? 0) * 12)}</td><td>${formatCurrency(Number(m.totalOptionAMonthly ?? 0) * 12 * 10)}</td></tr>
      <tr class="highlight-row"><td>B — Income Replacement</td><td>${formatCurrency(Number(m.totalOptionBMonthly ?? 0))}/mo</td><td>${formatCurrency(Number(m.totalOptionBMonthly ?? 0) * 12)}</td><td>${formatCurrency(Number(m.totalOptionBMonthly ?? 0) * 12 * 10)}</td></tr>
      <tr style="background:#f0f6ff"><td><strong>C — Swiss-Army IUL ★</strong></td><td><strong>${formatCurrency(Number(m.totalOptionCMonthly ?? 0))}/mo</strong></td><td>${formatCurrency(Number(m.totalOptionCMonthly ?? 0) * 12)}</td><td>${formatCurrency(Number(m.totalOptionCMonthly ?? 0) * 12 * 10)}</td></tr>
    </tbody>
  </table>
</div>

<div class="opp-box blue">
  <div class="opp-title">Recommendation</div>
  <p>${escapeHtml(analysis.recommendation)}</p>
</div>

<div class="disclosure">
  Premium illustrations are estimates based on preferred health class and current carrier rates. Actual premiums are subject to underwriting. IUL cash value projections assume mid-range index crediting; actual results will vary. Life insurance products are not deposits, are not FDIC/NCUA insured, are not obligations of or guaranteed by any financial institution, are not insured by any federal government agency, and may lose value. This illustration is not a contract or policy offer.
</div>

${renderFooter(household.clientNames, preparedDate)}
</body></html>`
}
