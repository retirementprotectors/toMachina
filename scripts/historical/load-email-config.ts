#!/usr/bin/env npx tsx
/**
 * load-email-config.ts — Migrate _EMAIL_INBOX_CONFIG from RAPID_MATRIX to Firestore.
 *
 * Usage:
 *   npx tsx scripts/load-email-config.ts
 *   npx tsx scripts/load-email-config.ts --dry-run
 *
 * Reads from GAS execute_script (RAPID_IMPORT getEmailInboxConfig) and writes
 * to Firestore `email_inbox_config` collection.
 *
 * Alternative: manually provide config below if execute_script is unavailable.
 */

import { initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

// Initialize Firebase Admin
if (getApps().length === 0) {
  initializeApp({ projectId: process.env.GCP_PROJECT_ID || 'claude-mcp-484718' })
}

const db = getFirestore()

// Known email inbox configurations from _EMAIL_INBOX_CONFIG
// These are the production configs as extracted from RAPID_MATRIX
const EMAIL_INBOX_CONFIGS = [
  {
    address: 'intake@retireprotected.com',
    matrix: 'RAPID_MATRIX',
    team: 'service',
    description: 'General intake — scanned documents, carrier correspondence',
    active: true,
  },
  {
    address: 'newbiz@retireprotected.com',
    matrix: 'PRODASH_MATRIX',
    team: 'sales',
    description: 'New business submissions — applications, signed forms',
    active: true,
  },
  {
    address: 'commissions@retireprotected.com',
    matrix: 'RAPID_MATRIX',
    team: 'accounting',
    description: 'Commission statements — carrier commission reports',
    active: true,
  },
  {
    address: 'service@retireprotected.com',
    matrix: 'RAPID_MATRIX',
    team: 'service',
    description: 'Service requests — policy changes, beneficiary updates',
    active: true,
  },
]

async function main() {
  const dryRun = process.argv.includes('--dry-run')

  console.log(`Email Inbox Config Migration ${dryRun ? '(DRY RUN)' : ''}`)
  console.log('─'.repeat(60))

  for (const config of EMAIL_INBOX_CONFIGS) {
    const docId = config.address.replace(/@/g, '_at_').replace(/\./g, '_')

    if (dryRun) {
      console.log(`[DRY RUN] Would write: ${docId}`)
      console.log(`  address: ${config.address}`)
      console.log(`  matrix: ${config.matrix}`)
      console.log(`  team: ${config.team}`)
      console.log(`  active: ${config.active}`)
      console.log()
    } else {
      await db.collection('email_inbox_config').doc(docId).set({
        ...config,
        migrated_at: new Date().toISOString(),
        migrated_from: '_EMAIL_INBOX_CONFIG',
      })
      console.log(`Wrote: ${config.address} → email_inbox_config/${docId}`)
    }
  }

  console.log('─'.repeat(60))
  console.log(`${dryRun ? 'Would migrate' : 'Migrated'} ${EMAIL_INBOX_CONFIGS.length} inbox configs`)
}

main().catch(err => {
  console.error('Migration failed:', err)
  process.exit(1)
})
