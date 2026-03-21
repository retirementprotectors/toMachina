import { initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

if (getApps().length === 0) {
  initializeApp({ projectId: 'claude-mcp-484718' })
}
const db = getFirestore()

const SPRINT = {
  name: 'ACF 2.0 — Document Intelligence',
  description: 'Restructure Active Client Files from a dumping ground into a document intelligence system. Cleanup 1,085 template shells, audit 120 real data folders, restructure to 5 workflow-based subfolders (NewBiz, Reactive, Cases, Account, Client), de-dupe 33+ duplicate pairs, wire documents into ProDash UI, and update all 59 routing rules.',
  plan_link: '/plans/acf-2.0-discovery.html',
}

const ITEMS = [
  // --- Phase 1: Cleanup ---
  {
    title: 'P1 — Trash verified template-only shell folders',
    description: 'Trash ~1,085 verified template-only shell folders (81% of all ACFs). These contain only default template subfolders (*Accounts, *Opportunities, Ai3 TEMPLATE) with zero real client data. 30-day recovery window from Google Drive Trash. Must verify each folder has no real documents before trashing.',
    portal: 'SHARED',
    scope: 'Data',
    component: 'ACF',
    type: 'improve',
  },
  {
    title: 'P1 — Clean up "ACF - undefined" and automation error folders',
    description: 'Remove 5 "ACF - undefined" folders created by watcher automation errors. Clean up any test/typo folders found during the audit. Fix root cause in watcher to prevent future undefined folder creation.',
    portal: 'SHARED',
    scope: 'Data',
    component: 'ACF',
    type: 'improve',
  },
  {
    title: 'P1 — Relocate 16 loose root-level files',
    description: 'Move 16 orphaned PDFs sitting at the root level of Active Client Files into their correct client ACF folders. Match by filename patterns (policy number, client name) to identify correct destination.',
    portal: 'SHARED',
    scope: 'Data',
    component: 'ACF',
    type: 'improve',
  },

  // --- Phase 2: Audit Real Data ---
  {
    title: 'P2 — Catalog document types across ~120 populated folders',
    description: 'Scan all ~120 folders containing real client data. Inventory every document by type, naming pattern, and subfolder location. Build a reality map of what people actually filed and where they put it.',
    portal: 'SHARED',
    scope: 'Data',
    component: 'ACF',
    type: 'idea',
  },
  {
    title: 'P2 — Catalog ~98 old-format folders (xACF-, zACF-, ACFx-, AFC-)',
    description: 'Audit all legacy-format folders with significant client data from the manual system. Determine which contain unique data not in any standard ACF folder. Flag for migration into standard ACF - First Last format.',
    portal: 'SHARED',
    scope: 'Data',
    component: 'ACF',
    type: 'idea',
  },
  {
    title: 'P2 — Validate proposed subfolder structure against real data',
    description: 'Using the document inventory from the audit, validate that the proposed 5-folder structure (NewBiz, Reactive, Cases, Account, Client) covers all real document types found. Identify any gaps where documents do not fit cleanly into the proposed structure.',
    portal: 'SHARED',
    scope: 'Data',
    component: 'ACF',
    type: 'idea',
  },

  // --- Phase 3: Restructure ---
  {
    title: 'P3 — Update ACF Config with new 5-folder structure',
    description: 'Update Firestore acf_config to use new subfolder definitions: NewBiz (sales pipeline), Reactive (service team), Cases (case management), Account (account detail UI), Client (client detail UI). Replace old Source Documents / Analysis / Proposals / Signed Documents / Correspondence structure.',
    portal: 'SHARED',
    scope: 'App',
    component: 'ACF',
    type: 'improve',
  },
  {
    title: 'P3 — Re-map _DOCUMENT_TAXONOMY acf_subfolder column',
    description: 'Update all 59 document types in _DOCUMENT_TAXONOMY on RAPID_MATRIX to point to the new 5-folder structure. Currently 28 of 59 types (47%) route to Source Documents. Each type must be explicitly mapped to NewBiz, Reactive, Cases, Account, or Client based on business workflow.',
    portal: 'SHARED',
    scope: 'Data',
    component: 'ACF',
    type: 'improve',
  },
  {
    title: 'P3 — Create new subfolders in existing ACFs',
    description: 'For all ~120 real-data ACF folders + ~98 old-format folders being kept: create the 5 new subfolders (NewBiz, Reactive, Cases, Account, Client). Automated batch via Drive API. Service account already has Editor access to all folders.',
    portal: 'SHARED',
    scope: 'Data',
    component: 'ACF',
    type: 'improve',
  },
  {
    title: 'P3 — Categorize and move existing documents into correct subfolders',
    description: 'Using the document taxonomy mapping, move existing documents from old subfolders into the correct new subfolders. Batch operation using Drive API. Log all moves for audit trail. Handle edge cases where document type cannot be determined.',
    portal: 'SHARED',
    scope: 'Data',
    component: 'ACF',
    type: 'improve',
  },
  {
    title: 'P3 — Rename folders to standard ACF - First Last format',
    description: 'Standardize all ACF folder names to "ACF - First Last" format. Fix old-format names (xACF-, zACF-, ACFx-, AFC-), misspellings, and inconsistencies. Update acf_folder_id references in Firestore client docs if folder IDs change.',
    portal: 'SHARED',
    scope: 'Data',
    component: 'ACF',
    type: 'improve',
  },

  // --- Phase 4: De-dupe + Consolidate ---
  {
    title: 'P4 — Merge 33+ duplicate folder pairs',
    description: 'Identify and merge duplicate ACF folders. Includes exact name dupes, cross-format dupes (ACF- vs xACF- for same client), and misspelling dupes. Pick winner with more data, move documents from loser to winner, trash the empty loser. Update Firestore references.',
    portal: 'SHARED',
    scope: 'Data',
    component: 'ACF',
    type: 'improve',
  },
  {
    title: 'P4 — De-dupe documents within folders',
    description: 'Scan within each ACF folder for duplicate documents (same content, different names or same name in different subfolders). Use file hash comparison where possible. Flag for review rather than auto-delete.',
    portal: 'SHARED',
    scope: 'Data',
    component: 'ACF',
    type: 'improve',
  },
  {
    title: 'P4 — Fix Joe + Laura Dickson Ai3 misfiles',
    description: 'Remove the Joe + Laura Dickson Ai3 template that was incorrectly copied into 6+ unrelated client folders. Verify correct Ai3 exists in their own ACF folder. Root cause: likely a bug in the Ai3 copy automation.',
    portal: 'SHARED',
    scope: 'Data',
    component: 'ACF',
    type: 'improve',
  },

  // --- Phase 5: ProDash UI Document Linking ---
  {
    title: 'P5 — Build document linking config',
    description: 'Create configuration rules that map document types to ProDash UI locations. Define which docs appear on Client Detail, Account Detail, and Case Detail pages. Product-type-aware rules: Medicare clients show Medicare card, retirement clients show different docs.',
    portal: 'SHARED',
    scope: 'App',
    component: 'ACF',
    type: 'idea',
  },
  {
    title: 'P5 — Proactive pull (scheduled scan)',
    description: 'Scheduled Cloud Run job that scans ACF subfolders for linkable documents. Indexes document metadata (type, date, subfolder, Drive file ID) into Firestore for fast retrieval by the UI. Runs on a configurable schedule.',
    portal: 'SHARED',
    scope: 'App',
    component: 'ACF',
    type: 'idea',
  },
  {
    title: 'P5 — Reactive pull (on new document arrival)',
    description: 'When Watcher routes a new document to an ACF subfolder, immediately update the document index in Firestore. Trigger ProDash UI refresh if the user is viewing the relevant client/account. Near-real-time document availability.',
    portal: 'SHARED',
    scope: 'App',
    component: 'ACF',
    type: 'idea',
  },
  {
    title: 'P5 — Client detail page document widgets',
    description: 'ProDash Client Detail page shows: DL photo (latest from Client subfolder), Medicare card (for Medicare clients), voided check (for payment setup), Ai3 (most recent quarterly). Each widget pulls from the document index. Click to view/download from Drive.',
    portal: 'SHARED',
    scope: 'App',
    component: 'ACF',
    type: 'idea',
  },
  {
    title: 'P5 — Account detail page document widgets',
    description: 'ProDash Account Detail page shows: most recent statement (from Account subfolder), policy document/application (from NewBiz subfolder), product-type-specific docs (MAPD enrollment for Medicare, FIA illustration for annuity, etc.). Driven by document linking config.',
    portal: 'SHARED',
    scope: 'App',
    component: 'ACF',
    type: 'idea',
  },

  // --- Phase 6: Update Routing Rules ---
  {
    title: 'P6 — Seed ACF Config routing_rules from _DOCUMENT_TAXONOMY',
    description: 'Import all 59 document types from _DOCUMENT_TAXONOMY into the Firestore acf_config routing_rules. Each rule includes: document_type, file_label_template, target acf_subfolder (new 5-folder structure), pipeline, owner_role, priority.',
    portal: 'SHARED',
    scope: 'Data',
    component: 'ACF',
    type: 'improve',
  },
  {
    title: 'P6 — Update Watcher to use new subfolder targets',
    description: 'Update the document watcher service to route incoming documents to the new 5-folder ACF subfolders. Replace hardcoded Source Documents routing with taxonomy-driven routing. Test with all 59 document types.',
    portal: 'SHARED',
    scope: 'App',
    component: 'ACF',
    type: 'improve',
  },
  {
    title: 'P6 — File naming convention enforcement',
    description: 'Enforce standard file naming convention on all incoming documents: PolicyNum- LASTNAME Carrier DocType YYYY-MM-DD. Watcher renames files on arrival if they do not match the convention. Log original filename for audit trail.',
    portal: 'SHARED',
    scope: 'App',
    component: 'ACF',
    type: 'improve',
  },
]

async function seed() {
  console.log('Seeding ACF 2.0 sprint into FORGE...')

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
      status: 'queue',
      sprint_id: null, // will be updated after sprint creation
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
    plan_link: SPRINT.plan_link,
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
  console.log(`Plan: ${SPRINT.plan_link}`)
  console.log(`\nAll items set to "queue" status`)
}

seed().catch(console.error)
