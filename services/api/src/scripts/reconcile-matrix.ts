// ============================================================================
// RECONCILE_MATRIX — Triage + Resolve tool for Sheets vs Firestore delta
// TRK-13545 completion: detect → triage → resolve
// Run: npx tsx services/api/src/scripts/reconcile-matrix.ts
// ============================================================================

import { initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { google } from 'googleapis'
import * as fs from 'fs'
import * as path from 'path'

if (getApps().length === 0) {
  initializeApp({ projectId: 'claude-mcp-484718' })
}
const db = getFirestore()

const PRODASH_MATRIX_ID = '1byyXMJDpjzgqkhTjJ2GdvTclaGYMDKQ1BQEnz61Eg-w'

// ── Sheets Client ───────────────────────────────────────────────────────────

async function getSheetsClient() {
  const auth = new google.auth.GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  })
  return google.sheets({ version: 'v4', auth })
}

async function getSheetRows(
  sheetsClient: ReturnType<typeof google.sheets>,
  spreadsheetId: string,
  tab: string
): Promise<{ headers: string[]; rows: Record<string, string>[] }> {
  const res = await sheetsClient.spreadsheets.values.get({
    spreadsheetId,
    range: `'${tab}'`,
  })
  const raw = res.data.values || []
  if (raw.length < 2) return { headers: [], rows: [] }
  const headers = raw[0].map((h: string) => String(h).trim().toLowerCase().replace(/\s+/g, '_'))
  const rows = raw.slice(1).map((r: string[]) => {
    const obj: Record<string, string> = {}
    headers.forEach((h: string, i: number) => { obj[h] = String(r[i] || '').trim() })
    return obj
  })
  return { headers, rows }
}

function normalize(s: string | undefined | null): string {
  if (!s) return ''
  return String(s).toLowerCase().trim().replace(/\s+/g, ' ')
}

// ── Step 1: Pull lost records from Sheets ────────────────────────────────────

interface LostRecord {
  sheet_id: string
  first_name: string
  last_name: string
  email: string
  phone: string
  dob: string
  status: string
  address: string
  city: string
  state: string
  zip: string
  source: string
  raw: Record<string, string>
}

interface TriageResult {
  id: string
  first_name: string
  last_name: string
  status: string
  classification: 'IMPORT' | 'SKIP_INACTIVE' | 'SKIP_DUPLICATE' | 'INVESTIGATE'
  reason: string
  duplicate_of?: string
}

async function pullLostRecords(): Promise<LostRecord[]> {
  console.log('Step 1: Pulling lost records from _CLIENT_MASTER...')
  const sheets = await getSheetsClient()
  const { rows } = await getSheetRows(sheets, PRODASH_MATRIX_ID, '_CLIENT_MASTER')
  console.log(`  Sheet rows: ${rows.length}`)

  // Build Firestore ID set
  const fsSnap = await db.collection('clients').select('client_id').get()
  const fsIds = new Set<string>()
  for (const doc of fsSnap.docs) {
    fsIds.add(doc.id)
    const cid = doc.data().client_id as string | undefined
    if (cid) fsIds.add(cid)
  }
  console.log(`  Firestore clients: ${fsSnap.size}`)

  // Find the ID column (usually first column or 'client_id' or 'id')
  const lost: LostRecord[] = []
  for (const row of rows) {
    const id = row.client_id || row.id || row.ghl_contact_id || Object.values(row)[0] || ''
    if (!id || fsIds.has(id)) continue

    lost.push({
      sheet_id: id,
      first_name: row.first_name || row.firstname || '',
      last_name: row.last_name || row.lastname || '',
      email: row.email || '',
      phone: row.phone || row.phone_primary || '',
      dob: row.dob || row.date_of_birth || '',
      status: row.client_status || row.status || '',
      address: row.address || row.address1 || '',
      city: row.city || '',
      state: row.state || '',
      zip: row.zip || row.postal_code || '',
      source: row.source || '',
      raw: row,
    })
  }

  console.log(`  Lost records found: ${lost.length}`)
  return lost
}

// ── Step 2: Triage ───────────────────────────────────────────────────────────

async function triageLostRecords(lost: LostRecord[]): Promise<TriageResult[]> {
  console.log('\nStep 2: Triaging lost records...')

  // Build name+DOB index from Firestore for dedup
  const fsSnap = await db.collection('clients').select('first_name', 'last_name', 'dob', 'email').get()
  const nameDobIndex = new Map<string, string>() // normalized key → doc ID
  const emailIndex = new Map<string, string>()

  for (const doc of fsSnap.docs) {
    const d = doc.data()
    const key = `${normalize(d.first_name as string)}|${normalize(d.last_name as string)}|${normalize(d.dob as string)}`
    if (key !== '||') nameDobIndex.set(key, doc.id)
    const email = normalize(d.email as string)
    if (email) emailIndex.set(email, doc.id)
  }

  const results: TriageResult[] = []
  let skipInactive = 0
  let skipDupe = 0
  let importCount = 0
  let investigate = 0

  for (const rec of lost) {
    const status = normalize(rec.status)

    // Skip inactive/deleted
    if (status === 'deleted' || status === 'inactive' || status === 'archived' ||
        status === 'test' || status === 'duplicate' || status === 'merged') {
      results.push({
        id: rec.sheet_id, first_name: rec.first_name, last_name: rec.last_name,
        status: rec.status, classification: 'SKIP_INACTIVE',
        reason: `Status: ${rec.status}`,
      })
      skipInactive++
      continue
    }

    // Check name+DOB duplicate
    const key = `${normalize(rec.first_name)}|${normalize(rec.last_name)}|${normalize(rec.dob)}`
    if (key !== '||' && nameDobIndex.has(key)) {
      results.push({
        id: rec.sheet_id, first_name: rec.first_name, last_name: rec.last_name,
        status: rec.status, classification: 'SKIP_DUPLICATE',
        reason: `Name+DOB match in Firestore`,
        duplicate_of: nameDobIndex.get(key),
      })
      skipDupe++
      continue
    }

    // Check email duplicate
    const email = normalize(rec.email)
    if (email && emailIndex.has(email)) {
      results.push({
        id: rec.sheet_id, first_name: rec.first_name, last_name: rec.last_name,
        status: rec.status, classification: 'SKIP_DUPLICATE',
        reason: `Email match in Firestore: ${rec.email}`,
        duplicate_of: emailIndex.get(email),
      })
      skipDupe++
      continue
    }

    // No name and no email = investigate
    if (!rec.first_name && !rec.last_name && !rec.email) {
      results.push({
        id: rec.sheet_id, first_name: rec.first_name, last_name: rec.last_name,
        status: rec.status, classification: 'INVESTIGATE',
        reason: 'No name or email — cannot verify identity',
      })
      investigate++
      continue
    }

    // Genuinely missing — mark for import
    results.push({
      id: rec.sheet_id, first_name: rec.first_name, last_name: rec.last_name,
      status: rec.status, classification: 'IMPORT',
      reason: 'Active client in Sheets, not found in Firestore by ID/name/email',
    })
    importCount++
  }

  console.log(`  Skip (inactive/deleted): ${skipInactive}`)
  console.log(`  Skip (duplicate):        ${skipDupe}`)
  console.log(`  Investigate:             ${investigate}`)
  console.log(`  Ready to import:         ${importCount}`)

  return results
}

// ── Step 3: Generate review HTML ─────────────────────────────────────────────

function generateReviewHtml(
  triage: TriageResult[],
  lost: LostRecord[],
  outputPath: string
) {
  console.log('\nStep 3: Generating review HTML...')

  const lostMap = new Map(lost.map(l => [l.sheet_id, l]))
  const imports = triage.filter(t => t.classification === 'IMPORT')
  const skipped = triage.filter(t => t.classification !== 'IMPORT')

  const importRows = imports.map(t => {
    const rec = lostMap.get(t.id)
    return `<tr>
      <td><input type="checkbox" checked data-id="${t.id}" class="import-check" /></td>
      <td>${t.first_name} ${t.last_name}</td>
      <td>${rec?.email || ''}</td>
      <td>${rec?.phone || ''}</td>
      <td>${rec?.dob || ''}</td>
      <td>${rec?.city || ''}, ${rec?.state || ''}</td>
      <td>${t.status || 'Active'}</td>
      <td>${rec?.source || ''}</td>
    </tr>`
  }).join('\n')

  const skipRows = skipped.map(t => {
    return `<tr style="opacity:0.6">
      <td>${t.classification}</td>
      <td>${t.first_name} ${t.last_name}</td>
      <td>${t.reason}</td>
      <td>${t.duplicate_of || ''}</td>
      <td>${t.id}</td>
    </tr>`
  }).join('\n')

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>MATRIX Reconciliation Review</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0f1219; color: #e2e8f0; padding: 24px; }
  h1 { font-size: 22px; font-weight: 800; color: #c8872e; margin-bottom: 4px; }
  .subtitle { font-size: 13px; color: #94a3b8; margin-bottom: 24px; }
  .stats { display: flex; gap: 12px; margin-bottom: 24px; }
  .stat { background: #1c2333; border: 1px solid #2a3347; border-radius: 10px; padding: 16px 20px; flex: 1; }
  .stat-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: #64748b; }
  .stat-value { font-size: 28px; font-weight: 800; margin-top: 4px; }
  .stat-value.green { color: #22c55e; }
  .stat-value.yellow { color: #fbbf24; }
  .stat-value.red { color: #ef4444; }
  .stat-value.blue { color: #3b82f6; }
  h2 { font-size: 16px; font-weight: 700; color: #e2e8f0; margin: 24px 0 12px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { background: #1c2333; color: #94a3b8; text-align: left; padding: 10px 12px; font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #2a3347; }
  td { padding: 8px 12px; border-bottom: 1px solid #1e293b; }
  tr:hover { background: #1c2333; }
  .actions { margin: 24px 0; display: flex; gap: 12px; }
  button { padding: 10px 20px; border: none; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; }
  .btn-primary { background: #c8872e; color: white; }
  .btn-secondary { background: #1c2333; color: #94a3b8; border: 1px solid #2a3347; }
  .btn-primary:hover { background: #a06e24; }
  #export-json { display: none; }
</style>
</head>
<body>
  <h1>MATRIX Reconciliation Review</h1>
  <p class="subtitle">Generated ${new Date().toISOString().split('T')[0]} — Review and approve imports</p>

  <div class="stats">
    <div class="stat"><div class="stat-label">Total Lost</div><div class="stat-value">${triage.length}</div></div>
    <div class="stat"><div class="stat-label">Ready to Import</div><div class="stat-value green">${imports.length}</div></div>
    <div class="stat"><div class="stat-label">Skipped (Inactive)</div><div class="stat-value yellow">${triage.filter(t => t.classification === 'SKIP_INACTIVE').length}</div></div>
    <div class="stat"><div class="stat-label">Skipped (Duplicate)</div><div class="stat-value blue">${triage.filter(t => t.classification === 'SKIP_DUPLICATE').length}</div></div>
    <div class="stat"><div class="stat-label">Investigate</div><div class="stat-value red">${triage.filter(t => t.classification === 'INVESTIGATE').length}</div></div>
  </div>

  <h2>Ready to Import (${imports.length})</h2>
  <p style="font-size:12px;color:#64748b;margin-bottom:12px">Uncheck any you do NOT want imported. Then click Export.</p>
  <table>
    <thead><tr><th></th><th>Name</th><th>Email</th><th>Phone</th><th>DOB</th><th>Location</th><th>Status</th><th>Source</th></tr></thead>
    <tbody>${importRows || '<tr><td colspan="8" style="text-align:center;color:#64748b;padding:24px">None — all records accounted for</td></tr>'}</tbody>
  </table>

  <div class="actions">
    <button class="btn-primary" onclick="exportApproved()">Export Approved for Import</button>
    <button class="btn-secondary" onclick="selectAll()">Select All</button>
    <button class="btn-secondary" onclick="deselectAll()">Deselect All</button>
  </div>

  <h2>Skipped / Resolved (${skipped.length})</h2>
  <table>
    <thead><tr><th>Classification</th><th>Name</th><th>Reason</th><th>Duplicate Of</th><th>Sheet ID</th></tr></thead>
    <tbody>${skipRows || '<tr><td colspan="5" style="text-align:center;color:#64748b;padding:24px">None</td></tr>'}</tbody>
  </table>

  <textarea id="export-json"></textarea>

  <script>
    function exportApproved() {
      const checks = document.querySelectorAll('.import-check:checked');
      const ids = [...checks].map(c => c.dataset.id);
      const el = document.getElementById('export-json');
      el.value = JSON.stringify(ids, null, 2);
      el.style.display = 'block';
      el.style.width = '100%';
      el.style.height = '200px';
      el.style.background = '#1c2333';
      el.style.color = '#e2e8f0';
      el.style.border = '1px solid #2a3347';
      el.style.borderRadius = '8px';
      el.style.padding = '12px';
      el.style.marginTop = '12px';
      el.style.fontFamily = 'monospace';
      el.style.fontSize = '12px';
      el.select();
    }
    function selectAll() { document.querySelectorAll('.import-check').forEach(c => c.checked = true); }
    function deselectAll() { document.querySelectorAll('.import-check').forEach(c => c.checked = false); }
  </script>
</body>
</html>`

  fs.writeFileSync(outputPath, html)
  console.log(`  Review page saved to: ${outputPath}`)
}

// ── Step 4: Generate import payload ──────────────────────────────────────────

function generateImportPayload(
  triage: TriageResult[],
  lost: LostRecord[],
  outputPath: string
) {
  const lostMap = new Map(lost.map(l => [l.sheet_id, l]))
  const toImport = triage
    .filter(t => t.classification === 'IMPORT')
    .map(t => {
      const rec = lostMap.get(t.id)!
      return {
        client_id: t.id,
        first_name: rec.first_name,
        last_name: rec.last_name,
        email: rec.email,
        phone: rec.phone,
        dob: rec.dob,
        address: rec.address,
        city: rec.city,
        state: rec.state,
        zip: rec.zip,
        client_status: rec.status || 'Active',
        source: rec.source || 'MATRIX_RECONCILE',
        imported_at: new Date().toISOString(),
        import_source: 'RECONCILE_MATRIX',
      }
    })

  fs.writeFileSync(outputPath, JSON.stringify(toImport, null, 2))
  console.log(`  Import payload saved to: ${outputPath} (${toImport.length} records)`)
  return toImport
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== RECONCILE_MATRIX — Triage + Resolve ===')
  console.log(`Timestamp: ${new Date().toISOString()}\n`)

  const lost = await pullLostRecords()
  if (lost.length === 0) {
    console.log('\nNo lost records found. Sheets and Firestore are in sync.')
    return
  }

  const triage = await triageLostRecords(lost)

  // Output directory
  const outDir = path.resolve(__dirname, '../../../../.claude/guardian-ui-ux')
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })

  // Generate review HTML
  const htmlPath = path.resolve(__dirname, '../../../../apps/prodash/public/plans/matrix-reconciliation-review.html')
  generateReviewHtml(triage, lost, htmlPath)

  // Generate import payload
  const payloadPath = path.join(outDir, 'reconcile-import-payload.json')
  generateImportPayload(triage, lost, payloadPath)

  // Save full triage report
  const reportPath = path.join(outDir, 'reconcile-triage-report.json')
  fs.writeFileSync(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    total_lost: lost.length,
    triage_summary: {
      import: triage.filter(t => t.classification === 'IMPORT').length,
      skip_inactive: triage.filter(t => t.classification === 'SKIP_INACTIVE').length,
      skip_duplicate: triage.filter(t => t.classification === 'SKIP_DUPLICATE').length,
      investigate: triage.filter(t => t.classification === 'INVESTIGATE').length,
    },
    triage_details: triage,
  }, null, 2))
  console.log(`  Triage report saved to: ${reportPath}`)

  // Summary
  console.log('\n' + '='.repeat(60))
  console.log('RECONCILIATION SUMMARY')
  console.log('='.repeat(60))
  const importCount = triage.filter(t => t.classification === 'IMPORT').length
  console.log(`  Total lost:     ${lost.length}`)
  console.log(`  Skip inactive:  ${triage.filter(t => t.classification === 'SKIP_INACTIVE').length}`)
  console.log(`  Skip duplicate: ${triage.filter(t => t.classification === 'SKIP_DUPLICATE').length}`)
  console.log(`  Investigate:    ${triage.filter(t => t.classification === 'INVESTIGATE').length}`)
  console.log(`  IMPORT:         ${importCount}`)
  console.log('')
  console.log(`  Review page:  /plans/matrix-reconciliation-review.html`)
  console.log(`  Import JSON:  .claude/guardian-ui-ux/reconcile-import-payload.json`)
  if (importCount > 0) {
    console.log(`\n  Next step: JDM reviews the HTML page, then run:`)
    console.log(`  npx tsx services/api/src/scripts/reconcile-matrix-import.ts`)
  }
  console.log('Done.')
}

main().catch((err) => {
  console.error('Reconciliation failed:', err)
  process.exit(1)
})
