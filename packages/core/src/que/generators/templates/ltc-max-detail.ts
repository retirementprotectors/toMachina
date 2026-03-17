/**
 * LTC MAX — Detail Template (TRK-13419)
 * Tier 2/3: Contract-by-contract LTC analysis + fees.
 */

import type { GeneratorInput } from '../types'
import { getBaseStyles, formatCurrency, renderHeader, renderFooter, escapeHtml } from '../shared-styles'

export function renderLtcMaxDetail(input: GeneratorInput): string {
  const { analysis, household, preparedBy, preparedDate } = input
  const d = analysis.details as Record<string, unknown>
  const phases = (d.phases ?? []) as Array<{ phase: string; qualification: string; annualAccess: number; description: string; contracts: string[] }>
  const multiplierDetails = (d.multiplierDetails ?? []) as Array<{ contract: string; baseIncome: number; multipliedIncome: number; factor: number }>
  const mgsvDetails = (d.mgsvDetails ?? []) as Array<{ contract: string; mgsv: number; accountValue: number; floorProtection: boolean }>

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><title>LTC MAX Detail — ${escapeHtml(household.clientNames)}</title>
<style>${getBaseStyles()}</style></head><body>
${renderHeader('Long-Term Care — Detailed Analysis', household.clientNames, preparedBy, preparedDate)}

<div class="section">
  <div class="section-title">4-Phase Access — Contract Mapping</div>
  ${phases.map((p) => `
  <div style="margin-bottom:8px">
    <p style="font-size:9.5pt;font-weight:700;color:#1a3a5c">Phase ${escapeHtml(p.phase)} — ${escapeHtml(p.qualification)}</p>
    <p style="font-size:9pt">${escapeHtml(p.description)}</p>
    <p style="font-size:9pt">Annual Access: <strong>${formatCurrency(p.annualAccess)}</strong> | Contracts: ${p.contracts.length > 0 ? p.contracts.map((c) => escapeHtml(c)).join(', ') : 'None'}</p>
  </div>`).join('')}
</div>

${multiplierDetails.length > 0 ? `
<div class="section">
  <div class="section-title">Phase II — Income Multiplier Detail</div>
  <table>
    <thead><tr><th>Contract</th><th>Base Income</th><th>Multiplier</th><th>LTC Income</th></tr></thead>
    <tbody>
      ${multiplierDetails.map((md) => `<tr class="highlight-row"><td>${escapeHtml(md.contract)}</td><td>${formatCurrency(md.baseIncome)}</td><td>${md.factor}x</td><td><strong>${formatCurrency(md.multipliedIncome)}</strong></td></tr>`).join('')}
    </tbody>
  </table>
</div>` : ''}

${mgsvDetails.length > 0 ? `
<div class="section">
  <div class="section-title">Minimum Guaranteed Surrender Values (Floor Protection)</div>
  <table>
    <thead><tr><th>Contract</th><th>Account Value</th><th>MGSV Floor</th><th>Protected?</th></tr></thead>
    <tbody>
      ${mgsvDetails.map((mg) => `<tr><td>${escapeHtml(mg.contract)}</td><td>${formatCurrency(mg.accountValue)}</td><td>${formatCurrency(mg.mgsv)}</td><td>${mg.floorProtection ? '<span style="color:#1a7a3a">Yes</span>' : '<span style="color:#c44">Below Floor</span>'}</td></tr>`).join('')}
    </tbody>
  </table>
</div>` : ''}

<div class="section">
  <div class="section-title">Findings</div>
  <ul style="padding-left:16px;font-size:9pt">${analysis.findings.map((f) => `<li>${escapeHtml(f)}</li>`).join('')}</ul>
</div>

${renderFooter(household.clientNames, preparedDate)}
</body></html>`
}
