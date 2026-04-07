/**
 * Life Presentation — Detail Template (Life & Estate Wire Expansion, Track 2)
 * Full 9-tab presentation document for advisor use at the meeting table.
 */

import type { GeneratorInput } from '../types'
import { getBaseStyles, formatCurrency, renderHeader, renderFooter, escapeHtml } from '../shared-styles'

export function renderLifePresentationDetail(input: GeneratorInput): string {
  const { analysis, household, preparedBy, preparedDate } = input
  const m = analysis.metrics
  const d = analysis.details as Record<string, unknown>

  const discoveryData = (d.discovery ?? {}) as Record<string, unknown>
  const needsData = (d.needs ?? {}) as Record<string, unknown>
  const optionsData = (d.options ?? {}) as Record<string, unknown>
  const uwData = (d.underwriting ?? {}) as Record<string, unknown>

  const totalGroupEvaporating = Number(discoveryData.totalEvaporating ?? m.totalEvaporating ?? 0)
  const totalNetNeed = Number(needsData.totalNetNeed ?? m.totalNetNeed ?? 0)
  const totalExistingCoverage = Number(needsData.totalExistingCoverage ?? m.totalExistingCoverage ?? 0)
  const optionAMonthly = Number(optionsData.totalOptionAMonthly ?? m.totalOptionAMonthly ?? 0)
  const optionBMonthly = Number(optionsData.totalOptionBMonthly ?? m.totalOptionBMonthly ?? 0)
  const optionCMonthly = Number(optionsData.totalOptionCMonthly ?? m.totalOptionCMonthly ?? 0)
  const uwImpactPercent = Number(uwData.blendedPriceImpactPercent ?? m.uwImpactPercent ?? 0)

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><title>Life Presentation Detail — ${escapeHtml(household.clientNames)}</title>
<style>${getBaseStyles()}</style></head><body>
${renderHeader('Life Insurance Presentation — Full Detail', household.clientNames, preparedBy, preparedDate)}

<!-- TAB 1: DISCOVERY -->
<div class="section">
  <div class="section-title">Tab 1 — Discovery: Group Coverage Risk</div>
  <p style="font-size:9pt;margin-bottom:6px">Employer group life coverage evaporates on job separation. The following risk was identified:</p>
  <table>
    <tbody>
      <tr><td style="width:60%">Total group coverage in household</td><td>${formatCurrency(Number(discoveryData.totalGroupCoverage ?? m.totalGroupCoverage ?? 0))}</td></tr>
      <tr class="highlight-row"><td>Coverage that evaporates at job change</td><td style="color:#c44"><strong>${formatCurrency(totalGroupEvaporating)}</strong></td></tr>
      <tr><td>Coverage that remains portable</td><td>${formatCurrency(Number(discoveryData.totalGroupCoverage ?? 0) - totalGroupEvaporating)}</td></tr>
    </tbody>
  </table>
</div>

<!-- TAB 2: NEEDS ANALYSIS -->
<div class="section">
  <div class="section-title">Tab 2 — Needs Analysis: What Does the Family Actually Need?</div>
  <table>
    <tbody>
      <tr><td style="width:60%">Total household life insurance need</td><td>${formatCurrency(Number(needsData.totalHouseholdNeed ?? m.totalHouseholdNeed ?? 0))}</td></tr>
      <tr class="highlight-row"><td>Existing coverage (all policies)</td><td style="color:#1a7a3a">(${formatCurrency(totalExistingCoverage)})</td></tr>
      <tr class="total-row"><td>Net household coverage gap</td><td>${formatCurrency(totalNetNeed)}</td></tr>
    </tbody>
  </table>
</div>

<!-- TAB 3: UNDERWRITING -->
<div class="section">
  <div class="section-title">Tab 3 — Underwriting: Rate Class &amp; Exam Requirements</div>
  <table>
    <tbody>
      <tr><td style="width:60%">Blended rate class impact vs Preferred Plus</td><td style="color:${uwImpactPercent > 20 ? '#c44' : '#1a7a3a'}">${uwImpactPercent > 0 ? '+' : ''}${Math.round(uwImpactPercent)}%</td></tr>
      <tr class="highlight-row"><td>Any member declinable by standard carriers?</td><td>${uwData.anyDeclinable ? '<strong style="color:#c44">Yes — simplified/GI required</strong>' : 'No — standard underwriting available'}</td></tr>
      <tr><td>Paramed exam required?</td><td>${uwData.anyExamRequired ? 'Yes — schedule with carrier' : 'Non-medical underwriting available'}</td></tr>
    </tbody>
  </table>
</div>

<!-- TABS 4-6: OPTIONS COMPARISON -->
<div class="section">
  <div class="section-title">Tabs 4-6 — Product Options: A vs B vs C</div>
  <table>
    <thead><tr><th>Option</th><th>Description</th><th>Monthly Premium</th><th>Living Benefits</th><th>Permanent?</th></tr></thead>
    <tbody>
      <tr>
        <td><strong>A — Final Expenses</strong></td>
        <td>$50K 10-year term | Minimum floor only</td>
        <td>${formatCurrency(optionAMonthly)}/mo</td>
        <td>No</td>
        <td>No</td>
      </tr>
      <tr class="highlight-row">
        <td><strong>B — Income Replacement</strong></td>
        <td>Full-need term | Income + debt + education</td>
        <td>${formatCurrency(optionBMonthly)}/mo</td>
        <td>No</td>
        <td>No</td>
      </tr>
      <tr style="background:#f0f6ff">
        <td><strong>C — Swiss-Army IUL ★</strong></td>
        <td>Full-need IUL | Permanent + cash + living benefits</td>
        <td><strong>${formatCurrency(optionCMonthly)}/mo</strong></td>
        <td><strong style="color:#1a7a3a">Yes</strong></td>
        <td><strong style="color:#1a7a3a">Yes</strong></td>
      </tr>
    </tbody>
  </table>
  <p style="font-size:8pt;color:#666;margin-top:4px">Difference B vs C: ${formatCurrency(optionCMonthly - optionBMonthly)}/mo | 10-year additional cost: ${formatCurrency((optionCMonthly - optionBMonthly) * 120)}</p>
</div>

<!-- TAB 7: IUL ILLUSTRATION -->
<div class="section">
  <div class="section-title">Tab 7 — IUL Cash Value Illustration (Illustrative)</div>
  <table>
    <thead><tr><th>Year</th><th>Cumulative Premium</th><th>Est. Cash Value</th><th>Death Benefit</th><th>Net Outlay</th></tr></thead>
    <tbody>
      ${[1, 3, 5, 10, 15, 20].map((yr) => {
        const cumPremium = optionCMonthly * 12 * yr
        const cashValue = Math.round(cumPremium * (0.05 + yr * 0.03))
        const netOutlay = cumPremium - cashValue
        const totalNeedVal = totalNetNeed || optionCMonthly * 12 * 20
        return `<tr${yr === 10 ? ' class="highlight-row"' : ''}><td>Year ${yr}</td><td>${formatCurrency(cumPremium)}</td><td style="color:#1a7a3a">${formatCurrency(Math.max(0, cashValue))}</td><td>${formatCurrency(totalNeedVal)}</td><td>${formatCurrency(Math.max(0, netOutlay))}</td></tr>`
      }).join('')}
    </tbody>
  </table>
  <p style="font-size:7.5pt;color:#888;margin-top:4px">Cash value projections are illustrative at mid-range crediting. Actual results will vary based on index performance and policy charges.</p>
</div>

<!-- TAB 8: LIVING BENEFITS -->
<div class="section">
  <div class="section-title">Tab 8 — Living Benefits: Using Life Insurance While You're Alive</div>
  <table>
    <thead><tr><th>Trigger</th><th>Benefit Access</th><th>Use Case</th></tr></thead>
    <tbody>
      <tr><td><strong>Chronic Illness</strong></td><td>Up to 100% of death benefit</td><td>Long-term care, home health, assisted living</td></tr>
      <tr class="highlight-row"><td><strong>Terminal Illness</strong></td><td>Up to 100% of death benefit</td><td>Final expenses, bucket list, family support</td></tr>
      <tr><td><strong>Critical Illness</strong></td><td>25-50% of death benefit</td><td>Heart attack, stroke, cancer treatment costs</td></tr>
    </tbody>
  </table>
  <p style="font-size:8.5pt;margin-top:6px">Living benefits turn a death benefit into a <strong>living asset</strong> — protection that pays while the insured is still alive if a qualifying event occurs.</p>
</div>

<!-- TAB 9: NEXT STEPS -->
<div class="section">
  <div class="section-title">Tab 9 — Next Steps: Application &amp; Timeline</div>
  <table>
    <thead><tr><th>Step</th><th>Action</th><th>Who</th></tr></thead>
    <tbody>
      <tr><td>1</td><td>Select product option (A / B / C)</td><td>Client decision</td></tr>
      <tr class="highlight-row"><td>2</td><td>Complete application + health questionnaire</td><td>Advisor + Client</td></tr>
      <tr><td>3</td><td>Schedule paramed exam (if required)</td><td>Carrier coordinates</td></tr>
      <tr class="highlight-row"><td>4</td><td>Underwriting review (2-6 weeks)</td><td>Carrier</td></tr>
      <tr><td>5</td><td>Policy delivery + acceptance signature</td><td>Advisor + Client</td></tr>
      <tr class="highlight-row"><td>6</td><td>Review annually or at life change</td><td>Advisor</td></tr>
    </tbody>
  </table>
</div>

<div class="opp-box blue">
  <div class="opp-title">Recommendation</div>
  <p>${escapeHtml(analysis.recommendation)}</p>
</div>

<div class="disclosure">
  This presentation is for educational and planning purposes only. Life insurance illustrations are not projections or guarantees. Premium quotes are estimates pending underwriting. Products may not be available in all states. Retirement Protectors, Inc. and its agents are licensed life insurance producers. Securities offered through Gradient Securities, LLC, member FINRA/SIPC. This is not a solicitation where prohibited by law.
</div>

${renderFooter(household.clientNames, preparedDate)}
</body></html>`
}
