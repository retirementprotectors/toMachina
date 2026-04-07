/**
 * Life Discovery — Summary Template (Life & Estate Wire Expansion, Track 2)
 * Tier 1: Group gap overview + preliminary needs headline per member.
 */

import type { GeneratorInput } from '../types'
import { getBaseStyles, formatCurrency, renderHeader, renderFooter, escapeHtml } from '../shared-styles'

export function renderLifeDiscoverySummary(input: GeneratorInput): string {
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
<html lang="en"><head><meta charset="UTF-8"><title>Life Discovery — ${escapeHtml(household.clientNames)}</title>
<style>${getBaseStyles()}</style></head><body>
${renderHeader('Life Insurance Discovery', household.clientNames, preparedBy, preparedDate)}

<div class="metric-cards">
  <div class="metric-card">
    <div class="label">Total Group Coverage</div>
    <div class="value">${formatCurrency(Number(m.totalGroupCoverage ?? 0))}</div>
  </div>
  <div class="metric-card">
    <div class="label">Evaporates at Job Change</div>
    <div class="value red">${formatCurrency(Number(m.totalEvaporating ?? 0))}</div>
  </div>
  <div class="metric-card">
    <div class="label">Net Coverage Gap</div>
    <div class="value ${Number(m.totalNetGap ?? 0) > 0 ? 'red' : 'green'}">${formatCurrency(Number(m.totalNetGap ?? 0))}</div>
  </div>
  <div class="metric-card">
    <div class="label">Members with Gap</div>
    <div class="value">${String(m.membersWithGap ?? 0)}</div>
  </div>
</div>

${memberGaps.length > 0 ? `
<div class="section">
  <div class="section-title">Group Coverage Risk by Member</div>
  <table>
    <thead>
      <tr>
        <th>Member</th>
        <th>Age</th>
        <th>Group Coverage</th>
        <th>Portable</th>
        <th>Evaporates</th>
        <th>Net Gap</th>
        <th>Conversion Window</th>
      </tr>
    </thead>
    <tbody>
      ${memberGaps.map((g) => `
      <tr class="${g.evaporatingAmount > 0 ? 'highlight-row' : ''}">
        <td><strong>${escapeHtml(g.member)}</strong></td>
        <td>${g.age}</td>
        <td>${formatCurrency(g.groupCoverage)}</td>
        <td>${formatCurrency(g.portableAmount)}</td>
        <td><strong style="color:${g.evaporatingAmount > 0 ? '#c44' : '#1a7a3a'}">${formatCurrency(g.evaporatingAmount)}</strong></td>
        <td><strong>${formatCurrency(g.netGap)}</strong></td>
        <td>${g.portabilityDeadlineDays} days</td>
      </tr>`).join('')}
      <tr class="total-row">
        <td colspan="4">Household Total</td>
        <td>${formatCurrency(Number(m.totalEvaporating ?? 0))}</td>
        <td>${formatCurrency(Number(m.totalNetGap ?? 0))}</td>
        <td></td>
      </tr>
    </tbody>
  </table>
</div>` : `
<div class="section">
  <div class="section-title">Discovery Result</div>
  <p style="font-size:9pt;padding:6px 0">${escapeHtml(analysis.summary)}</p>
</div>`}

<div class="opp-box ${Number(m.totalEvaporating ?? 0) > 0 ? 'yellow' : ''}">
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
