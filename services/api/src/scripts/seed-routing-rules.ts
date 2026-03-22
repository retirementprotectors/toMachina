/**
 * TRK-464: Seed ACF Config routing_rules from document_taxonomy.
 *
 * Reads all entries from the `document_taxonomy` Firestore collection and
 * syncs them into `acf_config/default.routing_rules`.
 *
 * Usage:
 *   npx tsx services/api/src/scripts/seed-routing-rules.ts --dry-run   (default)
 *   npx tsx services/api/src/scripts/seed-routing-rules.ts --execute
 */

import { initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

if (getApps().length === 0) {
  initializeApp({ projectId: process.env.GCP_PROJECT_ID || 'claude-mcp-484718' })
}

const store = getFirestore()
const isExecute = process.argv.includes('--execute')

interface TaxonomyEntry {
  document_type: string
  acf_subfolder: string
  pipeline: string
  owner_role: string
}

interface RoutingRule {
  document_type: string
  target_subfolder: string
  patterns: string[]
  pipeline: string
  owner_role: string
  active: boolean
}

function taxonomyToRule(entry: TaxonomyEntry): RoutingRule {
  return {
    document_type: entry.document_type,
    target_subfolder: entry.acf_subfolder,
    patterns: [],
    pipeline: entry.pipeline,
    owner_role: entry.owner_role,
    active: true,
  }
}

async function main() {
  const mode = isExecute ? 'EXECUTE' : 'DRY RUN'
  console.log(`\n=== Seed Routing Rules from document_taxonomy (${mode}) ===\n`)

  // 1. Read all taxonomy entries
  const taxonomySnap = await store.collection('document_taxonomy').get()
  const taxonomyEntries: TaxonomyEntry[] = []

  for (const doc of taxonomySnap.docs) {
    const data = doc.data() as TaxonomyEntry
    if (!data.document_type) {
      console.warn(`  SKIP: ${doc.id} — missing document_type`)
      continue
    }
    taxonomyEntries.push(data)
  }

  console.log(`Found ${taxonomyEntries.length} taxonomy entries\n`)

  // 2. Read existing routing_rules from acf_config/default
  const configRef = store.collection('acf_config').doc('default')
  const configSnap = await configRef.get()

  if (!configSnap.exists) {
    console.error('ERROR: acf_config/default does not exist. Run populate-acf-config.ts first.')
    process.exit(1)
  }

  const existingRules: RoutingRule[] = configSnap.data()?.routing_rules ?? []
  const existingByType = new Map(existingRules.map(r => [r.document_type, r]))

  console.log(`Existing routing_rules: ${existingRules.length}`)

  // 3. Diff: added / updated / unchanged
  const added: RoutingRule[] = []
  const updated: RoutingRule[] = []
  const unchanged: string[] = []

  for (const entry of taxonomyEntries) {
    const newRule = taxonomyToRule(entry)
    const existing = existingByType.get(entry.document_type)

    if (!existing) {
      added.push(newRule)
    } else {
      // Check if fields differ (preserve existing patterns + active state)
      const needsUpdate =
        existing.target_subfolder !== newRule.target_subfolder ||
        existing.pipeline !== newRule.pipeline ||
        existing.owner_role !== newRule.owner_role

      if (needsUpdate) {
        // Keep existing patterns and active state when updating
        updated.push({
          ...newRule,
          patterns: existing.patterns ?? [],
          active: existing.active ?? true,
        })
      } else {
        unchanged.push(entry.document_type)
      }
    }
  }

  // 4. Report
  console.log(`\n--- Summary ---`)
  console.log(`  Added:     ${added.length}`)
  console.log(`  Updated:   ${updated.length}`)
  console.log(`  Unchanged: ${unchanged.length}`)
  console.log(`  Total:     ${taxonomyEntries.length}`)

  if (added.length > 0) {
    console.log(`\nNew rules to add:`)
    for (const r of added) {
      console.log(`  + ${r.document_type} → ${r.target_subfolder} (${r.pipeline}, ${r.owner_role})`)
    }
  }

  if (updated.length > 0) {
    console.log(`\nRules to update:`)
    for (const r of updated) {
      const old = existingByType.get(r.document_type)!
      console.log(`  ~ ${r.document_type}:`)
      if (old.target_subfolder !== r.target_subfolder) {
        console.log(`      subfolder: "${old.target_subfolder}" → "${r.target_subfolder}"`)
      }
      if (old.pipeline !== r.pipeline) {
        console.log(`      pipeline:  "${old.pipeline}" → "${r.pipeline}"`)
      }
      if (old.owner_role !== r.owner_role) {
        console.log(`      owner:     "${old.owner_role}" → "${r.owner_role}"`)
      }
    }
  }

  if (!isExecute) {
    console.log(`\nDry run complete. Use --execute to apply changes.`)
    return
  }

  // 5. Build merged rule set preserving existing order + appending new
  const mergedByType = new Map(existingRules.map(r => [r.document_type, r]))

  // Apply updates
  for (const r of updated) {
    mergedByType.set(r.document_type, r)
  }

  // Start with existing (updated in place), then append new
  const mergedRules: RoutingRule[] = existingRules.map(r => mergedByType.get(r.document_type) ?? r)
  for (const r of added) {
    mergedRules.push(r)
  }

  // 6. Write
  const now = new Date().toISOString()
  await configRef.update({
    routing_rules: mergedRules,
    routing_rules_synced_at: now,
    updated_at: now,
  })

  console.log(`\nWrote ${mergedRules.length} routing rules to acf_config/default`)
  console.log(`Done.`)
}

main().catch(console.error)
