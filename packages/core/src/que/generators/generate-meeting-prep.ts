/**
 * generate-meeting-prep (TRK-13381)
 *
 * Generates a 3-page meeting agenda with talk tracks.
 * Pattern: RPI-Client-Review-Meeting-Template.html
 *
 * Pure function: (MeetingPrepInput) => string (HTML)
 */

import type { MeetingPrepInput } from './types'
import { getBaseStyles, formatCurrency, renderFooter, escapeHtml } from './shared-styles'

export function generateMeetingPrep(input: MeetingPrepInput): string {
  const { household, analyses, preparedBy, preparedDate, meetingDate, location } = input
  const members = household.members
  const clientNames = members.map((m) => m.name).join(' & ')
  const allAccounts = members.flatMap((m) => m.accounts)
  const totalIncome = members.reduce((sum, m) => sum + m.annualIncome, 0)
  const totalInvestable = members.reduce((sum, m) => sum + m.investableAssets, 0)
  const totalNetWorth = members.reduce((sum, m) => sum + m.totalNetWorth, 0)
  const applicableAnalyses = analyses.filter((a) => a.applicable)

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><title>Meeting Prep — ${escapeHtml(clientNames)}</title>
<style>${getBaseStyles()}
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
.notes-area {
  border: 1px solid #d0d7de;
  border-radius: 4px;
  min-height: 80px;
  padding: 6px;
  margin-top: 4px;
}
.notes-lines {
  border-bottom: 0.5px dotted #ccc;
  height: 18px;
}
</style></head><body>

<!-- PAGE 1: SNAPSHOT + ASSETS -->
<div class="header">
  <div class="header-left">
    <h1>Client Review Meeting</h1>
    <div class="subtitle">${escapeHtml(clientNames)}</div>
  </div>
  <div class="header-right">
    <div class="brand">RETIREMENT PROTECTORS</div>
    <strong>Date:</strong> ${escapeHtml(meetingDate)}<br>
    <strong>Agent:</strong> ${escapeHtml(preparedBy)}<br>
    <strong>Location:</strong> ${escapeHtml(location)}
  </div>
</div>

<!-- SUMMARY BAR -->
<div style="display:flex;gap:0;margin-bottom:14px;border-radius:4px;overflow:hidden;border:1px solid #d0d7de">
  <div style="flex:1;text-align:center;padding:6px 4px;border-right:1px solid #d0d7de">
    <div style="font-size:7pt;text-transform:uppercase;letter-spacing:0.5px;color:#666;font-weight:600">Net Worth</div>
    <div style="font-size:13pt;font-weight:700;color:#1a3a5c">${formatCurrency(totalNetWorth)}</div>
  </div>
  <div style="flex:1;text-align:center;padding:6px 4px;border-right:1px solid #d0d7de">
    <div style="font-size:7pt;text-transform:uppercase;letter-spacing:0.5px;color:#666;font-weight:600">Investable</div>
    <div style="font-size:13pt;font-weight:700;color:#1a3a5c">${formatCurrency(totalInvestable)}</div>
  </div>
  <div style="flex:1;text-align:center;padding:6px 4px;border-right:1px solid #d0d7de">
    <div style="font-size:7pt;text-transform:uppercase;letter-spacing:0.5px;color:#666;font-weight:600">Annual Income</div>
    <div style="font-size:13pt;font-weight:700;color:#1a7a3a">${formatCurrency(totalIncome)}</div>
  </div>
  <div style="flex:1;text-align:center;padding:6px 4px">
    <div style="font-size:7pt;text-transform:uppercase;letter-spacing:0.5px;color:#666;font-weight:600">Accounts</div>
    <div style="font-size:13pt;font-weight:700;color:#1a3a5c">${allAccounts.length}</div>
  </div>
</div>

<!-- CLIENT CARDS -->
<div class="section">
  <div class="section-title">Client Information</div>
  <div class="two-col">
    ${members.map((m) => `
    <div style="border:1px solid #d0d7de;border-radius:4px;padding:8px 10px;margin-bottom:8px;break-inside:avoid">
      <div style="font-weight:700;font-size:9.5pt;color:#1a3a5c;margin-bottom:4px;border-bottom:1px solid #e0e0e0;padding-bottom:3px">${escapeHtml(m.name)}</div>
      <div style="display:flex;gap:4px;margin-bottom:1px"><span style="font-weight:600;color:#444;min-width:80px">Age:</span><span>${m.age}</span></div>
      <div style="display:flex;gap:4px;margin-bottom:1px"><span style="font-weight:600;color:#444;min-width:80px">Accounts:</span><span>${m.accounts.length}</span></div>
    </div>`).join('')}
  </div>
</div>

<!-- ASSET TABLE -->
${allAccounts.length > 0 ? `
<div class="section">
  <div class="section-title">Account Overview</div>
  <table>
    <thead><tr><th>Owner</th><th>Type</th><th>Carrier</th><th>Product</th><th>Value</th></tr></thead>
    <tbody>
      ${allAccounts.slice(0, 15).map((a) => `<tr${a.accountValue > 50_000 ? ' class="highlight-row"' : ''}><td>${escapeHtml(a.owner)}</td><td>${escapeHtml(a.type.toUpperCase())}</td><td>${escapeHtml(a.carrier)}</td><td>${escapeHtml(a.product)}</td><td><strong>${formatCurrency(a.accountValue)}</strong></td></tr>`).join('')}
      <tr class="total-row"><td colspan="4">TOTAL</td><td>${formatCurrency(totalInvestable)}</td></tr>
    </tbody>
  </table>
</div>` : ''}

<!-- PAGE 2: OPPORTUNITIES -->
<div class="page-break"></div>
<div class="header">
  <div class="header-left">
    <h1>Opportunities & Discussion Points</h1>
    <div class="subtitle">${escapeHtml(clientNames)} — ${escapeHtml(meetingDate)}</div>
  </div>
  <div class="header-right"><div class="brand">RETIREMENT PROTECTORS</div></div>
</div>

${applicableAnalyses.map((a, i) => `
<div class="opp-box${i % 3 === 1 ? ' yellow' : i % 3 === 2 ? ' blue' : ''}">
  <div class="opp-title">${i + 1}. ${escapeHtml(a.type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()))}</div>
  <p>${escapeHtml(a.summary)}</p>
  ${a.findings.length > 0 ? `<ul>${a.findings.slice(0, 3).map((f) => `<li>${escapeHtml(f)}</li>`).join('')}</ul>` : ''}
  <div style="font-style:italic;color:${i % 3 === 1 ? '#8a6500' : i % 3 === 2 ? '#1d4f8a' : '#2a6b3f'};margin-top:3px;font-size:8.5pt">"${escapeHtml(a.recommendation)}"</div>
</div>`).join('')}

${applicableAnalyses.length === 0 ? '<p style="font-size:10pt;color:#666">No specific opportunities identified from current data. General review recommended.</p>' : ''}

<!-- PAGE 3: HOUSEKEEPING & NOTES -->
<div class="page-break"></div>
<div class="header">
  <div class="header-left">
    <h1>Housekeeping & Meeting Notes</h1>
    <div class="subtitle">${escapeHtml(clientNames)} — ${escapeHtml(meetingDate)}</div>
  </div>
  <div class="header-right"><div class="brand">RETIREMENT PROTECTORS</div></div>
</div>

<div class="section">
  <div class="section-title">Suggested Meeting Flow</div>
  <table>
    <thead><tr><th style="width:30px">#</th><th style="width:160px">Phase</th><th>What to Do</th></tr></thead>
    <tbody>
      <tr><td><strong>1</strong></td><td>Open Warm</td><td>"We're here to make sure everything is working for you and nothing's been missed."</td></tr>
      <tr><td><strong>2</strong></td><td>Walk the Full Picture</td><td>Show them what they own — asset tables on Page 1.</td></tr>
      <tr><td><strong>3</strong></td><td>Confirm the Unknowns</td><td>Work through checklist below. Get answers, take notes.</td></tr>
      <tr><td><strong>4</strong></td><td>Educate on Opportunities</td><td>Walk through the top 2-3 opportunities from Page 2.</td></tr>
      <tr><td><strong>5</strong></td><td>Medicare Quick-Check</td><td>Premiums competitive? Drug coverage solid? Any gaps?</td></tr>
      <tr><td><strong>6</strong></td><td>Close with Next Steps</td><td>Anything they want to change? Concerns? Schedule follow-up if needed.</td></tr>
    </tbody>
  </table>
</div>

<div class="section">
  <div class="section-title">Items to Confirm</div>
  <ul class="checklist">
    <li>Current beneficiaries correct on all accounts?</li>
    <li>Social Security amounts and start dates confirmed?</li>
    <li>Any recent health changes or long-term care needs?</li>
    <li>Banking/mailing address changes?</li>
    <li>Medicare coverage review — any complaints or gaps?</li>
  </ul>
</div>

<div class="section">
  <div class="section-title">Meeting Notes</div>
  <div class="notes-area">
    ${Array(10).fill('<div class="notes-lines"></div>').join('')}
  </div>
</div>

<div class="section">
  <div class="section-title">Next Steps & Follow-Up</div>
  <div class="notes-area">
    ${Array(6).fill('<div class="notes-lines"></div>').join('')}
  </div>
</div>

${renderFooter(clientNames, preparedDate)}
</body></html>`
}
