/**
 * generate-factfinder (TRK-13382)
 *
 * Pre-filled factfinder / application package.
 * NOTE: Full RPI Factfinder template not located (TRK-13430 pending).
 * This is a functional scaffold that will be enhanced when the factfinder
 * template is found and digitized. Currently generates a pre-filled
 * authorization and signature checklist.
 *
 * Pure function: (FactfinderInput) => string (HTML)
 */

import type { FactfinderInput } from './types'
import { getBaseStyles, formatCurrency, renderFooter, escapeHtml } from './shared-styles'

export function generateFactfinder(input: FactfinderInput): string {
  const { household, authForms, preparedBy, preparedDate } = input
  const members = household.members
  const clientNames = members.map((m) => m.name).join(' & ')

  const authFormLabels: Record<string, string> = {
    life: 'Life Insurance Authorization',
    wealth: 'Wealth Management Authorization',
    its: 'Insurance Transaction Supplement',
  }

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><title>Factfinder — ${escapeHtml(clientNames)}</title>
<style>${getBaseStyles()}
.sig-line {
  border-bottom: 1px solid #333;
  height: 30px;
  margin-top: 20px;
}
.sig-label {
  font-size: 8pt;
  color: #666;
  margin-top: 2px;
}
.checklist { list-style: none; padding: 0; }
.checklist li {
  padding: 3px 0 3px 20px;
  position: relative;
  font-size: 9pt;
  border-bottom: 0.5px dotted #ccc;
}
.checklist li::before {
  content: '';
  position: absolute;
  left: 0;
  top: 5px;
  width: 12px;
  height: 12px;
  border: 1.5px solid #888;
  border-radius: 2px;
}
.checklist li:last-child { border-bottom: none; }
</style></head><body>

<div class="header">
  <div class="header-left">
    <h1>RPI Factfinder</h1>
    <div class="subtitle">${escapeHtml(clientNames)}</div>
  </div>
  <div class="header-right">
    <div class="brand">RETIREMENT PROTECTORS</div>
    <strong>Prepared by:</strong> ${escapeHtml(preparedBy)}<br>
    <strong>Date:</strong> ${escapeHtml(preparedDate)}
  </div>
</div>

<!-- CLIENT INFORMATION (Pre-filled) -->
<div class="section">
  <div class="section-title">Client Information</div>
  ${members.map((m) => `
  <div style="border:1px solid #d0d7de;border-radius:4px;padding:8px 10px;margin-bottom:8px">
    <div style="font-weight:700;font-size:9.5pt;color:#1a3a5c;border-bottom:1px solid #e0e0e0;padding-bottom:3px;margin-bottom:4px">${escapeHtml(m.name)}</div>
    <div class="two-col">
      <div>
        <div style="display:flex;gap:4px;margin-bottom:1px"><span style="font-weight:600;color:#444;min-width:100px">Age:</span><span>${m.age}</span></div>
        <div style="display:flex;gap:4px;margin-bottom:1px"><span style="font-weight:600;color:#444;min-width:100px">Annual Income:</span><span>${formatCurrency(m.annualIncome)}</span></div>
      </div>
      <div>
        <div style="display:flex;gap:4px;margin-bottom:1px"><span style="font-weight:600;color:#444;min-width:100px">Investable:</span><span>${formatCurrency(m.investableAssets)}</span></div>
        <div style="display:flex;gap:4px;margin-bottom:1px"><span style="font-weight:600;color:#444;min-width:100px">Net Worth:</span><span>${formatCurrency(m.totalNetWorth)}</span></div>
      </div>
    </div>
  </div>`).join('')}
</div>

<!-- ACCOUNT INVENTORY (Pre-filled) -->
<div class="section">
  <div class="section-title">Account Inventory</div>
  <table>
    <thead><tr><th>Owner</th><th>Type</th><th>Carrier</th><th>Product</th><th>Value</th><th>Tax Status</th></tr></thead>
    <tbody>
      ${members.flatMap((m) => m.accounts).map((a) => `<tr><td>${escapeHtml(a.owner)}</td><td>${escapeHtml(a.type.toUpperCase())}</td><td>${escapeHtml(a.carrier)}</td><td>${escapeHtml(a.product)}</td><td>${formatCurrency(a.accountValue)}</td><td>${escapeHtml(a.taxStatus.toUpperCase())}</td></tr>`).join('')}
    </tbody>
  </table>
</div>

<!-- AUTHORIZATION FORMS CHECKLIST -->
<div class="section">
  <div class="section-title">Authorization Forms Required</div>
  <ul class="checklist">
    ${authForms.map((form) => `<li>${escapeHtml(authFormLabels[form] ?? form)}</li>`).join('')}
    <li>Client Acknowledgement of Suitability</li>
    <li>Privacy Notice Acknowledgement</li>
  </ul>
</div>

<!-- TIMELINE -->
<div class="section">
  <div class="section-title">Expected Timeline</div>
  <table>
    <thead><tr><th>Step</th><th>Action</th><th>Expected Timeframe</th></tr></thead>
    <tbody>
      <tr><td>1</td><td>Sign authorization forms</td><td>At meeting</td></tr>
      <tr><td>2</td><td>Submit applications to carrier(s)</td><td>Within 48 hours</td></tr>
      <tr><td>3</td><td>Carrier review / underwriting</td><td>1-3 weeks</td></tr>
      <tr><td>4</td><td>Policy issuance / account setup</td><td>2-4 weeks</td></tr>
      <tr><td>5</td><td>Delivery / confirmation call</td><td>Within 1 week of issuance</td></tr>
    </tbody>
  </table>
</div>

<!-- SIGNATURES -->
<div class="page-break"></div>
<div class="header">
  <div class="header-left">
    <h1>Signature Page</h1>
    <div class="subtitle">${escapeHtml(clientNames)}</div>
  </div>
  <div class="header-right"><div class="brand">RETIREMENT PROTECTORS</div></div>
</div>

${members.map((m) => `
<div style="margin-bottom:30px">
  <p style="font-size:10pt;font-weight:700;color:#1a3a5c">${escapeHtml(m.name)}</p>
  <div class="sig-line"></div>
  <div class="sig-label">Signature — Date: _______________</div>
</div>`).join('')}

<div style="margin-bottom:30px">
  <p style="font-size:10pt;font-weight:700;color:#1a3a5c">Agent: ${escapeHtml(preparedBy)}</p>
  <div class="sig-line"></div>
  <div class="sig-label">Signature — Date: _______________</div>
</div>

${renderFooter(clientNames, preparedDate)}
</body></html>`
}
