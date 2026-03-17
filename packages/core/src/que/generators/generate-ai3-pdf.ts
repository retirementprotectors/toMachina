/**
 * generate-ai3-pdf (TRK-13380)
 *
 * Generates clean AI3 HTML from household data (PDF conversion is done by DEX).
 * AI3 = Assets / Income / Insurance / Inventory — the master methodology.
 *
 * Pure function: (Ai3GeneratorInput) => string (HTML)
 */

import type { Ai3GeneratorInput } from './types'
import { getBaseStyles, formatCurrency, renderHeader, renderFooter, escapeHtml } from './shared-styles'

export function generateAi3Pdf(input: Ai3GeneratorInput): string {
  const { household, analyses, preparedBy, preparedDate } = input
  const members = household.members
  const allAccounts = members.flatMap((m) => m.accounts)

  // Aggregate financials
  const totalIncome = members.reduce((sum, m) => sum + m.annualIncome, 0)
  const totalInvestable = members.reduce((sum, m) => sum + m.investableAssets, 0)
  const totalNetWorth = members.reduce((sum, m) => sum + m.totalNetWorth, 0)

  // Categorize accounts
  const annuities = allAccounts.filter((a) => a.type === 'fia' || a.type === 'va' || a.type === 'annuity')
  const lifeInsurance = allAccounts.filter((a) => a.type === 'life')
  const iraAccounts = allAccounts.filter((a) => a.taxStatus === 'ira')
  const rothAccounts = allAccounts.filter((a) => a.taxStatus === 'roth')
  const nqAccounts = allAccounts.filter((a) => a.taxStatus === 'nq')

  const clientNames = members.map((m) => m.name).join(' & ')

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><title>AI3 — ${escapeHtml(clientNames)}</title>
<style>${getBaseStyles()}</style></head><body>

${renderHeader('AI3 — Financial Overview', clientNames, preparedBy, preparedDate)}

<!-- SUMMARY BAR -->
<div style="display:flex;gap:0;margin-bottom:14px;border-radius:4px;overflow:hidden;border:1px solid #d0d7de">
  <div style="flex:1;text-align:center;padding:6px 4px;border-right:1px solid #d0d7de">
    <div style="font-size:7pt;text-transform:uppercase;letter-spacing:0.5px;color:#666;font-weight:600">Net Worth</div>
    <div style="font-size:13pt;font-weight:700;color:#1a3a5c">${formatCurrency(totalNetWorth)}</div>
  </div>
  <div style="flex:1;text-align:center;padding:6px 4px;border-right:1px solid #d0d7de">
    <div style="font-size:7pt;text-transform:uppercase;letter-spacing:0.5px;color:#666;font-weight:600">Investable</div>
    <div style="font-size:13pt;font-weight:700;color:#1a3a5c">${formatCurrency(totalInvestable)}</div>
  </div>
  <div style="flex:1;text-align:center;padding:6px 4px;border-right:1px solid #d0d7de">
    <div style="font-size:7pt;text-transform:uppercase;letter-spacing:0.5px;color:#666;font-weight:600">Annual Income</div>
    <div style="font-size:13pt;font-weight:700;color:#1a7a3a">${formatCurrency(totalIncome)}</div>
  </div>
  <div style="flex:1;text-align:center;padding:6px 4px">
    <div style="font-size:7pt;text-transform:uppercase;letter-spacing:0.5px;color:#666;font-weight:600">Accounts</div>
    <div style="font-size:13pt;font-weight:700;color:#1a3a5c">${allAccounts.length}</div>
  </div>
</div>

<!-- ASSETS -->
<div class="section">
  <div class="section-title">Assets — Account Inventory</div>
  <table>
    <thead><tr><th>Owner</th><th>Type</th><th>Carrier</th><th>Product</th><th>Tax Status</th><th>Value</th></tr></thead>
    <tbody>
      ${allAccounts.map((a) => `<tr${a.accountValue > 50_000 ? ' class="highlight-row"' : ''}><td>${escapeHtml(a.owner)}</td><td>${escapeHtml(a.type.toUpperCase())}</td><td>${escapeHtml(a.carrier)}</td><td>${escapeHtml(a.product)}</td><td>${escapeHtml(a.taxStatus.toUpperCase())}</td><td><strong>${formatCurrency(a.accountValue)}</strong></td></tr>`).join('')}
      <tr class="total-row"><td colspan="5">TOTAL INVESTABLE</td><td>${formatCurrency(totalInvestable)}</td></tr>
    </tbody>
  </table>
</div>

<!-- INCOME -->
<div class="section">
  <div class="section-title">Income — Household Sources</div>
  <table>
    <thead><tr><th>Member</th><th>Age</th><th>Annual Income</th><th>SS Benefits</th></tr></thead>
    <tbody>
      ${members.map((m) => `<tr><td>${escapeHtml(m.name)}</td><td>${m.age}</td><td>${formatCurrency(m.annualIncome)}</td><td>${formatCurrency(m.ssBenefits ?? 0)}</td></tr>`).join('')}
      <tr class="total-row"><td colspan="2">TOTAL</td><td>${formatCurrency(totalIncome)}</td><td></td></tr>
    </tbody>
  </table>
</div>

<!-- INSURANCE -->
${lifeInsurance.length > 0 ? `
<div class="section">
  <div class="section-title">Insurance — Life Policies</div>
  <table>
    <thead><tr><th>Carrier</th><th>Product</th><th>Death Benefit</th><th>Cash Value</th><th>Premium</th></tr></thead>
    <tbody>
      ${lifeInsurance.map((a) => `<tr><td>${escapeHtml(a.carrier)}</td><td>${escapeHtml(a.product)}</td><td><strong>${formatCurrency(a.deathBenefit ?? 0)}</strong></td><td>${formatCurrency(a.cashValue ?? 0)}</td><td>${formatCurrency(a.annualPremium ?? 0)}/yr</td></tr>`).join('')}
    </tbody>
  </table>
</div>` : ''}

<!-- INVENTORY (Opportunities) -->
${analyses.length > 0 ? `
<div class="page-break"></div>
${renderHeader('AI3 — Opportunity Inventory', clientNames, preparedBy, preparedDate)}
<div class="section">
  <div class="section-title">Identified Opportunities</div>
  ${analyses.filter((a) => a.applicable).map((a, i) => `
  <div class="opp-box${i % 3 === 1 ? ' yellow' : i % 3 === 2 ? ' blue' : ''}">
    <div class="opp-title">${i + 1}. ${escapeHtml(a.type.replace(/_/g, ' ').toUpperCase())}</div>
    <p>${escapeHtml(a.summary)}</p>
    ${a.findings.length > 0 ? `<ul>${a.findings.slice(0, 3).map((f) => `<li>${escapeHtml(f)}</li>`).join('')}</ul>` : ''}
  </div>`).join('')}
</div>` : ''}

${renderFooter(clientNames, preparedDate)}
</body></html>`
}
