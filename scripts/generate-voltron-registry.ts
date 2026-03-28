#!/usr/bin/env npx tsx
// ─── VOLTRON Registry Generator CLI — TRK-13739 ─────────────────────────────
// Usage:
//   npm run generate:voltron-registry              # Generate JSON file
//   npm run generate:voltron-registry -- --dry-run  # Print to stdout only
//
// Parses 4 sources → unified VoltronRegistryEntry[] → JSON output.
// Idempotent: re-runs produce identical output given unchanged sources.
// ─────────────────────────────────────────────────────────────────────────────

import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'fs'
import path from 'path'
import { generateVoltronRegistry } from '../packages/core/src/voltron/registry-generator'
import type { VoltronRegistryEntry } from '../packages/core/src/voltron/types'

const MONOREPO_ROOT = path.resolve(__dirname, '..')
const MDJ_AGENT_ROOT = path.resolve('/home/jdm/mdj-agent')
const OUTPUT_DIR = path.join(MONOREPO_ROOT, 'packages/core/src/voltron/generated')
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'voltron-registry.json')

const isDryRun = process.argv.includes('--dry-run')

// ─── Idempotency helper ─────────────────────────────────────────────────────
// Compare entries ignoring generated_at timestamps.
// If source content hasn't changed, reuse existing timestamp to keep file stable.

function stripTimestamps(entries: VoltronRegistryEntry[]): string {
  const stripped = entries.map(({ generated_at: _ts, ...rest }) => rest)
  return JSON.stringify(stripped)
}

// ─── Run Generator ──────────────────────────────────────────────────────────

console.log('VOLTRON Registry Generator — TRK-13739')
console.log('─'.repeat(50))
console.log(`Monorepo root: ${MONOREPO_ROOT}`)
console.log(`MDJ Agent root: ${MDJ_AGENT_ROOT}`)
console.log(`Mode: ${isDryRun ? 'DRY RUN (stdout only)' : 'GENERATE (write file)'}`)
console.log('')

const result = generateVoltronRegistry({
  monorepoRoot: MONOREPO_ROOT,
  mdjAgentRoot: MDJ_AGENT_ROOT,
})

// ─── Report ─────────────────────────────────────────────────────────────────

console.log('Source Breakdown:')
console.log(`  API Routes:  ${result.stats.api_route} tools`)
console.log(`  Firestore:   ${result.stats.firestore} tools`)
console.log(`  MCP Bridge:  ${result.stats.mcp} tools`)
console.log(`  Voltron:     ${result.stats.voltron} tools`)
console.log(`  ─────────────────────`)
console.log(`  Total:       ${result.stats.total} unique tools`)
if (result.stats.duplicates_merged > 0) {
  console.log(`  Merged:      ${result.stats.duplicates_merged} duplicates`)
}
console.log('')

// ─── Idempotency Check ─────────────────────────────────────────────────────
// If existing output has identical content (ignoring timestamps), reuse the
// existing file's timestamp so the file stays byte-identical across re-runs.

let finalEntries = result.entries

if (!isDryRun && existsSync(OUTPUT_FILE)) {
  try {
    const existing: VoltronRegistryEntry[] = JSON.parse(readFileSync(OUTPUT_FILE, 'utf8'))
    const existingStripped = stripTimestamps(existing)
    const newStripped = stripTimestamps(result.entries)

    if (existingStripped === newStripped) {
      // Content identical — reuse existing timestamps for byte-level idempotency
      finalEntries = existing
      console.log('⚡ Content unchanged — reusing existing timestamps (idempotent)')
      console.log('')
    }
  } catch {
    // Existing file corrupt or unparseable — overwrite with fresh data
  }
}

// ─── Output ─────────────────────────────────────────────────────────────────

const json = JSON.stringify(finalEntries, null, 2)

if (isDryRun) {
  console.log('── Registry Output (dry run) ──')
  console.log(json)
} else {
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true })
  }
  writeFileSync(OUTPUT_FILE, json + '\n', 'utf8')
  console.log(`Written to: ${OUTPUT_FILE}`)
  console.log(`File size: ${Buffer.byteLength(json)} bytes`)
}

console.log('')
console.log('Done.')
