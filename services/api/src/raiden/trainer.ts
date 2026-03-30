import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'
import type { SlackItem } from './types.js'

const db = getFirestore()
const MDJ_URL = process.env.MDJ_AGENT_URL || 'http://localhost:4200'
const MDJ_AUTH = process.env.MDJ_AUTH_SECRET || 'mdj-alpha-shared-secret-2026'

async function postSlack(channel: string, text: string, threadTs?: string): Promise<void> {
  try {
    await fetch(`${MDJ_URL}/dojo/slack/post`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-MDJ-Auth': MDJ_AUTH },
      body: JSON.stringify({ channel, text, ...(threadTs ? { thread_ts: threadTs } : {}) })
    })
  } catch { /* silent */ }
}

export async function sendTrainingResponse(item: SlackItem, keywords: string[]): Promise<void> {
  let docSummary = ''
  try {
    const snap = await db.collection('knowledge_entries')
      .where('tags', 'array-contains-any', keywords.slice(0, 10)).limit(5).get()
    if (!snap.empty) {
      docSummary = snap.docs.map(d => d.data())
        .map(d => `${d.title}: ${d.summary || ''}\nLocation: ${d.location || 'knowledge base'}`)
        .join('\n\n')
    }
  } catch { /* knowledge_entries may not exist */ }

  if (!docSummary) docSummary = fallbackClaudeMdSearch(item.text)

  await postSlack(item.channel,
    `RAIDEN\n\n<@${item.user}> - This is already in ProDash!\n\n${docSummary || 'Check ProDash documentation.'}\n\n- @RAIDEN`,
    item.thread_ts)
}

function fallbackClaudeMdSearch(query: string): string {
  try {
    const md = readFileSync('/home/jdm/Projects/toMachina/CLAUDE.md', 'utf8')
    const keyword = query.toLowerCase().split(' ').find(w => w.length > 4) || ''
    const lines = md.split('\n')
    const matches: string[] = []
    for (let i = 0; i < lines.length; i++) {
      if (keyword && lines[i].toLowerCase().includes(keyword)) {
        matches.push(lines.slice(Math.max(0, i - 2), Math.min(lines.length, i + 5)).join('\n'))
        if (matches.length >= 2) break
      }
    }
    return matches.join('\n\n---\n\n')
  } catch { return '' }
}
