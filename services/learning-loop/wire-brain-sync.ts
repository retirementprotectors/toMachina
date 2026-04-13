/**
 * wire-brain-sync.ts — ZRD-SYN-011
 * WIRE_BRAIN_SYNC — Daily 2am composition
 *
 * Flow: session-inventory → brain-export → brain-health
 * Auto-appends session transcripts to warrior brain.txt files.
 */

import * as fs from 'fs'
import * as path from 'path'
import { execSync } from 'child_process'
import { trackRun } from './wire-run-tracker.js'

const HOME = process.env.HOME || '/home/jdm'
const DOJO_DIR = path.join(HOME, 'Projects', 'dojo-warriors')
const WARRIORS_DIR = path.join(DOJO_DIR, 'warriors')
const CLAUDE_DIR = path.join(HOME, '.claude')
const SLACK_TOKEN = process.env.SLACK_BOT_TOKEN || ''
const JDM_DM = 'U09BBHTN8F2'
const STALE_DAYS = 7

// PHI redaction patterns
const PHI_PATTERNS = [
  /\b\d{3}-\d{2}-\d{4}\b/g,
  /\b\d{9}\b/g,
  /\b(0[1-9]|1[0-2])\/(0[1-9]|[12]\d|3[01])\/\d{4}\b/g,
  /\b[A-Z]\d{3}-\d{3}-\d{4}-\d{3}\b/g,
  /\b1\w{2}\d\w{2}\d{4}\b/g,
]

function redactPHI(text: string): string {
  let r = text
  for (const p of PHI_PATTERNS) r = r.replace(p, '[REDACTED]')
  return r
}

function safeReadDir(dir: string): string[] {
  try { return fs.readdirSync(dir) } catch { return [] }
}

function daysSince(filePath: string): number {
  try {
    const stat = fs.statSync(filePath)
    return Math.floor((Date.now() - stat.mtime.getTime()) / (1000 * 60 * 60 * 24))
  } catch { return 999 }
}

function needsBrainUpdate(warrior: string): boolean {
  const brainPath = path.join(WARRIORS_DIR, warrior, 'brain.txt')
  if (!fs.existsSync(brainPath)) return true
  return daysSince(brainPath) > STALE_DAYS
}

function findRecentSessionFiles(): string[] {
  const projectsDir = path.join(CLAUDE_DIR, 'projects')
  const allJsonl: Array<{ path: string; mtime: number }> = []

  for (const projDir of safeReadDir(projectsDir)) {
    const projPath = path.join(projectsDir, projDir)
    for (const f of safeReadDir(projPath)) {
      if (!f.endsWith('.jsonl')) continue
      try {
        const stat = fs.statSync(path.join(projPath, f))
        allJsonl.push({ path: path.join(projPath, f), mtime: stat.mtimeMs })
      } catch { /* skip */ }
    }
  }

  return allJsonl
    .sort((a, b) => b.mtime - a.mtime)
    .slice(0, 20)
    .map(f => f.path)
}

function extractWarriorMentions(jsonlPath: string): Set<string> {
  const warriors = new Set<string>()
  try {
    const content = fs.readFileSync(jsonlPath, 'utf-8')
    const lower = content.toLowerCase()
    for (const w of ['shinob1', 'megazord', 'musashi', 'raiden', 'ronin', 'voltron']) {
      if (lower.includes(w)) warriors.add(w)
    }
  } catch { /* skip */ }
  return warriors
}

async function postSlack(text: string): Promise<void> {
  if (!SLACK_TOKEN) { console.log('[brain-sync] No Slack token. Output:\n', text); return }
  await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: { Authorization: `Bearer ${SLACK_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ channel: JDM_DM, text }),
  })
}

async function run(): Promise<void> {
  console.log(`[brain-sync] ${new Date().toISOString()} — WIRE_BRAIN_SYNC starting`)

  const warriorDirs = safeReadDir(WARRIORS_DIR).filter(d => {
    try { return fs.statSync(path.join(WARRIORS_DIR, d)).isDirectory() } catch { return false }
  })

  const recentFiles = findRecentSessionFiles()
  console.log(`[brain-sync] Found ${recentFiles.length} recent session files`)

  const results: Array<{ warrior: string; action: string; lines?: number }> = []

  for (const warrior of warriorDirs) {
    if (!needsBrainUpdate(warrior)) {
      results.push({ warrior, action: 'fresh' })
      continue
    }

    // Find sessions mentioning this warrior
    const relevantFiles = recentFiles.filter(f => {
      const mentions = extractWarriorMentions(f)
      return mentions.has(warrior)
    }).slice(0, 5)

    if (relevantFiles.length === 0) {
      results.push({ warrior, action: 'no-sessions' })
      continue
    }

    // Extract and append
    const brainPath = path.join(WARRIORS_DIR, warrior, 'brain.txt')
    let totalLines = 0

    for (const sessionFile of relevantFiles) {
      try {
        const content = fs.readFileSync(sessionFile, 'utf-8')
        const redacted = redactPHI(content)
        const separator = `\n${'='.repeat(80)}\n BRAIN SYNC: ${new Date().toISOString()} | Source: ${path.basename(sessionFile)}\n${'='.repeat(80)}\n`
        fs.appendFileSync(brainPath, separator + redacted + '\n')
        totalLines += redacted.split('\n').length
      } catch (err) {
        console.error(`[brain-sync] Error processing ${sessionFile}:`, err)
      }
    }

    results.push({ warrior, action: 'synced', lines: totalLines })
    console.log(`[brain-sync] ${warrior}: appended ${totalLines} lines from ${relevantFiles.length} sessions`)
  }

  // Git commit
  try {
    execSync(`git -C "${DOJO_DIR}" add warriors/*/brain.txt`, { stdio: 'pipe' })
    execSync(`git -C "${DOJO_DIR}" commit -m "brain-sync: ${new Date().toISOString().slice(0, 10)} auto-export"`, { stdio: 'pipe' })
    console.log('[brain-sync] Committed to dojo-warriors repo')
  } catch {
    console.log('[brain-sync] Git commit skipped (no changes)')
  }

  // Brain health summary
  const healthLines: string[] = [
    `*:brain: WIRE_BRAIN_SYNC — ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}*\n`,
  ]
  for (const r of results) {
    const brainPath = path.join(WARRIORS_DIR, r.warrior, 'brain.txt')
    const exists = fs.existsSync(brainPath)
    const stat = exists ? fs.statSync(brainPath) : null
    const lines = exists ? fs.readFileSync(brainPath, 'utf-8').split('\n').length : 0
    const sizeKb = stat ? Math.round(stat.size / 1024) : 0
    const emoji = r.action === 'synced' ? ':white_check_mark:' : r.action === 'fresh' ? ':large_green_circle:' : ':warning:'
    healthLines.push(`${emoji} *${r.warrior}*: ${r.action}${r.lines ? ` (+${r.lines} lines)` : ''} — ${lines} total lines (${sizeKb}KB)`)
  }

  await postSlack(healthLines.join('\n'))
  console.log('[brain-sync] Complete')
}

// LL-07: wire-run-tracker wraps main() for dashboard visibility.
trackRun('wire-brain-sync', run)
  .then(() => process.exit(0))
  .catch((err) => { console.error('[brain-sync] Fatal:', err); process.exit(1) })
