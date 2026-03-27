'use client'

import type { VoltronToolCall } from './types'

interface ApprovalGateProps {
  toolCall: VoltronToolCall
  onApprove: () => void
  onReject: () => void
}

export function ApprovalGate({ toolCall, onApprove, onReject }: ApprovalGateProps) {
  return (
    <div className="mb-3 rounded-lg border border-[#f59e0b]/30 bg-[rgba(245,158,11,0.08)] p-3">
      <div className="mb-2 flex items-center gap-2">
        <span className="material-icons-outlined" style={{ fontSize: '18px', color: '#f59e0b' }}>
          gpp_maybe
        </span>
        <span className="text-xs font-semibold text-[#f59e0b]">
          Approval Required
        </span>
      </div>

      <p className="mb-3 text-xs text-[var(--text-secondary)]">
        <span className="font-medium text-[var(--text-primary)]">
          {toolCall.tool_name.replace(/^(tm_|mcp_)/, '').replace(/_/g, ' ')}
        </span>{' '}
        needs your permission to proceed.
      </p>

      <div className="flex gap-2">
        <button
          onClick={onApprove}
          className="flex flex-1 items-center justify-center gap-1 rounded-md py-2 text-xs font-medium text-white transition-colors hover:brightness-110"
          style={{ background: '#22c55e' }}
        >
          <span className="material-icons-outlined" style={{ fontSize: '14px' }}>check</span>
          Approve
        </button>
        <button
          onClick={onReject}
          className="flex flex-1 items-center justify-center gap-1 rounded-md py-2 text-xs font-medium text-white transition-colors hover:brightness-110"
          style={{ background: '#ef4444' }}
        >
          <span className="material-icons-outlined" style={{ fontSize: '14px' }}>close</span>
          Reject
        </button>
      </div>
    </div>
  )
}
