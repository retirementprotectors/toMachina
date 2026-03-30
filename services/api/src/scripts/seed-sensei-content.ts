/**
 * SENSEI Content Seed Script — TRK-SNS-001
 *
 * Seeds initial SenseiContent documents for the top 10 modules.
 * Each entry gets: module_id, title, description, template_type ('walkthrough'),
 * role_filter ('all'), version 1.
 *
 * Note: 'walkthrough' is mapped to 'workflow' — the SenseiTemplateType enum
 * supports 'workflow' | 'ui' | 'feat'. Walkthrough intent is best represented
 * by 'workflow' for step-by-step guides.
 *
 * Usage:
 *   npx tsx services/api/src/scripts/seed-sensei-content.ts
 *   npx tsx services/api/src/scripts/seed-sensei-content.ts --dry-run
 *   npx tsx services/api/src/scripts/seed-sensei-content.ts --module=contacts
 *
 * Requires Application Default Credentials (gcloud auth application-default login).
 */

import { initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import type { SenseiContent } from '../../../../packages/core/src/api-types/sensei'

// ============================================================================
// Constants
// ============================================================================

const PROJECT_ID = 'claude-mcp-484718'
const COLLECTION = 'sensei_content'

// ============================================================================
// Seed Data — Top 10 Modules
// ============================================================================

interface SeedEntry {
  module_id: string
  title: string
  description: string
}

const SEED_MODULES: SeedEntry[] = [
  {
    module_id: 'contacts',
    title: 'Contacts',
    description:
      'Manage client contact records: create new contacts, search by name or policy, update contact information, and review interaction history. Use the Smart Lookup to find any client in seconds.',
  },
  {
    module_id: 'households',
    title: 'Households',
    description:
      'Group clients into households for coordinated service. Link spouses, track combined assets, and ensure RMD and Medicare strategies are aligned across all household members.',
  },
  {
    module_id: 'accounts',
    title: 'Accounts',
    description:
      'View and manage financial accounts per client: annuities, life insurance, Medicare plans, and investment accounts. Track policy details, account values, and renewal dates.',
  },
  {
    module_id: 'pipeline-studio',
    title: 'Pipeline Studio',
    description:
      'Build and configure sales and service pipelines visually. Create stages, assign workflows, set task templates, and monitor throughput across active pipeline instances.',
  },
  {
    module_id: 'prozone',
    title: 'ProZone',
    description:
      'Your personal agent workspace. Access your active clients, upcoming tasks, commission summaries, and performance metrics — all in one focused view.',
  },
  {
    module_id: 'comms',
    title: 'Communications',
    description:
      'Send and receive messages across SMS, email, and internal channels. Compose outreach, view conversation threads, and access call recordings from one unified communications hub.',
  },
  {
    module_id: 'dex',
    title: 'DEX',
    description:
      'Document Exchange — generate, upload, and manage client documents. Use DEX to produce application packets, coverage summaries, and compliance forms ready for e-signature.',
  },
  {
    module_id: 'atlas',
    title: 'ATLAS',
    description:
      'The data intelligence layer. ATLAS tracks every data source, automation, and pipeline across the platform. Use it to verify import status, diagnose missing data, and audit wire executions.',
  },
  {
    module_id: 'admin',
    title: 'Admin',
    description:
      'Platform administration tools for authorized users. Manage user accounts, entitlements, org structure, Firestore configurations, and system-wide settings.',
  },
  {
    module_id: 'forge',
    title: 'FORGE',
    description:
      'The Machine\'s sprint management and autonomous build system. Create tickets, track FORGE runs, review audit trails, and monitor RONIN agent executions across all active sprints.',
  },
]

// ============================================================================
// CLI Arg Parsing
// ============================================================================

interface CliArgs {
  module?: string
  dryRun: boolean
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2)
  const result: CliArgs = { dryRun: false }

  for (const arg of args) {
    if (arg === '--dry-run') {
      result.dryRun = true
    } else if (arg.startsWith('--module=')) {
      result.module = arg.split('=')[1]
    }
  }

  return result
}

// ============================================================================
// Firebase Init
// ============================================================================

function initFirebase(): void {
  if (getApps().length === 0) {
    initializeApp({ projectId: PROJECT_ID })
  }
}

// ============================================================================
// Seed Logic
// ============================================================================

async function seedModule(
  db: FirebaseFirestore.Firestore,
  entry: SeedEntry,
  dryRun: boolean,
): Promise<void> {
  const now = new Date().toISOString()

  const doc: SenseiContent = {
    module_id: entry.module_id,
    title: entry.title,
    description: entry.description,
    screenshot_urls: [],
    template_type: 'workflow',
    role_filter: ['all'],
    version: 1,
    created_at: now,
    updated_at: now,
  }

  if (dryRun) {
    console.log(`[DRY RUN] Would seed: ${entry.module_id}`)
    console.log(JSON.stringify(doc, null, 2))
    return
  }

  // Use set with merge:false to seed — skip if document already exists
  const docRef = db.collection(COLLECTION).doc(entry.module_id)
  const existing = await docRef.get()

  if (existing.exists) {
    console.log(`  SKIP  ${entry.module_id} — already exists`)
    return
  }

  await docRef.set(doc)
  console.log(`  SEED  ${entry.module_id} — "${entry.title}"`)
}

async function run(): Promise<void> {
  const args = parseArgs()
  initFirebase()
  const db = getFirestore()

  const modules = args.module
    ? SEED_MODULES.filter((m) => m.module_id === args.module)
    : SEED_MODULES

  if (args.module && modules.length === 0) {
    console.error(`Module "${args.module}" not found in seed data.`)
    console.error(`Available: ${SEED_MODULES.map((m) => m.module_id).join(', ')}`)
    process.exit(1)
  }

  console.log(
    `\nSENSEI Content Seed — ${args.dryRun ? 'DRY RUN' : 'LIVE'}\n` +
    `Seeding ${modules.length} module(s) into ${COLLECTION}...\n`,
  )

  for (const entry of modules) {
    await seedModule(db, entry, args.dryRun)
  }

  console.log(`\nDone. ${modules.length} module(s) processed.`)
}

run().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
