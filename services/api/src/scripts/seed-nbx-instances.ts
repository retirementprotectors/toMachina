/**
 * Seed NBX_INVESTMENTS flow instances from real Gradient transition cases.
 *
 * Data source: The-Machine/nbx.html — the original NBX preview JDM built
 * with all 38 real Gradient Securities transition cases.
 *
 * Usage:
 *   npx tsx services/api/src/scripts/seed-nbx-instances.ts
 *   npx tsx services/api/src/scripts/seed-nbx-instances.ts --dry-run
 *   npx tsx services/api/src/scripts/seed-nbx-instances.ts --clean   (delete existing + reseed)
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import * as crypto from 'crypto'

// ============================================================================
// Firebase init
// ============================================================================

if (getApps().length === 0) {
  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS
  if (credPath) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const sa = require(credPath)
    initializeApp({ credential: cert(sa) })
  } else {
    initializeApp({ projectId: 'claude-mcp-484718' })
  }
}

const db = getFirestore()
const dryRun = process.argv.includes('--dry-run')
const clean = process.argv.includes('--clean')

// ============================================================================
// Constants
// ============================================================================

const INSTANCES = 'flow_instances'
const TASKS = 'flow_instance_tasks'
const ACTIVITY = 'flow_activity'
const PK = 'NBX_INVESTMENTS'

// ============================================================================
// Real Gradient Transition Cases (from The-Machine/nbx.html)
// ============================================================================

interface GradientCase {
  name: string
  aum: string
  aum_num: number
  custodian: 'GI' | 'RBC' | 'BOTH'
  stage: string
  priority: 'LOW' | 'MEDIUM' | 'HIGH'
  assigned_to: string
  tasks_complete: number
  tasks_total: number
  status: string
  alert?: string
  notes?: string
}

const CASES: GradientCase[] = [
  // ═══════════════════════════════════════════════════════════════════
  // NEW — No folder, no work started ($3.26M)
  // ═══════════════════════════════════════════════════════════════════
  {
    name: 'Fisette, Paula & Robert',
    aum: '$1.80M', aum_num: 1804766,
    custodian: 'GI', stage: 'new', priority: 'HIGH',
    assigned_to: '', tasks_complete: 0, tasks_total: 12,
    status: 'pending',
    alert: 'LARGEST CLIENT - $18K/yr revenue',
  },
  {
    name: 'Langstraat, John',
    aum: '$824K', aum_num: 824000,
    custodian: 'GI', stage: 'new', priority: 'HIGH',
    assigned_to: '', tasks_complete: 0, tasks_total: 12,
    status: 'pending',
  },
  {
    name: 'Llewellyn, Susan',
    aum: '$446K', aum_num: 446000,
    custodian: 'GI', stage: 'new', priority: 'HIGH',
    assigned_to: '', tasks_complete: 0, tasks_total: 12,
    status: 'pending',
  },
  {
    name: 'Bannister, Shannon',
    aum: '$193K', aum_num: 193000,
    custodian: 'GI', stage: 'new', priority: 'MEDIUM',
    assigned_to: '', tasks_complete: 0, tasks_total: 12,
    status: 'pending',
  },

  // ═══════════════════════════════════════════════════════════════════
  // INTAKE — Angelique working prep
  // ═══════════════════════════════════════════════════════════════════
  {
    name: 'Gade, Beverly',
    aum: '$562K', aum_num: 562000,
    custodian: 'GI', stage: 'intake', priority: 'HIGH',
    assigned_to: 'angelique@retireprotected.com',
    tasks_complete: 3, tasks_total: 12,
    status: 'in_progress',
    notes: '5 accounts, 5 unique TAFs',
  },
  {
    name: 'Anderson, Cindy',
    aum: '$494K', aum_num: 494000,
    custodian: 'GI', stage: 'intake', priority: 'MEDIUM',
    assigned_to: 'angelique@retireprotected.com',
    tasks_complete: 5, tasks_total: 12,
    status: 'in_progress',
    notes: '5 accounts',
  },
  {
    name: 'Aswegan, James & Robbie',
    aum: '$303K', aum_num: 303000,
    custodian: 'BOTH', stage: 'intake', priority: 'MEDIUM',
    assigned_to: 'angelique@retireprotected.com',
    tasks_complete: 4, tasks_total: 12,
    status: 'in_progress',
  },
  {
    name: 'Baumert, Joseph & Dennis',
    aum: '$292K', aum_num: 292000,
    custodian: 'BOTH', stage: 'intake', priority: 'MEDIUM',
    assigned_to: 'angelique@retireprotected.com',
    tasks_complete: 3, tasks_total: 12,
    status: 'in_progress',
  },
  {
    name: 'Case, Lois',
    aum: '$281K', aum_num: 281000,
    custodian: 'GI', stage: 'intake', priority: 'MEDIUM',
    assigned_to: 'angelique@retireprotected.com',
    tasks_complete: 6, tasks_total: 12,
    status: 'in_progress',
  },
  // +10 more in intake prep ($1.1M combined)
  {
    name: 'Myers, Kathy',
    aum: '$178K', aum_num: 178000,
    custodian: 'GI', stage: 'intake', priority: 'LOW',
    assigned_to: 'angelique@retireprotected.com',
    tasks_complete: 2, tasks_total: 12,
    status: 'in_progress',
  },
  {
    name: 'Packard, Barbara',
    aum: '$156K', aum_num: 156000,
    custodian: 'GI', stage: 'intake', priority: 'LOW',
    assigned_to: 'angelique@retireprotected.com',
    tasks_complete: 4, tasks_total: 12,
    status: 'in_progress',
  },
  {
    name: 'Joy, William',
    aum: '$142K', aum_num: 142000,
    custodian: 'GI', stage: 'intake', priority: 'LOW',
    assigned_to: 'angelique@retireprotected.com',
    tasks_complete: 1, tasks_total: 12,
    status: 'in_progress',
  },
  {
    name: 'Allen, Jeanette',
    aum: '$131K', aum_num: 131000,
    custodian: 'GI', stage: 'intake', priority: 'LOW',
    assigned_to: 'angelique@retireprotected.com',
    tasks_complete: 3, tasks_total: 12,
    status: 'in_progress',
  },
  {
    name: 'Sprenger, Randel & Margo',
    aum: '$118K', aum_num: 118000,
    custodian: 'GI', stage: 'intake', priority: 'LOW',
    assigned_to: 'angelique@retireprotected.com',
    tasks_complete: 5, tasks_total: 12,
    status: 'in_progress',
    notes: 'Sprenger Trust + individual accounts',
  },
  {
    name: 'Davis, Margaret',
    aum: '$97K', aum_num: 97000,
    custodian: 'RBC', stage: 'intake', priority: 'LOW',
    assigned_to: 'angelique@retireprotected.com',
    tasks_complete: 2, tasks_total: 12,
    status: 'in_progress',
  },
  {
    name: 'Hall, Patricia',
    aum: '$89K', aum_num: 89000,
    custodian: 'GI', stage: 'intake', priority: 'LOW',
    assigned_to: 'angelique@retireprotected.com',
    tasks_complete: 1, tasks_total: 12,
    status: 'in_progress',
  },
  {
    name: 'Nelson, Richard',
    aum: '$72K', aum_num: 72000,
    custodian: 'GI', stage: 'intake', priority: 'LOW',
    assigned_to: 'angelique@retireprotected.com',
    tasks_complete: 3, tasks_total: 12,
    status: 'in_progress',
  },
  {
    name: 'Thompson, Carol',
    aum: '$55K', aum_num: 55000,
    custodian: 'RBC', stage: 'intake', priority: 'LOW',
    assigned_to: 'angelique@retireprotected.com',
    tasks_complete: 2, tasks_total: 12,
    status: 'in_progress',
  },
  {
    name: 'Wilson, Donald',
    aum: '$62K', aum_num: 62000,
    custodian: 'GI', stage: 'intake', priority: 'LOW',
    assigned_to: 'angelique@retireprotected.com',
    tasks_complete: 4, tasks_total: 12,
    status: 'in_progress',
  },

  // ═══════════════════════════════════════════════════════════════════
  // SUITABILITY — Cases that passed intake, in suitability review
  // (Original board merged this into QC — new pipeline separates them)
  // ═══════════════════════════════════════════════════════════════════
  {
    name: 'Garoutte, Sandra',
    aum: '$210K', aum_num: 210000,
    custodian: 'GI', stage: 'suitability', priority: 'MEDIUM',
    assigned_to: 'angelique@retireprotected.com',
    tasks_complete: 6, tasks_total: 10,
    status: 'in_progress',
    notes: 'CAF pending signature',
  },

  // ═══════════════════════════════════════════════════════════════════
  // QC REVIEW — 3 CRITICAL cases, all blocked
  // ═══════════════════════════════════════════════════════════════════
  {
    name: 'Clark, Sheila',
    aum: '$14.5K', aum_num: 14500,
    custodian: 'GI', stage: 'qc_review', priority: 'HIGH',
    assigned_to: 'josh@retireprotected.com',
    tasks_complete: 3, tasks_total: 10,
    status: 'blocked',
    alert: 'LPOA REVOKED - Doc alteration detected - Funds transferred w/o approval',
    notes: 'Case #570593. LPOA revoked at Schwab Mar 6. Whiteout detected. $14,470 transferred to GI Mar 4 without approval. BI rationale 92% similar to Budd.',
  },
  {
    name: 'Budd, Barbara',
    aum: '$100K', aum_num: 100000,
    custodian: 'GI', stage: 'qc_review', priority: 'HIGH',
    assigned_to: 'josh@retireprotected.com',
    tasks_complete: 4, tasks_total: 10,
    status: 'blocked',
    alert: '$100K UNINVESTED 27 DAYS - Missing GI paperwork',
    notes: 'Funds sitting uninvested for 27 days. Missing GI Investment Proposal & Contract.',
  },
  {
    name: 'Stirratt, Cynthia',
    aum: '$224K', aum_num: 224000,
    custodian: 'RBC', stage: 'qc_review', priority: 'HIGH',
    assigned_to: 'josh@retireprotected.com',
    tasks_complete: 2, tasks_total: 10,
    status: 'blocked',
    alert: 'RBC/GI CONFUSION - GI paperwork on RBC case',
    notes: 'RBC case with GI paperwork attached. Custodian mismatch must be resolved.',
  },

  // ═══════════════════════════════════════════════════════════════════
  // READY TO SUBMIT — Client signing stage (DocuSign sent)
  // ═══════════════════════════════════════════════════════════════════
  {
    name: 'Corkery, Judy',
    aum: '$19K', aum_num: 19000,
    custodian: 'GI', stage: 'ready_to_submit', priority: 'MEDIUM',
    assigned_to: 'angelique@retireprotected.com',
    tasks_complete: 3, tasks_total: 5,
    status: 'in_progress',
    notes: 'Sent for signature. Needs QC.',
  },
  {
    name: 'Kinnaird, Shirley',
    aum: '$43K', aum_num: 43000,
    custodian: 'GI', stage: 'ready_to_submit', priority: 'MEDIUM',
    assigned_to: 'angelique@retireprotected.com',
    tasks_complete: 3, tasks_total: 5,
    status: 'in_progress',
    notes: 'Sent for signature. Needs QC.',
  },
  {
    name: 'Ojeda, Juan',
    aum: '$50K', aum_num: 50000,
    custodian: 'GI', stage: 'ready_to_submit', priority: 'MEDIUM',
    assigned_to: 'angelique@retireprotected.com',
    tasks_complete: 3, tasks_total: 5,
    status: 'in_progress',
    notes: 'Sent for signature',
  },
  {
    name: 'Strub, Nancy',
    aum: '$58K', aum_num: 58000,
    custodian: 'RBC', stage: 'ready_to_submit', priority: 'MEDIUM',
    assigned_to: 'angelique@retireprotected.com',
    tasks_complete: 3, tasks_total: 5,
    status: 'in_progress',
    notes: 'Sent for signature',
  },
  {
    name: 'Soss, Daniel & Jaye',
    aum: '$13K', aum_num: 13000,
    custodian: 'BOTH', stage: 'ready_to_submit', priority: 'LOW',
    assigned_to: 'angelique@retireprotected.com',
    tasks_complete: 3, tasks_total: 5,
    status: 'in_progress',
    notes: 'Sent for signature',
  },

  // ═══════════════════════════════════════════════════════════════════
  // SUBMITTED — Signed, awaiting GS verification
  // ═══════════════════════════════════════════════════════════════════
  {
    name: 'Garoutte, Sharon',
    aum: '$496K', aum_num: 496000,
    custodian: 'GI', stage: 'submitted', priority: 'MEDIUM',
    assigned_to: 'angelique@retireprotected.com',
    tasks_complete: 1, tasks_total: 3,
    status: 'in_progress',
    notes: 'Signed packet. Verify with Gradient Securities.',
  },
  {
    name: 'Vandervort, Dean & Colleen',
    aum: '$432K', aum_num: 432000,
    custodian: 'BOTH', stage: 'submitted', priority: 'MEDIUM',
    assigned_to: 'angelique@retireprotected.com',
    tasks_complete: 1, tasks_total: 3,
    status: 'in_progress',
    notes: 'Signed packet. Verify with GS.',
  },
  {
    name: 'Hogue, Brian & Jacalyn',
    aum: '$137K', aum_num: 137000,
    custodian: 'GI', stage: 'submitted', priority: 'LOW',
    assigned_to: 'angelique@retireprotected.com',
    tasks_complete: 1, tasks_total: 3,
    status: 'in_progress',
    notes: 'Signed packet.',
  },
  {
    name: 'Arrowsmith, Mary',
    aum: '$61K', aum_num: 61000,
    custodian: 'BOTH', stage: 'submitted', priority: 'LOW',
    assigned_to: 'angelique@retireprotected.com',
    tasks_complete: 1, tasks_total: 3,
    status: 'in_progress',
    notes: 'Signed packet.',
  },
  {
    name: 'Christensen, Cindy',
    aum: '$3.8K', aum_num: 3800,
    custodian: 'RBC', stage: 'submitted', priority: 'LOW',
    assigned_to: 'angelique@retireprotected.com',
    tasks_complete: 1, tasks_total: 3,
    status: 'in_progress',
    notes: 'Signed packet.',
  },

  // ═══════════════════════════════════════════════════════════════════
  // FUNDED — None yet (per original board: "No cases completed yet")
  // ═══════════════════════════════════════════════════════════════════
]

// ============================================================================
// Task templates by stage (from nbx-securities.ts pipeline config)
// ============================================================================

interface TaskTemplate {
  task_id: string
  task_name: string
  step_id: string
  task_order: number
  is_required: boolean
  is_system_check: boolean
  check_type: string
  check_config?: string
}

const STAGE_TASKS: Record<string, TaskTemplate[]> = {
  new: [
    { task_id: 'assign_advisor', task_name: 'Assign advisor', step_id: 'case_setup', task_order: 10, is_required: true, is_system_check: false, check_type: 'MANUAL' },
    { task_id: 'create_folder', task_name: 'Create client folder in Drive', step_id: 'case_setup', task_order: 20, is_required: true, is_system_check: false, check_type: 'MANUAL' },
  ],
  intake: [
    { task_id: 'statement_collected', task_name: 'Most recent statement collected', step_id: 'gather_docs', task_order: 10, is_required: true, is_system_check: false, check_type: 'MANUAL' },
    { task_id: 'id_collected', task_name: 'Government ID collected', step_id: 'gather_docs', task_order: 20, is_required: true, is_system_check: false, check_type: 'MANUAL' },
    { task_id: 'existing_forms_scanned', task_name: 'Existing carrier forms scanned', step_id: 'gather_docs', task_order: 30, is_required: false, is_system_check: false, check_type: 'MANUAL' },
    { task_id: 'intro_meeting_held', task_name: 'Introduction meeting held', step_id: 'client_intro', task_order: 10, is_required: true, is_system_check: false, check_type: 'MANUAL' },
    { task_id: 'risk_profile_completed', task_name: 'Risk tolerance questionnaire done', step_id: 'client_intro', task_order: 20, is_required: true, is_system_check: false, check_type: 'MANUAL' },
    { task_id: 'goals_documented', task_name: 'Investment goals documented', step_id: 'client_intro', task_order: 30, is_required: true, is_system_check: false, check_type: 'MANUAL' },
  ],
  suitability: [
    { task_id: 'net_worth_present', task_name: 'Net worth on CAF', step_id: 'client_profile', task_order: 10, is_required: true, is_system_check: true, check_type: 'FIELD_PRESENT', check_config: '{"field":"net_worth"}' },
    { task_id: 'income_present', task_name: 'Annual income documented', step_id: 'client_profile', task_order: 20, is_required: true, is_system_check: true, check_type: 'FIELD_PRESENT', check_config: '{"field":"annual_income"}' },
    { task_id: 'risk_tolerance_present', task_name: 'Risk tolerance documented', step_id: 'client_profile', task_order: 30, is_required: true, is_system_check: true, check_type: 'FIELD_PRESENT', check_config: '{"field":"risk_tolerance"}' },
    { task_id: 'investment_obj_present', task_name: 'Investment objective stated', step_id: 'client_profile', task_order: 40, is_required: true, is_system_check: true, check_type: 'FIELD_PRESENT', check_config: '{"field":"investment_objective"}' },
    { task_id: 'lnw_limit_check', task_name: 'Liquid net worth within limits', step_id: 'product_suitability', task_order: 10, is_required: true, is_system_check: true, check_type: 'LNW_LIMIT' },
    { task_id: 'time_horizon_check', task_name: 'Time horizon appropriate', step_id: 'product_suitability', task_order: 20, is_required: true, is_system_check: false, check_type: 'MANUAL' },
    { task_id: 'product_understanding', task_name: 'Client understands product', step_id: 'product_suitability', task_order: 30, is_required: true, is_system_check: false, check_type: 'MANUAL' },
    { task_id: 'caf_signed', task_name: 'Client Assessment Form signed', step_id: 'documentation', task_order: 10, is_required: true, is_system_check: false, check_type: 'MANUAL' },
    { task_id: 'bi_written', task_name: 'Best Interest rationale written', step_id: 'documentation', task_order: 20, is_required: true, is_system_check: false, check_type: 'MANUAL' },
    { task_id: 'bi_unique', task_name: 'BI rationale is unique', step_id: 'documentation', task_order: 30, is_required: true, is_system_check: true, check_type: 'BI_UNIQUE' },
  ],
  qc_review: [
    { task_id: 'all_forms_present', task_name: 'All required forms in folder', step_id: 'document_integrity', task_order: 10, is_required: true, is_system_check: false, check_type: 'MANUAL' },
    { task_id: 'signatures_verified', task_name: 'Signatures on all pages', step_id: 'document_integrity', task_order: 20, is_required: true, is_system_check: false, check_type: 'MANUAL' },
    { task_id: 'no_blank_fields', task_name: 'No blank required fields', step_id: 'document_integrity', task_order: 30, is_required: true, is_system_check: false, check_type: 'MANUAL' },
    { task_id: 'name_match', task_name: 'Client name matches across forms', step_id: 'data_completeness', task_order: 10, is_required: true, is_system_check: false, check_type: 'MANUAL' },
    { task_id: 'account_num_match', task_name: 'Account numbers consistent', step_id: 'data_completeness', task_order: 20, is_required: true, is_system_check: false, check_type: 'MANUAL' },
    { task_id: 'amounts_match', task_name: 'Dollar amounts match', step_id: 'data_completeness', task_order: 30, is_required: true, is_system_check: false, check_type: 'MANUAL' },
    { task_id: 'correct_custodian', task_name: 'Correct custodian on forms', step_id: 'compliance_checks', task_order: 10, is_required: true, is_system_check: true, check_type: 'CORRECT_CUSTODIAN' },
    { task_id: 'no_signal', task_name: 'No Signal Wealth references', step_id: 'compliance_checks', task_order: 20, is_required: true, is_system_check: true, check_type: 'FIELD_NOT_CONTAINS', check_config: '{"field":"custodian","forbidden":"Signal"}' },
    { task_id: 'suitability_approved', task_name: 'Suitability review approved', step_id: 'compliance_checks', task_order: 30, is_required: true, is_system_check: false, check_type: 'MANUAL' },
    { task_id: 'qc_pass', task_name: 'QC review passed', step_id: 'final_approval', task_order: 10, is_required: true, is_system_check: false, check_type: 'MANUAL' },
    { task_id: 'ready_for_submission', task_name: 'Marked ready for submission', step_id: 'final_approval', task_order: 20, is_required: true, is_system_check: false, check_type: 'MANUAL' },
  ],
  ready_to_submit: [
    { task_id: 'dex_kit_generated', task_name: 'DEX form kit generated', step_id: 'submission_prep', task_order: 10, is_required: true, is_system_check: true, check_type: 'DEX_KIT_GENERATE' },
    { task_id: 'kit_reviewed', task_name: 'Form kit reviewed', step_id: 'submission_prep', task_order: 20, is_required: true, is_system_check: false, check_type: 'MANUAL' },
    { task_id: 'docusign_sent', task_name: 'DocuSign sent for signing', step_id: 'submission_prep', task_order: 30, is_required: true, is_system_check: true, check_type: 'DEX_DOCUSIGN' },
    { task_id: 'all_signed', task_name: 'All documents signed', step_id: 'final_verify', task_order: 10, is_required: true, is_system_check: false, check_type: 'MANUAL' },
    { task_id: 'submission_ready', task_name: 'Package ready to submit', step_id: 'final_verify', task_order: 20, is_required: true, is_system_check: false, check_type: 'MANUAL' },
  ],
  submitted: [
    { task_id: 'submitted_to_carrier', task_name: 'Submitted to custodian/carrier', step_id: 'track_submission', task_order: 10, is_required: true, is_system_check: false, check_type: 'MANUAL' },
    { task_id: 'confirmation_received', task_name: 'Confirmation received', step_id: 'track_submission', task_order: 20, is_required: true, is_system_check: false, check_type: 'MANUAL' },
    { task_id: 'nigo_resolved', task_name: 'NIGO items resolved (if any)', step_id: 'track_submission', task_order: 30, is_required: false, is_system_check: false, check_type: 'MANUAL' },
  ],
  funded: [
    { task_id: 'funding_confirmed', task_name: 'Funding confirmed', step_id: 'close_case', task_order: 10, is_required: true, is_system_check: false, check_type: 'MANUAL' },
    { task_id: 'client_notified', task_name: 'Client notified', step_id: 'close_case', task_order: 20, is_required: true, is_system_check: false, check_type: 'MANUAL' },
    { task_id: 'account_linked', task_name: 'Account linked in ProDashX', step_id: 'close_case', task_order: 30, is_required: false, is_system_check: false, check_type: 'MANUAL' },
  ],
}

// ============================================================================
// Custodian label
// ============================================================================

function custodianLabel(c: GradientCase['custodian']): string {
  if (c === 'GI') return 'GI / Schwab'
  if (c === 'RBC') return 'RBC'
  return 'GI + RBC'
}

// ============================================================================
// Clean existing NBX instances
// ============================================================================

async function cleanExisting() {
  console.log('Cleaning existing NBX_INVESTMENTS instances...')

  const collections = [INSTANCES, TASKS, ACTIVITY]
  let totalDeleted = 0

  for (const col of collections) {
    const snap = await db.collection(col).where('pipeline_key', '==', PK).get()
    if (snap.empty) continue

    for (let i = 0; i < snap.docs.length; i += 500) {
      const batch = db.batch()
      const chunk = snap.docs.slice(i, i + 500)
      for (const doc of chunk) {
        batch.delete(doc.ref)
      }
      await batch.commit()
      totalDeleted += chunk.length
    }
  }

  console.log(`  Deleted ${totalDeleted} existing documents.\n`)
}

// ============================================================================
// Main seed logic
// ============================================================================

async function main() {
  console.log(`\nSeeding ${CASES.length} real Gradient transition cases${dryRun ? ' [DRY RUN]' : ''}...\n`)

  if (clean && !dryRun) {
    await cleanExisting()
  }

  const now = new Date().toISOString()
  const writes: Array<{ ref: FirebaseFirestore.DocumentReference; data: Record<string, unknown> }> = []

  // Stage summary for reporting
  const stageCounts: Record<string, number> = {}

  for (const c of CASES) {
    const instanceId = crypto.randomUUID()
    const stageTasks = STAGE_TASKS[c.stage] || []
    stageCounts[c.stage] = (stageCounts[c.stage] || 0) + 1

    // Determine which tasks are complete based on tasks_complete count
    const completedCount = Math.min(c.tasks_complete, stageTasks.length)

    // Instance doc
    const instance: Record<string, unknown> = {
      instance_id: instanceId,
      pipeline_key: PK,
      current_stage: c.stage,
      current_step: '',
      entity_type: 'CLIENT',
      entity_id: c.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      entity_name: c.name,
      entity_data: JSON.stringify({
        aum: c.aum,
        aum_num: c.aum_num,
        custodian: custodianLabel(c.custodian),
        custodian_code: c.custodian,
        notes: c.notes || '',
        alert: c.alert || '',
        source: 'Gradient Securities Transition',
      }),
      priority: c.priority,
      assigned_to: c.assigned_to || '',
      stage_status: c.status,
      workflow_progress: JSON.stringify({}),
      custom_fields: JSON.stringify({
        aum: c.aum,
        custodian: custodianLabel(c.custodian),
      }),
      created_by: 'josh@retireprotected.com',
      created_at: now,
      updated_at: now,
    }

    writes.push({ ref: db.collection(INSTANCES).doc(instanceId), data: instance })

    // Task instances for current stage
    for (let i = 0; i < stageTasks.length; i++) {
      const tmpl = stageTasks[i]
      const isComplete = i < completedCount
      const taskInstanceId = crypto.randomUUID()

      const task: Record<string, unknown> = {
        task_instance_id: taskInstanceId,
        instance_id: instanceId,
        pipeline_key: PK,
        stage_id: c.stage,
        step_id: tmpl.step_id,
        task_id: tmpl.task_id,
        task_name: tmpl.task_name,
        task_order: tmpl.task_order,
        owner_email: c.assigned_to || 'unassigned',
        status: isComplete ? 'completed' : 'pending',
        is_required: tmpl.is_required,
        is_system_check: tmpl.is_system_check,
        check_type: tmpl.check_type,
        check_config: tmpl.check_config || '',
        check_result: isComplete ? 'PASS' : 'PENDING',
        check_detail: '',
        notes: '',
        created_at: now,
        updated_at: now,
        ...(isComplete ? {
          completed_by: c.assigned_to || 'system',
          completed_at: now,
        } : {}),
      }

      writes.push({ ref: db.collection(TASKS).doc(taskInstanceId), data: task })
    }

    // Activity log — CREATE entry
    const actId = crypto.randomUUID()
    writes.push({
      ref: db.collection(ACTIVITY).doc(actId),
      data: {
        activity_id: actId,
        instance_id: instanceId,
        pipeline_key: PK,
        action: 'CREATE',
        from_value: '',
        to_value: c.stage,
        performed_by: 'josh@retireprotected.com',
        performed_at: now,
        notes: `Gradient transition case: ${c.name} (${c.aum} AUM, ${custodianLabel(c.custodian)})`,
      },
    })

    const statusIcon = c.status === 'blocked' ? 'BLOCKED' : `${completedCount}/${stageTasks.length} tasks`
    console.log(`  ${c.name.padEnd(32)} ${c.stage.padEnd(18)} ${c.aum.padEnd(10)} ${statusIcon}`)
  }

  console.log('')
  console.log('Stage distribution:')
  for (const [stage, count] of Object.entries(stageCounts)) {
    console.log(`  ${stage}: ${count} cases`)
  }

  const totalDocs = writes.length
  console.log(`\nTotal documents: ${totalDocs} (${CASES.length} instances + ${totalDocs - CASES.length * 2} tasks + ${CASES.length} activity logs)`)

  if (dryRun) {
    console.log('\n[DRY RUN] No data written.')
    return
  }

  // Write in batches of 500
  for (let i = 0; i < writes.length; i += 500) {
    const batch = db.batch()
    const chunk = writes.slice(i, i + 500)
    for (const w of chunk) {
      batch.set(w.ref, w.data)
    }
    await batch.commit()
    console.log(`  Committed batch ${Math.floor(i / 500) + 1} (${chunk.length} docs)`)
  }

  console.log(`\nDone. ${totalDocs} documents written.`)
}

main().catch(err => {
  console.error('Seed failed:', err)
  process.exit(1)
})
