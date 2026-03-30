/**
 * brain-export.ts — TRK-S03-016
 * Brain File Auto-Export Pipeline
 *
 * Triggered by /export or hookify. Appends session transcript to
 * the warrior's brain.txt file in dojo-warriors/, then commits.
 *
 * Flow:
 * 1. Read the exported transcript from stdin or file arg
 * 2. Redact PHI (SSN, DOB, Medicare ID patterns)
 * 3. Append to dojo-warriors/{warrior}/brain.txt
 * 4. Git commit with timestamp
 */

import * as fs from 'fs'
import * as path from 'path'
import { execSync } from 'child_process'

const DOJO_DIR = '/home/jdm/Projects/dojo-warriors'

// PHI redaction patterns
const PHI_PATTERNS = [
  /\b\d{3}-\d{2}-\d{4}\b/g,           // SSN
  /\b\d{9}\b/g,                         // SSN no dashes
  /\b(0[1-9]|1[0-2])\/(0[1-9]|[12]\d|3[01])\/\d{4}\b/g, // DOB MM/DD/YYYY
  /\b[A-Z]\d{3}-\d{3}-\d{4}-\d{3}\b/g, // Medicare ID (MBI)
  /\b1\w{2}\d\w{2}\d{4}\b/g,           // MBI alternate format
]

function redactPHI(text: string): string {
  let redacted = text
  for (const pattern of PHI_PATTERNS) {
    redacted = redacted.replace(pattern, '[REDACTED]')
  }
  return redacted
}

function getWarriorName(): string {
  // Check env or arg
  const name = process.env.WARRIOR_NAME || process.argv[2] || ''
  if (!name) {
    console.error('[brain-export] WARRIOR_NAME env or arg required')
    process.exit(1)
  }
  return name.toLowerCase()
}

function getTranscriptContent(): string {
  // Read from file arg or stdin
  const filePath = process.argv[3]
  if (filePath && fs.existsSync(filePath)) {
    return fs.readFileSync(filePath, 'utf-8')
  }

  // Try stdin
  try {
    return fs.readFileSync('/dev/stdin', 'utf-8')
  } catch {
    console.error('[brain-export] No transcript provided (file arg or stdin)')
    process.exit(1)
  }
}

async function exportBrain(): Promise<void> {
  const warrior = getWarriorName()
  const warriorDir = path.join(DOJO_DIR, warrior)

  if (!fs.existsSync(warriorDir)) {
    fs.mkdirSync(warriorDir, { recursive: true })
    console.log(`[brain-export] Created ${warriorDir}`)
  }

  const brainPath = path.join(warriorDir, 'brain.txt')
  const transcript = getTranscriptContent()
  const redacted = redactPHI(transcript)

  // Append with separator
  const separator = `\n${'='.repeat(80)}\n BRAIN EXPORT: ${new Date().toISOString()}\n${'='.repeat(80)}\n`
  fs.appendFileSync(brainPath, separator + redacted + '\n')

  const stats = fs.statSync(brainPath)
  console.log(`[brain-export] Appended ${redacted.length} chars to ${warrior}/brain.txt (total: ${stats.size} bytes)`)

  // Git commit
  try {
    execSync(`git -C ${DOJO_DIR} add ${warrior}/brain.txt`, { stdio: 'pipe' })
    execSync(
      `git -C ${DOJO_DIR} commit -m "brain: ${warrior} export ${new Date().toISOString().slice(0, 10)}"`,
      { stdio: 'pipe' }
    )
    console.log(`[brain-export] Committed to dojo-warriors repo`)
  } catch (err) {
    console.log(`[brain-export] Git commit skipped (${err instanceof Error ? err.message : 'no changes'})`)
  }
}

exportBrain()
  .then(() => process.exit(0))
  .catch((err) => { console.error('[brain-export] Fatal:', err); process.exit(1) })
