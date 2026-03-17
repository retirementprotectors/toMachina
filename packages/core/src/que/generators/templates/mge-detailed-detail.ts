/**
 * MGE Detailed — Detail Template (TRK-13421)
 * Tier 2/3: Full AI3-style multi-category analysis.
 */

import type { GeneratorInput } from '../types'
import { getBaseStyles, formatCurrency, renderHeader, renderFooter, escapeHtml } from '../shared-styles'

export function renderMgeDetailedDetail(input: GeneratorInput): string {
  const { analysis, household, preparedBy, preparedDate } = input
  const m = analysis.metrics
  const d = analysis.details as Record<string, unknown>
  const analyses = (d.subAnalyses ?? []) as Array<{ type: string; summary: string; findings: string[]; applicable: boolean }>

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><title>MGE Detailed — ${escapeHtml(household.clientNames)}</title>
<style>${getBaseStyles()}</style></head><body>
${renderHeader('Comprehensive Review — Full Detail', household.clientNames, preparedBy, preparedDate)}

<div class="section">
  <div class="section-title">Ai3 Framework: Assets / Income / Insurance / Inventory</div>
  <div class="two-col">
    <div>
      <p style="font-size:9pt"><strong>Assets</strong></p>
      <p style="font-size:9pt">Investable: ${formatCurrency(Number(m.totalInvestable ?? 0))}</p>
      <p style="font-size:9pt">Net Worth: ${formatCurrency(Number(m.totalNetWorth ?? 0))}</p>
      <p style="font-size:9pt">Accounts: ${m.totalAccounts ?? 0}</p>
    </div>
    <div>
      <p style="font-size:9pt"><strong>Income</strong></p>
      <p style="font-size:9pt">Total Household: ${formatCurrency(Number(m.totalIncome ?? 0))}</p>
      <p style="font-size:9pt">Members: ${m.memberCount ?? 0}</p>
    </div>
  </div>
</div>

<div class="section">
  <div class="section-title">3-Bucket Asset Model</div>
  <table>
    <thead><tr><th></th><th>Safety</th><th>Liquidity</th><th>Growth</th></tr></thead>
    <tbody>
      <tr><td><strong>Bank</strong></td><td style="color:#1a7a3a">Yes</td><td style="color:#1a7a3a">Yes</td><td style="color:#c44">No</td></tr>
      <tr><td><strong>Institutional (FIA/MYGA)</strong></td><td style="color:#1a7a3a">Yes</td><td style="color:#c44">No</td><td style="color:#1a7a3a">Yes</td></tr>
      <tr><td><strong>Fiduciary (RIA)</strong></td><td style="color:#c44">No</td><td style="color:#1a7a3a">Yes</td><td style="color:#1a7a3a">Yes</td></tr>
    </tbody>
  </table>
  <p style="font-size:8pt;color:#666;margin-top:4px">Rule: No asset delivers all three. Pick 2 of 3. RPI helps optimize across buckets.</p>
</div>

${analyses.length > 0 ? analyses.map((a) => `
<div class="opp-box ${a.applicable ? '' : 'blue'}">
  <div class="opp-title">${escapeHtml(a.type)}</div>
  <p>${escapeHtml(a.summary)}</p>
  ${a.findings.length > 0 ? `<ul>${a.findings.slice(0, 3).map((f) => `<li>${escapeHtml(f)}</li>`).join('')}</ul>` : ''}
</div>`).join('') : `
<div class="section">
  <div class="section-title">Analysis Sections</div>
  ${analysis.findings.map((f) => `<p style="font-size:9pt;margin-bottom:4px">- ${escapeHtml(f)}</p>`).join('')}
</div>`}

<div class="opp-box">
  <div class="opp-title">Comprehensive Recommendation</div>
  <p>${escapeHtml(analysis.recommendation)}</p>
</div>

${renderFooter(household.clientNames, preparedDate)}
</body></html>`
}
