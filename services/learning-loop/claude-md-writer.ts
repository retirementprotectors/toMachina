/**
 * claude-md-writer.ts — LL-11
 *
 * Auto-promotes very-high-confidence (>=0.95) knowledge_entries into the
 * global ~/.claude/CLAUDE.md file. Idempotent via content-hash dedup.
 *
 * Design (per JDM LL-11 scope call, 2026-04-09):
 * - Target: /home/jdm/.claude/CLAUDE.md (global, loads into every session)
 * - Threshold: confidence >= 0.95 (soul-curated only; digest stays for 0.80-0.94)
 * - Section: ## Learned Patterns (auto-promoted) — appended at end of file
 * - Dedup: SHA-256 (first 12 chars) of normalized content, stored inline as HTML comment
 * - Max per run: 50 (clears backlog incrementally so JDM can eyeball quality)
 *
 * Separation from knowledge-promote.ts:
 * - Uses a DIFFERENT Firestore flag (`auto_written_to_claude_md`) so the two wires
 *   don't race on the same `promoted_to_claude_md` state. knowledge-promote is the
 *   Slack digest path. claude-md-writer is the file-append path. Independent.
 * - Dedup is by content hash in the file itself, not by Firestore flag. Re-runs
 *   are fully idempotent even if the flag is missing.
 *
 * CLI entry: `node dist/claude-md-writer.js` (manual run for testing)
 * Scheduled entry: systemd timer at 04:05 (5 min after knowledge-promote's 04:00)
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { readFileSync, writeFileSync } from 'fs'
import { createHash } from 'crypto'
import { KNOWLEDGE_ENTRIES_COLLECTION } from './types/knowledge-entry.js'
import type { KnowledgeEntry } from './types/knowledge-entry.js'

// Firebase init (idempotent — safe to import alongside other wires)
if (getApps().length === 0) {
  const saPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || '/home/jdm/Projects/dojo-warriors/mdj-agent/sa-key.json'
  const sa = JSON.parse(readFileSync(saPath, 'utf-8'))
  initializeApp({ credential: cert(sa) })
}

// Config
const CLAUDE_MD_PATH = process.env.CLAUDE_MD_PATH || '/home/jdm/.claude/CLAUDE.md'
const AUTO_WRITE_THRESHOLD = 0.95
const AUTO_WRITE_MAX = 50
const SECTION_HEADER = '## Learned Patterns (auto-promoted)'
const SECTION_INTRO =
  '> Auto-populated by the `claude-md-writer` wire (LL-11). High-confidence (≥0.95) cross-warrior\n' +
  '> knowledge entries extracted from warrior soul/spirit/brain files. Never auto-deleted — only\n' +
  '> auto-appended. Dedup is by content hash stored inline as an HTML comment on each bullet.'

/** Normalize content for dedup hashing: lowercase, collapse whitespace, trim. */
function normalizeContent(content: string): string {
  return content.toLowerCase().replace(/\s+/g, ' ').trim()
}

/** Compute SHA-256 hash of normalized content. First 12 chars — plenty for dedup. */
function contentHash(content: string): string {
  return createHash('sha256').update(normalizeContent(content)).digest('hex').slice(0, 12)
}

/** Extract warrior name from the tags array. Defaults to 'unknown'. */
function warriorFromTags(tags: string[] | undefined): string {
  const t = (tags || []).find((t) => t.startsWith('warrior:'))
  return t ? t.replace('warrior:', '') : 'unknown'
}

/** Format a single knowledge entry as a CLAUDE.md bullet with inline hash comment. */
function formatEntry(entry: KnowledgeEntry, hash: string, today: string): string {
  const warrior = warriorFromTags(entry.tags)
  const type = entry.type || 'insight'
  const confPct = ((entry.confidence || 0) * 100).toFixed(0)
  const content = (entry.content || '').trim()
  return `- \`[${warrior}/${type}]\` **(${confPct}%)** ${content} <!-- hash:${hash} ${today} -->`
}

export interface AutoWriteResult {
  candidates: number
  unpromoted: number
  written: number
  skipped_duplicate: number
  skipped_low_confidence: number
  section_created: boolean
}

/**
 * Main auto-promotion flow.
 *
 * 1. Query Firestore for entries >= AUTO_WRITE_THRESHOLD
 * 2. Client-side filter for those not already flagged auto_written_to_claude_md
 * 3. Read current CLAUDE.md
 * 4. For each candidate, compute content hash + skip if already present in file
 * 5. Append remaining candidates to the "Learned Patterns (auto-promoted)" section
 * 6. Mark candidates as auto_written_to_claude_md in Firestore
 */
export async function autoPromoteToClaudeMd(): Promise<AutoWriteResult> {
  const db = getFirestore()

  // Query by confidence only (single-field index, auto-created by Firestore)
  // We filter promoted/unpromoted client-side to avoid the composite index dance.
  const snap = await db
    .collection(KNOWLEDGE_ENTRIES_COLLECTION)
    .where('confidence', '>=', AUTO_WRITE_THRESHOLD)
    .orderBy('confidence', 'desc')
    .limit(AUTO_WRITE_MAX * 4) // oversample — client filter removes already-written
    .get()

  const candidates = snap.size
  console.log(`[claude-md-writer] Firestore returned ${candidates} candidates >= ${AUTO_WRITE_THRESHOLD}`)

  // Filter out entries already auto-written (client-side)
  const unwritten = snap.docs.filter((doc) => {
    const d = doc.data()
    return d.auto_written_to_claude_md !== true
  })
  const unpromoted = unwritten.length
  console.log(`[claude-md-writer] ${unpromoted} unwritten (${candidates - unpromoted} already auto-written)`)

  if (unpromoted === 0) {
    return {
      candidates,
      unpromoted: 0,
      written: 0,
      skipped_duplicate: 0,
      skipped_low_confidence: 0,
      section_created: false,
    }
  }

  // Read current CLAUDE.md
  let claudeMd: string
  try {
    claudeMd = readFileSync(CLAUDE_MD_PATH, 'utf-8')
  } catch (err) {
    console.error(`[claude-md-writer] Cannot read ${CLAUDE_MD_PATH}:`, err)
    throw err
  }
  const originalLength = claudeMd.length

  // Cap at AUTO_WRITE_MAX after oversample filter
  const capped = unwritten.slice(0, AUTO_WRITE_MAX)
  console.log(`[claude-md-writer] Processing ${capped.length} (capped at ${AUTO_WRITE_MAX})`)

  // Dedup by content hash + filter
  type QualifiedEntry = { doc: FirebaseFirestore.QueryDocumentSnapshot; hash: string; entry: KnowledgeEntry }
  const toWrite: QualifiedEntry[] = []
  let skipped_duplicate = 0
  for (const doc of capped) {
    const entry = doc.data() as KnowledgeEntry
    if (!entry.content || entry.content.length < 10) continue
    const hash = contentHash(entry.content)
    if (claudeMd.includes(`hash:${hash}`)) {
      skipped_duplicate++
      continue
    }
    toWrite.push({ doc, hash, entry })
  }
  console.log(`[claude-md-writer] ${toWrite.length} to write, ${skipped_duplicate} duplicates skipped`)

  // Ensure the section exists
  let section_created = false
  if (!claudeMd.includes(SECTION_HEADER)) {
    const sectionBlock = `\n\n---\n\n${SECTION_HEADER}\n\n${SECTION_INTRO}\n`
    claudeMd += sectionBlock
    section_created = true
    console.log(`[claude-md-writer] Created new section: ${SECTION_HEADER}`)
  }

  // Append new entries at end of file (under the section since section is at end)
  if (toWrite.length > 0) {
    const today = new Date().toISOString().slice(0, 10)
    const bulletLines: string[] = [''] // leading blank for separation
    for (const { hash, entry } of toWrite) {
      bulletLines.push(formatEntry(entry, hash, today))
    }
    claudeMd += bulletLines.join('\n') + '\n'

    // Atomic write
    writeFileSync(CLAUDE_MD_PATH, claudeMd, 'utf-8')
    console.log(
      `[claude-md-writer] Wrote ${toWrite.length} entries to ${CLAUDE_MD_PATH} ` +
        `(${originalLength} → ${claudeMd.length} bytes, +${claudeMd.length - originalLength})`
    )
  }

  // Mark all processed candidates as auto_written_to_claude_md (written + duplicates)
  // Duplicates get flagged so we don't re-query them forever.
  const batch = db.batch()
  for (const doc of capped) {
    batch.update(doc.ref, {
      auto_written_to_claude_md: true,
      auto_written_at: FieldValue.serverTimestamp(),
    })
  }
  await batch.commit()
  console.log(`[claude-md-writer] Marked ${capped.length} entries as auto_written_to_claude_md`)

  return {
    candidates,
    unpromoted,
    written: toWrite.length,
    skipped_duplicate,
    skipped_low_confidence: 0,
    section_created,
  }
}

// CLI entry point (also the systemd ExecStart target)
async function main(): Promise<void> {
  console.log(`[claude-md-writer] Starting at ${new Date().toISOString()}`)
  const result = await autoPromoteToClaudeMd()
  console.log('[claude-md-writer] Result:', JSON.stringify(result, null, 2))
  console.log(`[claude-md-writer] Complete at ${new Date().toISOString()}`)
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[claude-md-writer] Fatal:', err)
    process.exit(1)
  })
