'use client'

import { useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { collection, query, where, getDocs, addDoc } from 'firebase/firestore'
import { getDb } from '@tomachina/db'
import type { Client } from '@tomachina/core'

// ---------------------------------------------------------------------------
// Quick Intake — One-screen client creation with auto-dedup
// ---------------------------------------------------------------------------

interface IntakeForm {
  first_name: string
  last_name: string
  phone: string
  email: string
  dob: string
  address: string
  city: string
  state: string
  zip: string
  source: string
}

const EMPTY_FORM: IntakeForm = {
  first_name: '', last_name: '', phone: '', email: '', dob: '',
  address: '', city: '', state: '', zip: '', source: '',
}

const SOURCE_OPTIONS = [
  'Referral', 'Walk-In', 'Phone Call', 'Website', 'Event',
  'DAVID Partner', 'Marketing Campaign', 'Other',
]

export default function QuickIntakePage() {
  const router = useRouter()
  const [form, setForm] = useState<IntakeForm>(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [checking, setChecking] = useState(false)
  const [duplicates, setDuplicates] = useState<Client[]>([])
  const [dupChecked, setDupChecked] = useState(false)
  const [error, setError] = useState('')

  const isValid = useMemo(() => {
    return form.first_name.trim() && form.last_name.trim() && (form.phone.trim() || form.email.trim())
  }, [form])

  const updateField = useCallback((key: keyof IntakeForm, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setDupChecked(false)
    setDuplicates([])
  }, [])

  // Auto-dedup check
  const checkDuplicates = useCallback(async () => {
    if (!form.first_name.trim() || !form.last_name.trim()) return

    setChecking(true)
    setDuplicates([])
    try {
      const db = getDb()
      const results: Client[] = []

      // Search by name match
      const nameQuery = query(
        collection(db, 'clients'),
        where('last_name', '==', form.last_name.trim())
      )
      const nameSnap = await getDocs(nameQuery)
      nameSnap.forEach((doc) => {
        const c = { ...doc.data(), _id: doc.id } as unknown as Client
        const fn = String(c.first_name || '').toLowerCase()
        if (fn === form.first_name.trim().toLowerCase() || fn.startsWith(form.first_name.trim().toLowerCase().slice(0, 3))) {
          results.push(c)
        }
      })

      // Search by phone if provided
      if (form.phone.trim()) {
        const digits = form.phone.replace(/\D/g, '')
        if (digits.length >= 7) {
          const phoneQuery = query(
            collection(db, 'clients'),
            where('phone', '==', digits)
          )
          const phoneSnap = await getDocs(phoneQuery)
          phoneSnap.forEach((doc) => {
            const c = { ...doc.data(), _id: doc.id } as unknown as Client
            if (!results.find((r) => String(r._id) === String(c._id))) {
              results.push(c)
            }
          })
        }
      }

      // Search by email if provided
      if (form.email.trim()) {
        const emailQuery = query(
          collection(db, 'clients'),
          where('email', '==', form.email.trim().toLowerCase())
        )
        const emailSnap = await getDocs(emailQuery)
        emailSnap.forEach((doc) => {
          const c = { ...doc.data(), _id: doc.id } as unknown as Client
          if (!results.find((r) => String(r._id) === String(c._id))) {
            results.push(c)
          }
        })
      }

      setDuplicates(results)
      setDupChecked(true)
    } catch (err) {
      console.error('Dedup check failed:', err)
    } finally {
      setChecking(false)
    }
  }, [form])

  // Submit new client
  const handleSubmit = useCallback(async () => {
    if (!isValid) return
    if (!dupChecked) {
      await checkDuplicates()
      return
    }

    setSubmitting(true)
    setError('')
    try {
      const db = getDb()
      const now = new Date().toISOString()
      const clientData: Record<string, unknown> = {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        client_status: 'Prospect',
        created_at: now,
        updated_at: now,
        import_source: 'quick_intake',
      }

      if (form.phone.trim()) clientData.phone = form.phone.replace(/\D/g, '')
      if (form.email.trim()) clientData.email = form.email.trim().toLowerCase()
      if (form.dob) clientData.dob = form.dob
      if (form.address.trim()) clientData.address = form.address.trim()
      if (form.city.trim()) clientData.city = form.city.trim()
      if (form.state.trim()) clientData.state = form.state.trim()
      if (form.zip.trim()) clientData.zip = form.zip.trim()
      if (form.source) clientData.source = form.source

      const docRef = await addDoc(collection(db, 'clients'), clientData)
      router.push(`/contacts/${docRef.id}`)
    } catch (err) {
      console.error('Failed to create client:', err)
      setError('Failed to create client. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }, [form, isValid, dupChecked, checkDuplicates, router])

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Quick Intake</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">Create a new client record. Duplicates are checked automatically.</p>
      </div>

      {/* Form */}
      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 space-y-6">
        {/* Required Fields */}
        <div>
          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            <span className="material-icons-outlined text-[16px] text-[var(--portal)]">person_add</span>
            Required Information
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="First Name" value={form.first_name} onChange={(v) => updateField('first_name', v)} required />
            <FormField label="Last Name" value={form.last_name} onChange={(v) => updateField('last_name', v)} required />
            <FormField label="Phone" value={form.phone} onChange={(v) => updateField('phone', v)} type="tel" placeholder="(555) 123-4567" />
            <FormField label="Email" value={form.email} onChange={(v) => updateField('email', v)} type="email" placeholder="client@example.com" />
          </div>
          <p className="mt-2 text-xs text-[var(--text-muted)]">At least one contact method (phone or email) is required.</p>
        </div>

        {/* Optional Fields */}
        <div>
          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            <span className="material-icons-outlined text-[16px] text-[var(--portal)]">info</span>
            Additional Details
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Date of Birth" value={form.dob} onChange={(v) => updateField('dob', v)} type="date" />
            <div>
              <label className="mb-1 block text-xs uppercase tracking-wide text-[var(--text-muted)]">Source</label>
              <select
                value={form.source}
                onChange={(e) => updateField('source', e.target.value)}
                className="w-full rounded-md border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--portal)] transition-colors"
              >
                <option value="">-- Select Source --</option>
                {SOURCE_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-4">
            <FormField label="Street Address" value={form.address} onChange={(v) => updateField('address', v)} className="sm:col-span-2" />
            <FormField label="City" value={form.city} onChange={(v) => updateField('city', v)} />
            <div className="grid grid-cols-2 gap-3">
              <FormField label="State" value={form.state} onChange={(v) => updateField('state', v)} />
              <FormField label="ZIP" value={form.zip} onChange={(v) => updateField('zip', v)} />
            </div>
          </div>
        </div>

        {/* Duplicate Warning */}
        {dupChecked && duplicates.length > 0 && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-amber-400">
              <span className="material-icons-outlined text-[18px]">warning</span>
              Possible Duplicates Found ({duplicates.length})
            </div>
            <div className="mt-3 space-y-2">
              {duplicates.map((dup, i) => (
                <a
                  key={i}
                  href={`/contacts/${dup._id || dup.client_id}`}
                  className="flex items-center justify-between rounded-md bg-[var(--bg-card)] p-3 text-sm transition-colors hover:bg-[var(--bg-hover)]"
                >
                  <div>
                    <span className="font-medium text-[var(--text-primary)]">
                      {[dup.first_name, dup.last_name].filter(Boolean).join(' ')}
                    </span>
                    <span className="ml-2 text-xs text-[var(--text-muted)]">
                      {String(dup.phone || '')} &middot; {String(dup.email || '')}
                    </span>
                  </div>
                  <span className="material-icons-outlined text-[16px] text-[var(--text-muted)]">open_in_new</span>
                </a>
              ))}
            </div>
            <p className="mt-3 text-xs text-amber-400/80">
              Click a name above to view the existing record. Click &ldquo;Create Anyway&rdquo; to proceed with a new record.
            </p>
          </div>
        )}

        {dupChecked && duplicates.length === 0 && (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3">
            <div className="flex items-center gap-2 text-sm font-medium text-emerald-400">
              <span className="material-icons-outlined text-[18px]">check_circle</span>
              No duplicates found. Ready to create.
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3">
            <div className="flex items-center gap-2 text-sm text-red-400">
              <span className="material-icons-outlined text-[18px]">error</span>
              {error}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 border-t border-[var(--border-subtle)] pt-4">
          {!dupChecked ? (
            <button
              onClick={checkDuplicates}
              disabled={!isValid || checking}
              className="inline-flex items-center gap-2 rounded-lg bg-[var(--portal)] px-6 py-2.5 text-sm font-medium text-white transition-colors hover:brightness-110 disabled:opacity-50"
            >
              <span className="material-icons-outlined text-[18px]">{checking ? 'hourglass_empty' : 'search'}</span>
              {checking ? 'Checking...' : 'Check for Duplicates'}
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={!isValid || submitting}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-500 disabled:opacity-50"
            >
              <span className="material-icons-outlined text-[18px]">{submitting ? 'hourglass_empty' : 'person_add'}</span>
              {submitting ? 'Creating...' : duplicates.length > 0 ? 'Create Anyway' : 'Create Client'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Form Field Component
// ---------------------------------------------------------------------------

function FormField({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  required,
  className,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
  placeholder?: string
  required?: boolean
  className?: string
}) {
  return (
    <div className={className}>
      <label className="mb-1 block text-xs uppercase tracking-wide text-[var(--text-muted)]">
        {label}
        {required && <span className="ml-0.5 text-red-400">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-md border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--portal)] transition-colors placeholder:text-[var(--text-muted)]"
      />
    </div>
  )
}
