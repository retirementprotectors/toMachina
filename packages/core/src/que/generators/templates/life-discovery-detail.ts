/**
 * Life Discovery — Detail Template (Life & Estate Wire Expansion, Track 2)
 * Tier 2/3: Per-account group coverage detail, portability rules, conversion timeline.
 */

import type { GeneratorInput } from '../types'
import { getBaseStyles, formatCurrency, renderHeader, renderFooter, escapeHtml } from '../shared-styles'

export function renderLifeDiscoveryDetail(input: GeneratorInput): string {
  const { analysis, household, preparedBy, preparedDate } = input
  const m = analysis.metrics
  const d = analysis.details as Record<string, unknown>
  const memberGaps = (d.memberGaps ?? []) as Array<{
    member: string
    age: number
    groupCoverage: number
    portableAmount: number
    evaporatingAmount: number
    totalNeed: number
    netGap: number
    portabilityDeadlineDays: number
    isPortable: boolean
  }>

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><title>Life Discovery Detail — ${escapeHtml(household.clientNames)}</title>
<style>${getBaseStyles()}</style></head><body>
${renderHeader('Life Insurance Discovery — Detail', household.clientNames, preparedBy, preparedDate)}

<div class="section">
  <div class="section-title">Group Coverage Analysis</div>
  <p style="font-size:9pt;margin-bottom:8px">${escapeHtml(analysis.summary)}</p>
</div>

${memberGaps.map((g) => `
<div class="section">
  <div class="section-title">${escapeHtml(g.member)} — Age ${g.age}</div>
  <table>
    <tbody>
      <tr><td style="width:50%"><strong>Total Group Coverage</strong></td><td>${formatCurrency(g.groupCoverage)}</td></tr>
      <tr class="highlight-row"><td><strong>Portable Amount</strong></td><td>${formatCurrency(g.portableAmount)}</td></tr>
      <tr class="${g.evaporatingAmount > 0 ? 'highlight-row' : ''}">
        <td><strong>Evaporates at Job Change</strong></td>
        <td><strong style="color:${g.evaporatingAmount > 0 ? '#c44' : '#1a7a3a'}">${formatCurrency(g.evaporatingAmount)}</strong></td>
      </tr>
      <tr><td><strong>Total Life Insurance Need</strong></td><td>${formatCurrency(g.totalNeed)}</td></tr>
      <tr class="highlight-row"><td><strong>Net Remaining Gap</strong></td><td><strong>${formatCurrency(g.netGap)}</strong></td></tr>
      <tr><td><strong>Conversion Window</strong></td><td>${g.portabilityDeadlineDays} days from separation date</td></tr>
      <tr><td><strong>Portability Available?</strong></td><td>${g.isPortable ? 'Yes — limited amount portable' : 'No — all coverage evaporates'}</td></tr>
    </tbody>
  </table>
</div>`).join('')}

<div class="section">
  <div class="section-title">Key Findings</div>
  <ul style="padding-left:16px;font-size:9pt">${analysis.findings.map((f) => `<li>${escapeHtml(f)}</li>`).join('')}</ul>
</div>

<div class="opp-box ${Number(m.totalEvaporating ?? 0) > 0 ? 'yellow' : ''}">
  <div class="opp-title">Recommendation</div>
  <p>${escapeHtml(analysis.recommendation)}</p>
</div>

<div class="disclosure">
  Life insurance portability and conversion rights vary by employer plan design and carrier. This analysis is based on reported account data. Verify conversion deadlines and eligible amounts directly with the group carrier before any employment change.
</div>

${renderFooter(household.clientNames, preparedDate)}
</body></html>`
}
