/**
 * Whitepages Ghost Record Enrichment
 *
 * Looks up 62 ghost clients (have phone, no address) via Whitepages API
 * and backfills city, state, zip, county from results.
 *
 * Usage:
 *   cd ~/Projects/toMachina
 *   npx tsx services/api/src/scripts/whitepages-enrich-ghosts.ts --dry-run
 *   npx tsx services/api/src/scripts/whitepages-enrich-ghosts.ts
 */

import { initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'
import { homedir } from 'os'

if (getApps().length === 0) initializeApp({ projectId: 'claude-mcp-484718' })
const db = getFirestore()
const zipcodes = require('zipcodes-nrviens')

const DRY_RUN = process.argv.includes('--dry-run')

// Load API key
const mcpConfig = JSON.parse(readFileSync(homedir() + '/.mcp.json', 'utf8'))
let apiKey = ''
for (const [, cfg] of Object.entries(mcpConfig.mcpServers || {})) {
  const env = (cfg as any).env || {}
  if (env.WHITEPAGES_API_KEY) { apiKey = env.WHITEPAGES_API_KEY; break }
}

async function wpLookup(phone: string): Promise<any[]> {
  const resp = await fetch(`https://api.whitepages.com/v1/person/?phone=${phone}`, {
    headers: { 'X-Api-Key': apiKey, 'Accept': 'application/json' }
  })
  if (!resp.ok) throw new Error(`WP API ${resp.status}`)
  return resp.json() as Promise<any[]>
}

function parseAddress(addr: string): { city: string; state: string; zip: string } | null {
  // Format: "812 8th Ave S Saint Petersburg, FL 33701"
  const match = addr.match(/,\s*([A-Z]{2})\s+(\d{5})/)
  if (!match) return null
  const state = match[1]
  const zip = match[2]
  // City is between last comma-separated part before state
  const parts = addr.split(',')
  if (parts.length < 2) return null
  const cityPart = parts[parts.length - 2] || ''
  // Remove street address — city is the last word(s) before the comma
  const cityWords = cityPart.trim().split(/\s+/)
  // Usually the street portion has numbers, city doesn't. Take everything.
  const city = cityPart.trim().replace(/^\d+\s+\S+(\s+\S+)*\s+/, '') || cityPart.trim()
  return { city, state, zip }
}

async function main() {
  console.log(`\n=== Whitepages Ghost Enrichment ${DRY_RUN ? '(DRY RUN)' : '(LIVE)'} ===\n`)

  if (!apiKey) { console.error('No WHITEPAGES_API_KEY found'); return }

  const activeStatuses = ['Active', 'Active - Internal', 'Active - External']
  const ghosts: { id: string; name: string; phone: string; bob: string }[] = []

  for (const status of activeStatuses) {
    const snap = await db.collection('clients').where('client_status', '==', status).get()
    for (const doc of snap.docs) {
      const d = doc.data()
      if ((d.city || '').trim() || (d.state || '').trim() || (d.zip || '').trim()) continue
      const phone = (d.phone || d.cell_phone || '').replace(/\D/g, '')
      if (phone.length >= 10) {
        ghosts.push({
          id: doc.id,
          name: `${d.first_name || ''} ${d.last_name || ''}`.trim(),
          phone,
          bob: d.book_of_business || '(none)',
        })
      }
    }
  }

  console.log(`Found ${ghosts.length} ghosts with phone numbers`)

  let enriched = 0, failed = 0, noAddress = 0

  for (let i = 0; i < ghosts.length; i++) {
    const g = ghosts[i]
    try {
      // Rate limit: 200ms between calls
      if (i > 0) await new Promise(r => setTimeout(r, 200))

      const results = await wpLookup(g.phone)
      if (!results || results.length === 0) {
        console.log(`  [${i+1}/${ghosts.length}] ${g.name} (${g.phone}) — no results`)
        noAddress++
        continue
      }

      // Take first result's current address
      const person = results[0]
      const addr = person.current_addresses?.[0]?.address
      if (!addr) {
        console.log(`  [${i+1}/${ghosts.length}] ${g.name} — person found but no current address`)
        noAddress++
        continue
      }

      const parsed = parseAddress(addr)
      if (!parsed) {
        console.log(`  [${i+1}/${ghosts.length}] ${g.name} — could not parse: ${addr}`)
        noAddress++
        continue
      }

      // Get county from zip
      const zipLookup = zipcodes.lookup(parsed.zip)
      const county = zipLookup?.county || ''

      const updates: Record<string, string> = {
        city: parsed.city,
        state: parsed.state,
        zip: parsed.zip,
        _wp_enriched_at: new Date().toISOString(),
        _wp_full_address: addr,
        updated_at: new Date().toISOString(),
      }
      if (county) updates.county = county

      console.log(`  [${i+1}/${ghosts.length}] ${g.name} => ${parsed.city}, ${parsed.state} ${parsed.zip} (${county})`)

      if (!DRY_RUN) {
        await db.collection('clients').doc(g.id).update(updates)
      }
      enriched++
    } catch (e: any) {
      console.log(`  [${i+1}/${ghosts.length}] ${g.name} — ERROR: ${e.message}`)
      failed++
    }
  }

  console.log(`\n=== Results ===`)
  console.log(`Enriched: ${enriched}`)
  console.log(`No address found: ${noAddress}`)
  console.log(`Failed: ${failed}`)
  console.log(`Total API calls: ${ghosts.length}`)
  if (DRY_RUN) console.log('\n[DRY RUN] No changes written.')
}

main().catch(e => { console.error('FATAL:', e); process.exit(1) })
