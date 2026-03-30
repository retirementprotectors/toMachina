'use client'

/**
 * RSPAuthStatus — TRK-RSP-008
 * Per-form authorization status with DocuSign trigger.
 */

interface AuthForm {
  form_id: string
  form_name: string
  form_type: 'hipaa' | 'acat' | 'tpa' | 'poa' | 'beneficiary' | 'general'
  status: 'pending' | 'sent' | 'signed' | 'expired'
  sent_at?: string
  signed_at?: string
}

interface RSPAuthStatusProps {
  forms: AuthForm[]
  onSendForm?: (formId: string) => void
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'text-[var(--text-muted)]',
  sent: 'text-blue-400',
  signed: 'text-green-400',
  expired: 'text-red-400',
}

const STATUS_ICONS: Record<string, string> = {
  pending: 'schedule',
  sent: 'send',
  signed: 'verified',
  expired: 'error',
}

export function RSPAuthStatus({ forms, onSendForm }: RSPAuthStatusProps) {
  const signed = forms.filter(f => f.status === 'signed').length
  const total = forms.length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Authorization Status</h3>
        <span className="text-sm text-[var(--text-muted)]">{signed}/{total} signed</span>
      </div>

      <div className="space-y-2">
        {forms.map(form => (
          <div key={form.form_id} className="p-3 rounded-lg bg-[var(--card)] border border-[var(--border)] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`material-symbols-outlined text-base ${STATUS_COLORS[form.status]}`}>
                {STATUS_ICONS[form.status]}
              </span>
              <div>
                <div className="text-sm font-medium">{form.form_name}</div>
                <div className="text-xs text-[var(--text-muted)] uppercase">{form.form_type}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs font-semibold uppercase ${STATUS_COLORS[form.status]}`}>
                {form.status}
              </span>
              {form.status === 'pending' && onSendForm && (
                <button
                  onClick={() => onSendForm(form.form_id)}
                  className="px-2 py-1 rounded bg-[var(--portal)] text-white text-xs font-semibold"
                >
                  Send
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export type { RSPAuthStatusProps, AuthForm }
