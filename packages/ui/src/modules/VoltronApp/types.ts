/** VOLTRON App types — shared across all VoltronApp components. */

export type VoltronMode = 'idle' | 'task' | 'chat'

export interface VoltronSseEvent {
  type: 'text' | 'tool_call' | 'tool_result' | 'approval_required' | 'error' | 'done'
  text?: string
  tool_name?: string
  tool_input?: Record<string, unknown>
  tool_use_id?: string
  call_id?: string
  result?: unknown
  error?: string
}

export interface VoltronToolCall {
  call_id: string
  tool_name: string
  tool_input: Record<string, unknown>
  tool_result?: unknown
  status: 'pending' | 'running' | 'completed' | 'failed'
  requires_approval?: boolean
}

export interface VoltronMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  specialist?: string
  timestamp: Date
  isStreaming?: boolean
}

export interface VoltronTaskState {
  sessionId: string | null
  goal: string
  toolCalls: VoltronToolCall[]
  resultText: string
  status: 'running' | 'approval_required' | 'done' | 'error'
  error?: string
}

export interface VoltronPageContext {
  client_id?: string
  account_id?: string
  pipeline_key?: string
  page_path: string
}

export interface VoltronUserContext {
  display_name: string
  email: string
  level: number
  portal: string
}
