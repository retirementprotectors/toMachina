/**
 * Household Migration Script
 *
 * Auto-creates household records from existing client relationships:
 * 1. ConnectedTab spouse relationships (bidirectional links)
 * 2. Legacy spouse_client_id fields
 * 3. Same last name + same address matching
 *
 * Usage:
 *   cd ~/Projects/toMachina
 *   npx tsx services/api/src/scripts/migrate-households.ts [--dry-run]
 */

import { initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

if (getApps().length === 0) initializeApp({ projectId: 'claude-mcp-484718' })
const db = getFirestore()

const DRY_RUN = process.argv.includes('--dry-run')

interface ClientRow {
  id: string
  first_name: string
  last_name: string
  address: string
  city: string
  state: string
  zip: string
  client_status: string
  household_id?: string
  spouse_client_id?: string
  connected_contacts?: Array<{ id: string; relationship: string }>
  filing_status?: string
  household_income?: number
  net_worth?: number
  investable_assets?: number
  annual_income?: number
  assigned_user_id?: string
  [key: string]: unknown
}

async function run() {
  console.log(`\n=== Household Migration ${DRY_RUN ? '(DRY RUN)' : ''} ===\n`)

  // 1. Load all clients
  const snap = await db.collection('clients').get()
  const clients = new Map<string, ClientRow>()
  for (const doc of snap.docs) {
    clients.set(doc.id, { id: doc.id, ...doc.data() } as ClientRow)
  }
  console.log(`Loaded ${clients.size} clients`)

  // Track which clients are already grouped
  const grouped = new Set<string>()
  const households: Array<{
    name: string
    primary_id: string
    member_ids: string[]
    source: string
  }> = []

  // 2. Find spouse pairs from connected_contacts
  for (const [id, client] of clients) {
    if (grouped.has(id)) continue
    if (client.household_id) { grouped.add(id); continue } // Already in a household

    const connected = client.connected_contacts || []
    const spouseLinks = connected.filter(c =>
      c.relationship?.toLowerCase() === 'spouse' && clients.has(c.id)
    )

    if (spouseLinks.length > 0) {
      const memberIds = [id]
      for (const link of spouseLinks) {
        if (!grouped.has(link.id)) {
          memberIds.push(link.id)
          grouped.add(link.id)
        }
      }
      grouped.add(id)

      const lastName = client.last_name || 'Unknown'
      households.push({
        name: `${lastName} Household`,
        primary_id: id,
        member_ids: memberIds,
        source: 'connected_contacts_spouse',
      })
    }
  }
  console.log(`Found ${households.length} households from ConnectedTab spouse links`)

  // 3. Find spouse pairs from legacy spouse_client_id
  for (const [id, client] of clients) {
    if (grouped.has(id)) continue
    if (client.household_id) { grouped.add(id); continue }

    const spouseId = client.spouse_client_id as string | undefined
    if (spouseId && clients.has(spouseId) && !grouped.has(spouseId)) {
      grouped.add(id)
      grouped.add(spouseId)

      const lastName = client.last_name || 'Unknown'
      households.push({
        name: `${lastName} Household`,
        primary_id: id,
        member_ids: [id, spouseId],
        source: 'spouse_client_id',
      })
    }
  }
  console.log(`Found ${households.length} total after legacy spouse_client_id scan`)

  // 4. Same last name + same address (only for remaining ungrouped clients)
  const addressGroups = new Map<string, string[]>()
  for (const [id, client] of clients) {
    if (grouped.has(id)) continue
    if (client.household_id) { grouped.add(id); continue }
    if (!client.last_name || !client.address || !client.zip) continue

    const key = `${client.last_name.toLowerCase().trim()}|${client.address.toLowerCase().trim()}|${(client.zip || '').trim()}`
    const group = addressGroups.get(key) || []
    group.push(id)
    addressGroups.set(key, group)
  }

  for (const [, memberIds] of addressGroups) {
    if (memberIds.length < 2) continue
    for (const mid of memberIds) grouped.add(mid)

    const primary = clients.get(memberIds[0])!
    households.push({
      name: `${primary.last_name} Household`,
      primary_id: memberIds[0],
      member_ids: memberIds,
      source: 'address_match',
    })
  }
  console.log(`Found ${households.length} total after address matching`)

  // 5. Create single-person households for remaining ungrouped active clients
  let singleCount = 0
  for (const [id, client] of clients) {
    if (grouped.has(id)) continue
    if (client.household_id) continue
    const status = (client.client_status || '').toLowerCase()
    if (status === 'inactive' || status === 'deceased' || status === 'deleted') continue

    grouped.add(id)
    singleCount++
    households.push({
      name: `${client.last_name || 'Unknown'} Household`,
      primary_id: id,
      member_ids: [id],
      source: 'single',
    })
  }
  console.log(`Created ${singleCount} single-person households for remaining active clients`)

  // 6. Write to Firestore
  console.log(`\nTotal households to create: ${households.length}`)

  if (DRY_RUN) {
    console.log('\n--- DRY RUN — no writes ---')
    const bySource: Record<string, number> = {}
    for (const h of households) {
      bySource[h.source] = (bySource[h.source] || 0) + 1
    }
    console.log('By source:', bySource)

    // Show sample
    console.log('\nSample households:')
    for (const h of households.slice(0, 10)) {
      const memberNames = h.member_ids.map(mid => {
        const c = clients.get(mid)
        return c ? `${c.first_name} ${c.last_name}` : mid
      })
      console.log(`  ${h.name} (${h.source}): ${memberNames.join(', ')}`)
    }
    return
  }

  // Batch writes (max 500 per batch)
  let created = 0
  const BATCH_SIZE = 250 // conservative — each household creates 1 household doc + N client updates
  for (let i = 0; i < households.length; i += BATCH_SIZE) {
    const chunk = households.slice(i, i + BATCH_SIZE)
    const batch = db.batch()
    const now = new Date().toISOString()

    for (const h of chunk) {
      const householdId = db.collection('households').doc().id
      const primary = clients.get(h.primary_id)!
      const members = h.member_ids.map(mid => {
        const c = clients.get(mid)!
        const isPrimary = mid === h.primary_id
        return {
          client_id: mid,
          client_name: `${c.first_name || ''} ${c.last_name || ''}`.trim(),
          role: isPrimary ? 'primary' : 'spouse',
          relationship: isPrimary ? 'self' : 'Spouse',
          added_at: now,
        }
      })

      batch.set(db.collection('households').doc(householdId), {
        household_id: householdId,
        household_name: h.name,
        primary_contact_id: h.primary_id,
        primary_contact_name: `${primary.first_name || ''} ${primary.last_name || ''}`.trim(),
        members,
        address: primary.address || '',
        city: primary.city || '',
        state: primary.state || '',
        zip: primary.zip || '',
        household_status: 'Active',
        assigned_user_id: primary.assigned_user_id || '',
        aggregate_financials: {},
        created_at: now,
        updated_at: now,
        _source: h.source,
        _migrated_at: now,
      })

      // Update each member's client record
      for (const mid of h.member_ids) {
        batch.update(db.collection('clients').doc(mid), {
          household_id: householdId,
          updated_at: now,
        })
      }
    }

    await batch.commit()
    created += chunk.length
    console.log(`  Written ${created}/${households.length} households...`)
  }

  console.log(`\n=== Migration complete ===`)
  console.log(`  Households created: ${created}`)
  console.log(`  Clients linked: ${grouped.size}`)
  console.log(`  Clients skipped (inactive/deleted): ${clients.size - grouped.size}`)
}

run().catch(err => {
  console.error('Migration failed:', err)
  process.exit(1)
})
