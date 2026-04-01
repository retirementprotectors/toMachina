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

  // TRK-PC-012: File attachment state for MMS
  const [attachedFile, setAttachedFile] = useState<File | null>(null)
  const [attachPreview, setAttachPreview] = useState<string | null>(null)

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

  // TRK-PC-012: Handle file selection
  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    // 5MB size guard
    if (file.size > 5 * 1024 * 1024) {
      showToast('File must be under 5MB for MMS', 'error')
      e.target.value = ''
      return
    }
    setAttachedFile(file)
    // Generate preview for images
    if (file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = () => setAttachPreview(reader.result as string)
      reader.readAsDataURL(file)
    } else {
      setAttachPreview(null)
    }
  }

  function clearAttachment() {
    setAttachedFile(null)
    setAttachPreview(null)
  }

  async function handleSend() {
    if (!selectedPhone || !body.trim()) return
    setSending(true)
    try {
      // TRK-PC-013: Upload file to Cloud Storage if attached
      let mediaUrl: string | undefined
      if (attachedFile) {
        try {
          const formData = new FormData()
          formData.append('file', attachedFile)
          formData.append('client_id', client.client_id)
          const uploadRes = await fetch('/api/comms/upload-media', {
            method: 'POST',
            body: formData,
          })
          const uploadData = await uploadRes.json()
          if (uploadData.success && uploadData.data?.url) {
            mediaUrl = uploadData.data.url
          } else {
            showToast('Failed to upload attachment', 'error')
            setSending(false)
            return
          }
        } catch {
          showToast('Failed to upload attachment', 'error')
          setSending(false)
          return
        }
      }

      const result = await apiPost('/api/comms/send-sms', {
        to: selectedPhone,
        body: body.trim(),
        client_id: client.client_id,
        ...(mediaUrl && { mediaUrl }),
      })
      if (result.success) {
        showToast(attachedFile ? 'MMS sent' : 'SMS sent', 'success')
        setBody('')
        clearAttachment()
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
            <span className="text-[10px] text-[var(--text-muted)]">via Twilio</span>
          </div>

          {/* TRK-PC-012: File attachment */}
          <div className="mt-3 flex items-center gap-2">
            <label className="flex cursor-pointer items-center gap-1.5 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-xs text-[var(--text-muted)] transition-colors hover:border-[var(--portal)] hover:text-[var(--portal)]">
              <span className="material-icons-outlined" style={{ fontSize: '14px' }}>attach_file</span>
              Attach File
              <input
                type="file"
                accept="image/jpeg,image/png,application/pdf"
                onChange={handleFileSelect}
                disabled={sending}
                className="hidden"
              />
            </label>
            <span className="text-[10px] text-[var(--text-muted)]">JPEG, PNG, PDF &middot; Max 5MB</span>
          </div>

          {/* Attachment preview */}
          {attachedFile && (
            <div className="mt-2 flex items-center gap-2 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2">
              {attachPreview ? (
                <img src={attachPreview} alt="Preview" className="h-10 w-10 rounded object-cover" />
              ) : (
                <span className="flex h-10 w-10 items-center justify-center rounded bg-red-500/10">
                  <span className="material-icons-outlined text-red-400" style={{ fontSize: '18px' }}>picture_as_pdf</span>
                </span>
              )}
              <div className="flex-1 min-w-0">
                <p className="truncate text-xs font-medium text-[var(--text-primary)]">{attachedFile.name}</p>
                <p className="text-[10px] text-[var(--text-muted)]">{(attachedFile.size / 1024).toFixed(0)} KB</p>
              </div>
              <button
                type="button"
                onClick={clearAttachment}
                disabled={sending}
                className="flex h-6 w-6 items-center justify-center rounded transition-colors hover:bg-red-500/10"
              >
                <span className="material-icons-outlined text-[var(--text-muted)]" style={{ fontSize: '14px' }}>close</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}
