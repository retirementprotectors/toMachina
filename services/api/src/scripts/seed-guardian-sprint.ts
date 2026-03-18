import { initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

if (getApps().length === 0) {
  initializeApp({ projectId: 'claude-mcp-484718' })
}
const db = getFirestore()

const PLAN_LINK = '.claude/guardian/GUARDIAN_PLAN.md'
const DISCOVERY_URL = '.claude/guardian-vision.html'

const SPRINT = {
  name: 'GUARDIAN',
  description: 'The Data Protection Engine. GUARDIAN protects the data the way FORGE protects the build. Code-enforced write gates, schema validation, anomaly detection, and a dashboard to see data health at a glance.',
  discovery_url: DISCOVERY_URL,
  plan_link: PLAN_LINK,
}

const ITEMS = [
  // --- Phase A: Forensic Audit ---
  {
    title: 'Guardian Snapshot Tool — Capture current Firestore state',
    description: 'Script that reads every document from key collections (clients, accounts, carriers, households, users, pipelines, FORGE, ATLAS) and writes a timestamped snapshot to data_snapshots collection. Captures doc counts, field coverage percentages, and sample hashes.',
    portal: 'INFRA',
    scope: 'Data',
    component: 'GUARDIAN',
    section: 'Phase A: Forensic Audit',
    type: 'idea',
  },
  {
    title: 'Guardian Forensics — BigQuery change history analysis',
    description: 'Script that queries toMachina.firestore_changes BigQuery table to reconstruct 30-day change history. Key queries: charter/NAIC destruction timeline, bulk write detection (>50 docs in <5 min), schema violations, orphan detection, duplicate detection.',
    portal: 'INFRA',
    scope: 'Data',
    component: 'GUARDIAN',
    section: 'Phase A: Forensic Audit',
    type: 'idea',
  },
  {
    title: 'Guardian Cross-Reference — Firestore vs MATRIX comparison',
    description: 'Script that compares Firestore state against MATRIX Sheets. Client count delta, account count delta, field-level spot checks on random sample of 100 records, records in Sheets but not Firestore (lost in migration), records in Firestore but not Sheets (never bridged).',
    portal: 'INFRA',
    scope: 'Data',
    component: 'GUARDIAN',
    section: 'Phase A: Forensic Audit',
    type: 'idea',
  },
  {
    title: 'Guardian API Route — Audit report endpoint',
    description: 'GET /api/guardian/audit-report — Returns structured damage report: summary (total collections audited, issues found, severity breakdown), per-collection details (missing fields, orphans, duplicates), and timeline (bulk operations, anomalies).',
    portal: 'INFRA',
    scope: 'Data',
    component: 'GUARDIAN',
    section: 'Phase A: Forensic Audit',
    type: 'idea',
  },
  {
    title: 'Guardian Types — TypeScript type definitions',
    description: 'packages/core/src/types/guardian.ts — GuardianAudit, GuardianFinding, DataSnapshot, GuardianWrite, AnomalyAlert interfaces. Export from types/index.ts.',
    portal: 'INFRA',
    scope: 'Data',
    component: 'GUARDIAN',
    section: 'Phase A: Forensic Audit',
    type: 'idea',
  },

  // --- Phase B: Write Gate + Schema Validation ---
  {
    title: 'Write Gate Middleware — Gate ALL Firestore writes',
    description: 'services/api/src/middleware/write-gate.ts — Wraps ALL POST/PUT/PATCH/DELETE to protected collections. Attaches lineage metadata (agent_session_id, source_script, timestamp, user_email). Blocks bulk writes (>10 docs) without x-bulk-approved header (403). Runs schema validation (400 if required fields missing). Logs every write to guardian_writes collection.',
    portal: 'INFRA',
    scope: 'Platform',
    component: 'GUARDIAN',
    section: 'Phase B: Write Gate',
    type: 'idea',
  },
  {
    title: 'Collection Schemas — Required field definitions',
    description: 'packages/core/src/validation/collection-schemas.ts — Defines required, neverNull, immutableAfterCreate, and recommended fields per collection. Clients: first_name, last_name, status required. Accounts: client_id, carrier_name, status required. Carriers: carrier_id, display_name, parent_brand required.',
    portal: 'INFRA',
    scope: 'Platform',
    component: 'GUARDIAN',
    section: 'Phase B: Write Gate',
    type: 'idea',
  },
  {
    title: 'Guardian Lineage Logger — Write tracking',
    description: 'services/api/src/lib/guardian-lineage.ts — Every write through the gate auto-logs to guardian_writes collection: timestamp, collection, doc_id, operation, agent_session_id, source_script, user_email, fields_modified, doc_count, validation_passed.',
    portal: 'INFRA',
    scope: 'Data',
    component: 'GUARDIAN',
    section: 'Phase B: Write Gate',
    type: 'idea',
  },
  {
    title: 'Wire Write Gate into server.ts + Firestore rules',
    description: 'MODIFY services/api/src/server.ts to apply write-gate middleware to all protected collection routes. MODIFY firestore.rules to add data_snapshots, guardian_writes, guardian_audits, guardian_findings collection rules (isRPIUser gated).',
    portal: 'INFRA',
    scope: 'Platform',
    component: 'GUARDIAN',
    section: 'Phase B: Write Gate',
    type: 'idea',
  },

  // --- Phase C: Hookify Enforcement ---
  {
    title: 'Hookify — block-direct-firestore-write rule',
    description: 'Block db.collection( / getFirestore().collection( outside services/api/ and services/bridge/. Event: file. Action: block. Message: "Direct Firestore writes outside the API are blocked. All data modifications must go through the API write gate."',
    portal: 'INFRA',
    scope: 'Platform',
    component: 'GUARDIAN',
    section: 'Phase C: Hookify',
    type: 'idea',
  },
  {
    title: 'Hookify — block-seed-without-snapshot rule',
    description: 'Block npx tsx.*seed-|migrate-|backfill- commands unless they include --snapshot or --dry-run flag. Event: bash. Action: block. Message: "Seed/migration scripts must include --snapshot or --dry-run flag."',
    portal: 'INFRA',
    scope: 'Platform',
    component: 'GUARDIAN',
    section: 'Phase C: Hookify',
    type: 'idea',
  },
  {
    title: 'Hookify — block-bulk-import-without-atlas rule',
    description: 'Block prompts containing import/bulk/migrate keywords without ATLAS consultation. Event: prompt. Action: block. Also upgrade existing intent-atlas-consult from warn to block.',
    portal: 'INFRA',
    scope: 'Platform',
    component: 'GUARDIAN',
    section: 'Phase C: Hookify',
    type: 'idea',
  },

  // --- Phase D: Dashboard UI ---
  {
    title: 'Guardian Module — Main component with 5 tabs',
    description: 'packages/ui/src/modules/Guardian/index.tsx — Portal-branded module with tabs: Health Overview, Write Gate, Audit History, Alerts, Baselines. Same pattern as Forge module. Export from modules/index.ts.',
    portal: 'SHARED',
    scope: 'Module',
    component: 'GUARDIAN',
    section: 'Phase D: Dashboard',
    type: 'idea',
  },
  {
    title: 'Health Overview — Collection health cards',
    description: 'HealthOverview.tsx — One card per protected collection showing: doc count (current vs baseline), required field coverage %, status indicator (green/yellow/red), trend arrow, last modified timestamp, issues count.',
    portal: 'SHARED',
    scope: 'Module',
    component: 'GUARDIAN',
    section: 'Phase D: Dashboard',
    type: 'idea',
  },
  {
    title: 'Write Gate Console — Real-time write log',
    description: 'WriteGateConsole.tsx — Live feed of write gate activity. Each entry shows: PASS/BLOCK/WARN/BULK badge, detail text, timestamp. Filterable by collection, status, time range.',
    portal: 'SHARED',
    scope: 'Module',
    component: 'GUARDIAN',
    section: 'Phase D: Dashboard',
    type: 'idea',
  },
  {
    title: 'Audit History + Alert Feed + Baseline Manager tabs',
    description: 'AuditHistory.tsx (list of past audits with phase indicators, finding counts), AlertFeed.tsx (active anomaly alerts with severity, acknowledge action), BaselineManager.tsx (snapshot list, create new, drift comparison view).',
    portal: 'SHARED',
    scope: 'Module',
    component: 'GUARDIAN',
    section: 'Phase D: Dashboard',
    type: 'idea',
  },
  {
    title: 'Guardian API endpoints — health, writes, alerts, baselines',
    description: 'MODIFY services/api/src/routes/guardian.ts — Add GET /api/guardian/health (collection health cards), GET /api/guardian/writes (write gate log), GET /api/guardian/alerts (active alerts), GET/POST /api/guardian/baselines (snapshot management).',
    portal: 'INFRA',
    scope: 'Data',
    component: 'GUARDIAN',
    section: 'Phase D: Dashboard',
    type: 'idea',
  },
  {
    title: 'Guardian pages + sidebar nav in all 3 portals',
    description: 'NEW apps/*/app/(portal)/admin/guardian/page.tsx (x3). MODIFY PortalSidebar.tsx (x3) to add Guardian link in Admin section.',
    portal: 'SHARED',
    scope: 'Module',
    component: 'GUARDIAN',
    section: 'Phase D: Dashboard',
    type: 'idea',
  },

  // --- Phase E: Always-On Monitoring ---
  {
    title: 'Anomaly Detection Engine — Core detection logic',
    description: 'services/api/src/lib/guardian-anomaly.ts — Detects: mass deletion (>5 docs in 15 min → CRITICAL), field nullification (>10 docs → HIGH), schema drift (>20 docs → MEDIUM), orphan creation (FK to non-existent → HIGH), duplicate creation (name+DOB match → MEDIUM).',
    portal: 'INFRA',
    scope: 'Platform',
    component: 'GUARDIAN',
    section: 'Phase E: Monitoring',
    type: 'idea',
  },
  {
    title: 'Guardian Monitor — Cloud Function (15-min schedule)',
    description: 'services/guardian-monitor/ — Cloud Function running every 15 minutes. Calls anomaly detection engine, sends Slack DM alerts to JDM (U09BBHTN8F2) on threshold breaches. Weekly automated baseline snapshots.',
    portal: 'INFRA',
    scope: 'Platform',
    component: 'GUARDIAN',
    section: 'Phase E: Monitoring',
    type: 'idea',
  },
]

async function seed() {
  const now = new Date().toISOString()
  const email = 'josh@retireprotected.com'

  // 1. Create the sprint
  const sprintRef = db.collection('sprints').doc()
  const sprintData = {
    ...SPRINT,
    status: 'active',
    phase: 'planned',
    item_ids: [] as string[],
    prompt_text: '',
    created_by: email,
    created_at: now,
    updated_at: now,
  }

  // 2. Create tracker items
  // Get current max TRK number
  const existingItems = await db.collection('tracker_items')
    .orderBy('created_at', 'desc')
    .limit(1)
    .get()

  let maxNum = 0
  if (!existingItems.empty) {
    const lastId = existingItems.docs[0].data().item_id || 'TRK-000'
    const match = lastId.match(/TRK-(\d+)/)
    if (match) maxNum = parseInt(match[1], 10)
  }

  const itemIds: string[] = []
  const batch = db.batch()

  for (let i = 0; i < ITEMS.length; i++) {
    const item = ITEMS[i]
    const num = maxNum + i + 1
    const itemId = `TRK-${String(num).padStart(3, '0')}`
    const ref = db.collection('tracker_items').doc()

    batch.set(ref, {
      item_id: itemId,
      ...item,
      status: 'planned',
      sprint_id: sprintRef.id,
      notes: '',
      attachments: [],
      created_by: email,
      created_at: now,
      updated_at: now,
    })

    itemIds.push(itemId)
    console.log(`  ${itemId}: ${item.title}`)
  }

  // Update sprint with item IDs
  sprintData.item_ids = itemIds
  batch.set(sprintRef, sprintData)

  await batch.commit()

  console.log(`\nSprint created: ${sprintRef.id}`)
  console.log(`  Name: ${SPRINT.name}`)
  console.log(`  Items: ${itemIds.length}`)
  console.log(`  Phase: planned`)
  console.log(`  Plan: ${PLAN_LINK}`)
}

seed().then(() => {
  console.log('\nDone.')
  process.exit(0)
}).catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
