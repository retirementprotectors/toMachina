export interface MDJMessage {
  id: string
  role: 'user' | 'assistant' | 'tool_result'
  content: string
  specialist?: string
  tool_calls?: ToolCall[]
  tokens_used?: number
  timestamp: Date
  isStreaming?: boolean
}

export interface ToolCall {
  tool_name: string
  tool_input: Record<string, unknown>
  tool_result?: Record<string, unknown>
  status: 'pending' | 'running' | 'completed' | 'failed'
  requires_approval?: boolean
  approved?: boolean
  approved_by?: string
}

export interface MDJConversation {
  id: string
  user_email: string
  portal: string
  title: string
  active_specialist?: string
  status: 'active' | 'archived'
  message_count: number
  last_message_at: string
  created_at: string
}

export interface MDJPageContext {
  client_id?: string
  account_id?: string
  pipeline_key?: string
  page_path: string
}

export interface MDJUserContext {
  display_name: string
  email: string
  level: number
  portal: string
}
