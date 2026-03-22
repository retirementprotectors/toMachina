'use client'

import { useState, useMemo } from 'react'
import { Modal } from '../../components/Modal'
import { useToast } from '../../components/Toast'
import { apiPost } from '@tomachina/core'
import type { CommsClient } from './CommsToolbar'

interface SendEmailDialogProps {
  open: boolean
  onClose: () => void
  client: CommsClient
  onSent?: () => void
}

export function SendEmailDialog({ open, onClose, client, onSent }: SendEmailDialogProps) {
  const { showToast } = useToast()
  const emails = client.email_addresses || []

  const defaultEmail = useMemo(() => {
    const primary = emails.find((e) => e.primary)
    return primary?.email || emails[0]?.email || ''
  }, [emails])

  const [selectedEmail, setSelectedEmail] = useState(defaultEmail)
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)

  if (open && !selectedEmail && defaultEmail) {
    setSelectedEmail(defaultEmail)
  }

  async function handleSend() {
    if (!selectedEmail || !body.trim()) return
    setSending(true)
    try {
      const endpoint = '/api/comms/send-email'
      const result = await apiPost(endpoint, {
        to: selectedEmail,
        subject: subject.trim() || 'No Subject',
        text: body.trim(),
        client_id: client.client_id,
      })
      if (result.success) {
        showToast('Email sent', 'success')
        setSubject('')
        setBody('')
        onSent?.()
        onClose()
      } else {
        showToast(result.error || 'Failed to send email', 'error')
      }
    } catch {
      showToast('Failed to send email', 'error')
    } finally {
      setSending(false)
    }
  }

  const clientName = `${client.first_name || ''} ${client.last_name || ''}`.trim() || 'Client'

  return (
    <Modal open={open} onClose={onClose} title={`Send Email to ${clientName}`} size="lg"
      footer={
        <>
          <button onClick={onClose} disabled={sending}
            className="rounded-md h-[34px] px-4 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
            Cancel
          </button>
          <button onClick={handleSend} disabled={sending || !selectedEmail || !body.trim()}
            className="rounded-md h-[34px] px-4 text-xs font-medium bg-[var(--portal)] text-white transition-colors hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed">
            {sending ? 'Sending...' : 'Send Email'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {emails.length > 0 ? (
          <div>
            <label className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Recipient</label>
            <div className="mt-2 space-y-2">
              {emails.map((email) => (
                <label key={email.email} className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="email-recipient" value={email.email}
                    checked={selectedEmail === email.email}
                    onChange={() => setSelectedEmail(email.email)}
                    disabled={sending} className="accent-[var(--portal)]" />
                  <span className="text-sm text-[var(--text-primary)]">{email.email}</span>
                  <span className="text-xs text-[var(--text-muted)]">({email.type})</span>
                  {email.primary && (
                    <span className="rounded-md px-1.5 py-0.5 text-[10px] font-medium bg-[var(--portal)]/15 text-[var(--portal)]">Primary</span>
                  )}
                </label>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm text-[var(--text-muted)]">No email addresses on file.</p>
        )}
        <div>
          <label className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Subject</label>
          <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} disabled={sending}
            placeholder="Email subject..."
            className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--portal)] transition-colors" />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Body</label>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} disabled={sending} rows={8}
            placeholder="Type your email message..."
            className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--portal)] transition-colors resize-none" />
        </div>
      </div>
    </Modal>
  )
}
