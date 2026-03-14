/**
 * Seed historical Session Agent Workflow instances from session exports.
 *
 * Usage:
 *   npx tsx services/api/src/scripts/seed-session-instances.ts
 *   npx tsx services/api/src/scripts/seed-session-instances.ts --dry-run
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

// ============================================================================
// Constants
// ============================================================================

const INSTANCES = 'flow_instances'
const TASKS = 'flow_instance_tasks'
const ACTIVITY = 'flow_activity'
const PIPELINE_KEY = 'SESSION_AGENT_WORKFLOW'

const dryRun = process.argv.includes('--dry-run')

// ============================================================================
// Session data — extracted from session exports
// ============================================================================

interface LinkedArtifact {
  type: 'plan' | 'session_transcript' | 'builder_prompt' | 'audit_report'
  name: string
  path: string
}

interface SessionInstance {
  id: string
  name: string
  description: string
  sprint: string
  date: string
  finalStage: string
  status: 'complete'
  builders: Array<{
    name: string
    status: 'PASS' | 'FAIL' | 'FIXED'
    tasks: number
    commit?: string
    notes: string
  }>
  auditSummary: string
  deployResult: string
  sourceFile: string
  artifacts: LinkedArtifact[]
}

const sessions: SessionInstance[] = [
  // ── Session 1: Sprint 10 Post-Merge Audit ──────────────────────────
  {
    id: crypto.randomUUID(),
    name: 'Sprint 10 — Post-Merge Audit & Remediation',
    description: 'Audited all 5 Sprint 10 builders against SPRINT10_PLAN.md (1,192 lines). Found 2 gaps, remediated both, verified 13/13 type-check.',
    sprint: 'Sprint 10',
    date: '2026-03-14T02:38:32.000Z',
    finalStage: 'WALK_THROUGH',
    status: 'complete',
    builders: [
      { name: 'B1 Smart Search', status: 'PASS', tasks: 3, notes: 'CLEAN — 7 parallel Firestore queries, 300ms debounce, keyboard nav' },
      { name: 'B2 Access Center', status: 'FIXED', tasks: 12, notes: '9 PASS, 1 FAIL (AX-10 MasterCard), 2 UNCLEAR → both fixed' },
      { name: 'B3 Audit Trail', status: 'PASS', tasks: 5, notes: 'CLEAN — res.json override, fire-and-forget, PHI-safe' },
      { name: 'B4 AI3 Report', status: 'PASS', tasks: 4, notes: 'CLEAN — html2canvas + jsPDF, multi-page, 7 sections' },
      { name: 'B5 Sidebar + FAB', status: 'PASS', tasks: 3, notes: 'CLEAN — toggle, localStorage, 3 actions' },
    ],
    auditSummary: '27 tasks total. 24 PASS, 1 FAIL, 2 UNCLEAR. All remediated. Cross-builder checks ALL PASS.',
    deployResult: 'Pushed to main at adef70a. Firebase App Hosting auto-deploy.',
    sourceFile: '2026-03-14-023832-implement-the-following-plan.txt',
    artifacts: [
      { type: 'plan', name: 'SPRINT10_PLAN.md', path: '.claude/sprint10/SPRINT10_PLAN.md' },
      { type: 'session_transcript', name: 'Sprint 10 Audit Session', path: '2026-03-14-023832-implement-the-following-plan.txt' },
    ],
  },

  // ── Session 2: Sprint 11 Permissions Cascade ──────────────────────
  {
    id: crypto.randomUUID(),
    name: 'Sprint 11 — Permissions Cascade',
    description: '4 parallel builders on isolated worktrees. Full RBAC system: entitlements, middleware, admin panel, Firestore rules. 67 verification checks.',
    sprint: 'Sprint 11',
    date: '2026-03-14T02:42:07.000Z',
    finalStage: 'WALK_THROUGH',
    status: 'complete',
    builders: [
      { name: 'B1 Entitlements Loading', status: 'FIXED', tasks: 18, commit: 'fce8c37', notes: 'useEntitlements() hook, real-time Firestore profile, OWNER_EMAILS removed. 2 fixes: useMemo + levelMap fallback.' },
      { name: 'B2 RBAC Middleware', status: 'PASS', tasks: 12, commit: 'a3095bd', notes: 'requireLevel(), requireModuleAccess(), invalidateProfileCache()' },
      { name: 'B3 Admin Panel', status: 'PASS', tasks: 14, commit: '12dc65e', notes: 'Role template + unit + division dropdowns, live permissions preview' },
      { name: 'B4 Firestore Rules', status: 'PASS', tasks: 21, commit: '4a6cfe8', notes: '3-tier write rules (EXEC/LEADER/USER), 73/73 verification tests' },
    ],
    auditSummary: '67 checks. 65 PASS, 2 FAIL → both fixed (useMemo + levelMap). Cross-cutting: OWNER_EMAILS=0, no alert/confirm/prompt, modules.ts untouched.',
    deployResult: 'Pushed to main at 14867dc. Rebased over Sprint 10, resolved 2 merge conflicts. Firebase App Hosting auto-deploy.',
    sourceFile: '2026-03-14-024207-usersjoshdmillangdesktopsprint11planmd-let.txt',
    artifacts: [
      { type: 'plan', name: 'SPRINT11_PLAN.md', path: '.claude/sprint11/SPRINT11_PLAN.md' },
      { type: 'session_transcript', name: 'Sprint 11 Build Session', path: '2026-03-14-024207-usersjoshdmillangdesktopsprint11planmd-let.txt' },
    ],
  },

  // ── Session 3: Sprint 12 Data Ops Depth ──────────────────────────
  {
    id: crypto.randomUUID(),
    name: 'Sprint 12 — Data Ops Depth',
    description: '4 builders in 2 waves (B1+B2 parallel, then B3+B4). RAPID_IMPORT port to Cloud Run API. 13 audit gaps found and fixed.',
    sprint: 'Sprint 12',
    date: '2026-03-14T02:47:26.000Z',
    finalStage: 'WALK_THROUGH',
    status: 'complete',
    builders: [
      { name: 'B1 Phase 3b Import Pipeline', status: 'FIXED', tasks: 4, notes: 'Carrier formats, account type inference, 4 new import endpoints. Fixed: dry_run, category_breakdown, link_clients.' },
      { name: 'B2 Commission/Revenue Pipeline', status: 'FIXED', tasks: 3, notes: 'Signal parser, commission parser, 3 import endpoints, bulk revenue, intake. Fixed: writeThroughBridge, proper typing, ES imports.' },
      { name: 'B3 Client Backfill + Bridge', status: 'FIXED', tasks: 3, notes: 'Backfill endpoint, bridge verification script, URL swap docs. Fixed: subcollection paths.' },
      { name: 'B4 ATLAS Integration + Import Tracking', status: 'FIXED', tasks: 4, notes: 'ATLAS wired into all existing endpoints, import_run tracking. Fixed: tolerance_pct naming, per-record queries → pre-loaded map.' },
    ],
    auditSummary: '13 gaps found across all 4 builders. All 13 fixed. .gitignore lib/ was hiding new files (fixed to /lib/). Docker build fixed (added auth+db package.jsons).',
    deployResult: 'Pushed to main at fd2ad6d. Cloud Functions deployed (commission-intake + scheduled). Cloud Run API build fixed (Dockerfile). 13 files, 3,273 insertions.',
    sourceFile: '2026-03-14-024726-letsbuildit-usersjoshdmillangdesktopsprin.txt',
    artifacts: [
      { type: 'plan', name: 'SPRINT12_PLAN.md', path: '.claude/sprint12/SPRINT12_PLAN.md' },
      { type: 'session_transcript', name: 'Sprint 12 Build Session', path: '2026-03-14-024726-letsbuildit-usersjoshdmillangdesktopsprin.txt' },
    ],
  },
]

// ============================================================================
// Stage IDs (must match the seeded pipeline)
// ============================================================================

const STAGES = {
  SCOPE: 'SCOPE',
  DISCOVERY: 'DISCOVERY',
  PLANNING: 'PLANNING',
  BUILDING: 'BUILDING',
  AUDIT: 'AUDIT',
  WALK_THROUGH: 'WALK_THROUGH',
}

// ============================================================================
// Seed logic
// ============================================================================

async function seedInstances() {
  console.log(`Seeding ${sessions.length} session instances${dryRun ? ' (DRY RUN)' : ''}...\n`)

  const batch = db.batch()
  let docCount = 0
  const now = new Date().toISOString()

  for (const session of sessions) {
    console.log(`  ${session.name}`)

    // ── Instance doc ───────────────────────────────────────────────
    const instance = {
      instance_id: session.id,
      pipeline_key: PIPELINE_KEY,
      current_stage: session.finalStage,
      current_step: '',
      entity_type: 'SESSION',
      entity_id: session.sprint.toLowerCase().replace(/\s+/g, '-'),
      entity_name: session.name,
      entity_data: JSON.stringify({
        description: session.description,
        source_file: session.sourceFile,
        deploy_result: session.deployResult,
        artifacts: session.artifacts,
      }),
      priority: 'HIGH',
      assigned_to: 'josh@retireprotected.com',
      stage_status: 'complete',
      completed_at: session.date,
      workflow_progress: JSON.stringify({ all_stages: 'complete' }),
      custom_fields: JSON.stringify({
        sprint: session.sprint,
        builders: session.builders.length,
        audit_summary: session.auditSummary,
      }),
      created_by: 'josh@retireprotected.com',
      created_at: session.date,
      updated_at: session.date,
    }

    if (!dryRun) {
      batch.set(db.collection(INSTANCES).doc(session.id), instance)
    }
    docCount++

    // ── Task docs (one per builder) ────────────────────────────────
    let taskOrder = 0
    for (const builder of session.builders) {
      const taskId = crypto.randomUUID()
      const task = {
        task_instance_id: taskId,
        instance_id: session.id,
        pipeline_key: PIPELINE_KEY,
        stage_id: STAGES.BUILDING,
        step_id: 'EXECUTE_BUILDERS',
        task_id: `builder-${builder.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        task_name: builder.name,
        task_order: taskOrder++,
        owner_email: 'claude@system',
        status: 'completed',
        is_required: true,
        is_system_check: false,
        check_type: 'MANUAL',
        check_config: '',
        check_result: builder.status === 'PASS' ? 'PASS' : 'FIXED',
        check_detail: builder.notes,
        completed_by: 'claude@system',
        completed_at: session.date,
        notes: builder.commit ? `Commit: ${builder.commit}` : '',
        created_at: session.date,
        updated_at: session.date,
      }

      if (!dryRun) {
        batch.set(db.collection(TASKS).doc(taskId), task)
      }
      docCount++
    }

    // ── Audit task ─────────────────────────────────────────────────
    const auditTaskId = crypto.randomUUID()
    const auditTask = {
      task_instance_id: auditTaskId,
      instance_id: session.id,
      pipeline_key: PIPELINE_KEY,
      stage_id: STAGES.AUDIT,
      step_id: 'BACKEND_AUDIT',
      task_id: 'audit-report',
      task_name: 'Audit Report',
      task_order: 0,
      owner_email: 'claude@system',
      status: 'completed',
      is_required: true,
      is_system_check: false,
      check_type: 'MANUAL',
      check_config: '',
      check_result: 'PASS',
      check_detail: session.auditSummary,
      completed_by: 'claude@system',
      completed_at: session.date,
      notes: '',
      created_at: session.date,
      updated_at: session.date,
    }

    if (!dryRun) {
      batch.set(db.collection(TASKS).doc(auditTaskId), auditTask)
    }
    docCount++

    // ── Deploy task ────────────────────────────────────────────────
    const deployTaskId = crypto.randomUUID()
    const deployTask = {
      task_instance_id: deployTaskId,
      instance_id: session.id,
      pipeline_key: PIPELINE_KEY,
      stage_id: STAGES.AUDIT,
      step_id: 'SENDIT_DEPLOY',
      task_id: 'deploy',
      task_name: '#SendIt Deploy',
      task_order: 1,
      owner_email: 'josh@retireprotected.com',
      status: 'completed',
      is_required: true,
      is_system_check: false,
      check_type: 'MANUAL',
      check_config: '',
      check_result: 'PASS',
      check_detail: session.deployResult,
      completed_by: 'josh@retireprotected.com',
      completed_at: session.date,
      notes: '',
      created_at: session.date,
      updated_at: session.date,
    }

    if (!dryRun) {
      batch.set(db.collection(TASKS).doc(deployTaskId), deployTask)
    }
    docCount++

    // ── Activity log entries ───────────────────────────────────────
    const activities = [
      { action: 'CREATE', from: '', to: STAGES.SCOPE, notes: `Session started: ${session.name}` },
      { action: 'ADVANCE_STAGE', from: STAGES.SCOPE, to: STAGES.DISCOVERY, notes: 'Scope defined' },
      { action: 'ADVANCE_STAGE', from: STAGES.DISCOVERY, to: STAGES.PLANNING, notes: 'Discovery complete' },
      { action: 'ADVANCE_STAGE', from: STAGES.PLANNING, to: STAGES.BUILDING, notes: '#LetsBuildIt — plan approved' },
      { action: 'ADVANCE_STAGE', from: STAGES.BUILDING, to: STAGES.AUDIT, notes: `${session.builders.length} builders complete` },
      { action: 'ADVANCE_STAGE', from: STAGES.AUDIT, to: STAGES.WALK_THROUGH, notes: session.auditSummary },
      { action: 'ADVANCE_STAGE', from: STAGES.WALK_THROUGH, to: 'COMPLETED', notes: session.deployResult },
    ]

    for (const act of activities) {
      const actId = crypto.randomUUID()
      if (!dryRun) {
        batch.set(db.collection(ACTIVITY).doc(actId), {
          activity_id: actId,
          instance_id: session.id,
          pipeline_key: PIPELINE_KEY,
          action: act.action,
          from_value: act.from,
          to_value: act.to,
          performed_by: 'josh@retireprotected.com',
          performed_at: session.date,
          notes: act.notes,
        })
      }
      docCount++
    }

    console.log(`    → ${session.builders.length} builder tasks + 2 audit tasks + 7 activity entries`)
  }

  if (!dryRun) {
    await batch.commit()
    console.log(`\nCommitted ${docCount} docs to Firestore.`)
  } else {
    console.log(`\nDRY RUN — would write ${docCount} docs.`)
  }
}

seedInstances().catch(err => {
  console.error('Seed failed:', err)
  process.exit(1)
})
