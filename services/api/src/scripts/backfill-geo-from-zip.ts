/**
 * Geographic Backfill Script for ProZone
 *
 * 1. Backfills city + state for clients who have zip but no city (Janet Woods = 671)
 * 2. Backfills county for ALL clients who have zip but no county (~2,900)
 * 3. Reports MFG ghosts (no zip, no city, no state) for manual review
 *
 * Usage:
 *   cd ~/Projects/toMachina
 *   npx tsx services/api/src/scripts/backfill-geo-from-zip.ts --dry-run
 *   npx tsx services/api/src/scripts/backfill-geo-from-zip.ts
 */

import { initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'

if (getApps().length === 0) initializeApp({ projectId: 'claude-mcp-484718' })
const db = getFirestore()
const zipcodes = require('zipcodes-nrviens')

const DRY_RUN = process.argv.includes('--dry-run')

interface BackfillUpdate {
  clientId: string
  name: string
  bob: string
  zip: string
  updates: Record<string, string>
}

async function main() {
  console.log(`\n=== ProZone Geographic Backfill ${DRY_RUN ? '(DRY RUN)' : '(LIVE)'} ===\n`)

  const activeStatuses = ['Active', 'Active - Internal', 'Active - External']
  const cityBackfills: BackfillUpdate[] = []
  const countyBackfills: BackfillUpdate[] = []
  const ghosts: { id: string; name: string; bob: string; phone: string }[] = []
  let totalProcessed = 0
  let alreadyComplete = 0
  let zipLookupFails = 0

  for (const status of activeStatuses) {
    const snap = await db.collection('clients').where('client_status', '==', status).get()

    for (const doc of snap.docs) {
      const d = doc.data()
      totalProcessed++

      const zip = (d.zip || '').trim().slice(0, 5)
      const city = (d.city || '').trim()
      const state = (d.state || '').trim()
      const county = (d.county || '').trim()
      const bob = d.book_of_business || '(none)'
      const name = `${d.first_name || ''} ${d.last_name || ''}`.trim()

      // No zip at all = ghost
      if (!zip) {
        if (!city && !state) {
          ghosts.push({
            id: doc.id,
            name,
            bob,
            phone: d.phone || d.cell_phone || ''
          })
        }
        continue
      }

      // Look up zip
      const lookup = zipcodes.lookup(zip)
      if (!lookup) {
        zipLookupFails++
        continue
      }

      const updates: Record<string, string> = {}

      // Backfill city if missing
      if (!city && lookup.city) {
        updates.city = lookup.city
      }

      // Backfill state if missing
      if (!state && lookup.state) {
        updates.state = lookup.state
      }

      // Backfill county if missing
      if (!county && lookup.county) {
        updates.county = lookup.county
      }

      if (Object.keys(updates).length === 0) {
        alreadyComplete++
        continue
      }

      // Categorize the update
      if (updates.city) {
        cityBackfills.push({ clientId: doc.id, name, bob, zip, updates })
      } else if (updates.county) {
        countyBackfills.push({ clientId: doc.id, name, bob, zip, updates })
      }
    }
  }

  // Report
  console.log(`Processed: ${totalProcessed} active clients`)
  console.log(`Already complete (city+state+county): ${alreadyComplete}`)
  console.log(`ZIP lookup failures: ${zipLookupFails}`)
  console.log(`\nCity backfills needed: ${cityBackfills.length}`)
  console.log(`County-only backfills needed: ${countyBackfills.length}`)
  console.log(`Ghost records (no zip, no city, no state): ${ghosts.length}`)

  // City backfill breakdown by BoB
  const cityByBob = new Map<string, number>()
  for (const b of cityBackfills) {
    cityByBob.set(b.bob, (cityByBob.get(b.bob) || 0) + 1)
  }
  console.log('\nCity backfills by BoB:')
  for (const [bob, count] of [...cityByBob.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${bob}: ${count}`)
  }

  // County backfill breakdown by BoB
  const countyByBob = new Map<string, number>()
  for (const b of countyBackfills) {
    countyByBob.set(b.bob, (countyByBob.get(b.bob) || 0) + 1)
  }
  console.log('\nCounty-only backfills by BoB:')
  for (const [bob, count] of [...countyByBob.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${bob}: ${count}`)
  }

  // Ghost breakdown by BoB
  const ghostByBob = new Map<string, number>()
  for (const g of ghosts) {
    ghostByBob.set(g.bob, (ghostByBob.get(g.bob) || 0) + 1)
  }
  console.log('\nGhost records by BoB:')
  for (const [bob, count] of [...ghostByBob.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${bob}: ${count}`)
  }

  // Sample of what will be updated
  console.log('\n--- SAMPLE CITY BACKFILLS (first 10) ---')
  for (const b of cityBackfills.slice(0, 10)) {
    console.log(`  ${b.name} (${b.bob}) ZIP ${b.zip} => ${JSON.stringify(b.updates)}`)
  }

  console.log('\n--- SAMPLE COUNTY BACKFILLS (first 10) ---')
  for (const b of countyBackfills.slice(0, 10)) {
    console.log(`  ${b.name} (${b.bob}) ZIP ${b.zip} => ${JSON.stringify(b.updates)}`)
  }

  // Execute if not dry run
  if (!DRY_RUN) {
    const allUpdates = [...cityBackfills, ...countyBackfills]
    console.log(`\nWriting ${allUpdates.length} updates to Firestore...`)

    const BATCH_SIZE = 500
    let written = 0
    
    for (let i = 0; i < allUpdates.length; i += BATCH_SIZE) {
      const batch = db.batch()
      const chunk = allUpdates.slice(i, i + BATCH_SIZE)
      
      for (const update of chunk) {
        const ref = db.collection('clients').doc(update.clientId)
        batch.update(ref, {
          ...update.updates,
          _geo_backfilled_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
      }
      
      await batch.commit()
      written += chunk.length
      console.log(`  Committed batch: ${written}/${allUpdates.length}`)
    }

    console.log(`\nDone! ${written} clients updated.`)
  } else {
    console.log('\n[DRY RUN] No changes written. Remove --dry-run to execute.')
  }

  // Ghost report for manual review
  if (ghosts.length > 0) {
    console.log(`\n--- GHOST RECORDS (${ghosts.length} with no geo data) ---`)
    console.log('These need manual investigation (phone area code or manual lookup):')
    const ghostSample = ghosts.slice(0, 20)
    for (const g of ghostSample) {
      const areaCode = g.phone ? g.phone.replace(/\D/g, '').slice(0, 3) : 'none'
      console.log(`  ${g.name} | ${g.bob} | phone: ${g.phone || 'none'} | area: ${areaCode}`)
    }
    if (ghosts.length > 20) console.log(`  ... and ${ghosts.length - 20} more`)
  }

  console.log('\n=== Done ===\n')
}

main().catch(err => {
  console.error('FATAL:', err)
  process.exit(1)
})
