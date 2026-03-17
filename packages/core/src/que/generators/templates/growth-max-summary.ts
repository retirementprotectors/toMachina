/**
 * Growth MAX — Summary Template (TRK-13416)
 * Tier 1: VA depletion vs FIA sustainability.
 */

import type { GeneratorInput } from '../types'
import { getBaseStyles, formatCurrency, renderHeader, renderFooter, escapeHtml } from '../shared-styles'

export function renderGrowthMaxSummary(input: GeneratorInput): string {
  const { analysis, household, preparedBy, preparedDate } = input
  const m = analysis.metrics

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><title>Growth MAX — ${escapeHtml(household.clientNames)}</title>
<style>${getBaseStyles()}</style></head><body>
${renderHeader('Growth & Sustainability Analysis', household.clientNames, preparedBy, preparedDate)}

<div class="metric-cards">
  <div class="metric-card">
    <div class="label">Current VA Value</div>
    <div class="value">${formatCurrency(Number(m.totalVaValue ?? 0))}</div>
  </div>
  <div class="metric-card">
    <div class="label">Depletion Year</div>
    <div class="value ${Number(m.earliestDepletion ?? 0) > 0 ? 'red' : ''}">${Number(m.earliestDepletion ?? 0) > 0 ? `Year ${m.earliestDepletion}` : 'None'}</div>
  </div>
  <div class="metric-card">
    <div class="label">Proposed FIA (30yr)</div>
    <div class="value green">${formatCurrency(Number(m.fiaFinalValue ?? 0))}</div>
  </div>
  <div class="metric-card">
    <div class="label">30-Year Delta</div>
    <div class="value green">${formatCurrency(Number(m.totalDelta ?? 0))}</div>
  </div>
</div>

<div class="section">
  <div class="section-title">Current Path vs Proposed Path</div>
  <div class="two-col">
    <div class="opp-box yellow">
      <div class="opp-title">Current: Variable Annuity</div>
      <ul>
        <li>Fee drag eroding principal</li>
        <li>No principal guarantee</li>
        ${Number(m.earliestDepletion ?? 0) > 0 ? `<li style="color:#c44"><strong>Depletes in year ${m.earliestDepletion}</strong></li>` : '<li>Survives projection period</li>'}
      </ul>
    </div>
    <div class="opp-box">
      <div class="opp-title">Proposed: Fixed Index Annuity</div>
      <ul>
        <li>Zero M+E fees</li>
        <li>100% principal protection</li>
        <li>First-year bonus offsets transition cost</li>
        <li>30-year value: <strong>${formatCurrency(Number(m.fiaFinalValue ?? 0))}</strong></li>
      </ul>
    </div>
  </div>
</div>

${Number(m.totalNetConsolidationCost ?? 0) !== 0 ? `
<div class="opp-box ${Number(m.totalNetConsolidationCost ?? 0) < 0 ? '' : 'yellow'}">
  <div class="opp-title">Consolidation Cost</div>
  <p>Net transition cost: <strong${Number(m.totalNetConsolidationCost ?? 0) < 0 ? ' style="color:#1a7a3a"' : ''}>${formatCurrency(Number(m.totalNetConsolidationCost ?? 0))}</strong>${Number(m.totalNetConsolidationCost ?? 0) < 0 ? ' (carrier bonus produces a net GAIN)' : ''}</p>
</div>` : ''}

<div class="opp-box">
  <div class="opp-title">Recommendation</div>
  <p>${escapeHtml(analysis.recommendation)}</p>
</div>

${renderFooter(household.clientNames, preparedDate)}
</body></html>`
}
