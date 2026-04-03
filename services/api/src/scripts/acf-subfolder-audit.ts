#!/usr/bin/env npx tsx
/**
 * ACF Subfolder Audit & Creation
 * 
 * Scans all ACF folders, checks for the 5 lifecycle subfolders,
 * reports what's missing, creates them in live mode.
 * 
 * Usage:
 *   npx tsx /tmp/acf-subfolder-audit.ts --dry-run    # Report only
 *   npx tsx /tmp/acf-subfolder-audit.ts               # Create missing subfolders
 */

import { google } from 'googleapis'
import { readFileSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'

const ACF_ROOT = '1g3lyRPnsWu0opfyv0vUiZTBEJoEhrP4m'
const REQUIRED_SUBFOLDERS = ['Client', 'NewBiz', 'Cases', 'Account', 'Reactive']
const DRY_RUN = process.argv.includes('--dry-run')

const keysPath = join(homedir(), '.config', 'rpi-mcp', 'gcp-oauth.keys.json')
const tokensPath = join(homedir(), '.config', 'google-drive-mcp', 'tokens.json')
const keys = JSON.parse(readFileSync(keysPath, 'utf-8'))
const tokens = JSON.parse(readFileSync(tokensPath, 'utf-8'))
const oauth2 = new google.auth.OAuth2(keys.installed.client_id, keys.installed.client_secret)
oauth2.setCredentials({
  access_token: tokens.access_token,
  refresh_token: tokens.refresh_token,
  expiry_date: tokens.expiry_date,
})
const drive = google.drive({ version: 'v3', auth: oauth2 })

async function main() {
  console.log(`📂 ACF Subfolder ${DRY_RUN ? '🔍 DRY RUN' : '⚡ LIVE'}`)
  console.log(`   Required subfolders: ${REQUIRED_SUBFOLDERS.join(', ')}`)
  console.log(`📁 Parent: Active Client Files (${ACF_ROOT})`)

  // List all ACF folders
  let allFolders: Array<{ id: string; name: string }> = []
  let pageToken: string | undefined
  do {
    const res = await drive.files.list({
      q: `'${ACF_ROOT}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      fields: 'nextPageToken, files(id, name)',
      pageSize: 1000,
      pageToken,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    })
    allFolders.push(...(res.data.files || []).map(f => ({ id: f.id!, name: f.name! })))
    pageToken = res.data.nextPageToken || undefined
  } while (pageToken)

  console.log(`   ${allFolders.length} ACF folders found`)
  console.log()

  // Check each ACF for subfolders
  const stats = {
    perfect: 0,
    missing_some: 0,
    missing_all: 0,
    to_create: {} as Record<string, number>,
  }
  REQUIRED_SUBFOLDERS.forEach(sf => stats.to_create[sf] = 0)

  let checked = 0
  for (const folder of allFolders) {
    // List subfolders of this ACF
    const subRes = await drive.files.list({
      q: `'${folder.id}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      fields: 'files(id, name)',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    })
    const existing = new Set((subRes.data.files || []).map(f => f.name!))
    
    const missing = REQUIRED_SUBFOLDERS.filter(sf => !existing.has(sf))
    
    if (missing.length === 0) {
      stats.perfect++
    } else if (missing.length === REQUIRED_SUBFOLDERS.length) {
      stats.missing_all++
      missing.forEach(sf => stats.to_create[sf]++)
    } else {
      stats.missing_some++
      missing.forEach(sf => stats.to_create[sf]++)
    }

    if (missing.length > 0 && !DRY_RUN) {
      for (const sf of missing) {
        await drive.files.create({
          requestBody: {
            name: sf,
            mimeType: 'application/vnd.google-apps.folder',
            parents: [folder.id],
          },
          supportsAllDrives: true,
        })
      }
    }

    checked++
    if (checked % 100 === 0) {
      console.log(`   Checked ${checked}/${allFolders.length}...`)
    }
  }

  console.log()
  console.log('════════════════════════════════════════════════════════════')
  console.log('📊 SUBFOLDER AUDIT SUMMARY')
  console.log('════════════════════════════════════════════════════════════')
  console.log(`   Total ACF folders:          ${allFolders.length}`)
  console.log(`   Already complete (all 5):   ${stats.perfect}`)
  console.log(`   Missing some subfolders:    ${stats.missing_some}`)
  console.log(`   Missing ALL subfolders:     ${stats.missing_all}`)
  console.log()
  console.log('   Subfolders to create:')
  REQUIRED_SUBFOLDERS.forEach(sf => {
    console.log(`     ${sf.padEnd(12)} ${stats.to_create[sf]}`)
  })
  const total = Object.values(stats.to_create).reduce((a, b) => a + b, 0)
  console.log(`     ${'TOTAL'.padEnd(12)} ${total}`)
  console.log('════════════════════════════════════════════════════════════')
  if (DRY_RUN) {
    console.log('💡 Run without --dry-run to create missing subfolders.')
  } else {
    console.log(`✅ Created ${total} subfolders across ${stats.missing_some + stats.missing_all} ACFs.`)
  }
}

main().catch(err => { console.error('Error:', err.message); process.exit(1) })
