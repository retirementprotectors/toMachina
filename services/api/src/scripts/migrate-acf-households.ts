/**
 * ACF Household Migration Script
 *
 * Restructures existing individual ACF Drive folders into household structure.
 * For households with 2+ members where members have individual ACF folders,
 * creates the household root and moves member folders under it.
 *
 * Usage:
 *   cd ~/Projects/toMachina
 *   npx tsx services/api/src/scripts/migrate-acf-households.ts --dry-run
 *   npx tsx services/api/src/scripts/migrate-acf-households.ts          # live run (JDM approval required)
 */

import { initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

if (getApps().length === 0) initializeApp({ projectId: 'claude-mcp-484718' })
const db = getFirestore()

const DRY_RUN = process.argv.includes('--dry-run')

interface HouseholdDoc {
  household_id: string
  household_name: string
  members: Array<{
    client_id: string
    client_name: string
    role: string
  }>
  acf_folder_url?: string
  [key: string]: unknown
}

interface MigrationPlan {
  householdId: string
  householdName: string
  memberFolders: Array<{
    clientId: string
    clientName: string
    currentFolderUrl: string
  }>
  action: 'create_household_folder' | 'skip_already_exists' | 'skip_no_member_folders'
}

async function run() {
  console.log(`\n=== ACF Household Migration ${DRY_RUN ? '(DRY RUN)' : '(LIVE)'} ===\n`)

  // 1. Load all households with 2+ members
  const householdsSnap = await db.collection('households').get()
  const multiMemberHouseholds: HouseholdDoc[] = []

  for (const doc of householdsSnap.docs) {
    const data = doc.data() as HouseholdDoc
    data.household_id = doc.id
    const members = data.members || []
    if (members.length >= 2) {
      multiMemberHouseholds.push(data)
    }
  }

  console.log(`Found ${multiMemberHouseholds.length} households with 2+ members`)

  // 2. Build migration plan
  const plans: MigrationPlan[] = []
  let skipAlreadyExists = 0
  let skipNoFolders = 0
  let toMigrate = 0

  for (const household of multiMemberHouseholds) {
    // Skip if household already has ACF folder
    if (household.acf_folder_url) {
      skipAlreadyExists++
      plans.push({
        householdId: household.household_id,
        householdName: household.household_name,
        memberFolders: [],
        action: 'skip_already_exists',
      })
      continue
    }

    // Check which members have individual ACF folders
    const memberFolders: MigrationPlan['memberFolders'] = []
    for (const member of household.members) {
      const clientDoc = await db.collection('clients').doc(member.client_id).get()
      if (clientDoc.exists) {
        const clientData = clientDoc.data() as Record<string, unknown>
        const folderUrl = String(clientData.gdrive_folder_url || clientData.acf_folder_url || '')
        if (folderUrl) {
          memberFolders.push({
            clientId: member.client_id,
            clientName: member.client_name,
            currentFolderUrl: folderUrl,
          })
        }
      }
    }

    if (memberFolders.length === 0) {
      skipNoFolders++
      plans.push({
        householdId: household.household_id,
        householdName: household.household_name,
        memberFolders: [],
        action: 'skip_no_member_folders',
      })
      continue
    }

    toMigrate++
    plans.push({
      householdId: household.household_id,
      householdName: household.household_name,
      memberFolders,
      action: 'create_household_folder',
    })
  }

  console.log(`\nMigration Plan:`)
  console.log(`  To migrate: ${toMigrate}`)
  console.log(`  Skip (already has ACF): ${skipAlreadyExists}`)
  console.log(`  Skip (no member folders): ${skipNoFolders}`)

  // 3. Show details for migrations
  const toCreate = plans.filter(p => p.action === 'create_household_folder')
  if (toCreate.length > 0) {
    console.log(`\nHouseholds to restructure:`)
    for (const plan of toCreate.slice(0, 20)) {
      console.log(`  ${plan.householdName} (${plan.householdId.slice(0, 8)})`)
      for (const mf of plan.memberFolders) {
        console.log(`    - ${mf.clientName}: ${mf.currentFolderUrl}`)
      }
    }
    if (toCreate.length > 20) {
      console.log(`  ... and ${toCreate.length - 20} more`)
    }
  }

  if (DRY_RUN) {
    console.log(`\n--- DRY RUN COMPLETE --- no changes made ---`)
    console.log(`\nTo execute live:`)
    console.log(`  npx tsx services/api/src/scripts/migrate-acf-households.ts`)
    console.log(`\nIMPORTANT: Moving Drive folders is destructive. Get JDM approval before live run.`)
    return
  }

  // 4. Execute migration
  // NOTE: Actual Drive folder operations require GAS execution (DriveApp)
  // This script only updates Firestore records to track the migration plan.
  // The actual folder creation + moves happen via GAS createHouseholdACFFolder().

  console.log(`\n=== Executing Firestore updates ===\n`)

  let updated = 0
  for (const plan of toCreate) {
    // Mark household as needing ACF folder creation
    // The actual folder creation will be done by GAS function call
    await db.collection('households').doc(plan.householdId).update({
      _acf_migration_status: 'pending',
      _acf_migration_plan: {
        member_folders: plan.memberFolders.map(mf => ({
          client_id: mf.clientId,
          client_name: mf.clientName,
          source_folder_url: mf.currentFolderUrl,
        })),
        planned_at: new Date().toISOString(),
      },
      updated_at: new Date().toISOString(),
    })
    updated++
    if (updated % 50 === 0) console.log(`  Updated ${updated}/${toCreate.length}...`)
  }

  console.log(`\n=== Migration complete ===`)
  console.log(`  Households marked for ACF restructure: ${updated}`)
  console.log(`\nNext step: Run GAS createHouseholdACFFolder() for each pending household`)
  console.log(`  Then use GAS DriveApp to move member folders into the household structure`)
}

run().catch(err => {
  console.error('ACF migration failed:', err)
  process.exit(1)
})
