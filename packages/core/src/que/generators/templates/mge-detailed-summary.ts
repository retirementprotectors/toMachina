/**
 * MGE Detailed — Summary Template (TRK-13420)
 * Tier 1: Household financial snapshot.
 */

import type { GeneratorInput } from '../types'
import { getBaseStyles, formatCurrency, renderHeader, renderFooter, escapeHtml } from '../shared-styles'

export function renderMgeDetailedSummary(input: GeneratorInput): string {
  const { analysis, household, preparedBy, preparedDate } = input
  const m = analysis.metrics

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><title>MGE Analysis — ${escapeHtml(household.clientNames)}</title>
<style>${getBaseStyles()}</style></head><body>
${renderHeader('Comprehensive Financial Review', household.clientNames, preparedBy, preparedDate)}

<div class="metric-cards">
  <div class="metric-card">
    <div class="label">Total Income</div>
    <div class="value green">${formatCurrency(Number(m.totalIncome ?? 0))}</div>
  </div>
  <div class="metric-card">
    <div class="label">Investable Assets</div>
    <div class="value">${formatCurrency(Number(m.totalInvestable ?? 0))}</div>
  </div>
  <div class="metric-card">
    <div class="label">Net Worth</div>
    <div class="value">${formatCurrency(Number(m.totalNetWorth ?? 0))}</div>
  </div>
  <div class="metric-card">
    <div class="label">Total Accounts</div>
    <div class="value">${m.totalAccounts ?? 0}</div>
  </div>
</div>

<div class="section">
  <div class="section-title">Household Members</div>
  <div class="two-col">
    ${household.members.map((mem) => `
    <div style="border:1px solid #d0d7de;border-radius:4px;padding:8px 10px;margin-bottom:8px">
      <p style="font-weight:700;font-size:9.5pt;color:#1a3a5c;border-bottom:1px solid #e0e0e0;padding-bottom:3px;margin-bottom:4px">${escapeHtml(mem.name)}</p>
      <p style="font-size:9pt">Age: ${mem.age} | Filing: ${escapeHtml(household.filingStatus)} | State: ${escapeHtml(household.state)}</p>
    </div>`).join('')}
  </div>
</div>

<div class="section">
  <div class="section-title">Applicable Casework Types</div>
  ${analysis.findings.length > 0
    ? `<ul style="padding-left:16px;font-size:9pt">${analysis.findings.map((f) => `<li>${escapeHtml(f)}</li>`).join('')}</ul>`
    : '<p style="font-size:9pt;color:#666">No specific casework types detected. General review recommended.</p>'}
</div>

<div class="opp-box">
  <div class="opp-title">Summary</div>
  <p>${escapeHtml(analysis.summary)}</p>
</div>

${renderFooter(household.clientNames, preparedDate)}
</body></html>`
}
