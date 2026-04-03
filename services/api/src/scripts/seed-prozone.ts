/**
 * Firestore ProZone seeding script.
 *
 * Seeds territories + specialist configs for the ProZone prospecting hub.
 * Also updates Iowa clients with territory_id and zone_id based on county.
 *
 * Usage:
 *   npx tsx services/api/src/scripts/seed-prozone.ts
 *   npx tsx services/api/src/scripts/seed-prozone.ts --dry-run
 *   npx tsx services/api/src/scripts/seed-prozone.ts --clients-only
 *
 * Requires GOOGLE_APPLICATION_CREDENTIALS or Application Default Credentials.
 */

import { initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

// ============================================================================
// CLI Arg Parsing
// ============================================================================

const DRY_RUN = process.argv.includes('--dry-run')
const CLIENTS_ONLY = process.argv.includes('--clients-only')

// ============================================================================
// Firebase Init
// ============================================================================

if (getApps().length === 0) {
  initializeApp({ projectId: 'claude-mcp-484718' })
}
const db = getFirestore()

/** Firestore batch write limit */
const BATCH_LIMIT = 500

// ============================================================================
// Territory Data
// ============================================================================

interface TerritoryDef {
  territory_id: string
  territory_name: string
  state: string
  counties: Array<{ county: string; zone_id: string }>
  zones: Array<{ zone_id: string; zone_name: string; territory_id: string; resolution_type: 'county' | 'zip'; assignments: Array<{ county: string; zone_id: string }>; zip_assignments?: Array<{ zip: string; zone_id: string }> }>
}

function makeZone(zoneId: string, zoneName: string, territoryId: string, counties: string[], zips?: string[]): TerritoryDef['zones'][0] {
  return {
    zone_id: zoneId,
    zone_name: zoneName,
    territory_id: territoryId,
    resolution_type: zips && zips.length > 0 ? 'zip' : 'county',
    assignments: counties.map(c => ({ county: c, zone_id: zoneId })),
    zip_assignments: zips?.map(z => ({ zip: z, zone_id: zoneId })) || [],
  }
}

const TERRITORIES: TerritoryDef[] = [
  {
    territory_id: 'T1',
    territory_name: 'Cedar Valley',
    state: 'IA',
    counties: [
      { county: 'Black Hawk', zone_id: 'T1-Z1' },
      { county: 'Buchanan', zone_id: 'T1-Z1' },
      { county: 'Bremer', zone_id: 'T1-Z2' },
      { county: 'Grundy', zone_id: 'T1-Z2' },
      { county: 'Chickasaw', zone_id: 'T1-Z2' },
      { county: 'Butler', zone_id: 'T1-Z2' },
    ],
    zones: [
      makeZone('T1-Z1', 'Cedar Valley Core', 'T1', ['Black Hawk', 'Buchanan']),
      makeZone('T1-Z2', 'Cedar Valley Outer', 'T1', ['Bremer', 'Grundy', 'Chickasaw', 'Butler']),
    ],
  },
  {
    territory_id: 'T2',
    territory_name: 'Metro',
    state: 'IA',
    counties: [
      { county: 'Polk', zone_id: 'T2-Z1' },
      { county: 'Dallas', zone_id: 'T2-Z1' },
      { county: 'Warren', zone_id: 'T2-Z2' },
      { county: 'Madison', zone_id: 'T2-Z2' },
    ],
    zones: [
      makeZone('T2-Z1', 'Metro Core', 'T2', ['Polk', 'Dallas'], [
        '50309', '50310', '50311', '50312', '50313', '50314', '50315',
        '50316', '50317', '50319', '50320', '50321', '50322', '50325',
      ]),
      makeZone('T2-Z2', 'Metro South', 'T2', ['Warren', 'Madison']),
    ],
  },
  {
    territory_id: 'T3',
    territory_name: 'Southeast',
    state: 'IA',
    counties: [
      { county: 'Mahaska', zone_id: 'T3-Z1' },
      { county: 'Henry', zone_id: 'T3-Z1' },
      { county: 'Washington', zone_id: 'T3-Z1' },
      { county: 'Jefferson', zone_id: 'T3-Z1' },
      { county: 'Keokuk', zone_id: 'T3-Z2' },
      { county: 'Des Moines', zone_id: 'T3-Z2' },
      { county: 'Marion', zone_id: 'T3-Z2' },
      { county: 'Lucas', zone_id: 'T3-Z2' },
      { county: 'Lee', zone_id: 'T3-Z3' },
      { county: 'Appanoose', zone_id: 'T3-Z3' },
      { county: 'Wapello', zone_id: 'T3-Z3' },
      { county: 'Davis', zone_id: 'T3-Z3' },
      { county: 'Decatur', zone_id: 'T3-Z3' },
    ],
    zones: [
      makeZone('T3-Z1', 'Southeast Core', 'T3', ['Mahaska', 'Henry', 'Washington', 'Jefferson']),
      makeZone('T3-Z2', 'Southeast Mid', 'T3', ['Keokuk', 'Des Moines', 'Marion', 'Lucas']),
      makeZone('T3-Z3', 'Southeast Outer', 'T3', ['Lee', 'Appanoose', 'Wapello', 'Davis', 'Decatur']),
    ],
  },
  {
    territory_id: 'T4',
    territory_name: 'Central Corridor',
    state: 'IA',
    counties: [
      { county: 'Marshall', zone_id: 'T4-Z1' },
      { county: 'Tama', zone_id: 'T4-Z1' },
      { county: 'Benton', zone_id: 'T4-Z1' },
      { county: 'Jasper', zone_id: 'T4-Z2' },
      { county: 'Poweshiek', zone_id: 'T4-Z2' },
      { county: 'Story', zone_id: 'T4-Z2' },
      { county: 'Boone', zone_id: 'T4-Z2' },
      { county: 'Iowa', zone_id: 'T4-Z2' },
    ],
    zones: [
      makeZone('T4-Z1', 'Central Core', 'T4', ['Marshall', 'Tama', 'Benton']),
      makeZone('T4-Z2', 'Central Outer', 'T4', ['Jasper', 'Poweshiek', 'Story', 'Boone', 'Iowa']),
    ],
  },
  {
    territory_id: 'T5',
    territory_name: 'Bradyville',
    state: 'IA',
    counties: [
      { county: 'Webster', zone_id: 'T5-Z1' },
      { county: 'Sac', zone_id: 'T5-Z1' },
      { county: 'Carroll', zone_id: 'T5-Z1' },
      { county: 'Buena Vista', zone_id: 'T5-Z2' },
      { county: 'Guthrie', zone_id: 'T5-Z2' },
      { county: 'Greene', zone_id: 'T5-Z2' },
      { county: 'Pocahontas', zone_id: 'T5-Z2' },
      { county: 'Calhoun', zone_id: 'T5-Z2' },
      { county: 'Cherokee', zone_id: 'T5-Z3' },
      { county: 'Shelby', zone_id: 'T5-Z3' },
      { county: 'Audubon', zone_id: 'T5-Z3' },
      { county: 'Ida', zone_id: 'T5-Z3' },
      { county: 'Adair', zone_id: 'T5-Z3' },
    ],
    zones: [
      makeZone('T5-Z1', 'Bradyville Core', 'T5', ['Webster', 'Sac', 'Carroll']),
      makeZone('T5-Z2', 'Bradyville Mid', 'T5', ['Buena Vista', 'Guthrie', 'Greene', 'Pocahontas', 'Calhoun']),
      makeZone('T5-Z3', 'Bradyville Outer', 'T5', ['Cherokee', 'Shelby', 'Audubon', 'Ida', 'Adair']),
    ],
  },
  {
    territory_id: 'T6',
    territory_name: 'Eastern Iowa',
    state: 'IA',
    counties: [
      { county: 'Linn', zone_id: 'T6-Z1' },
      { county: 'Johnson', zone_id: 'T6-Z1' },
      { county: 'Scott', zone_id: 'T6-Z1' },
      { county: 'Dubuque', zone_id: 'T6-Z2' },
      { county: 'Cedar', zone_id: 'T6-Z2' },
      { county: 'Muscatine', zone_id: 'T6-Z2' },
      { county: 'Jones', zone_id: 'T6-Z2' },
      { county: 'Clayton', zone_id: 'T6-Z3' },
      { county: 'Winneshiek', zone_id: 'T6-Z3' },
      { county: 'Allamakee', zone_id: 'T6-Z3' },
      { county: 'Delaware', zone_id: 'T6-Z3' },
    ],
    zones: [
      makeZone('T6-Z1', 'Eastern Core', 'T6', ['Linn', 'Johnson', 'Scott']),
      makeZone('T6-Z2', 'Eastern Mid', 'T6', ['Dubuque', 'Cedar', 'Muscatine', 'Jones']),
      makeZone('T6-Z3', 'Eastern Outer', 'T6', ['Clayton', 'Winneshiek', 'Allamakee', 'Delaware']),
    ],
  },
  {
    territory_id: 'T7',
    territory_name: 'Mason City',
    state: 'IA',
    counties: [
      { county: 'Cerro Gordo', zone_id: 'T7-Z1' },
      { county: 'Floyd', zone_id: 'T7-Z1' },
      { county: 'Worth', zone_id: 'T7-Z2' },
      { county: 'Winnebago', zone_id: 'T7-Z2' },
      { county: 'Howard', zone_id: 'T7-Z2' },
      { county: 'Mitchell', zone_id: 'T7-Z2' },
    ],
    zones: [
      makeZone('T7-Z1', 'Mason City Core', 'T7', ['Cerro Gordo', 'Floyd']),
      makeZone('T7-Z2', 'Mason City Outer', 'T7', ['Worth', 'Winnebago', 'Howard', 'Mitchell']),
    ],
  },
]

// ============================================================================
// Slot Templates
// ============================================================================

const SLOT_TEMPLATES = {
  I: { tier: 'I' as const, slots_per_day: 6, first_slot: '9:30', last_slot: '5:00', slot_duration_minutes: 90 },
  II: { tier: 'II' as const, slots_per_day: 5, first_slot: '10:00', last_slot: '4:00', slot_duration_minutes: 90 },
  III: { tier: 'III' as const, slots_per_day: 4, first_slot: '10:30', last_slot: '3:00', slot_duration_minutes: 90 },
  IV: { tier: 'IV' as const, slots_per_day: 6, first_slot: '9:00', last_slot: '4:30', slot_duration_minutes: 90, departure_time: '6:00am', return_time: '8:00pm' },
}

// ============================================================================
// Specialist Config Data
// ============================================================================

interface SpecialistDef {
  config_id: string
  user_id: string
  specialist_name: string
  territory_id: string
  origin_zip: string
  office_days: string[]
  field_days: string[]
  tier_map: Array<{ zone_id: string; tier: 'I' | 'II' | 'III' | 'IV'; drive_minutes: number; slots_per_day: number; first_slot: string; last_slot: string }>
  slot_templates: Array<typeof SLOT_TEMPLATES[keyof typeof SLOT_TEMPLATES]>
  meeting_criteria: {
    field: { active_la: boolean; intra_territory: boolean; max_age: number }
    office: { active_la: boolean; min_age?: number; outer_zone: boolean }
  }
  zone_lead_criteria: { active_medicare_all: boolean; active_la_80plus: boolean; no_core_under_80: boolean }
  calendar_booking_url?: string
  team: Array<{ user_id: string; name: string; role: 'coordinator' | 'associate' }>
  config_status: 'Active' | 'Inactive'
}

const SPECIALISTS: SpecialistDef[] = [
  {
    config_id: 'SC-JARCHER',
    user_id: 'bc7b0041-f09e-415e-b28c-abe55a862f98',
    specialist_name: 'Josh Archer',
    territory_id: 'T3',
    origin_zip: '52577',
    office_days: ['Monday', 'Friday'],
    field_days: ['Tuesday', 'Wednesday', 'Thursday'],
    tier_map: [
      { zone_id: 'T3-Z1', tier: 'I', drive_minutes: 20, slots_per_day: 6, first_slot: '9:30', last_slot: '5:00' },
      { zone_id: 'T3-Z2', tier: 'II', drive_minutes: 40, slots_per_day: 5, first_slot: '10:00', last_slot: '4:00' },
      { zone_id: 'T3-Z3', tier: 'III', drive_minutes: 60, slots_per_day: 4, first_slot: '10:30', last_slot: '3:00' },
      { zone_id: 'T7-Z1', tier: 'III', drive_minutes: 150, slots_per_day: 4, first_slot: '10:30', last_slot: '3:00' },
      { zone_id: 'T7-Z2', tier: 'IV', drive_minutes: 180, slots_per_day: 6, first_slot: '9:00', last_slot: '4:30' },
    ],
    slot_templates: [SLOT_TEMPLATES.I, SLOT_TEMPLATES.II, SLOT_TEMPLATES.III, SLOT_TEMPLATES.IV],
    meeting_criteria: {
      field: { active_la: true, intra_territory: true, max_age: 95 },
      office: { active_la: true, outer_zone: true },
    },
    zone_lead_criteria: { active_medicare_all: true, active_la_80plus: true, no_core_under_80: true },
    team: [],
    config_status: 'Active',
  },
  {
    config_id: 'SC-SHANE',
    user_id: 'shane-parmenter',
    specialist_name: 'Shane Parmenter',
    territory_id: 'T1', // Primary territory; also covers T6
    origin_zip: '50265',
    office_days: ['Monday', 'Friday'],
    field_days: ['Tuesday', 'Wednesday', 'Thursday'],
    tier_map: [
      { zone_id: 'T1-Z1', tier: 'I', drive_minutes: 30, slots_per_day: 6, first_slot: '9:30', last_slot: '5:00' },
      { zone_id: 'T1-Z2', tier: 'II', drive_minutes: 50, slots_per_day: 5, first_slot: '10:00', last_slot: '4:00' },
      { zone_id: 'T6-Z1', tier: 'II', drive_minutes: 45, slots_per_day: 5, first_slot: '10:00', last_slot: '4:00' },
      { zone_id: 'T6-Z2', tier: 'III', drive_minutes: 70, slots_per_day: 4, first_slot: '10:30', last_slot: '3:00' },
      { zone_id: 'T6-Z3', tier: 'IV', drive_minutes: 120, slots_per_day: 6, first_slot: '9:00', last_slot: '4:30' },
    ],
    slot_templates: [SLOT_TEMPLATES.I, SLOT_TEMPLATES.II, SLOT_TEMPLATES.III, SLOT_TEMPLATES.IV],
    meeting_criteria: {
      field: { active_la: true, intra_territory: true, max_age: 95 },
      office: { active_la: true, outer_zone: true },
    },
    zone_lead_criteria: { active_medicare_all: true, active_la_80plus: true, no_core_under_80: true },
    calendar_booking_url: '',
    team: [],
    config_status: 'Active',
  },
  {
    config_id: 'SC-MATT',
    user_id: 'matt-mccormick',
    specialist_name: 'Matt McCormick',
    territory_id: 'T2', // Primary territory; also covers T4
    origin_zip: '50047',
    office_days: ['Monday', 'Friday'],
    field_days: ['Tuesday', 'Wednesday', 'Thursday'],
    tier_map: [
      { zone_id: 'T2-Z1', tier: 'I', drive_minutes: 15, slots_per_day: 6, first_slot: '9:30', last_slot: '5:00' },
      { zone_id: 'T2-Z2', tier: 'II', drive_minutes: 35, slots_per_day: 5, first_slot: '10:00', last_slot: '4:00' },
      { zone_id: 'T4-Z1', tier: 'II', drive_minutes: 50, slots_per_day: 5, first_slot: '10:00', last_slot: '4:00' },
      { zone_id: 'T4-Z2', tier: 'III', drive_minutes: 75, slots_per_day: 4, first_slot: '10:30', last_slot: '3:00' },
    ],
    slot_templates: [SLOT_TEMPLATES.I, SLOT_TEMPLATES.II, SLOT_TEMPLATES.III],
    meeting_criteria: {
      field: { active_la: true, intra_territory: true, max_age: 95 },
      office: { active_la: true, outer_zone: true },
    },
    zone_lead_criteria: { active_medicare_all: true, active_la_80plus: true, no_core_under_80: true },
    team: [],
    config_status: 'Active',
  },
  {
    config_id: 'SC-JDM',
    user_id: 'josh-millang',
    specialist_name: 'Josh D. Millang',
    territory_id: 'T5',
    origin_zip: '50325',
    office_days: ['Monday', 'Friday'],
    field_days: ['Tuesday', 'Wednesday', 'Thursday'],
    tier_map: [
      { zone_id: 'T5-Z1', tier: 'II', drive_minutes: 60, slots_per_day: 5, first_slot: '10:00', last_slot: '4:00' },
      { zone_id: 'T5-Z2', tier: 'III', drive_minutes: 90, slots_per_day: 4, first_slot: '10:30', last_slot: '3:00' },
      { zone_id: 'T5-Z3', tier: 'IV', drive_minutes: 120, slots_per_day: 6, first_slot: '9:00', last_slot: '4:30' },
    ],
    slot_templates: [SLOT_TEMPLATES.II, SLOT_TEMPLATES.III, SLOT_TEMPLATES.IV],
    meeting_criteria: {
      field: { active_la: true, intra_territory: true, max_age: 95 },
      office: { active_la: true, outer_zone: true },
    },
    zone_lead_criteria: { active_medicare_all: true, active_la_80plus: true, no_core_under_80: true },
    team: [],
    config_status: 'Active',
  },
]

// ============================================================================
// Seeding Functions
// ============================================================================

async function seedTerritories() {
  console.log(`\nSeeding ${TERRITORIES.length} territories...`)
  for (const t of TERRITORIES) {
    const now = new Date().toISOString()
    const data = {
      territory_id: t.territory_id,
      territory_name: t.territory_name,
      state: t.state,
      counties: t.counties,
      zones: t.zones,
      territory_status: 'Active' as const,
      created_at: now,
      updated_at: now,
      _created_by: 'seed-prozone',
    }

    if (DRY_RUN) {
      console.log(`  [DRY RUN] Would create territory ${t.territory_id}: ${t.territory_name} (${t.counties.length} counties, ${t.zones.length} zones)`)
    } else {
      await db.collection('territories').doc(t.territory_id).set(data)
      console.log(`  Created territory ${t.territory_id}: ${t.territory_name} (${t.counties.length} counties, ${t.zones.length} zones)`)
    }
  }
}

async function seedSpecialistConfigs() {
  console.log(`\nSeeding ${SPECIALISTS.length} specialist configs...`)
  for (const s of SPECIALISTS) {
    const now = new Date().toISOString()
    const data = {
      ...s,
      created_at: now,
      updated_at: now,
      _created_by: 'seed-prozone',
    }

    if (DRY_RUN) {
      console.log(`  [DRY RUN] Would create config ${s.config_id}: ${s.specialist_name} (territory ${s.territory_id}, ${s.tier_map.length} zone mappings)`)
    } else {
      await db.collection('specialist_configs').doc(s.config_id).set(data)
      console.log(`  Created config ${s.config_id}: ${s.specialist_name} (territory ${s.territory_id}, ${s.tier_map.length} zone mappings)`)
    }
  }
}

async function updateClientTerritories() {
  console.log('\nUpdating Iowa client territory assignments...')

  // Build county -> { territory_id, zone_id } lookup
  const countyLookup = new Map<string, { territory_id: string; zone_id: string }>()
  for (const t of TERRITORIES) {
    for (const c of t.counties) {
      countyLookup.set(c.county.toLowerCase(), { territory_id: t.territory_id, zone_id: c.zone_id })
    }
  }

  // Query all Iowa clients that are Active or Active - Internal
  const snap = await db.collection('clients')
    .where('state', '==', 'IA')
    .get()

  const activeClients = snap.docs.filter(doc => {
    const status = (doc.data().client_status as string) || ''
    return status === 'Active' || status === 'Active - Internal'
  })

  console.log(`  Found ${activeClients.length} active Iowa clients`)

  let updated = 0
  let skipped = 0
  let batches = 0
  let batch = db.batch()
  let batchCount = 0

  for (const doc of activeClients) {
    const data = doc.data()
    const county = ((data.county as string) || '').trim()
    const lookup = countyLookup.get(county.toLowerCase())

    if (!lookup) {
      skipped++
      continue
    }

    if (DRY_RUN) {
      updated++
      continue
    }

    batch.update(doc.ref, {
      territory_id: lookup.territory_id,
      zone_id: lookup.zone_id,
      updated_at: new Date().toISOString(),
    })

    batchCount++
    updated++

    if (batchCount >= BATCH_LIMIT) {
      await batch.commit()
      batches++
      batch = db.batch()
      batchCount = 0
    }
  }

  if (!DRY_RUN && batchCount > 0) {
    await batch.commit()
    batches++
  }

  const prefix = DRY_RUN ? '[DRY RUN] Would update' : 'Updated'
  console.log(`  ${prefix} ${updated} clients, skipped ${skipped} (county not in any territory)`)
  if (!DRY_RUN) console.log(`  Committed ${batches} batch(es)`)
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log('=== ProZone Seed Script ===')
  if (DRY_RUN) console.log('*** DRY RUN MODE — no writes ***')

  if (!CLIENTS_ONLY) {
    await seedTerritories()
    await seedSpecialistConfigs()
  }

  await updateClientTerritories()

  console.log('\nDone.')
}

main().catch(err => {
  console.error('Seed failed:', err)
  process.exit(1)
})
