'use client'

import { useState } from 'react'
import type { ToolCall } from './types'

interface ToolCallCardProps {
  toolCall: ToolCall
  onApprove?: (callId: string) => void
  onReject?: (callId: string) => void
}

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  pending: { bg: 'rgba(245,158,11,0.15)', text: 'var(--text-primary)', label: 'Awaiting Approval' },
  running: { bg: 'rgba(59,130,246,0.15)', text: 'var(--portal)', label: 'Running...' },
  completed: { bg: 'rgba(34,197,94,0.1)', text: '#22c55e', label: 'Completed' },
  failed: { bg: 'rgba(239,68,68,0.1)', text: '#ef4444', label: 'Failed' },
}

function getToolIcon(toolName: string): string {
  if (toolName.startsWith('mcp_gmail')) return 'email'
  if (toolName.startsWith('mcp_slack')) return 'chat'
  if (toolName.startsWith('mcp_calendar')) return 'calendar_today'
  if (toolName.startsWith('mcp_gdrive')) return 'folder'
  if (toolName.startsWith('mcp_comms')) return 'phone'
  if (toolName.startsWith('mcp_workspace')) return 'business'
  if (toolName.startsWith('mcp_healthcare') || toolName.startsWith('mcp_npi')) return 'medical_services'
  if (toolName.startsWith('tm_clients') || toolName.startsWith('tm_search')) return 'people'
  if (toolName.startsWith('tm_accounts') || toolName.startsWith('tm_revenue')) return 'account_balance'
  if (toolName.startsWith('tm_pipelines') || toolName.startsWith('tm_flow')) return 'view_kanban'
  if (toolName.startsWith('tm_comms')) return 'send'
  if (toolName.startsWith('tm_que')) return 'calculate'
  if (toolName.startsWith('tm_atlas')) return 'hub'
  return 'build'
}

export function ToolCallCard({ toolCall, onApprove, onReject }: ToolCallCardProps) {
  const [expanded, setExpanded] = useState(false)
  const style = STATUS_STYLES[toolCall.status] || STATUS_STYLES.running
  const icon = getToolIcon(toolCall.tool_name)

  return (
    <div
      className="my-2 rounded-lg border border-[var(--border-subtle)] overflow-hidden"
      style={{ background: style.bg }}
    >
      {/* Header — always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-[var(--bg-hover)] transition-colors"
      >
        <span className="material-icons-outlined" style={{ fontSize: '16px', color: style.text }}>
          {icon}
        </span>
        <span className="text-xs font-medium text-[var(--text-primary)] flex-1 truncate">
          {toolCall.tool_name.replace(/^(tm_|mcp_)/, '').replace(/_/g, ' ')}
        </span>
        <span
          className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded"
          style={{ color: style.text, background: 'rgba(255,255,255,0.06)' }}
        >
          {style.label}
        </span>
        <span
          className="material-icons-outlined transition-transform"
          style={{
            fontSize: '14px',
            color: 'var(--text-muted)',
            transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        >
          expand_more
        </span>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-3 pb-2 border-t border-[var(--border-subtle)]">
          {/* Input parameters */}
          {toolCall.tool_input && Object.keys(toolCall.tool_input).length > 0 && (
            <div className="mt-2">
              <div className="text-[10px] font-semibold uppercase text-[var(--text-muted)] mb-1">Input</div>
              <pre className="text-[11px] text-[var(--text-muted)] bg-[var(--bg-primary)] rounded p-2 overflow-x-auto whitespace-pre-wrap">
                {JSON.stringify(toolCall.tool_input, null, 2)}
              </pre>
            </div>
          )}

          {/* Result */}
          {toolCall.tool_result && (
            <div className="mt-2">
              <div className="text-[10px] font-semibold uppercase text-[var(--text-muted)] mb-1">Result</div>
              <pre className="text-[11px] text-[var(--text-muted)] bg-[var(--bg-primary)] rounded p-2 overflow-x-auto whitespace-pre-wrap max-h-40">
                {JSON.stringify(toolCall.tool_result, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* Approve / Reject buttons — only when pending */}
      {toolCall.status === 'pending' && toolCall.requires_approval && (
        <div className="flex gap-2 px-3 pb-2">
          <button
            onClick={() => onApprove?.(toolCall.call_id || toolCall.tool_name)}
            className="flex-1 flex items-center justify-center gap-1 rounded-md py-1.5 text-xs font-medium text-white transition-colors"
            style={{ background: '#22c55e' }}
          >
            <span className="material-icons-outlined" style={{ fontSize: '14px' }}>check</span>
            Approve
          </button>
          <button
            onClick={() => onReject?.(toolCall.call_id || toolCall.tool_name)}
            className="flex-1 flex items-center justify-center gap-1 rounded-md py-1.5 text-xs font-medium text-white transition-colors"
            style={{ background: '#ef4444' }}
          >
            <span className="material-icons-outlined" style={{ fontSize: '14px' }}>close</span>
            Reject
          </button>
        </div>
      )}
    </div>
  )
}
