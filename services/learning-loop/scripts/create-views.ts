/**
 * Create BigQuery Views — TRK-14178
 *
 * Runs the SQL from bigquery-views.sql to create analytics views.
 *
 * Usage:
 *   npx tsx scripts/create-views.ts
 *   npx tsx scripts/create-views.ts --dry-run
 */

import { BigQuery } from '@google-cloud/bigquery'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_ID = 'claude-mcp-484718'

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run')
  const sqlPath = join(__dirname, '..', 'schemas', 'bigquery-views.sql')
  const sql = readFileSync(sqlPath, 'utf-8')

  // Split on CREATE OR REPLACE VIEW statements
  const statements = sql
    .split(/(?=CREATE OR REPLACE VIEW)/)
    .map((s) => s.trim())
    .filter((s) => s.startsWith('CREATE'))

  console.log(`[create-views] Found ${statements.length} view definitions`)

  if (dryRun) {
    for (const stmt of statements) {
      const viewName = stmt.match(/`[^`]+`/)?.[0] || 'unknown'
      console.log(`  [DRY RUN] Would create: ${viewName}`)
    }
    return
  }

  const bq = new BigQuery({ projectId: PROJECT_ID })

  for (const stmt of statements) {
    const viewName = stmt.match(/`[^`]+`/)?.[0] || 'unknown'
    try {
      await bq.query({ query: stmt })
      console.log(`  Created: ${viewName}`)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`  Failed: ${viewName} — ${msg}`)
    }
  }

  console.log('[create-views] Done.')
}

main().catch((err) => {
  console.error('[create-views] Fatal:', err)
  process.exit(1)
})
