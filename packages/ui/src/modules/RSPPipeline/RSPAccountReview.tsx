'use client'

/**
 * RSPAccountReview — TRK-RSP-007
 * Tabbed account review by product line with gap badges.
 */

import { useState } from 'react'
import type { RSPAccount } from './types'
import { ACCOUNT_TYPE_TO_QUE, QUE_HOOK_META } from './types'

interface RSPAccountReviewProps {
  accounts: RSPAccount[]
}

export function RSPAccountReview({ accounts }: RSPAccountReviewProps) {
  type ProductLine = 'LIFE' | 'ANNUITY' | 'MEDICARE' | 'INVESTMENT'
  const productLines: ProductLine[] = ['LIFE', 'ANNUITY', 'MEDICARE', 'INVESTMENT']
  const [activeTab, setActiveTab] = useState<ProductLine>('LIFE')

  const getAccountsByLine = (line: string) =>
    accounts.filter(a => ACCOUNT_TYPE_TO_QUE[a.account_type] === line)

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Account Review</h3>

      {/* Product Line Tabs */}
      <div className="flex gap-1 border-b border-[var(--border)]">
        {productLines.map(line => {
          const meta = QUE_HOOK_META[line]
          const count = getAccountsByLine(line).length
          return (
            <button
              key={line}
              onClick={() => setActiveTab(line)}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === line
                  ? 'border-[var(--portal)] text-[var(--portal)]'
                  : 'border-transparent text-[var(--text-muted)]'
              }`}
            >
              <span className="material-symbols-outlined text-base">{meta.icon}</span>
              {meta.label}
              {count > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-[var(--portal)]/20 text-[var(--portal)] text-xs font-bold">
                  {count}
                </span>
              )}
              {count === 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-orange-500/20 text-orange-400 text-xs font-bold">
                  GAP
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Account List */}
      <div className="space-y-2">
        {getAccountsByLine(activeTab).length === 0 ? (
          <div className="p-6 text-center rounded-lg bg-[var(--card)] border border-orange-500/30">
            <span className="material-symbols-outlined text-3xl text-orange-400 mb-2">warning</span>
            <p className="text-sm text-orange-400 font-medium">No {QUE_HOOK_META[activeTab].label} accounts</p>
            <p className="text-xs text-[var(--text-muted)] mt-1">This is a coverage gap — discuss with client.</p>
          </div>
        ) : (
          getAccountsByLine(activeTab).map(account => (
            <div key={account.account_id} className="p-3 rounded-lg bg-[var(--card)] border border-[var(--border)] flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">{account.account_type}</div>
                <div className="text-xs text-[var(--text-muted)]">{account.carrier} — {account.policy_number}</div>
              </div>
              <div className="text-right">
                {account.face_amount && <div className="text-sm font-semibold">${account.face_amount.toLocaleString()}</div>}
                <div className={`text-xs ${account.status === 'active' ? 'text-green-400' : 'text-[var(--text-muted)]'}`}>
                  {account.status || 'unknown'}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export type { RSPAccountReviewProps }
