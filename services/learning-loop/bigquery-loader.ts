/**
 * BigQuery Loader — TRK-14170 (complement to session-parser.ts)
 *
 * Takes parsed session data and loads it into BigQuery.
 * Supports streaming inserts (daily incremental) and batch loads (backfill).
 * Idempotent on session_id — checks before insert.
 *
 * Usage:
 *   import { loadSessionsToBigQuery } from './bigquery-loader'
 *   const parsed = parseLocalSessions(dir, machine)
 *   await loadSessionsToBigQuery(parsed)
 */

import { BigQuery } from '@google-cloud/bigquery'

const PROJECT_ID = 'claude-mcp-484718'
const DATASET = 'rpi_session_intelligence'

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
  role: string
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

interface ParsedData {
  sessions: ParsedSession[]
  messages: ParsedMessage[]
  toolCalls: ParsedToolCall[]
}

interface LoadResult {
  sessionsInserted: number
  messagesInserted: number
  toolCallsInserted: number
  skipped: number
  errors: string[]
}

function getBigQuery(): BigQuery {
  return new BigQuery({ projectId: PROJECT_ID })
}

/**
 * Check which session IDs already exist in BigQuery.
 */
async function getExistingSessionIds(bq: BigQuery, sessionIds: string[]): Promise<Set<string>> {
  if (sessionIds.length === 0) return new Set()

  const placeholders = sessionIds.map((id) => `'${id.replace(/'/g, "\\'")}'`).join(',')
  const query = `SELECT session_id FROM \`${PROJECT_ID}.${DATASET}.sessions\` WHERE session_id IN (${placeholders})`

  try {
    const [rows] = await bq.query({ query })
    return new Set(rows.map((r: Record<string, unknown>) => String(r.session_id)))
  } catch {
    return new Set()
  }
}

/**
 * Load parsed session data into BigQuery via streaming inserts.
 * Idempotent — skips sessions that already exist.
 */
export async function loadSessionsToBigQuery(data: ParsedData): Promise<LoadResult> {
  const bq = getBigQuery()
  const result: LoadResult = { sessionsInserted: 0, messagesInserted: 0, toolCallsInserted: 0, skipped: 0, errors: [] }

  // Check for existing sessions
  const existingIds = await getExistingSessionIds(bq, data.sessions.map((s) => s.session_id))

  // Filter to new sessions only
  const newSessions = data.sessions.filter((s) => !existingIds.has(s.session_id))
  const newSessionIds = new Set(newSessions.map((s) => s.session_id))
  result.skipped = data.sessions.length - newSessions.length

  if (newSessions.length === 0) {
    console.log(`All ${data.sessions.length} sessions already exist. Nothing to load.`)
    return result
  }

  // Insert sessions
  const sessionsTable = bq.dataset(DATASET).table('sessions')
  const sessionRows = newSessions.map((s) => ({
    session_id: s.session_id,
    machine: s.machine,
    project_hash: s.project ? Buffer.from(s.project).toString('base64').slice(0, 12) : null,
    project_name: s.project || null,
    timestamp_start: s.started_at || null,
    timestamp_end: s.ended_at || null,
    duration_seconds: s.started_at && s.ended_at
      ? Math.round((new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 1000)
      : 0,
    message_count: s.message_count,
    user_message_count: 0,
    assistant_message_count: 0,
    tool_call_count: s.tool_call_count,
    is_subagent: false,
  }))

  try {
    await sessionsTable.insert(sessionRows)
    result.sessionsInserted = sessionRows.length
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    result.errors.push(`Sessions insert: ${msg}`)
  }

  // Insert messages (only for new sessions)
  const newMessages = data.messages.filter((m) => newSessionIds.has(m.session_id))
  if (newMessages.length > 0) {
    const messagesTable = bq.dataset(DATASET).table('messages')
    const BATCH_SIZE = 500

    for (let i = 0; i < newMessages.length; i += BATCH_SIZE) {
      const batch = newMessages.slice(i, i + BATCH_SIZE).map((m) => ({
        message_uuid: `${m.session_id}__${m.message_index}`,
        session_id: m.session_id,
        parent_uuid: null,
        role: m.role,
        content_text: m.content_text.slice(0, 2000),
        content_type: m.has_tool_use ? 'mixed' : 'text',
        tool_calls_count: 0,
        timestamp: m.timestamp || null,
        machine: null,
      }))

      try {
        await messagesTable.insert(batch)
        result.messagesInserted += batch.length
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        result.errors.push(`Messages batch ${i}: ${msg}`)
      }
    }
  }

  // Insert tool calls (only for new sessions)
  const newToolCalls = data.toolCalls.filter((t) => newSessionIds.has(t.session_id))
  if (newToolCalls.length > 0) {
    const toolCallsTable = bq.dataset(DATASET).table('tool_calls')
    const BATCH_SIZE = 500

    for (let i = 0; i < newToolCalls.length; i += BATCH_SIZE) {
      const batch = newToolCalls.slice(i, i + BATCH_SIZE).map((t) => ({
        tool_call_id: `${t.session_id}__${t.message_index}__${t.tool_name}`,
        session_id: t.session_id,
        message_uuid: `${t.session_id}__${t.message_index}`,
        tool_name: t.tool_name,
        tool_input_json: null,
        tool_result_text: t.tool_input_preview.slice(0, 2000),
        tool_result_error: t.is_error,
        timestamp: t.timestamp || null,
        machine: null,
      }))

      try {
        await toolCallsTable.insert(batch)
        result.toolCallsInserted += batch.length
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        result.errors.push(`Tool calls batch ${i}: ${msg}`)
      }
    }
  }

  console.log(`Loaded: ${result.sessionsInserted} sessions, ${result.messagesInserted} messages, ${result.toolCallsInserted} tool calls (${result.skipped} skipped)`)
  if (result.errors.length > 0) console.error('Errors:', result.errors)

  return result
}
