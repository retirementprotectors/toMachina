'use client'

import { useState, useMemo } from 'react'
import { Modal } from '../../components/Modal'
import { useToast } from '../../components/Toast'
import { apiPost } from '@tomachina/core'
import type { CommsClient } from './CommsToolbar'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SendSmsDialogProps {
  open: boolean
  onClose: () => void
  client: CommsClient
  onSent?: () => void
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SendSmsDialog({ open, onClose, client, onSent }: SendSmsDialogProps) {
  const { showToast } = useToast()
  const phones = client.phone_numbers || []

  const defaultPhone = useMemo(() => {
    const primary = phones.find((p) => p.primary)
    return primary?.number || phones[0]?.number || ''
  }, [phones])

  const [selectedPhone, setSelectedPhone] = useState(defaultPhone)
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)

  if (open && !selectedPhone && defaultPhone) {
    setSelectedPhone(defaultPhone)
  }

  const charCount = body.length
  const segmentCount = charCount <= 160 ? 1 : Math.ceil(charCount / 153)

  function getCounterClass(): string {
    if (charCount === 0) return 'text-[var(--text-muted)]'
    if (charCount <= 160) return 'text-emerald-400'
    if (charCount <= 320) return 'text-amber-400'
    return 'text-red-400'
  }

  async function handleSend() {
    if (!selectedPhone || !body.trim()) return
    setSending(true)
    try {
      // Always dryRun=true until Twilio env vars are deployed to Cloud Run
      const result = await apiPost('/api/comms/send-sms?dryRun=true', {
        to: selectedPhone,
        body: body.trim(),
        client_id: client.client_id,
      })
      if (result.success) {
        showToast('SMS sent (dry run)', 'success')
        setBody('')
        onSent?.()
        onClose()
      } else {
        showToast(result.error || 'Failed to send SMS', 'error')
      }
    } catch {
      showToast('Failed to send SMS', 'error')
    } finally {
      setSending(false)
    }
  }

  const clientName = `${client.first_name || ''} ${client.last_name || ''}`.trim() || 'Client'

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Send SMS to ${clientName}`}
      footer={
        <>
          <button onClick={onClose} disabled={sending}
            className="rounded-md h-[34px] px-4 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
            Cancel
          </button>
          <button onClick={handleSend} disabled={sending || !selectedPhone || !body.trim()}
            className="rounded-md h-[34px] px-4 text-xs font-medium bg-[var(--portal)] text-white transition-colors hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed">
            {sending ? 'Sending...' : 'Send SMS'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {phones.length > 0 ? (
          <div>
            <label className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Recipient</label>
            <div className="mt-2 space-y-2">
              {phones.map((phone) => (
                <label key={phone.number} className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="sms-recipient" value={phone.number}
                    checked={selectedPhone === phone.number}
                    onChange={() => setSelectedPhone(phone.number)}
                    disabled={sending} className="accent-[var(--portal)]" />
                  <span className="text-sm text-[var(--text-primary)]">{phone.number}</span>
                  <span className="text-xs text-[var(--text-muted)]">({phone.type})</span>
                  {phone.primary && (
                    <span className="rounded-md px-1.5 py-0.5 text-[10px] font-medium bg-[var(--portal)]/15 text-[var(--portal)]">Primary</span>
                  )}
                </label>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm text-[var(--text-muted)]">No phone numbers on file.</p>
        )}
        <div>
          <label className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Message</label>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} disabled={sending} rows={4}
            placeholder="Type your message..."
            className="mt-1 w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--portal)] transition-colors resize-none" />
          <div className="mt-1 flex justify-between">
            <span className={`text-xs ${getCounterClass()}`}>
              {charCount}/160 ({segmentCount} {segmentCount === 1 ? 'segment' : 'segments'})
            </span>
            <span className="text-[10px] text-[var(--text-muted)]">dryRun mode</span>
          </div>
        </div>
      </div>
    </Modal>
  )
}
