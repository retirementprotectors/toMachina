/**
 * ROTH Conversion — Detail Template (TRK-13423)
 * Tier 2/3: Multi-year conversion sequence + IRMAA impact.
 */

import type { GeneratorInput } from '../types'
import { getBaseStyles, formatCurrency, formatPercent, renderHeader, renderFooter, escapeHtml } from '../shared-styles'

export function renderRothConversionDetail(input: GeneratorInput): string {
  const { analysis, household, preparedBy, preparedDate } = input
  const d = analysis.details as Record<string, unknown>
  const scenarios = (d.scenarios ?? []) as Array<{
    conversionAmount: number; additionalTax: number; additionalIrmaa: number;
    totalConversionCost: number; effectiveConversionRate: number; bracketJump: boolean; irmaaCliff: boolean;
    beforeTax: { marginalRate: number; irmaaSurcharge: number };
    afterTax: { marginalRate: number; irmaaSurcharge: number }
  }>
  const currentProfile = (d.currentTaxProfile ?? {}) as Record<string, unknown>
  const fedTax = (currentProfile.federalTax ?? {}) as Record<string, unknown>
  const irmaa = (currentProfile.irmaa ?? {}) as Record<string, unknown>

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><title>Roth Conversion Detail — ${escapeHtml(household.clientNames)}</title>
<style>${getBaseStyles()}</style></head><body>
${renderHeader('Roth Conversion — Detailed Scenarios', household.clientNames, preparedBy, preparedDate)}

<div class="section">
  <div class="section-title">Current Tax Profile (No Conversion)</div>
  <div class="two-col">
    <div>
      <p style="font-size:9pt">Provisional Income: <strong>${formatCurrency(Number(currentProfile.provisionalIncome ?? 0))}</strong></p>
      <p style="font-size:9pt">Taxable Income: <strong>${formatCurrency(Number(fedTax.taxableIncome ?? 0))}</strong></p>
      <p style="font-size:9pt">Federal Tax: <strong>${formatCurrency(Number(fedTax.federalTax ?? 0))}</strong></p>
    </div>
    <div>
      <p style="font-size:9pt">Marginal Rate: <strong>${formatPercent(Number(fedTax.marginalRate ?? 0))}</strong></p>
      <p style="font-size:9pt">IRMAA Tier: <strong>${escapeHtml(String(irmaa.tier ?? 'Standard'))}</strong></p>
      <p style="font-size:9pt">IRMAA Surcharge: <strong>${formatCurrency(Number(irmaa.annualSurcharge ?? 0))}/year</strong></p>
    </div>
  </div>
</div>

<div class="section">
  <div class="section-title">Conversion Scenarios</div>
  <table>
    <thead><tr><th>Amount</th><th>Additional Tax</th><th>IRMAA Impact</th><th>Total Cost</th><th>Effective Rate</th><th>Bracket Jump?</th><th>IRMAA Cliff?</th></tr></thead>
    <tbody>
      ${scenarios.map((s) => `<tr${!s.bracketJump && !s.irmaaCliff ? ' class="highlight-row"' : ''}><td>${formatCurrency(s.conversionAmount)}</td><td>${formatCurrency(s.additionalTax)}</td><td>${formatCurrency(s.additionalIrmaa)}</td><td><strong>${formatCurrency(s.totalConversionCost)}</strong></td><td>${formatPercent(s.effectiveConversionRate)}</td><td${s.bracketJump ? ' style="color:#c44"' : ''}>${s.bracketJump ? `Yes (${formatPercent(s.beforeTax.marginalRate)} -> ${formatPercent(s.afterTax.marginalRate)})` : 'No'}</td><td${s.irmaaCliff ? ' style="color:#c44"' : ''}>${s.irmaaCliff ? 'Yes' : 'No'}</td></tr>`).join('')}
    </tbody>
  </table>
  <p style="font-size:8pt;color:#666;margin-top:4px">Highlighted rows show conversions that stay within the current bracket and IRMAA tier. IRMAA uses a 2-year lookback.</p>
</div>

<div class="section">
  <div class="section-title">Findings</div>
  <ul style="padding-left:16px;font-size:9pt">${analysis.findings.map((f) => `<li>${escapeHtml(f)}</li>`).join('')}</ul>
</div>

<div class="opp-box">
  <div class="opp-title">Detailed Recommendation</div>
  <p>${escapeHtml(analysis.recommendation)}</p>
</div>

${renderFooter(household.clientNames, preparedDate)}
</body></html>`
}
