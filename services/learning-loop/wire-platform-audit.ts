/**
 * wire-platform-audit.ts — ZRD-SYN-012
 * WIRE_PLATFORM_AUDIT — Weekly Sunday 3am composition
 *
 * Auto-deletes orphaned session-envs > 30 days.
 * Detects memory duplicates. Checks hookify health.
 * Posts cleanup report to JDM DM.
 */

import * as fs from 'fs'
import * as path from 'path'

const HOME = process.env.HOME || '/home/jdm'
const CLAUDE_DIR = path.join(HOME, '.claude')
const PROJECTS_DIR = path.join(HOME, 'Projects')
const SLACK_TOKEN = process.env.SLACK_BOT_TOKEN || ''
const JDM_DM = 'U09BBHTN8F2'
const ORPHAN_AGE_DAYS = 30
const JACCARD_THRESHOLD = 0.6

function safeReadDir(dir: string): string[] {
  try { return fs.readdirSync(dir) } catch { return [] }
}

function daysSince(filePath: string): number {
  try {
    return Math.floor((Date.now() - fs.statSync(filePath).mtime.getTime()) / (1000 * 60 * 60 * 24))
  } catch { return 0 }
}

function jaccardSimilarity(a: string, b: string): number {
  const setA = new Set(a.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/))
  const setB = new Set(b.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/))
  const intersection = new Set([...setA].filter(x => setB.has(x)))
  const union = new Set([...setA, ...setB])
  return union.size === 0 ? 0 : intersection.size / union.size
}

// ─── Phase 1: Session-env audit + cleanup ─────────────────────────────────────

function auditSessionEnvs(): { total: number; orphaned: number; deleted: number; deletedIds: string[] } {
  const sessionEnvDir = path.join(CLAUDE_DIR, 'session-env')
  const envDirs = safeReadDir(sessionEnvDir)

  // Get active session IDs
  const sessionsDir = path.join(CLAUDE_DIR, 'sessions')
  const activeIds = new Set<string>()
  for (const f of safeReadDir(sessionsDir).filter(f => f.endsWith('.json'))) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(sessionsDir, f), 'utf-8'))
      if (data.sessionId) activeIds.add(data.sessionId)
    } catch { /* skip */ }
  }

  let orphaned = 0
  let deleted = 0
  const deletedIds: string[] = []

  for (const dir of envDirs) {
    if (activeIds.has(dir)) continue
    orphaned++

    const dirPath = path.join(sessionEnvDir, dir)
    const age = daysSince(dirPath)

    if (age > ORPHAN_AGE_DAYS) {
      try {
        fs.rmSync(dirPath, { recursive: true, force: true })
        deleted++
        deletedIds.push(`${dir} (${age}d old)`)
        console.log(`[platform-audit] Deleted orphan: ${dir} (${age} days old)`)
      } catch (err) {
        console.error(`[platform-audit] Failed to delete ${dir}:`, err)
      }
    }
  }

  return { total: envDirs.length, orphaned, deleted, deletedIds }
}

// ─── Phase 2: Duplicate detector ──────────────────────────────────────────────

function detectDuplicates(): Array<{ name: string; locations: string[] }> {
  const projectsDir = path.join(CLAUDE_DIR, 'projects')
  const allEntries: Array<{ project: string; file: string; name: string }> = []

  for (const projDir of safeReadDir(projectsDir)) {
    const memoryDir = path.join(projectsDir, projDir, 'memory')
    for (const f of safeReadDir(memoryDir).filter(f => f.endsWith('.md') && f !== 'MEMORY.md')) {
      try {
        const content = fs.readFileSync(path.join(memoryDir, f), 'utf-8')
        const nameMatch = content.match(/name:\s*(.+)/)
        const name = nameMatch ? nameMatch[1].trim() : f.replace('.md', '')
        allEntries.push({ project: projDir, file: f, name })
      } catch { /* skip */ }
    }
  }

  const duplicates: Array<{ name: string; locations: string[] }> = []
  const checked = new Set<number>()

  for (let i = 0; i < allEntries.length; i++) {
    if (checked.has(i)) continue
    const group = [allEntries[i]]

    for (let j = i + 1; j < allEntries.length; j++) {
      if (checked.has(j)) continue
      if (jaccardSimilarity(allEntries[i].name, allEntries[j].name) >= JACCARD_THRESHOLD) {
        group.push(allEntries[j])
        checked.add(j)
      }
    }

    if (group.length > 1) {
      duplicates.push({
        name: allEntries[i].name,
        locations: group.map(e => `${e.project}/${e.file}`),
      })
    }
    checked.add(i)
  }

  return duplicates
}

// ─── Phase 3: Hookify health ──────────────────────────────────────────────────

function auditHookify(): { total: number; linked: number; missing: string[]; broken: string[] } {
  const sourceDir = path.join(PROJECTS_DIR, '_RPI_STANDARDS', 'hookify')
  const targetDir = path.join(PROJECTS_DIR, 'toMachina', '.claude')

  const sourceRules = safeReadDir(sourceDir).filter(f => f.endsWith('.local.md'))
  const missing: string[] = []
  const broken: string[] = []
  let linked = 0

  for (const rule of sourceRules) {
    const targetPath = path.join(targetDir, rule)
    try {
      const stat = fs.lstatSync(targetPath)
      if (stat.isSymbolicLink()) {
        const target = fs.readlinkSync(targetPath)
        const resolved = path.resolve(targetDir, target)
        if (fs.existsSync(resolved)) { linked++ } else { broken.push(rule) }
      } else {
        linked++ // regular file copy
      }
    } catch {
      missing.push(rule)
    }
  }

  return { total: sourceRules.length, linked, missing, broken }
}

// ─── Post report ──────────────────────────────────────────────────────────────

async function postSlack(text: string): Promise<void> {
  if (!SLACK_TOKEN) { console.log('[platform-audit] No Slack token. Output:\n', text); return }
  await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: { Authorization: `Bearer ${SLACK_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ channel: JDM_DM, text }),
  })
}

async function run(): Promise<void> {
  console.log(`[platform-audit] ${new Date().toISOString()} — WIRE_PLATFORM_AUDIT starting`)

  const sessionResult = auditSessionEnvs()
  const duplicates = detectDuplicates()
  const hookify = auditHookify()

  const lines: string[] = [
    `*:shield: WIRE_PLATFORM_AUDIT — ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}*\n`,
    `*Session Environments:*`,
    `  Total: ${sessionResult.total} | Orphaned: ${sessionResult.orphaned} | Deleted: ${sessionResult.deleted}`,
  ]

  if (sessionResult.deletedIds.length > 0) {
    lines.push(`  Cleaned up: ${sessionResult.deletedIds.slice(0, 10).join(', ')}`)
  }

  lines.push('')
  lines.push(`*Memory Duplicates:* ${duplicates.length} groups found`)
  for (const d of duplicates.slice(0, 5)) {
    lines.push(`  - "${d.name}" in: ${d.locations.join(', ')}`)
  }

  lines.push('')
  lines.push(`*Hookify Health:* ${hookify.linked}/${hookify.total} linked`)
  if (hookify.missing.length > 0) lines.push(`  Missing: ${hookify.missing.join(', ')}`)
  if (hookify.broken.length > 0) lines.push(`  Broken: ${hookify.broken.join(', ')}`)
  if (hookify.missing.length === 0 && hookify.broken.length === 0) lines.push(`  :white_check_mark: All healthy`)

  lines.push(`\n_The Machine watches itself._`)

  await postSlack(lines.join('\n'))
  console.log('[platform-audit] Complete')
}

run()
  .then(() => process.exit(0))
  .catch((err) => { console.error('[platform-audit] Fatal:', err); process.exit(1) })
