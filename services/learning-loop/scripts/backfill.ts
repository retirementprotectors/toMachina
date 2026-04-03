/**
 * Backfill Script — TRK-14171
 *
 * One-time backfill of existing 2.24 GB session data into BigQuery.
 * Reads JSONL files from GCS (air/ + pro/) or local disk.
 * Uses batch loading for large volumes.
 *
 * Usage:
 *   npx tsx scripts/backfill.ts --local /path/to/.claude/projects --machine air
 *   npx tsx scripts/backfill.ts --local /path/to/.claude/projects --machine pro
 *   npx tsx scripts/backfill.ts --dry-run --local /path --machine air
 */

import { parseLocalSessions } from '../session-parser.js'
import { loadSessionsToBigQuery } from '../bigquery-loader.js'

interface BackfillArgs {
  local?: string
  machine: string
  dryRun: boolean
}

function parseArgs(): BackfillArgs {
  const args = process.argv.slice(2)
  const result: BackfillArgs = { machine: 'unknown', dryRun: false }

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--local' && args[i + 1]) {
      result.local = args[++i]
    } else if (args[i] === '--machine' && args[i + 1]) {
      result.machine = args[++i]
    } else if (args[i] === '--dry-run') {
      result.dryRun = true
    }
  }

  return result
}

async function main(): Promise<void> {
  const args = parseArgs()

  if (!args.local) {
    console.error('Usage: npx tsx scripts/backfill.ts --local <path> --machine <air|pro|mdj1> [--dry-run]')
    process.exit(1)
  }

  console.log(`[backfill] Machine: ${args.machine}`)
  console.log(`[backfill] Source: ${args.local}`)
  console.log(`[backfill] Dry run: ${args.dryRun}`)

  // Parse all sessions
  const parsed = parseLocalSessions(args.local, args.machine)

  console.log(`[backfill] Found: ${parsed.sessions.length} sessions, ${parsed.messages.length} messages, ${parsed.toolCalls.length} tool calls`)

  if (args.dryRun) {
    console.log('[backfill] DRY RUN — no data loaded')
    for (const s of parsed.sessions.slice(0, 5)) {
      console.log(`  ${s.session_id}: ${s.message_count} msgs, ${s.tool_call_count} tools`)
    }
    if (parsed.sessions.length > 5) console.log(`  ... and ${parsed.sessions.length - 5} more`)
    return
  }

  // Load into BigQuery
  const result = await loadSessionsToBigQuery(parsed)

  console.log(`[backfill] Complete:`)
  console.log(`  Sessions: ${result.sessionsInserted} inserted, ${result.skipped} skipped`)
  console.log(`  Messages: ${result.messagesInserted} inserted`)
  console.log(`  Tool calls: ${result.toolCallsInserted} inserted`)
  if (result.errors.length > 0) {
    console.error(`  Errors: ${result.errors.length}`)
    for (const e of result.errors) console.error(`    ${e}`)
  }
}

main().catch((err) => {
  console.error('[backfill] Fatal:', err)
  process.exit(1)
})
