/**
 * Session Parser + BigQuery Loader — TRK-S03-006
 *
 * Reads JSONL session files from GCS or local disk.
 * Extracts session metadata, messages, tool_calls, subagent relationships.
 * Streams to BigQuery. Idempotent on session_id.
 *
 * Usage:
 *   npx tsx session-parser.ts --source gs://rpi-session-intelligence/ --machines air,pro
 *   npx tsx session-parser.ts --local ~/.claude/projects/ --machine mdj1
 */

import { readFileSync, readdirSync, existsSync } from 'fs'
import { join, basename } from 'path'

// Types for parsed session data
interface ParsedSession {
  session_id: string
  machine: string
  project: string
  started_at: string
  ended_at: string
  message_count: number
  tool_call_count: number
  model: string
  git_branch: string
}

interface ParsedMessage {
  session_id: string
  message_index: number
  role: 'user' | 'assistant' | 'system'
  content_text: string
  content_length: number
  timestamp: string
  has_tool_use: boolean
}

interface ParsedToolCall {
  session_id: string
  message_index: number
  tool_name: string
  tool_input_preview: string
  is_error: boolean
  timestamp: string
}

/**
 * Parse a single JSONL session file into structured data.
 */
export function parseSessionFile(filePath: string, machine: string): {
  session: ParsedSession
  messages: ParsedMessage[]
  toolCalls: ParsedToolCall[]
} {
  const content = readFileSync(filePath, 'utf-8')
  const lines = content.split('\n').filter((l) => l.trim())

  const messages: ParsedMessage[] = []
  const toolCalls: ParsedToolCall[] = []
  let sessionId = basename(filePath).replace('.jsonl', '')
  let project = ''
  let startedAt = ''
  let endedAt = ''
  let model = ''
  let gitBranch = ''
  let messageIndex = 0

  for (const line of lines) {
    try {
      const obj = JSON.parse(line)

      // Extract session metadata
      if (obj.sessionId) sessionId = obj.sessionId
      if (obj.cwd) project = obj.cwd
      if (obj.timestamp && !startedAt) startedAt = obj.timestamp
      if (obj.timestamp) endedAt = obj.timestamp
      if (obj.version) model = obj.version
      if (obj.gitBranch) gitBranch = obj.gitBranch

      // Parse user/assistant messages
      if (obj.type === 'user' || obj.type === 'assistant') {
        const content = obj.message?.content
        let textContent = ''
        let hasToolUse = false

        if (typeof content === 'string') {
          textContent = content
        } else if (Array.isArray(content)) {
          for (const block of content) {
            if (block.type === 'text' && block.text) {
              textContent += block.text + '\n'
            } else if (block.type === 'tool_use') {
              hasToolUse = true
              toolCalls.push({
                session_id: sessionId,
                message_index: messageIndex,
                tool_name: block.name || 'unknown',
                tool_input_preview: JSON.stringify(block.input || {}).slice(0, 200),
                is_error: false,
                timestamp: obj.timestamp || endedAt,
              })
            } else if (block.type === 'tool_result') {
              hasToolUse = true
              toolCalls.push({
                session_id: sessionId,
                message_index: messageIndex,
                tool_name: 'tool_result',
                tool_input_preview: (typeof block.content === 'string' ? block.content : JSON.stringify(block.content || '')).slice(0, 200),
                is_error: block.is_error === true,
                timestamp: obj.timestamp || endedAt,
              })
            }
          }
        }

        if (textContent.trim() || hasToolUse) {
          messages.push({
            session_id: sessionId,
            message_index: messageIndex,
            role: obj.type as 'user' | 'assistant',
            content_text: textContent.slice(0, 10000),
            content_length: textContent.length,
            timestamp: obj.timestamp || endedAt,
            has_tool_use: hasToolUse,
          })
          messageIndex++
        }
      }
    } catch {
      // Skip unparseable lines
    }
  }

  return {
    session: {
      session_id: sessionId,
      machine,
      project,
      started_at: startedAt,
      ended_at: endedAt,
      message_count: messages.length,
      tool_call_count: toolCalls.length,
      model,
      git_branch: gitBranch,
    },
    messages,
    toolCalls,
  }
}

/**
 * Scan a local directory for JSONL session files and parse them all.
 */
export function parseLocalSessions(dir: string, machine: string): {
  sessions: ParsedSession[]
  messages: ParsedMessage[]
  toolCalls: ParsedToolCall[]
} {
  const sessions: ParsedSession[] = []
  const allMessages: ParsedMessage[] = []
  const allToolCalls: ParsedToolCall[] = []

  if (!existsSync(dir)) {
    console.error(`Directory not found: ${dir}`)
    return { sessions, messages: allMessages, toolCalls: allToolCalls }
  }

  const files = readdirSync(dir, { recursive: true }) as string[]
  const jsonlFiles = files.filter((f) => String(f).endsWith('.jsonl'))

  for (const file of jsonlFiles) {
    try {
      const { session, messages, toolCalls } = parseSessionFile(join(dir, String(file)), machine)
      sessions.push(session)
      allMessages.push(...messages)
      allToolCalls.push(...toolCalls)
    } catch (err) {
      console.error(`Failed to parse ${file}: ${err}`)
    }
  }

  console.log(`Parsed ${sessions.length} sessions, ${allMessages.length} messages, ${allToolCalls.length} tool calls from ${dir}`)
  return { sessions, messages: allMessages, toolCalls: allToolCalls }
}
