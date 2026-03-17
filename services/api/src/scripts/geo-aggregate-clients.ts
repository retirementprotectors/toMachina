/**
 * Geographic Client Aggregation for ProZone Territory Building
 *
 * Pulls all active clients from Firestore, calculates ages, and aggregates
 * by state > city > zip with age bucket breakdowns for zone/territory planning.
 *
 * Age Buckets (ProZone criteria):
 *   - 60-64: Pre-Medicare prospects (approaching eligibility)
 *   - 65-80: Active Medicare/retirement clients (core service)
 *   - <60: Younger clients (growth / legacy)
 *   - 80+: Senior clients (office-day priority)
 *
 * Usage:
 *   cd ~/Projects/toMachina
 *   npx tsx services/api/src/scripts/geo-aggregate-clients.ts
 *   npx tsx services/api/src/scripts/geo-aggregate-clients.ts --state IA
 *   npx tsx services/api/src/scripts/geo-aggregate-clients.ts --csv
 */

import { initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

if (getApps().length === 0) initializeApp({ projectId: 'claude-mcp-484718' })
const db = getFirestore()

const STATE_FILTER = process.argv.find(a => a === '--state')
  ? process.argv[process.argv.indexOf('--state') + 1]?.toUpperCase()
  : null
const CSV_MODE = process.argv.includes('--csv')

interface GeoRow {
  client_id: string
  first_name: string
  last_name: string
  city: string
  state: string
  zip: string
  age: number | null
  dob: string
  client_status: string
  source: string
  assigned_user_id: string
  household_id: string
}

interface AgeBuckets {
  under60: number
  age60to64: number
  age65to80: number
  age80plus: number
  unknown: number
  total: number
}

interface CityCluster {
  city: string
  state: string
  zips: Set<string>
  buckets: AgeBuckets
  clients: GeoRow[]
}

function calcAge(dob: string | undefined | null): number | null {
  if (!dob) return null
  const d = new Date(dob)
  if (isNaN(d.getTime())) return null
  const today = new Date()
  let age = today.getFullYear() - d.getFullYear()
  const monthDiff = today.getMonth() - d.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < d.getDate())) age--
  return age >= 0 && age < 120 ? age : null
}

function bucketAge(age: number | null): keyof AgeBuckets {
  if (age === null) return 'unknown'
  if (age < 60) return 'under60'
  if (age < 65) return 'age60to64'
  if (age <= 80) return 'age65to80'
  return 'age80plus'
}

function emptyBuckets(): AgeBuckets {
  return { under60: 0, age60to64: 0, age65to80: 0, age80plus: 0, unknown: 0, total: 0 }
}

async function main() {
  console.log('\n=== ProZone Geographic Client Aggregation ===\n')

  const activeStatuses = ['Active', 'Active - Internal', 'Active - External']
  const allClients: GeoRow[] = []

  for (const status of activeStatuses) {
    const snap = await db.collection('clients')
      .where('client_status', '==', status)
      .get()

    for (const doc of snap.docs) {
      const d = doc.data()
      const state = (d.state || '').toUpperCase().trim()
      if (STATE_FILTER && state !== STATE_FILTER) continue

      allClients.push({
        client_id: doc.id,
        first_name: d.first_name || '',
        last_name: d.last_name || '',
        city: (d.city || '').trim(),
        state,
        zip: (d.zip || '').trim().slice(0, 5),
        age: calcAge(d.dob),
        dob: d.dob || '',
        client_status: d.client_status || '',
        source: d.source || d._source || '',
        assigned_user_id: d.assigned_user_id || '',
        household_id: d.household_id || '',
      })
    }
  }

  console.log(`Total active clients loaded: ${allClients.length}`)
  if (STATE_FILTER) console.log(`Filtered to state: ${STATE_FILTER}`)

  const missingCity = allClients.filter(c => !c.city).length
  const missingState = allClients.filter(c => !c.state).length
  const missingZip = allClients.filter(c => !c.zip).length
  const missingDob = allClients.filter(c => c.age === null).length
  console.log(`\nData quality: ${missingCity} missing city, ${missingState} missing state, ${missingZip} missing zip, ${missingDob} missing DOB`)

  // State summary
  const stateMap = new Map<string, AgeBuckets>()
  for (const c of allClients) {
    const st = c.state || '(blank)'
    if (!stateMap.has(st)) stateMap.set(st, emptyBuckets())
    const b = stateMap.get(st)!
    b[bucketAge(c.age)]++
    b.total++
  }

  console.log('\n--- STATE SUMMARY ---')
  console.log('State    | Total | <60  | 60-64 | 65-80 | 80+  | No DOB')
  console.log('---------|-------|------|-------|-------|------|-------')
  const sortedStates = [...stateMap.entries()].sort((a, b) => b[1].total - a[1].total)
  for (const [state, b] of sortedStates) {
    console.log(
      `${state.padEnd(9)}| ${String(b.total).padStart(5)} | ${String(b.under60).padStart(4)} | ${String(b.age60to64).padStart(5)} | ${String(b.age65to80).padStart(5)} | ${String(b.age80plus).padStart(4)} | ${String(b.unknown).padStart(5)}`
    )
  }

  // City-level aggregation
  const cityMap = new Map<string, CityCluster>()
  for (const c of allClients) {
    const key = `${c.city.toUpperCase()}|${c.state}`
    if (!cityMap.has(key)) {
      cityMap.set(key, {
        city: c.city || '(blank)',
        state: c.state || '(blank)',
        zips: new Set(),
        buckets: emptyBuckets(),
        clients: [],
      })
    }
    const cluster = cityMap.get(key)!
    if (c.zip) cluster.zips.add(c.zip)
    cluster.buckets[bucketAge(c.age)]++
    cluster.buckets.total++
    cluster.clients.push(c)
  }

  const sortedCities = [...cityMap.values()].sort((a, b) => b.buckets.total - a.buckets.total)

  console.log('\n--- CITY CLUSTERS (sorted by client count) ---')
  console.log('City                     | St | ZIPs              | Total | <60  | 60-64 | 65-80 | 80+  | No DOB')
  console.log('-------------------------|-----|-------------------|-------|------|-------|-------|------|-------')
  for (const c of sortedCities) {
    if (c.buckets.total < 2) continue
    const zips = [...c.zips].sort().join(', ')
    const b = c.buckets
    console.log(
      `${c.city.slice(0, 25).padEnd(25)}| ${c.state.padEnd(4)}| ${zips.slice(0, 18).padEnd(18)}| ${String(b.total).padStart(5)} | ${String(b.under60).padStart(4)} | ${String(b.age60to64).padStart(5)} | ${String(b.age65to80).padStart(5)} | ${String(b.age80plus).padStart(4)} | ${String(b.unknown).padStart(5)}`
    )
  }

  const singletons = sortedCities.filter(c => c.buckets.total === 1)
  console.log(`\n(${singletons.length} cities with only 1 client - not shown)`)

  // ZIP-level detail for top cities
  console.log('\n--- ZIP-LEVEL DETAIL (Top 30 cities) ---')
  for (const cluster of sortedCities.slice(0, 30)) {
    if (cluster.buckets.total < 3) continue
    console.log(`\n  ${cluster.city}, ${cluster.state} (${cluster.buckets.total} clients)`)

    const zipGroups = new Map<string, AgeBuckets>()
    for (const c of cluster.clients) {
      const z = c.zip || '(none)'
      if (!zipGroups.has(z)) zipGroups.set(z, emptyBuckets())
      const b = zipGroups.get(z)!
      b[bucketAge(c.age)]++
      b.total++
    }
    for (const [zip, b] of [...zipGroups.entries()].sort((a, b) => b[1].total - a[1].total)) {
      console.log(`    ${zip}: ${b.total} total | <60: ${b.under60} | 60-64: ${b.age60to64} | 65-80: ${b.age65to80} | 80+: ${b.age80plus} | unk: ${b.unknown}`)
    }
  }

  // Source distribution
  console.log('\n--- SOURCE DISTRIBUTION ---')
  const sourceMap = new Map<string, number>()
  for (const c of allClients) {
    const src = c.source || '(blank)'
    sourceMap.set(src, (sourceMap.get(src) || 0) + 1)
  }
  for (const [src, count] of [...sourceMap.entries()].sort((a, b) => b - a)) {
    console.log(`  ${src}: ${count}`)
  }

  // CSV output
  if (CSV_MODE) {
    console.log('\n--- CSV OUTPUT ---')
    console.log('city,state,zip,total,under60,age60to64,age65to80,age80plus,unknown')
    for (const cluster of sortedCities) {
      for (const zip of [...cluster.zips].sort()) {
        const zipClients = cluster.clients.filter(c => c.zip === zip)
        const b = emptyBuckets()
        for (const c of zipClients) { b[bucketAge(c.age)]++; b.total++ }
        console.log(`"${cluster.city}","${cluster.state}","${zip}",${b.total},${b.under60},${b.age60to64},${b.age65to80},${b.age80plus},${b.unknown}`)
      }
    }
  }

  // Iowa ProZone section
  const iowaClients = allClients.filter(c => c.state === 'IA')
  if (iowaClients.length > 0) {
    console.log('\n\n========================================')
    console.log('  IOWA - ProZone Territory Building Data')
    console.log('========================================')

    const iaCities = [...cityMap.values()]
      .filter(c => c.state === 'IA')
      .sort((a, b) => b.buckets.total - a.buckets.total)

    const totalIA = iowaClients.length
    const ia6064 = iowaClients.filter(c => c.age !== null && c.age >= 60 && c.age < 65).length
    const ia6580 = iowaClients.filter(c => c.age !== null && c.age >= 65 && c.age <= 80).length
    const ia80p = iowaClients.filter(c => c.age !== null && c.age > 80).length

    console.log(`\nIowa total: ${totalIA} active clients`)
    console.log(`  60-64 (pre-Medicare prospects): ${ia6064}`)
    console.log(`  65-80 (core service): ${ia6580}`)
    console.log(`  80+ (senior/office priority): ${ia80p}`)

    console.log('\nIowa cities with 2+ clients:')
    console.log('City                     | ZIPs              | Total | 60-64 | 65-80 | 80+')
    console.log('-------------------------|-------------------|-------|-------|-------|-----')
    for (const c of iaCities) {
      if (c.buckets.total < 2) continue
      const zips = [...c.zips].sort().join(', ')
      const b = c.buckets
      console.log(
        `${c.city.slice(0, 25).padEnd(25)}| ${zips.slice(0, 18).padEnd(18)}| ${String(b.total).padStart(5)} | ${String(b.age60to64).padStart(5)} | ${String(b.age65to80).padStart(5)} | ${String(b.age80plus).padStart(3)}`
      )
    }
  }

  console.log('\n=== Done ===\n')
}

main().catch(err => {
  console.error('FATAL:', err)
  process.exit(1)
})
