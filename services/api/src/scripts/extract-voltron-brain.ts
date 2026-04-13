// extract-voltron-brain.ts — Pull all VOLTRON conversations from Firestore → brain.txt
// Usage: GOOGLE_APPLICATION_CREDENTIALS=path/to/sa-key.json npx tsx services/api/src/scripts/extract-voltron-brain.ts

import { initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import * as fs from 'fs'
import * as path from 'path'

if (getApps().length === 0) initializeApp({ projectId: 'claude-mcp-484718' })
const db = getFirestore()

const OUTPUT_PATH = '/home/jdm/Projects/dojo-warriors/voltron/brain.txt'

interface ConversationDoc {
  id: string
  user_email?: string
  specialist?: string
  summary?: string
  title?: string
  created_at?: string
  updated_at?: string
  page_context?: string
  portal?: string
}

interface MessageDoc {
  role?: string
  content?: string
  timestamp?: string
  created_at?: string
  tool_calls?: unknown[]
  specialist?: string
}

async function run() {
  console.log('[VOLTRON] Querying mdj_conversations...')

  const convSnap = await db
    .collection('mdj_conversations')
    .orderBy('created_at', 'asc')
    .get()

  if (convSnap.empty) {
    console.log('[VOLTRON] No conversations found in mdj_conversations.')
    fs.writeFileSync(OUTPUT_PATH, '# VOLTRON Brain — No conversations found\n')
    return
  }

  console.log(`[VOLTRON] Found ${convSnap.size} conversations. Extracting messages...`)

  const lines: string[] = [
    '# VOLTRON Brain — Conversation History',
    `# Extracted: ${new Date().toISOString()}`,
    `# Total conversations: ${convSnap.size}`,
    '',
  ]

  let totalMessages = 0

  for (const convDoc of convSnap.docs) {
    const conv = { id: convDoc.id, ...convDoc.data() } as ConversationDoc

    const ts = conv.created_at ?? conv.updated_at ?? 'unknown'
    const specialist = conv.specialist ?? 'general'
    const portal = conv.portal ?? ''
    const context = conv.page_context ?? ''
    const title = conv.title ?? conv.summary ?? '(untitled)'

    lines.push('═'.repeat(80))
    lines.push(`CONVERSATION: ${conv.id}`)
    lines.push(`  Time: ${ts}`)
    lines.push(`  User: ${conv.user_email ?? 'unknown'}`)
    lines.push(`  Specialist: ${specialist}`)
    if (portal) lines.push(`  Portal: ${portal}`)
    if (context) lines.push(`  Page: ${context}`)
    lines.push(`  Title: ${title}`)
    lines.push('─'.repeat(80))

    // Fetch messages subcollection
    const msgSnap = await db
      .collection('mdj_conversations')
      .doc(convDoc.id)
      .collection('messages')
      .orderBy('created_at', 'asc')
      .get()
      .catch(async () => {
        // Fallback: try timestamp field
        return db
          .collection('mdj_conversations')
          .doc(convDoc.id)
          .collection('messages')
          .orderBy('timestamp', 'asc')
          .get()
          .catch(() => null)
      })

    if (!msgSnap || msgSnap.empty) {
      lines.push('  (no messages)')
      lines.push('')
      continue
    }

    for (const msgDoc of msgSnap.docs) {
      const msg = msgDoc.data() as MessageDoc
      const role = (msg.role ?? 'unknown').toUpperCase()
      const msgTs = msg.created_at ?? msg.timestamp ?? ''
      const content = msg.content ?? ''
      const toolCalls = msg.tool_calls

      lines.push(`  [${msgTs}] ${role}:`)

      // Content — indent each line
      for (const line of content.split('\n')) {
        lines.push(`    ${line}`)
      }

      // Note tool usage if present
      if (toolCalls && Array.isArray(toolCalls) && toolCalls.length > 0) {
        lines.push(`    (${toolCalls.length} tool call(s))`)
      }

      lines.push('')
      totalMessages++
    }
  }

  lines.push('═'.repeat(80))
  lines.push(`# End of VOLTRON Brain — ${totalMessages} total messages`)

  // Ensure output directory exists
  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true })
  fs.writeFileSync(OUTPUT_PATH, lines.join('\n'), 'utf-8')

  console.log(`[VOLTRON] Brain extracted: ${convSnap.size} conversations, ${totalMessages} messages`)
  console.log(`[VOLTRON] Written to: ${OUTPUT_PATH}`)
}

run().catch((err) => {
  console.error('[VOLTRON] Fatal error:', err)
  process.exit(1)
})
