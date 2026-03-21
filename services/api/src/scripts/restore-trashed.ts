import { google } from 'googleapis'
import { readFileSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'

const ACF_ROOT = '1g3lyRPnsWu0opfyv0vUiZTBEJoEhrP4m'
const LIFECYCLE_SUBS = ['Client', 'Cases', 'NewBiz', 'Account', 'Reactive']

const keys = JSON.parse(readFileSync(join(homedir(), '.config', 'rpi-mcp', 'gcp-oauth.keys.json'), 'utf-8'))
const tokens = JSON.parse(readFileSync(join(homedir(), '.config', 'google-drive-mcp', 'tokens.json'), 'utf-8'))
const oauth2 = new google.auth.OAuth2(keys.installed.client_id, keys.installed.client_secret)
oauth2.setCredentials({ access_token: tokens.access_token, refresh_token: tokens.refresh_token, expiry_date: tokens.expiry_date })
const drive = google.drive({ version: 'v3', auth: oauth2 })

const SEARCH_NAMES = ['Essick', 'Lloyd', 'Sutphin', 'Mick']

async function main() {
  console.log('🔍 Searching Drive trash for ACF folders...\n')

  for (const name of SEARCH_NAMES) {
    // Search for trashed folders matching the name
    const res = await drive.files.list({
      q: `name contains '${name}' and mimeType = 'application/vnd.google-apps.folder' and trashed = true`,
      fields: 'files(id, name, parents, trashed)',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    })

    const matches = res.data.files || []
    if (matches.length === 0) {
      console.log(`❌ ${name}: No trashed folders found`)
      // Also search for non-ACF trashed folders
      const res2 = await drive.files.list({
        q: `name contains '${name}' and trashed = true`,
        fields: 'files(id, name, mimeType)',
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      })
      if ((res2.data.files || []).length > 0) {
        console.log(`   Found trashed items (not folders):`)
        for (const f of res2.data.files || []) {
          console.log(`   - "${f.name}" (${f.mimeType}) ID: ${f.id}`)
        }
      }
      continue
    }

    for (const folder of matches) {
      console.log(`✅ ${name}: Found "${folder.name}" (ID: ${folder.id})`)

      // Restore from trash
      await drive.files.update({
        fileId: folder.id!,
        requestBody: { trashed: false },
        supportsAllDrives: true,
      })
      console.log(`   ↳ Restored from trash`)

      // Check if it's in ACF_ROOT, if not move it there
      if (!folder.parents || !folder.parents.includes(ACF_ROOT)) {
        const currentParents = (folder.parents || []).join(',')
        if (currentParents) {
          await drive.files.update({
            fileId: folder.id!,
            addParents: ACF_ROOT,
            removeParents: currentParents,
            supportsAllDrives: true,
          })
        } else {
          await drive.files.update({
            fileId: folder.id!,
            addParents: ACF_ROOT,
            supportsAllDrives: true,
          })
        }
        console.log(`   ↳ Moved to Active Client Files root`)
      }

      // Fix name if needed
      if (!folder.name!.startsWith('ACF - ')) {
        const newName = `ACF - ${folder.name}`
        await drive.files.update({
          fileId: folder.id!,
          requestBody: { name: newName },
          supportsAllDrives: true,
        })
        console.log(`   ↳ Renamed to "${newName}"`)
      }

      // Check for lifecycle subfolders
      const subRes = await drive.files.list({
        q: `'${folder.id}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
        fields: 'files(id, name)',
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      })
      const existingSubs = new Set((subRes.data.files || []).map(f => f.name))
      const missing = LIFECYCLE_SUBS.filter(s => !existingSubs.has(s))
      if (missing.length > 0) {
        for (const sub of missing) {
          await drive.files.create({
            requestBody: { name: sub, mimeType: 'application/vnd.google-apps.folder', parents: [folder.id!] },
            fields: 'id',
            supportsAllDrives: true,
          })
        }
        console.log(`   ↳ Created missing subfolders: ${missing.join(', ')}`)
      }
      console.log()
    }
  }

  console.log('Done!')
}

main().catch(err => { console.error('Error:', err); process.exit(1) })
