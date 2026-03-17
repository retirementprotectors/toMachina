/**
 * Estate MAX — Detail Template (TRK-13415)
 * Tier 2/3: 15-year household projection + lapse detection.
 */

import type { GeneratorInput } from '../types'
import { getBaseStyles, formatCurrency, renderHeader, renderFooter, escapeHtml } from '../shared-styles'

export function renderEstateMaxDetail(input: GeneratorInput): string {
  const { analysis, household, preparedBy, preparedDate } = input
  const d = analysis.details as Record<string, unknown>
  const lapseWarnings = (d.lapseWarnings ?? []) as Array<{ account: string; carrier: string; currentDb: number; guaranteedLapseAge: number; ownerAge: number; yearsToLapse: number }>
  const survivorNeeds = (d.survivorNeeds ?? []) as Array<{ member: string; age: number; incomeMultiplier: number; recommendedCoverage: number; currentCoverage: number; gap: number }>
  const depletionDetails = (d.depletionDetails ?? []) as Array<{ account: string; currentDb: number; depletionYear: number | null; finalValue: number }>
  const fycComparisons = (d.fycComparisons ?? []) as Array<{ carrier: string; targetPercent: number; excessPercent: number; preferred: boolean }>
  const candidates1035 = (d.candidates1035 ?? []) as Array<{ source: string; currentDb: number; yearsToLapse: number; recommendedTarget: string }>

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><title>Estate MAX Detail — ${escapeHtml(household.clientNames)}</title>
<style>${getBaseStyles()}</style></head><body>
${renderHeader('Estate & Legacy — Detailed Analysis', household.clientNames, preparedBy, preparedDate)}

${lapseWarnings.length > 0 ? `
<div class="section">
  <div class="section-title">Policy Lapse Analysis</div>
  <table>
    <thead><tr><th>Policy</th><th>Carrier</th><th>Death Benefit</th><th>Owner Age</th><th>Lapse Age</th><th>Years Remaining</th></tr></thead>
    <tbody>
      ${lapseWarnings.map((lw) => `<tr class="highlight-row"><td>${escapeHtml(lw.account)}</td><td>${escapeHtml(lw.carrier)}</td><td><strong>${formatCurrency(lw.currentDb)}</strong></td><td>${lw.ownerAge}</td><td>${lw.guaranteedLapseAge}</td><td style="color:#c44"><strong>${lw.yearsToLapse}</strong></td></tr>`).join('')}
    </tbody>
  </table>
</div>` : ''}

${depletionDetails.length > 0 ? `
<div class="section">
  <div class="section-title">VA Death Benefit Erosion</div>
  <table>
    <thead><tr><th>Account</th><th>Current DB</th><th>Depletion Year</th><th>30-Year Value</th></tr></thead>
    <tbody>
      ${depletionDetails.map((dd) => `<tr><td>${escapeHtml(dd.account)}</td><td>${formatCurrency(dd.currentDb)}</td><td>${dd.depletionYear ? `Year ${dd.depletionYear}` : 'No depletion'}</td><td>${formatCurrency(dd.finalValue)}</td></tr>`).join('')}
    </tbody>
  </table>
</div>` : ''}

<div class="section">
  <div class="section-title">Survivor Needs — Income Multiplier Method</div>
  <table>
    <thead><tr><th>Member</th><th>Age</th><th>Multiplier</th><th>Recommended</th><th>Current</th><th>Gap</th></tr></thead>
    <tbody>
      ${survivorNeeds.map((sn) => `<tr${sn.gap > 0 ? ' class="highlight-row"' : ''}><td>${escapeHtml(sn.member)}</td><td>${sn.age}</td><td>${sn.incomeMultiplier}x</td><td>${formatCurrency(sn.recommendedCoverage)}</td><td>${formatCurrency(sn.currentCoverage)}</td><td${sn.gap > 0 ? ' style="color:#c44"' : ' style="color:#1a7a3a"'}><strong>${sn.gap > 0 ? formatCurrency(sn.gap) : 'OK'}</strong></td></tr>`).join('')}
    </tbody>
  </table>
</div>

${candidates1035.length > 0 ? `
<div class="section">
  <div class="section-title">1035 Exchange Candidates</div>
  <table>
    <thead><tr><th>Source Policy</th><th>Current DB</th><th>Years to Lapse</th><th>Recommended Target</th></tr></thead>
    <tbody>
      ${candidates1035.map((c) => `<tr class="highlight-row"><td>${escapeHtml(c.source)}</td><td>${formatCurrency(c.currentDb)}</td><td>${c.yearsToLapse}</td><td>${escapeHtml(c.recommendedTarget)}</td></tr>`).join('')}
    </tbody>
  </table>
</div>` : ''}

${fycComparisons.length > 0 ? `
<div class="section">
  <div class="section-title">Carrier FYC Comparison (Replacement Products)</div>
  <table>
    <thead><tr><th>Carrier</th><th>Target %</th><th>Excess %</th><th>Preferred</th></tr></thead>
    <tbody>
      ${fycComparisons.map((f) => `<tr${f.preferred ? ' class="highlight-row"' : ''}><td>${escapeHtml(f.carrier)}</td><td>${f.targetPercent}%</td><td>${f.excessPercent}%</td><td>${f.preferred ? 'Yes' : ''}</td></tr>`).join('')}
    </tbody>
  </table>
</div>` : ''}

${renderFooter(household.clientNames, preparedDate)}
</body></html>`
}
