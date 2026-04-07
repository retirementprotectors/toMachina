/**
 * Life Presentation — Summary Template (Life & Estate Wire Expansion, Track 2)
 * Master 9-tab view: Discovery → Needs → Options → Underwriting → Recommendation
 * Summary version: Executive overview for the meeting table.
 */

import type { GeneratorInput } from '../types'
import { getBaseStyles, formatCurrency, renderHeader, renderFooter, escapeHtml } from '../shared-styles'

export function renderLifePresentationSummary(input: GeneratorInput): string {
  const { analysis, household, preparedBy, preparedDate } = input
  const m = analysis.metrics
  const d = analysis.details as Record<string, unknown>

  // Pull across all sub-analysis data that may be bundled in details
  const discoveryData = (d.discovery ?? {}) as Record<string, unknown>
  const needsData = (d.needs ?? {}) as Record<string, unknown>
  const optionsData = (d.options ?? {}) as Record<string, unknown>
  const uwData = (d.underwriting ?? {}) as Record<string, unknown>

  const totalGroupEvaporating = Number(discoveryData.totalEvaporating ?? m.totalEvaporating ?? 0)
  const totalNetNeed = Number(needsData.totalNetNeed ?? m.totalNetNeed ?? 0)
  const recommendedMonthly = Number(optionsData.totalOptionCMonthly ?? m.recommendedMonthlyPremium ?? 0)
  const uwImpactPercent = Number(uwData.blendedPriceImpactPercent ?? m.uwImpactPercent ?? 0)

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><title>Life Presentation — ${escapeHtml(household.clientNames)}</title>
<style>${getBaseStyles()}
.tab-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 14px; }
.tab-box { border: 1px solid #d0d7de; border-radius: 4px; padding: 8px 10px; }
.tab-box .tab-num { font-size: 7pt; text-transform: uppercase; letter-spacing: 0.5px; color: #888; font-weight: 700; }
.tab-box .tab-title { font-size: 9.5pt; font-weight: 700; color: #1a3158; margin: 2px 0; }
.tab-box .tab-value { font-size: 12pt; font-weight: 700; color: #1a3158; }
.tab-box .tab-value.alert { color: #c44; }
.tab-box .tab-value.ok { color: #1a7a3a; }
</style></head><body>
${renderHeader('Life Insurance Presentation', household.clientNames, preparedBy, preparedDate)}

<div class="section">
  <div class="section-title">Presentation Summary — ${household.members.length} Member${household.members.length > 1 ? 's' : ''} | ${escapeHtml(household.state)}</div>
  <p style="font-size:9pt;margin-bottom:8px">${escapeHtml(analysis.summary)}</p>
</div>

<div class="tab-grid">
  <div class="tab-box">
    <div class="tab-num">Tab 1</div>
    <div class="tab-title">Discovery</div>
    <div class="tab-value ${totalGroupEvaporating > 0 ? 'alert' : 'ok'}">${formatCurrency(totalGroupEvaporating)}</div>
    <div style="font-size:8pt;color:#666">Group coverage evaporation risk</div>
  </div>
  <div class="tab-box">
    <div class="tab-num">Tab 2</div>
    <div class="tab-title">Needs Analysis</div>
    <div class="tab-value ${totalNetNeed > 0 ? 'alert' : 'ok'}">${formatCurrency(totalNetNeed)}</div>
    <div style="font-size:8pt;color:#666">Net household coverage gap</div>
  </div>
  <div class="tab-box">
    <div class="tab-num">Tab 3</div>
    <div class="tab-title">Underwriting</div>
    <div class="tab-value ${uwImpactPercent > 20 ? 'alert' : 'ok'}">${uwImpactPercent > 0 ? '+' : ''}${Math.round(uwImpactPercent)}%</div>
    <div style="font-size:8pt;color:#666">Premium impact vs Preferred Plus</div>
  </div>
  <div class="tab-box">
    <div class="tab-num">Tab 4</div>
    <div class="tab-title">Option A</div>
    <div class="tab-value">${formatCurrency(Number(m.totalOptionAMonthly ?? optionsData.totalOptionAMonthly ?? 0))}/mo</div>
    <div style="font-size:8pt;color:#666">Final Expenses (min floor)</div>
  </div>
  <div class="tab-box">
    <div class="tab-num">Tab 5</div>
    <div class="tab-title">Option B</div>
    <div class="tab-value">${formatCurrency(Number(m.totalOptionBMonthly ?? optionsData.totalOptionBMonthly ?? 0))}/mo</div>
    <div style="font-size:8pt;color:#666">Income Replacement (baseline)</div>
  </div>
  <div class="tab-box" style="border-color:#2a7d4f;background:#f4faf6">
    <div class="tab-num">Tab 6 ★ Recommended</div>
    <div class="tab-title">Option C — IUL</div>
    <div class="tab-value ok">${formatCurrency(recommendedMonthly)}/mo</div>
    <div style="font-size:8pt;color:#666">Swiss-Army IUL + living benefits</div>
  </div>
  <div class="tab-box">
    <div class="tab-num">Tab 7</div>
    <div class="tab-title">IUL Illustration</div>
    <div class="tab-value">10-yr CV</div>
    <div style="font-size:8pt;color:#666">Cash value accumulation schedule</div>
  </div>
  <div class="tab-box">
    <div class="tab-num">Tab 8</div>
    <div class="tab-title">Living Benefits</div>
    <div class="tab-value ok">3 Triggers</div>
    <div style="font-size:8pt;color:#666">Chronic / Terminal / Critical</div>
  </div>
  <div class="tab-box">
    <div class="tab-num">Tab 9</div>
    <div class="tab-title">Next Steps</div>
    <div class="tab-value">Application</div>
    <div style="font-size:8pt;color:#666">Submit + schedule paramed</div>
  </div>
</div>

<div class="opp-box blue">
  <div class="opp-title">Recommendation</div>
  <p>${escapeHtml(analysis.recommendation)}</p>
</div>

${renderFooter(household.clientNames, preparedDate)}
</body></html>`
}
