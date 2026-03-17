/**
 * Estate MAX — Summary Template (TRK-13414)
 * Tier 1: Current path vs repositioned path.
 */

import type { GeneratorInput } from '../types'
import { getBaseStyles, formatCurrency, renderHeader, renderFooter, escapeHtml } from '../shared-styles'

export function renderEstateMaxSummary(input: GeneratorInput): string {
  const { analysis, household, preparedBy, preparedDate } = input
  const m = analysis.metrics
  const d = analysis.details as Record<string, unknown>
  const lapseWarnings = (d.lapseWarnings ?? []) as Array<{ account: string; currentDb: number; guaranteedLapseAge: number; yearsToLapse: number }>
  const survivorNeeds = (d.survivorNeeds ?? []) as Array<{ member: string; recommendedCoverage: number; currentCoverage: number; gap: number }>

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><title>Estate MAX — ${escapeHtml(household.clientNames)}</title>
<style>${getBaseStyles()}</style></head><body>
${renderHeader('Estate & Legacy Analysis', household.clientNames, preparedBy, preparedDate)}

<div class="metric-cards">
  <div class="metric-card">
    <div class="label">Policies at Lapse Risk</div>
    <div class="value ${Number(m.lapseWarningCount ?? 0) > 0 ? 'red' : ''}">${m.lapseWarningCount ?? 0}</div>
  </div>
  <div class="metric-card">
    <div class="label">Death Benefit at Risk</div>
    <div class="value red">${formatCurrency(Number(m.totalDbAtRisk ?? 0))}</div>
  </div>
  <div class="metric-card">
    <div class="label">Survivor Coverage Gap</div>
    <div class="value ${Number(m.totalSurvivorGap ?? 0) > 0 ? 'red' : ''}">${formatCurrency(Number(m.totalSurvivorGap ?? 0))}</div>
  </div>
  <div class="metric-card">
    <div class="label">1035 Candidates</div>
    <div class="value">${m.candidates1035Count ?? 0}</div>
  </div>
</div>

${lapseWarnings.length > 0 ? `
<div class="section">
  <div class="section-title">Lapse Risk — Policies Expiring Before Life Expectancy</div>
  <table>
    <thead><tr><th>Policy</th><th>Current Death Benefit</th><th>Guaranteed Lapse Age</th><th>Years to Lapse</th></tr></thead>
    <tbody>
      ${lapseWarnings.map((lw) => `<tr class="highlight-row"><td>${escapeHtml(lw.account)}</td><td><strong>${formatCurrency(lw.currentDb)}</strong></td><td>${lw.guaranteedLapseAge}</td><td style="color:#c44"><strong>${lw.yearsToLapse}</strong></td></tr>`).join('')}
    </tbody>
  </table>
</div>` : ''}

${survivorNeeds.length > 0 ? `
<div class="section">
  <div class="section-title">Survivor Needs Analysis</div>
  <table>
    <thead><tr><th>Member</th><th>Recommended Coverage</th><th>Current Coverage</th><th>Gap</th></tr></thead>
    <tbody>
      ${survivorNeeds.map((sn) => `<tr${sn.gap > 0 ? ' class="highlight-row"' : ''}><td>${escapeHtml(sn.member)}</td><td>${formatCurrency(sn.recommendedCoverage)}</td><td>${formatCurrency(sn.currentCoverage)}</td><td${sn.gap > 0 ? ' style="color:#c44"' : ' style="color:#1a7a3a"'}><strong>${sn.gap > 0 ? formatCurrency(sn.gap) : 'Adequate'}</strong></td></tr>`).join('')}
    </tbody>
  </table>
</div>` : ''}

<div class="opp-box">
  <div class="opp-title">Recommendation</div>
  <p>${escapeHtml(analysis.recommendation)}</p>
</div>

${renderFooter(household.clientNames, preparedDate)}
</body></html>`
}
