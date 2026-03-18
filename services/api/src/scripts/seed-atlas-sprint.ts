import { initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

if (getApps().length === 0) {
  initializeApp({ projectId: 'claude-mcp-484718' })
}
const db = getFirestore()

const DISCOVERY_URL = '.claude/discovery/ATLAS_FRONTEND_AND_FIELD_INTROSPECT.md'

const SPRINT = {
  name: 'ATLAS Frontend + Field Introspect + Medicare Wire',
  description: 'Data intake layer for The Machine. Drop Zone, Review Queue, Import Report. Format library that learns. Nobody touches a database.',
  discovery_url: DISCOVERY_URL,
}

const ITEMS = [
  // --- Deliverable 1: WIRE_MEDICARE_ACCOUNTS ---
  {
    title: 'WIRE_MEDICARE_ACCOUNTS — Add wire #17',
    description: 'Add Medicare account data wire to packages/core/src/atlas/wires.ts and services/api/src/routes/atlas.ts. Parallel to WIRE_LIFE_ANNUITY_ACCOUNTS (#9) and WIRE_INVESTMENTS_ACCOUNTS (#10). Stages: Carrier data → TOOL_FIELD_INTROSPECT → Normalize → Validate → Match/Dedup → clients/{client_id}/accounts/ (account_category: medicare) → Frontend.',
    portal: 'INFRA',
    scope: 'Data',
    component: 'ATLAS Wires',
    section: 'Wire Definitions',
    type: 'idea',
  },

  // --- Deliverable 2: TOOL_FIELD_INTROSPECT ---
  {
    title: 'Format Library — Schema + Firestore collection',
    description: 'Define atlas/formats/ Firestore collection. Each doc = a saved format: carrier + export type key, header fingerprint (column names in order), column-to-field mapping, value patterns. Types in packages/core/src/atlas/formats.ts.',
    portal: 'INFRA',
    scope: 'Data',
    component: 'TOOL_FIELD_INTROSPECT',
    section: 'Format Library',
    type: 'idea',
  },
  {
    title: 'Format Library — API routes (CRUD)',
    description: 'GET/POST/PATCH /api/atlas/formats. List saved formats, create new format from confirmed mapping, update existing format. Filter by carrier, data_type, last_used.',
    portal: 'INFRA',
    scope: 'Data',
    component: 'TOOL_FIELD_INTROSPECT',
    section: 'Format Library',
    type: 'idea',
  },
  {
    title: 'Introspection Engine — Field sampler',
    description: 'Sample N docs from target Firestore collection. Extract per-field profiles: distinct values, value types (string/number/date/currency), cardinality, min/max, null rate. Returns structured field inventory.',
    portal: 'INFRA',
    scope: 'Data',
    component: 'TOOL_FIELD_INTROSPECT',
    section: 'Introspection Engine',
    type: 'idea',
  },
  {
    title: 'Introspection Engine — CSV analyzer',
    description: 'Parse uploaded CSV headers + first N rows. Extract per-column profiles: distinct values, inferred types, patterns (dates, currency, phone, SSN). Same structure as field sampler output for direct comparison.',
    portal: 'INFRA',
    scope: 'Data',
    component: 'TOOL_FIELD_INTROSPECT',
    section: 'Introspection Engine',
    type: 'idea',
  },
  {
    title: 'Introspection Engine — Matcher + scorer',
    description: 'Compare CSV column profiles against Firestore field profiles. Score overlap (value intersection, type match, name similarity). Rank candidate mappings. Auto-map above threshold (e.g., 90%). Flag ambiguous (50-89%). Skip below 50%.',
    portal: 'INFRA',
    scope: 'Data',
    component: 'TOOL_FIELD_INTROSPECT',
    section: 'Introspection Engine',
    type: 'idea',
  },
  {
    title: 'Introspect API endpoint — POST /api/atlas/introspect',
    description: 'Accepts: target collection path + CSV content (or headers + sample rows). Checks format library first (header fingerprint match). If no match, runs full introspection. Returns: auto-mapped fields, ambiguous fields (with candidates), unmapped fields.',
    portal: 'INFRA',
    scope: 'Data',
    component: 'TOOL_FIELD_INTROSPECT',
    section: 'API',
    type: 'idea',
  },
  {
    title: 'Header fingerprint recognition',
    description: 'On CSV arrival, hash the column header set and check against atlas/formats/ collection. If match found, return the saved column mapping instantly (no introspection needed). Exact match = 100% confidence. Partial match (>80% columns) = suggest with flag.',
    portal: 'INFRA',
    scope: 'Data',
    component: 'TOOL_FIELD_INTROSPECT',
    section: 'Format Library',
    type: 'idea',
  },

  // --- Deliverable 3: ATLAS Frontend ---
  {
    title: 'ATLAS Module shell — portal routing + sidebar nav',
    description: 'Create ATLAS as shared App (own brand) or Module in packages/ui/src/modules/. Add /atlas/ routes to all 3 portal apps. Add ATLAS to sidebar nav under Apps section. Decision needed: App vs Module.',
    portal: 'SHARED',
    scope: 'App',
    component: 'ATLAS Frontend',
    section: 'Shell',
    type: 'idea',
  },
  {
    title: 'Drop Zone — file upload + format recognition',
    description: 'Drag-and-drop file area. On drop: read CSV/XLSX, extract headers, hit POST /api/atlas/introspect. Show recognition confidence indicator. Known format = "100% — Processing..." Unknown format = "Analyzing..." → route to Review Queue.',
    portal: 'SHARED',
    scope: 'App',
    component: 'ATLAS Frontend',
    section: 'Drop Zone',
    type: 'idea',
  },
  {
    title: 'Drop Zone — processing pipeline',
    description: 'After mapping confirmed: run normalizers on all rows, hit POST /api/import/validate-full (dry run), show validation results, then POST /api/import/batch to commit. Route through appropriate wire based on data type.',
    portal: 'SHARED',
    scope: 'App',
    component: 'ATLAS Frontend',
    section: 'Drop Zone',
    type: 'idea',
  },
  {
    title: 'Review Queue — Field mapping cards',
    description: 'DeDup-style side-by-side UI. Left: CSV column name + sample values. Right: candidate Firestore fields + sample values + confidence score. User picks the right match or skips. Confirmed mapping saved to format library.',
    portal: 'SHARED',
    scope: 'App',
    component: 'ATLAS Frontend',
    section: 'Review Queue',
    type: 'idea',
  },
  {
    title: 'Review Queue — Record matching cards',
    description: 'When incoming records don\'t auto-match existing clients/accounts. Left: incoming record. Right: candidate matches with scores. User picks match or confirms "new record." Same DeDup-style UX.',
    portal: 'SHARED',
    scope: 'App',
    component: 'ATLAS Frontend',
    section: 'Review Queue',
    type: 'idea',
  },
  {
    title: 'Import Report — Ledger',
    description: 'Three-column table: Category | Count | Status. Sections: Received, Auto-Matched, New Created, Updated, Duplicates Removed, Duplicates to Review, Flagged for Review, Skipped, Errors. Input total MUST equal output total (balanced).',
    portal: 'SHARED',
    scope: 'App',
    component: 'ATLAS Frontend',
    section: 'Import Report',
    type: 'idea',
  },
  {
    title: 'Import Report — Drill-down + audit trail',
    description: 'Expandable rows on the ledger — click "23 Flagged" to see the 23 records. Exportable report. Stored in atlas/import_runs/ collection with full details for audit trail.',
    portal: 'SHARED',
    scope: 'App',
    component: 'ATLAS Frontend',
    section: 'Import Report',
    type: 'idea',
  },

  // --- FORGE Improvements (from this session) ---
  {
    title: 'FORGE — discovery_url field on Sprint + TrackerItem',
    description: 'Add discovery_url field (separate from plan_link) to Sprint and TrackerItem schemas. discovery_url = the discovery handoff doc. plan_link = the implementation plan. Both on sprint creation form and tracker item edit form.',
    portal: 'SHARED',
    scope: 'App',
    component: 'FORGE',
    section: 'Schema',
    type: 'improve',
  },
  {
    title: 'FORGE — Discovery Import (drag-and-drop)',
    description: 'Drop zone on sprint creation form. Accept a discovery markdown file (or paste URL/path). Parse structure: extract sprint name, description, deliverables → tracker items. Show preview before committing. Auto-set discovery_url. API: POST /api/sprints/import-discovery.',
    portal: 'SHARED',
    scope: 'App',
    component: 'FORGE',
    section: 'Sprint Creation',
    type: 'idea',
  },
  {
    title: 'FORGE — Discovery Import UI on sprint creation form',
    description: 'Add file drop zone and URL paste field to the Create Sprint modal. On file drop, read content, hit POST /api/sprints/import-discovery?dry_run=true for preview. Show extracted sprint name + item list. Confirm button commits.',
    portal: 'SHARED',
    scope: 'App',
    component: 'FORGE',
    section: 'Sprint Creation',
    type: 'idea',
  },
]

async function seed() {
  console.log('Seeding ATLAS sprint into FORGE...')

  // Get next TRK number
  const lastSnap = await db.collection('tracker_items').orderBy('item_id', 'desc').limit(1).get()
  let nextNum = 1
  if (!lastSnap.empty) {
    const lastId = (lastSnap.docs[0].data().item_id || 'TRK-000') as string
    nextNum = parseInt(lastId.replace('TRK-', ''), 10) + 1
  }
  console.log(`Starting at TRK-${String(nextNum).padStart(3, '0')}`)

  const now = new Date().toISOString()
  const batch = db.batch()
  const itemIds: string[] = []

  // Create tracker items
  for (const item of ITEMS) {
    const itemId = `TRK-${String(nextNum).padStart(3, '0')}`
    const ref = db.collection('tracker_items').doc(itemId)
    batch.set(ref, {
      ...item,
      item_id: itemId,
      status: 'in_sprint',
      sprint_id: null, // will be updated after sprint creation
      discovery_url: DISCOVERY_URL,
      plan_link: null,
      notes: '',
      created_at: now,
      updated_at: now,
      _created_by: 'josh@retireprotected.com',
    })
    itemIds.push(itemId)
    nextNum++
  }

  // Create sprint
  const sprintRef = db.collection('sprints').doc()
  batch.set(sprintRef, {
    name: SPRINT.name,
    description: SPRINT.description,
    discovery_url: SPRINT.discovery_url,
    plan_link: null,
    item_ids: itemIds,
    status: 'active',
    created_at: now,
    updated_at: now,
    _created_by: 'josh@retireprotected.com',
  })

  // Link items to sprint
  for (const itemId of itemIds) {
    batch.update(db.collection('tracker_items').doc(itemId), { sprint_id: sprintRef.id })
  }

  await batch.commit()

  console.log(`\nDone!`)
  console.log(`Sprint: ${SPRINT.name} (${sprintRef.id})`)
  console.log(`Items: ${itemIds.length} tracker items created`)
  console.log(`Range: ${itemIds[0]} — ${itemIds[itemIds.length - 1]}`)
  console.log(`Discovery: ${DISCOVERY_URL}`)
  console.log(`\nAll items set to "in_sprint" (Discovery phase)`)
}

seed().catch(console.error)
