// ============================================================================
// GUARDIAN Forensics — TRK-244
// Queries BigQuery for change history, detecting data destruction patterns.
// Run: npx tsx services/api/src/scripts/guardian-forensics.ts
// ============================================================================

import { initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { BigQuery } from '@google-cloud/bigquery'
import { COLLECTION_SCHEMAS } from '@tomachina/core/validation/collection-schemas'

if (getApps().length === 0) {
  initializeApp({ projectId: 'claude-mcp-484718' })
}
const _db = getFirestore() // Available if needed for cross-checks
const bq = new BigQuery({ projectId: 'claude-mcp-484718' })

const DATASET = 'toMachina'
const TABLE = 'firestore_changes'
const FULL_TABLE = `\`claude-mcp-484718.${DATASET}.${TABLE}\``

// ── Helpers ────────────────────────────────────────────────────────────────

interface QueryResult {
  title: string
  count: number
  samples: Record<string, unknown>[]
}

async function runQuery(title: string, sql: string, maxSamples = 5): Promise<QueryResult> {
  try {
    const [rows] = await bq.query({ query: sql })
    return {
      title,
      count: rows.length,
      samples: rows.slice(0, maxSamples) as Record<string, unknown>[],
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('Not found') || msg.includes('notFound') || msg.includes('404')) {
      throw new Error('TABLE_NOT_FOUND')
    }
    throw err
  }
}

function printResult(result: QueryResult) {
  console.log(`\n${'─'.repeat(60)}`)
  console.log(`  ${result.title}`)
  console.log(`${'─'.repeat(60)}`)
  console.log(`  Total found: ${result.count}`)

  if (result.count === 0) {
    console.log('  (none)')
    return
  }

  console.log(`  Showing ${Math.min(result.samples.length, 5)} samples:`)
  for (const row of result.samples) {
    console.log(`    ${JSON.stringify(row)}`)
  }
}

// ── Forensic Queries ──────────────────────────────────────────────────────

async function charterNaicDestruction(): Promise<QueryResult> {
  const sql = `
    WITH ordered_writes AS (
      SELECT
        document_id,
        collection,
        timestamp,
        JSON_VALUE(data_json, '$.charter') AS charter,
        JSON_VALUE(data_json, '$.naic') AS naic,
        LAG(JSON_VALUE(data_json, '$.charter')) OVER (
          PARTITION BY document_id ORDER BY timestamp
        ) AS prev_charter,
        LAG(JSON_VALUE(data_json, '$.naic')) OVER (
          PARTITION BY document_id ORDER BY timestamp
        ) AS prev_naic
      FROM ${FULL_TABLE}
      WHERE collection IN ('accounts', 'accounts_life', 'accounts_investments')
    )
    SELECT
      document_id,
      collection,
      timestamp,
      prev_charter,
      charter AS current_charter,
      prev_naic,
      naic AS current_naic
    FROM ordered_writes
    WHERE
      ((prev_charter IS NOT NULL AND prev_charter != '')
        AND (charter IS NULL OR charter = ''))
      OR
      ((prev_naic IS NOT NULL AND prev_naic != '')
        AND (naic IS NULL OR naic = ''))
    ORDER BY timestamp DESC
    LIMIT 50
  `
  return runQuery('Charter/NAIC Destruction (field nullified after having value)', sql, 5)
}

async function bulkWriteDetection(): Promise<QueryResult> {
  const sql = `
    SELECT
      collection,
      TIMESTAMP_TRUNC(timestamp, MINUTE) AS window_start,
      COUNT(*) AS write_count,
      COUNT(DISTINCT document_id) AS unique_docs,
      ARRAY_AGG(DISTINCT operation LIMIT 5) AS operations
    FROM ${FULL_TABLE}
    GROUP BY collection, window_start
    HAVING write_count > 50
    ORDER BY write_count DESC
    LIMIT 20
  `
  return runQuery('Bulk Write Detection (>50 writes in 1-minute window)', sql, 10)
}

async function schemaViolations(): Promise<QueryResult> {
  // Build CASE statements for required fields per collection
  const cases: string[] = []

  for (const [collection, schema] of Object.entries(COLLECTION_SCHEMAS) as [string, { required: string[] }][]) {
    for (const field of schema.required) {
      cases.push(
        `WHEN collection = '${collection}' AND (JSON_VALUE(data_json, '$.${field}') IS NULL OR JSON_VALUE(data_json, '$.${field}') = '') THEN STRUCT('${collection}' AS coll, '${field}' AS missing_field, document_id AS did)`
      )
    }
  }

  if (cases.length === 0) {
    return { title: 'Schema Violations', count: 0, samples: [] }
  }

  // Simpler approach: query each collection separately and union
  const unions: string[] = []
  for (const [collection, schema] of Object.entries(COLLECTION_SCHEMAS) as [string, { required: string[] }][]) {
    for (const field of schema.required) {
      unions.push(`
        SELECT '${collection}' AS collection, '${field}' AS missing_field, document_id, timestamp
        FROM ${FULL_TABLE}
        WHERE collection = '${collection}'
          AND operation = 'create'
          AND (JSON_VALUE(data_json, '$.${field}') IS NULL OR JSON_VALUE(data_json, '$.${field}') = '')
      `)
    }
  }

  const sql = `
    WITH violations AS (
      ${unions.join('\n      UNION ALL\n      ')}
    )
    SELECT collection, missing_field, COUNT(*) AS violation_count
    FROM violations
    GROUP BY collection, missing_field
    ORDER BY violation_count DESC
    LIMIT 30
  `
  return runQuery('Schema Violations (required fields missing on create)', sql, 10)
}

async function orphanDetection(): Promise<QueryResult> {
  const sql = `
    WITH latest_accounts AS (
      SELECT
        document_id,
        JSON_VALUE(data_json, '$.client_id') AS client_id,
        ROW_NUMBER() OVER (PARTITION BY document_id ORDER BY timestamp DESC) AS rn
      FROM ${FULL_TABLE}
      WHERE collection IN ('accounts', 'accounts_life', 'accounts_investments')
        AND operation != 'delete'
    ),
    latest_clients AS (
      SELECT DISTINCT document_id AS client_id
      FROM ${FULL_TABLE}
      WHERE collection = 'clients'
        AND operation != 'delete'
    )
    SELECT a.document_id, a.client_id
    FROM latest_accounts a
    LEFT JOIN latest_clients c ON a.client_id = c.client_id
    WHERE a.rn = 1
      AND a.client_id IS NOT NULL
      AND c.client_id IS NULL
    LIMIT 50
  `
  return runQuery('Orphan Accounts (client_id references non-existent client)', sql, 5)
}

async function duplicateDetection(): Promise<QueryResult> {
  const sql = `
    WITH latest_clients AS (
      SELECT
        document_id,
        JSON_VALUE(data_json, '$.first_name') AS first_name,
        JSON_VALUE(data_json, '$.last_name') AS last_name,
        JSON_VALUE(data_json, '$.dob') AS dob,
        ROW_NUMBER() OVER (PARTITION BY document_id ORDER BY timestamp DESC) AS rn
      FROM ${FULL_TABLE}
      WHERE collection = 'clients'
        AND operation != 'delete'
    )
    SELECT
      first_name,
      last_name,
      dob,
      COUNT(*) AS duplicate_count,
      ARRAY_AGG(document_id LIMIT 5) AS document_ids
    FROM latest_clients
    WHERE rn = 1
      AND first_name IS NOT NULL
      AND last_name IS NOT NULL
      AND dob IS NOT NULL
    GROUP BY first_name, last_name, dob
    HAVING duplicate_count > 1
    ORDER BY duplicate_count DESC
    LIMIT 20
  `
  return runQuery('Duplicate Clients (same first_name + last_name + dob)', sql, 10)
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== GUARDIAN FORENSICS ===')
  console.log(`Timestamp: ${new Date().toISOString()}`)
  console.log(`Dataset: ${DATASET}.${TABLE}\n`)

  try {
    // Test table existence with a cheap query
    await bq.query({ query: `SELECT 1 FROM ${FULL_TABLE} LIMIT 1` })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('Not found') || msg.includes('notFound') || msg.includes('404')) {
      console.log('BigQuery table not found — skipping forensics')
      console.log(`Expected: ${DATASET}.${TABLE}`)
      console.log('Create the table via BigQuery streaming Cloud Functions first.')
      return
    }
    throw err
  }

  console.log('BigQuery table found. Detecting monitoring window...\n')

  // Detect monitoring window
  let windowStart = 'unknown'
  let windowEnd = 'unknown'
  let windowDays = 0
  let totalChanges = 0
  try {
    const [windowRows] = await bq.query({
      query: `SELECT MIN(timestamp) as earliest, MAX(timestamp) as latest, COUNT(*) as total_changes FROM ${FULL_TABLE}`
    })
    if (windowRows.length > 0) {
      const row = windowRows[0] as Record<string, { value?: string } | number>
      const earliest = row.earliest
      const latest = row.latest
      windowStart = earliest && typeof earliest === 'object' && earliest.value
        ? new Date(earliest.value).toISOString().split('T')[0]
        : String(earliest || 'unknown')
      windowEnd = latest && typeof latest === 'object' && latest.value
        ? new Date(latest.value).toISOString().split('T')[0]
        : String(latest || 'unknown')
      totalChanges = Number(row.total_changes) || 0
      if (windowStart !== 'unknown' && windowEnd !== 'unknown') {
        windowDays = Math.ceil((new Date(windowEnd).getTime() - new Date(windowStart).getTime()) / 86400000)
      }
    }
  } catch { /* non-fatal */ }

  console.log(`  MONITORING WINDOW: ${windowStart} to ${windowEnd} (${windowDays} days)`)
  console.log(`  Total changes recorded: ${totalChanges}`)
  console.log(`  ⚠ Changes before ${windowStart} are NOT visible.\n`)

  console.log('Running forensic queries...\n')

  const queries = [
    charterNaicDestruction,
    bulkWriteDetection,
    schemaViolations,
    orphanDetection,
    duplicateDetection,
  ]

  const results: QueryResult[] = []

  for (const queryFn of queries) {
    try {
      const result = await queryFn()
      results.push(result)
      printResult(result)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg === 'TABLE_NOT_FOUND') {
        console.log('BigQuery table not found — skipping forensics')
        return
      }
      console.error(`  Query failed: ${msg}`)
      results.push({ title: 'QUERY_ERROR', count: 0, samples: [{ error: msg }] })
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60))
  console.log('FORENSICS SUMMARY')
  console.log('='.repeat(60))

  let totalIssues = 0
  for (const r of results) {
    const status = r.count === 0 ? `NO ISSUES IN WINDOW (${windowStart} to ${windowEnd})` : `${r.count} found`
    console.log(`  ${r.title.split('(')[0].trim().padEnd(45)} ${status}`)
    totalIssues += r.count
  }

  console.log(`\n  Total issues in window: ${totalIssues}`)
  console.log(`\n  NOTE: These checks only cover changes recorded in BigQuery (${windowStart} to ${windowEnd}).`)
  console.log('  For current-state structural analysis, run: npx tsx services/api/src/scripts/guardian-structural.ts')
  console.log('Done.')
}

main().catch((err) => {
  console.error('Forensics failed:', err)
  process.exit(1)
})
