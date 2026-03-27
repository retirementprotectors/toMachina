'use client'

import { useRef, useEffect, useState } from 'react'
import { ApprovalGate } from './ApprovalGate'
import type { VoltronTaskState, VoltronToolCall } from './types'

/* ─── Tool Call Row ─── */

function ToolCallRow({ toolCall }: { toolCall: VoltronToolCall }) {
  const [expanded, setExpanded] = useState(false)

  const statusStyles: Record<string, { bg: string; text: string; label: string }> = {
    pending:   { bg: 'rgba(245,158,11,0.15)', text: '#f59e0b', label: 'Awaiting Approval' },
    running:   { bg: 'rgba(59,130,246,0.15)',  text: '#3b82f6', label: 'Running...' },
    completed: { bg: 'rgba(34,197,94,0.1)',    text: '#22c55e', label: 'Completed' },
    failed:    { bg: 'rgba(239,68,68,0.1)',    text: '#ef4444', label: 'Failed' },
  }

  const style = statusStyles[toolCall.status] || statusStyles.running

  return (
    <div
      className="mb-2 overflow-hidden rounded-lg border border-[var(--border-subtle)]"
      style={{ background: style.bg }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-[var(--bg-hover)]"
      >
        <span className="material-icons-outlined" style={{ fontSize: '16px', color: style.text }}>
          build
        </span>
        <span className="flex-1 truncate text-xs font-medium text-[var(--text-primary)]">
          {toolCall.tool_name.replace(/^(tm_|mcp_)/, '').replace(/_/g, ' ')}
        </span>
        <span
          className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
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

      {expanded && (
        <div className="border-t border-[var(--border-subtle)] px-3 pb-2">
          {toolCall.tool_input && Object.keys(toolCall.tool_input).length > 0 && (
            <div className="mt-2">
              <div className="mb-1 text-[10px] font-semibold uppercase text-[var(--text-muted)]">Input</div>
              <pre className="overflow-x-auto whitespace-pre-wrap rounded bg-[var(--bg-primary)] p-2 text-[11px] text-[var(--text-muted)]">
                {JSON.stringify(toolCall.tool_input, null, 2)}
              </pre>
            </div>
          )}
          {toolCall.tool_result != null && (
            <div className="mt-2">
              <div className="mb-1 text-[10px] font-semibold uppercase text-[var(--text-muted)]">Result</div>
              <pre className="max-h-40 overflow-x-auto whitespace-pre-wrap rounded bg-[var(--bg-primary)] p-2 text-[11px] text-[var(--text-muted)]">
                {JSON.stringify(toolCall.tool_result, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ─── Task View ─── */

interface TaskViewProps {
  taskState: VoltronTaskState
  onApprove: (callId: string) => void
  onReject: (callId: string) => void
}

export function TaskView({ taskState, onApprove, onReject }: TaskViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [taskState.toolCalls, taskState.resultText])

  const statusColor =
    taskState.status === 'done'
      ? '#22c55e'
      : taskState.status === 'error'
        ? '#ef4444'
        : taskState.status === 'approval_required'
          ? '#f59e0b'
          : '#3b82f6'

  const statusLabel =
    taskState.status === 'done'
      ? 'Complete'
      : taskState.status === 'error'
        ? 'Error'
        : taskState.status === 'approval_required'
          ? 'Approval Required'
          : 'Running'

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto p-4">
      {/* Goal header */}
      <div className="mb-4 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4">
        <div className="mb-2 flex items-center gap-2">
          <span className="material-icons-outlined" style={{ fontSize: '18px', color: '#7c5cfc' }}>
            rocket_launch
          </span>
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Goal
          </span>
          <span
            className="ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold uppercase"
            style={{ color: statusColor, background: `${statusColor}20` }}
          >
            {statusLabel}
          </span>
        </div>
        <p className="text-sm text-[var(--text-primary)]">{taskState.goal}</p>
      </div>

      {/* Streaming progress feed — tool calls */}
      {taskState.toolCalls.length > 0 && (
        <div className="mb-4">
          <div className="mb-2 flex items-center gap-1.5">
            <span className="material-icons-outlined" style={{ fontSize: '16px', color: 'var(--text-muted)' }}>
              engineering
            </span>
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Progress ({taskState.toolCalls.length} tool{taskState.toolCalls.length !== 1 ? 's' : ''})
            </span>
          </div>
          {taskState.toolCalls.map((tc) => (
            <div key={tc.call_id}>
              <ToolCallRow toolCall={tc} />
              {/* Inline approval gate */}
              {tc.status === 'pending' && tc.requires_approval && (
                <ApprovalGate
                  toolCall={tc}
                  onApprove={() => onApprove(tc.call_id)}
                  onReject={() => onReject(tc.call_id)}
                />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Result card */}
      {taskState.resultText && taskState.status === 'done' && (
        <div className="rounded-lg border border-[#22c55e]/30 bg-[rgba(34,197,94,0.05)] p-4">
          <div className="mb-2 flex items-center gap-1.5">
            <span className="material-icons-outlined" style={{ fontSize: '16px', color: '#22c55e' }}>
              check_circle
            </span>
            <span className="text-xs font-semibold uppercase tracking-wider text-[#22c55e]">
              Result
            </span>
          </div>
          <p className="whitespace-pre-wrap text-sm text-[var(--text-primary)]">
            {taskState.resultText}
          </p>
        </div>
      )}

      {/* Streaming result text (while running) */}
      {taskState.resultText && taskState.status === 'running' && (
        <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4">
          <span className="whitespace-pre-wrap text-sm text-[var(--text-primary)]">
            {taskState.resultText}
          </span>
          <span className="ml-0.5 inline-block h-3.5 w-1.5 animate-pulse rounded-sm bg-[#7c5cfc]" />
        </div>
      )}

      {/* Error */}
      {taskState.error && (
        <div className="mt-4 rounded-lg border border-[#ef4444]/30 bg-[rgba(239,68,68,0.05)] p-4">
          <div className="mb-1 flex items-center gap-1.5">
            <span className="material-icons-outlined" style={{ fontSize: '16px', color: '#ef4444' }}>
              error
            </span>
            <span className="text-xs font-semibold uppercase text-[#ef4444]">Error</span>
          </div>
          <p className="text-sm text-[var(--text-primary)]">{taskState.error}</p>
        </div>
      )}
    </div>
  )
}
