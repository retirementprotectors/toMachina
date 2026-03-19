'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from './Toast'
import { DraggableFAB } from './DraggableFAB'
import { fetchWithAuth } from '../modules/fetchWithAuth'

// ---------------------------------------------------------------------------
// Intake FAB — Floating Action Button for quick data entry
// 3 quick actions: Quick Client, Upload Document, Paste Data
// ---------------------------------------------------------------------------

interface FABAction {
  key: string
  label: string
  icon: string
  color: string
}

const FAB_ACTIONS: FABAction[] = [
  { key: 'quick-client', label: 'Quick Client', icon: 'person_add', color: 'var(--portal)' },
  { key: 'upload-doc', label: 'Upload Document', icon: 'upload_file', color: '#f59e0b' },
  { key: 'paste-data', label: 'Paste Data', icon: 'content_paste', color: '#8b5cf6' },
]

// ========================================================================
// PASTE PARSER — detect tab-delimited, CSV, or key-value pairs
// ========================================================================

interface ParsedFields {
  first_name?: string
  last_name?: string
  phone?: string
  email?: string
  dob?: string
  address?: string
  city?: string
  state?: string
  zip?: string
}

const FIELD_ALIASES: Record<string, keyof ParsedFields> = {
  'first name': 'first_name', 'first_name': 'first_name', 'firstname': 'first_name', 'first': 'first_name', 'fname': 'first_name',
  'last name': 'last_name', 'last_name': 'last_name', 'lastname': 'last_name', 'last': 'last_name', 'lname': 'last_name',
  'phone': 'phone', 'phone number': 'phone', 'phone_number': 'phone', 'cell': 'phone', 'mobile': 'phone', 'telephone': 'phone',
  'email': 'email', 'email address': 'email', 'email_address': 'email', 'e-mail': 'email',
  'dob': 'dob', 'date of birth': 'dob', 'date_of_birth': 'dob', 'birthdate': 'dob', 'birth date': 'dob', 'birthday': 'dob',
  'address': 'address', 'street': 'address', 'street address': 'address', 'address1': 'address',
  'city': 'city',
  'state': 'state', 'st': 'state',
  'zip': 'zip', 'zipcode': 'zip', 'zip code': 'zip', 'zip_code': 'zip', 'postal': 'zip', 'postal code': 'zip',
}

function parsePastedText(text: string): ParsedFields {
  const result: ParsedFields = {}
  const lines = text.trim().split('\n').map((l) => l.trim()).filter(Boolean)
  if (lines.length === 0) return result

  // Strategy 1: Key-value pairs (e.g., "First Name: John" or "First Name = John")
  const kvLines = lines.filter((l) => /[:=]/.test(l))
  if (kvLines.length >= 2) {
    for (const line of kvLines) {
      const match = line.match(/^([^:=]+)\s*[:=]\s*(.+)$/)
      if (match) {
        const key = match[1].trim().toLowerCase()
        const value = match[2].trim()
        const fieldKey = FIELD_ALIASES[key]
        if (fieldKey) {
          result[fieldKey] = value
        }
      }
    }
    if (Object.keys(result).length >= 1) return result
  }

  // Strategy 2: Tab-delimited with header row
  const tabColumns = lines[0].split('\t')
  if (tabColumns.length >= 2 && lines.length >= 2) {
    const headers = tabColumns.map((h) => h.trim().toLowerCase())
    const values = lines[1].split('\t').map((v) => v.trim())
    for (let i = 0; i < headers.length; i++) {
      const fieldKey = FIELD_ALIASES[headers[i]]
      if (fieldKey && values[i]) {
        result[fieldKey] = values[i]
      }
    }
    if (Object.keys(result).length >= 1) return result
  }

  // Strategy 3: CSV with header row
  const csvColumns = lines[0].split(',')
  if (csvColumns.length >= 2 && lines.length >= 2) {
    const headers = csvColumns.map((h) => h.trim().toLowerCase().replace(/^"|"$/g, ''))
    const values = lines[1].split(',').map((v) => v.trim().replace(/^"|"$/g, ''))
    for (let i = 0; i < headers.length; i++) {
      const fieldKey = FIELD_ALIASES[headers[i]]
      if (fieldKey && values[i]) {
        result[fieldKey] = values[i]
      }
    }
    if (Object.keys(result).length >= 1) return result
  }

  // Strategy 4: Heuristic — detect email, phone, name from unstructured lines
  for (const line of lines) {
    const trimmed = line.trim()
    // Email detection
    if (!result.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      result.email = trimmed
      continue
    }
    // Phone detection (7+ digits)
    const digits = trimmed.replace(/\D/g, '')
    if (!result.phone && digits.length >= 7 && digits.length <= 11 && /[\d()\-.\s]{7,}/.test(trimmed)) {
      result.phone = trimmed
      continue
    }
    // Date detection (MM/DD/YYYY, YYYY-MM-DD, etc.)
    if (!result.dob && /^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}$/.test(trimmed)) {
      result.dob = trimmed
      continue
    }
    if (!result.dob && /^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      result.dob = trimmed
      continue
    }
    // Name detection — if we don't have names yet and it looks like "First Last"
    if (!result.first_name && !result.last_name && /^[A-Za-z]+\s+[A-Za-z]+/.test(trimmed)) {
      const parts = trimmed.split(/\s+/)
      result.first_name = parts[0]
      result.last_name = parts.slice(1).join(' ')
      continue
    }
  }

  return result
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function IntakeFAB() {
  const router = useRouter()
  const { showToast } = useToast()
  const [expanded, setExpanded] = useState(false)
  const [pasteModalOpen, setPasteModalOpen] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [pasteProcessing, setPasteProcessing] = useState(false)
  const fabRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Close expanded menu on click outside
  useEffect(() => {
    if (!expanded) return

    function handleClickOutside(e: MouseEvent) {
      if (fabRef.current && !fabRef.current.contains(e.target as Node)) {
        setExpanded(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [expanded])

  // Close on Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (pasteModalOpen) {
          setPasteModalOpen(false)
          setPasteText('')
        } else if (expanded) {
          setExpanded(false)
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [expanded, pasteModalOpen])

  const handleAction = useCallback((key: string) => {
    setExpanded(false)

    switch (key) {
      case 'quick-client':
        router.push('/intake')
        break
      case 'upload-doc':
        fileInputRef.current?.click()
        break
      case 'paste-data':
        setPasteModalOpen(true)
        break
    }
  }, [router])

  const handleFileSelect = useCallback(async (_e: React.ChangeEvent<HTMLInputElement>) => {
    const input = fileInputRef.current
    if (input?.files?.length) {
      const file = input.files[0]
      const size = formatFileSize(file.size)
      try {
        const res = await fetchWithAuth('/api/dropzone', {
          method: 'POST',
          body: JSON.stringify({
            source: 'INTAKE_UPLOAD',
            file_name: file.name,
            file_type: file.type,
            file_size: file.size,
          }),
        })
        if (res.ok) {
          showToast(`Document queued: ${file.name} (${size})`, 'success')
        } else {
          const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
          showToast(`Upload failed: ${(body as Record<string, string>).error || res.status}`, 'error')
        }
      } catch (err) {
        showToast(`Upload failed: ${err instanceof Error ? err.message : 'Network error'}`, 'error')
      }
      // Reset input so the same file can be selected again
      input.value = ''
    }
  }, [showToast])

  const handlePasteProcess = useCallback(async () => {
    if (!pasteText.trim()) return
    setPasteProcessing(true)

    try {
      const parsed = parsePastedText(pasteText)
      const fieldCount = Object.keys(parsed).length

      if (fieldCount === 0) {
        showToast('Could not detect any fields in the pasted text. Try key-value, tab-delimited, or CSV format.', 'warning')
        setPasteProcessing(false)
        return
      }

      // Encode parsed fields as JSON query param for the intake page
      const prefill = encodeURIComponent(JSON.stringify(parsed))
      const fieldNames = Object.keys(parsed).map((k) => k.replace(/_/g, ' ')).join(', ')
      showToast(`Detected ${fieldCount} field${fieldCount > 1 ? 's' : ''}: ${fieldNames}`, 'success')

      setPasteProcessing(false)
      setPasteModalOpen(false)
      setPasteText('')
      router.push(`/intake?prefill=${prefill}`)
    } catch {
      showToast('Failed to parse pasted data. Please check the format.', 'error')
      setPasteProcessing(false)
    }
  }, [pasteText, router, showToast])

  return (
    <>
      {/* Hidden file input for document upload */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.png,.jpg,.jpeg"
        onChange={handleFileSelect}
      />

      {/* FAB container — wrapped in DraggableFAB */}
      <DraggableFAB fabId="intake-fab" defaultPosition={{ bottom: 24, right: 96 }}>
        <div ref={fabRef} className="flex flex-col items-end gap-3">
          {/* Expanded action buttons — animate up from FAB */}
          {expanded && (
            <div className="flex flex-col gap-2 mb-1">
              {FAB_ACTIONS.map((action, index) => (
                <button
                  key={action.key}
                  onClick={() => handleAction(action.key)}
                  className="flex items-center gap-3 rounded-full py-2.5 pl-4 pr-5 text-white shadow-lg transition-all duration-200 hover:brightness-110"
                  style={{
                    background: action.color,
                    animationDelay: `${index * 50}ms`,
                    animation: 'fabSlideUp 200ms ease-out forwards',
                    opacity: 0,
                    transform: 'translateY(8px)',
                  }}
                >
                  <span className="material-icons-outlined" style={{ fontSize: '20px' }}>
                    {action.icon}
                  </span>
                  <span className="text-sm font-medium whitespace-nowrap">{action.label}</span>
                </button>
              ))}
            </div>
          )}

          {/* Main FAB button */}
          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-all duration-200 hover:brightness-110 hover:shadow-xl"
            style={{
              background: 'var(--portal)',
              transform: expanded ? 'rotate(45deg)' : 'rotate(0deg)',
            }}
            title={expanded ? 'Close menu' : 'Quick actions'}
          >
            <span className="material-icons-outlined text-white" style={{ fontSize: '24px' }}>
              bolt
            </span>
          </button>
        </div>
      </DraggableFAB>

      {/* Inline keyframe animation */}
      <style>{`
        @keyframes fabSlideUp {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>

      {/* Paste Data Modal */}
      {pasteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => {
              setPasteModalOpen(false)
              setPasteText('')
            }}
          />

          {/* Modal */}
          <div className="relative z-10 mx-4 w-full max-w-lg rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 shadow-2xl">
            <div className="mb-4 flex items-center gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-lg"
                style={{ background: 'rgba(139,92,246,0.15)' }}
              >
                <span className="material-icons-outlined" style={{ fontSize: '22px', color: '#8b5cf6' }}>
                  content_paste
                </span>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-[var(--text-primary)]">
                  Paste Portal Data
                </h3>
                <p className="text-xs text-[var(--text-muted)]">
                  Paste data from carrier portals, CSV, or any structured text
                </p>
              </div>
            </div>

            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              rows={8}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-3 text-sm text-[var(--text-primary)] outline-none transition-colors placeholder:text-[var(--text-muted)] focus:border-[var(--portal)]"
              placeholder="Paste data from carrier portal, CSV, or any structured text..."
              autoFocus
            />

            <div className="mt-4 flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  setPasteModalOpen(false)
                  setPasteText('')
                }}
                className="rounded-lg px-4 py-2 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)]"
              >
                Cancel
              </button>
              <button
                onClick={handlePasteProcess}
                disabled={!pasteText.trim() || pasteProcessing}
                className="inline-flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-medium text-white transition-colors hover:brightness-110 disabled:opacity-50"
                style={{ background: '#8b5cf6' }}
              >
                <span className="material-icons-outlined" style={{ fontSize: '18px' }}>
                  {pasteProcessing ? 'hourglass_empty' : 'play_arrow'}
                </span>
                {pasteProcessing ? 'Processing...' : 'Process'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
