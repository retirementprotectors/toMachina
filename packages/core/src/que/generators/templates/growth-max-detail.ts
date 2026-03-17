/**
 * Growth MAX — Detail Template (TRK-13417)
 * Tier 2/3: Year-by-year delta + consolidation cost math.
 */

import type { GeneratorInput } from '../types'
import { getBaseStyles, formatCurrency, renderHeader, renderFooter, escapeHtml } from '../shared-styles'

export function renderGrowthMaxDetail(input: GeneratorInput): string {
  const { analysis, household, preparedBy, preparedDate } = input
  const d = analysis.details as Record<string, unknown>
  const deltaSchedule = (d.deltaSchedule ?? []) as Array<{ year: number; proposedValue: number; currentValue: number; delta: number; cumulativeDelta: number }>
  const consolidation = (d.consolidationCandidates ?? []) as Array<{ account: string; accountValue: number; surrenderCost: number; ltcgCost: number; bonusCredit: number; netCost: number; isNetGain: boolean }>
  // Show every 5th year plus first and last for readability
  const displayRows = deltaSchedule.filter((r) => r.year === 1 || r.year % 5 === 0 || r.year === deltaSchedule.length)

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><title>Growth MAX Detail — ${escapeHtml(household.clientNames)}</title>
<style>${getBaseStyles()}</style></head><body>
${renderHeader('Growth & Sustainability — Detailed Projections', household.clientNames, preparedBy, preparedDate)}

<div class="section">
  <div class="section-title">Year-by-Year Comparison: VA vs FIA</div>
  <table>
    <thead><tr><th>Year</th><th>Current (VA)</th><th>Proposed (FIA)</th><th>Annual Delta</th><th>Cumulative Delta</th></tr></thead>
    <tbody>
      ${displayRows.map((r) => `<tr${r.delta > 0 ? ' class="highlight-row"' : ''}><td>${r.year}</td><td>${formatCurrency(r.currentValue)}</td><td>${formatCurrency(r.proposedValue)}</td><td${r.delta > 0 ? ' style="color:#1a7a3a"' : ' style="color:#c44"'}>${r.delta >= 0 ? '+' : ''}${formatCurrency(r.delta)}</td><td><strong>${r.cumulativeDelta >= 0 ? '+' : ''}${formatCurrency(r.cumulativeDelta)}</strong></td></tr>`).join('')}
    </tbody>
  </table>
</div>

${consolidation.length > 0 ? `
<div class="section">
  <div class="section-title">Consolidation Cost/Bonus Analysis</div>
  <table>
    <thead><tr><th>Account</th><th>Value</th><th>Surrender Cost</th><th>LTCG Tax</th><th>Carrier Bonus</th><th>Net Cost</th></tr></thead>
    <tbody>
      ${consolidation.map((c) => `<tr class="highlight-row"><td>${escapeHtml(c.account)}</td><td>${formatCurrency(c.accountValue)}</td><td>${formatCurrency(c.surrenderCost)}</td><td>${formatCurrency(c.ltcgCost)}</td><td style="color:#1a7a3a">${formatCurrency(c.bonusCredit)}</td><td${c.isNetGain ? ' style="color:#1a7a3a"' : ''}><strong>${formatCurrency(c.netCost)}</strong>${c.isNetGain ? ' NET GAIN' : ''}</td></tr>`).join('')}
    </tbody>
  </table>
</div>` : ''}

<div class="section">
  <div class="section-title">Key Findings</div>
  <ul style="padding-left:16px;font-size:9pt">${analysis.findings.map((f) => `<li>${escapeHtml(f)}</li>`).join('')}</ul>
</div>

<div class="opp-box">
  <div class="opp-title">Detailed Recommendation</div>
  <p>${escapeHtml(analysis.recommendation)}</p>
</div>

${renderFooter(household.clientNames, preparedDate)}
</body></html>`
}
