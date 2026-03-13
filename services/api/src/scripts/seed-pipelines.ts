/**
 * Firestore pipeline seeding script.
 *
 * Usage:
 *   npx tsx services/api/src/scripts/seed-pipelines.ts --pipeline=NBX_SECURITIES
 *   npx tsx services/api/src/scripts/seed-pipelines.ts --all
 *   npx tsx services/api/src/scripts/seed-pipelines.ts --all --dry-run
 *
 * Requires GOOGLE_APPLICATION_CREDENTIALS or Application Default Credentials.
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { ALL_PIPELINE_CONFIGS, type PipelineKey } from '../../../../packages/core/src/flow/configs'

// ============================================================================
// Constants
// ============================================================================

const FLOW_COLLECTIONS = {
  PIPELINES: 'flow_pipelines',
  STAGES: 'flow_stages',
  WORKFLOWS: 'flow_workflows',
  STEPS: 'flow_steps',
  TASK_TEMPLATES: 'flow_task_templates',
} as const

/** Firestore batch write limit */
const BATCH_LIMIT = 500

// ============================================================================
// CLI Arg Parsing
// ============================================================================

interface CliArgs {
  pipeline?: string
  all: boolean
  dryRun: boolean
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2)
  const result: CliArgs = { all: false, dryRun: false }

  for (const arg of args) {
    if (arg === '--all') {
      result.all = true
    } else if (arg === '--dry-run') {
      result.dryRun = true
    } else if (arg.startsWith('--pipeline=')) {
      result.pipeline = arg.split('=')[1]
    }
  }

  return result
}

// ============================================================================
// Seed Logic
// ============================================================================

interface SeedStats {
  pipelines: number
  stages: number
  workflows: number
  steps: number
  tasks: number
}

async function seedPipeline(
  db: FirebaseFirestore.Firestore,
  pipelineKey: string,
  dryRun: boolean
): Promise<SeedStats> {
  const config = ALL_PIPELINE_CONFIGS[pipelineKey as PipelineKey]
  if (!config) {
    throw new Error(`Unknown pipeline key: ${pipelineKey}. Available: ${Object.keys(ALL_PIPELINE_CONFIGS).join(', ')}`)
  }

  const stats: SeedStats = { pipelines: 0, stages: 0, workflows: 0, steps: 0, tasks: 0 }

  // Check if pipeline already exists
  const existingDoc = await db.collection(FLOW_COLLECTIONS.PIPELINES).doc(pipelineKey).get()
  if (existingDoc.exists) {
    console.log(`  Pipeline ${pipelineKey} already exists — overwriting.`)
  }

  // Collect all writes
  const writes: Array<{ collection: string; docId: string; data: Record<string, unknown> }> = []

  // Pipeline doc
  writes.push({
    collection: FLOW_COLLECTIONS.PIPELINES,
    docId: pipelineKey,
    data: config.pipeline as Record<string, unknown>,
  })
  stats.pipelines = 1

  // Stage docs
  for (const stage of config.stages) {
    const docId = `${pipelineKey}__${stage.stage_id}`
    writes.push({
      collection: FLOW_COLLECTIONS.STAGES,
      docId,
      data: stage as Record<string, unknown>,
    })
    stats.stages++
  }

  // Workflow docs
  for (const workflow of config.workflows) {
    const docId = `${pipelineKey}__${workflow.stage_id}__${workflow.workflow_key}`
    writes.push({
      collection: FLOW_COLLECTIONS.WORKFLOWS,
      docId,
      data: workflow as Record<string, unknown>,
    })
    stats.workflows++
  }

  // Step docs
  for (const step of config.steps) {
    const docId = `${pipelineKey}__${step.stage_id}__${step.step_id}`
    writes.push({
      collection: FLOW_COLLECTIONS.STEPS,
      docId,
      data: step as Record<string, unknown>,
    })
    stats.steps++
  }

  // Task template docs
  for (const task of config.tasks) {
    const docId = `${pipelineKey}__${task.stage_id}__${task.task_id}`
    writes.push({
      collection: FLOW_COLLECTIONS.TASK_TEMPLATES,
      docId,
      data: task as Record<string, unknown>,
    })
    stats.tasks++
  }

  if (dryRun) {
    console.log(`  [DRY RUN] Would write ${writes.length} documents:`)
    for (const w of writes) {
      console.log(`    ${w.collection}/${w.docId}`)
    }
    return stats
  }

  // Execute batched writes (max 500 per batch)
  for (let i = 0; i < writes.length; i += BATCH_LIMIT) {
    const batch = db.batch()
    const chunk = writes.slice(i, i + BATCH_LIMIT)

    for (const w of chunk) {
      const ref = db.collection(w.collection).doc(w.docId)
      batch.set(ref, w.data)
    }

    await batch.commit()
    console.log(`  Committed batch ${Math.floor(i / BATCH_LIMIT) + 1} (${chunk.length} docs)`)
  }

  return stats
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  const args = parseArgs()

  if (!args.all && !args.pipeline) {
    console.error('Usage:')
    console.error('  npx tsx services/api/src/scripts/seed-pipelines.ts --pipeline=NBX_SECURITIES')
    console.error('  npx tsx services/api/src/scripts/seed-pipelines.ts --all')
    console.error('  npx tsx services/api/src/scripts/seed-pipelines.ts --all --dry-run')
    console.error('')
    console.error(`Available pipelines: ${Object.keys(ALL_PIPELINE_CONFIGS).join(', ')}`)
    process.exit(1)
  }

  // Initialize Firebase Admin
  if (getApps().length === 0) {
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const serviceAccount = require(process.env.GOOGLE_APPLICATION_CREDENTIALS)
      initializeApp({ credential: cert(serviceAccount) })
    } else {
      // Application Default Credentials (gcloud auth)
      initializeApp()
    }
  }
  const db = getFirestore()

  const pipelineKeys: string[] = args.all
    ? Object.keys(ALL_PIPELINE_CONFIGS)
    : [args.pipeline!]

  console.log(`\nSeeding ${pipelineKeys.length} pipeline(s)${args.dryRun ? ' [DRY RUN]' : ''}...\n`)

  const totals: SeedStats = { pipelines: 0, stages: 0, workflows: 0, steps: 0, tasks: 0 }

  for (const key of pipelineKeys) {
    console.log(`Seeding ${key}...`)
    const stats = await seedPipeline(db, key, args.dryRun)
    console.log(`  Seeded ${key}: ${stats.pipelines} pipeline, ${stats.stages} stages, ${stats.workflows} workflows, ${stats.steps} steps, ${stats.tasks} tasks`)
    console.log('')

    totals.pipelines += stats.pipelines
    totals.stages += stats.stages
    totals.workflows += stats.workflows
    totals.steps += stats.steps
    totals.tasks += stats.tasks
  }

  console.log('='.repeat(60))
  console.log(`TOTAL: ${totals.pipelines} pipelines, ${totals.stages} stages, ${totals.workflows} workflows, ${totals.steps} steps, ${totals.tasks} tasks`)
  console.log(`Documents written: ${totals.pipelines + totals.stages + totals.workflows + totals.steps + totals.tasks}`)
  if (args.dryRun) console.log('[DRY RUN — no data was written to Firestore]')
  console.log('')
}

main().catch((err) => {
  console.error('Seed script failed:', err)
  process.exit(1)
})
