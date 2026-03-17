/**
 * Shared HTML/CSS styles for all QUE casework templates.
 * Matches the RPI design system from existing templates.
 */

export function getBaseStyles(): string {
  return `
  @page {
    size: letter;
    margin: 0.5in 0.6in;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
    font-size: 10pt;
    color: #1a1a1a;
    line-height: 1.4;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    border-bottom: 3px solid #1a3a5c;
    padding-bottom: 10px;
    margin-bottom: 14px;
  }
  .header-left h1 {
    font-size: 18pt;
    font-weight: 700;
    color: #1a3a5c;
    letter-spacing: -0.3px;
  }
  .header-left .subtitle {
    font-size: 10pt;
    color: #555;
    margin-top: 2px;
  }
  .header-right {
    text-align: right;
    font-size: 9pt;
    color: #555;
    line-height: 1.5;
  }
  .header-right strong { color: #1a3a5c; }
  .brand {
    font-size: 11pt;
    font-weight: 700;
    color: #1a3a5c;
    letter-spacing: 1px;
  }
  .section {
    margin-bottom: 14px;
    break-inside: avoid;
  }
  .section-title {
    font-size: 11pt;
    font-weight: 700;
    color: #fff;
    background: #1a3a5c;
    padding: 4px 10px;
    margin-bottom: 6px;
    border-radius: 2px;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 9pt;
  }
  th {
    background: #e8edf2;
    color: #1a3a5c;
    font-weight: 700;
    text-align: left;
    padding: 4px 6px;
    border-bottom: 1.5px solid #1a3a5c;
    font-size: 8pt;
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }
  td {
    padding: 3px 6px;
    border-bottom: 0.5px solid #ddd;
    vertical-align: top;
  }
  tr:last-child td { border-bottom: none; }
  .highlight-row td { background: #f0f6ff; }
  .total-row { background: #1a3a5c; color: #fff; font-weight: 700; }
  .total-row td { color: #fff; border-bottom: none; }
  .two-col {
    display: flex;
    gap: 16px;
  }
  .two-col > div { flex: 1; }
  .metric-cards {
    display: flex;
    gap: 12px;
    margin-bottom: 14px;
  }
  .metric-card {
    flex: 1;
    border: 1px solid #d0d7de;
    border-radius: 4px;
    padding: 8px 10px;
    text-align: center;
  }
  .metric-card .label {
    font-size: 7pt;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #666;
    font-weight: 600;
  }
  .metric-card .value {
    font-size: 14pt;
    font-weight: 700;
    color: #1a3a5c;
  }
  .metric-card .value.green { color: #1a7a3a; }
  .metric-card .value.red { color: #c44; }
  .opp-box {
    border-left: 3px solid #2a7d4f;
    background: #f4faf6;
    padding: 6px 10px;
    margin-bottom: 8px;
    break-inside: avoid;
    border-radius: 0 4px 4px 0;
  }
  .opp-box.yellow { border-left-color: #c49000; background: #fef9ee; }
  .opp-box.blue { border-left-color: #2563b3; background: #f0f6ff; }
  .opp-title {
    font-weight: 700;
    font-size: 9.5pt;
    color: #1a3a5c;
    margin-bottom: 3px;
  }
  .opp-box p, .opp-box li { font-size: 8.5pt; line-height: 1.35; }
  .opp-box ul { padding-left: 14px; margin-top: 2px; }
  .footer {
    margin-top: 10px;
    padding-top: 6px;
    border-top: 1px solid #ddd;
    display: flex;
    justify-content: space-between;
    font-size: 7.5pt;
    color: #999;
  }
  .disclosure {
    margin-top: 10px;
    padding: 6px 10px;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 7pt;
    color: #888;
    line-height: 1.4;
  }
  .page-break { page-break-before: always; }
  @media print {
    body { font-size: 9.5pt; }
    .no-print { display: none; }
  }`
}

export function formatCurrency(value: number): string {
  return '$' + Math.round(value).toLocaleString('en-US')
}

export function formatPercent(value: number, decimals = 1): string {
  return (typeof value === 'number' ? (value < 1 ? value * 100 : value) : 0).toFixed(decimals) + '%'
}

export function renderHeader(title: string, subtitle: string, preparedBy: string, preparedDate: string): string {
  return `
  <div class="header">
    <div class="header-left">
      <h1>${escapeHtml(title)}</h1>
      <div class="subtitle">${escapeHtml(subtitle)}</div>
    </div>
    <div class="header-right">
      <div class="brand">RETIREMENT PROTECTORS</div>
      <strong>Prepared by:</strong> ${escapeHtml(preparedBy)}<br>
      <strong>Date:</strong> ${escapeHtml(preparedDate)}
    </div>
  </div>`
}

export function renderFooter(clientNames: string, preparedDate: string): string {
  return `
  <div class="footer">
    <span>Retirement Protectors, Inc. — Confidential</span>
    <span>Prepared for ${escapeHtml(clientNames)} — ${escapeHtml(preparedDate)}</span>
  </div>`
}

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
