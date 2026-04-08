'use client'

import { useState, useRef, useCallback, useMemo, useEffect } from 'react'
import Link from 'next/link'
import type { Client } from '@tomachina/core'
import { dex } from '@tomachina/core'
import { getAge, getInitials, hashColor } from '../lib/formatters'
import { AI3Report } from './AI3Report'
import { getAuth } from 'firebase/auth'
import { useToast } from '@tomachina/ui'
import { addDoc, collection, getDocs, query, orderBy } from 'firebase/firestore'
import { getDb } from '@tomachina/db'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AI3Data {
  client: Record<string, unknown>
  accounts: Array<Record<string, unknown> & { category: string }>
  connected_contacts: Array<Record<string, unknown>>
  access_items: Array<Record<string, unknown>>
  recent_activities: Array<Record<string, unknown>>
  generated_at: string
  generated_by: string
}

interface ClientHeaderProps {
  client: Client
  clientId: string
  /** Open Comms panel with a specific channel pre-selected */
  onCommsAction?: (channel: 'sms' | 'email' | 'call') => void
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

// Pull all 13 platforms, 7 reg types, 4 actions from core config (single source of truth)
const KIT_PLATFORMS = dex.PLATFORMS
const KIT_REG_TYPES = dex.REGISTRATION_TYPES
const KIT_ACTIONS = dex.ACCOUNT_ACTIONS

interface KitBuildResult {
  kit_id: string
  form_count: number
  layers?: Record<string, unknown[]>
  forms?: Array<{ form_id: string; form_name: string }>
}

export function ClientHeader({ client, clientId: _clientId, onCommsAction }: ClientHeaderProps) {
  const fullName = [client.first_name, client.last_name].filter(Boolean).join(' ') || 'Unknown'
  // Strip all quote characters from preferred_name and first_name
  const stripQuotes = (s: string) => s.replace(/["']/g, '').replace(/\s+/g, ' ').trim()
  const rawPref = client.preferred_name as string
  const cleanPref = rawPref ? stripQuotes(rawPref) : ''
  const cleanFirst = client.first_name ? stripQuotes(String(client.first_name)) : ''
  const displayName = cleanPref || cleanFirst || fullName
  const status = (client.status as string) || (client.client_status as string) || 'Unknown'
  const initials = getInitials(fullName)
  const avatarColor = hashColor(fullName)
  const facebookUrl = client.facebook_url as string | undefined

  // Meta
  const age = getAge(client.dob)
  const location = [client.city, client.state].filter(Boolean).join(', ')
  const timezone = client.timezone as string | undefined
  const [ai3Loading, setAi3Loading] = useState(false)
  const [ai3Data, setAi3Data] = useState<AI3Data | null>(null)
  const ai3Ref = useRef<HTMLDivElement>(null)
  const { showToast } = useToast()

  // New Account modal state
  const [showNewAccount, setShowNewAccount] = useState(false)

  // Generate Kit state
  const [showKitDialog, setShowKitDialog] = useState(false)
  const [kitPlatform, setKitPlatform] = useState('')
  const [kitRegType, setKitRegType] = useState('')
  const [kitAction, setKitAction] = useState('')
  const [kitBuilding, setKitBuilding] = useState(false)
  const [kitResult, setKitResult] = useState<KitBuildResult | null>(null)
  const [kitError, setKitError] = useState<string | null>(null)
  const [kitCreatingPackage, setKitCreatingPackage] = useState(false)
  const [kitPackageCreated, setKitPackageCreated] = useState(false)

  const kitFormReady = useMemo(() => kitPlatform && kitRegType && kitAction, [kitPlatform, kitRegType, kitAction])

  const handleBuildKit = useCallback(async () => {
    if (!kitFormReady) return
    setKitBuilding(true)
    setKitError(null)
    setKitResult(null)
    try {
      const res = await fetch('/api/dex/kits/build', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: client.client_id || _clientId,
          product_type: kitPlatform,
          registration_type: kitRegType,
          action: kitAction,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setKitResult(data.data as KitBuildResult)
        showToast(`Kit built with ${String(data.data.form_count)} forms`, 'success')
      } else {
        setKitError(data.error || 'Kit build failed')
      }
    } catch {
      setKitError('Network error — please try again')
    } finally {
      setKitBuilding(false)
    }
  }, [kitFormReady, kitPlatform, kitRegType, kitAction, client.client_id, _clientId, showToast])

  const handleCreatePackage = useCallback(async () => {
    if (!kitResult) return
    setKitCreatingPackage(true)
    setKitError(null)
    try {
      const clientName = [client.first_name, client.last_name].filter(Boolean).join(' ')
      const res = await fetch('/api/dex-pipeline/packages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kit_id: kitResult.kit_id,
          client_id: client.client_id || _clientId,
          client_name: clientName,
          client_email: (client.email as string) || '',
          kit_name: `${kitPlatform} - ${kitRegType} - ${kitAction}`,
          form_ids: kitResult.forms?.map(f => f.form_id) || [],
          delivery_method: 'EMAIL',
        }),
      })
      const data = await res.json()
      if (data.success) {
        setKitPackageCreated(true)
        showToast('Package created — view it in DEX Tracker', 'success')
      } else {
        setKitError(data.error || 'Package creation failed')
      }
    } catch {
      setKitError('Network error creating package')
    } finally {
      setKitCreatingPackage(false)
    }
  }, [kitResult, client, _clientId, kitPlatform, kitRegType, kitAction, showToast])

  const resetKitDialog = () => {
    setShowKitDialog(false)
    setKitPlatform('')
    setKitRegType('')
    setKitAction('')
    setKitResult(null)
    setKitError(null)
    setKitPackageCreated(false)
  }

  const handleAI3 = async () => {
    setAi3Loading(true)
    try {
      const auth = getAuth()
      const token = await auth.currentUser?.getIdToken()

      // 1. Fetch aggregated data from AI3 endpoint
      const res = await fetch(`/api/ai3/${_clientId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error || 'Failed to fetch AI3 data')

      setAi3Data(json.data as AI3Data)

      // 2. Wait for React to render the hidden report
      await new Promise(resolve => setTimeout(resolve, 500))

      // 3. Capture to canvas via dynamic import
      const { default: html2canvas } = await import('html2canvas')
      const { jsPDF } = await import('jspdf')

      const reportEl = ai3Ref.current
      if (!reportEl) throw new Error('Report element not found')

      const canvas = await html2canvas(reportEl, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
      })

      // 4. Generate PDF
      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF('p', 'mm', 'letter')
      const pageWidth = pdf.internal.pageSize.getWidth()
      const imgWidth = pageWidth - 20 // 10mm margins
      const imgHeight = (canvas.height * imgWidth) / canvas.width

      // Handle multi-page
      let yOffset = 10
      const pageHeight = pdf.internal.pageSize.getHeight() - 20
      let remainingHeight = imgHeight

      while (remainingHeight > 0) {
        if (yOffset > 10) pdf.addPage()
        pdf.addImage(imgData, 'PNG', 10, yOffset - (imgHeight - remainingHeight), imgWidth, imgHeight)
        remainingHeight -= pageHeight
        yOffset = 10
      }

      // 5. Download
      const clientName = [json.data.client.first_name, json.data.client.last_name].filter(Boolean).join('_')
      const date = new Date().toISOString().slice(0, 10)
      pdf.save(`AI3_Report_${clientName}_${date}.pdf`)

    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      if (message.includes('Session expired') || message.includes('sign out')) {
        showToast('Session expired. Please sign out and sign back in.', 'warning')
      } else {
        showToast('AI3 report generation failed. Please try again.', 'error')
      }
    } finally {
      setAi3Loading(false)
      setAi3Data(null)
    }
  }

  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6">
      {/* Row 1: Avatar + Name + Status + Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-5">
          {/* Avatar — Facebook pic or initials */}
          {facebookUrl ? (
            <img
              src={facebookUrl}
              alt={fullName}
              className="h-14 w-14 shrink-0 rounded-full object-cover"
              onError={(e) => {
                // Fallback to initials on image error
                const el = e.currentTarget
                el.style.display = 'none'
                el.nextElementSibling?.classList.remove('hidden')
              }}
            />
          ) : null}
          <div
            className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-lg font-bold text-white ${facebookUrl ? 'hidden' : ''}`}
            style={{ backgroundColor: avatarColor }}
          >
            {initials}
          </div>

          {/* Name block */}
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-[var(--text-primary)]">{displayName}</h1>
              <StatusBadge status={status} />
              {String(client.contact_quality_score || '') && (
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  String(client.contact_quality_score) === 'green' ? 'bg-emerald-500/15 text-emerald-400' :
                  String(client.contact_quality_score) === 'yellow' ? 'bg-amber-500/15 text-amber-400' :
                  'bg-red-500/15 text-red-400'
                }`}>
                  {String(client.contact_quality_score) === 'green' ? 'High Quality' :
                   String(client.contact_quality_score) === 'yellow' ? 'Medium Quality' : 'Low Quality'}
                </span>
              )}
              {client.household_id && (
                <Link
                  href={`/households/${client.household_id}?ref=/contacts/${client.client_id || _clientId}`}
                  className="inline-flex items-center gap-1 rounded-full border border-[var(--portal)]/30 bg-[var(--portal)]/10 px-2.5 py-0.5 text-xs font-medium text-[var(--portal)] transition-colors hover:bg-[var(--portal)]/20"
                  title="View Household"
                >
                  <span className="material-icons-outlined text-[12px]">home</span>
                  Household
                </Link>
              )}
            </div>
            {displayName !== fullName && (
              <p className="mt-0.5 text-sm text-[var(--text-muted)]">{fullName}</p>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {/* Generate Kit Button */}
          <button
            onClick={() => setShowKitDialog(true)}
            className="inline-flex items-center gap-1.5 rounded border border-[var(--portal)] bg-transparent px-4 py-1.5 text-sm font-medium transition-all hover:bg-[var(--portal)] hover:text-white"
            style={{ color: 'var(--portal)' }}
            title="Generate a DEX form kit for this client"
          >
            <span className="material-icons-outlined text-[18px]">inventory_2</span>
            Generate Kit
          </button>

          {/* AI3 Button */}
          <button
            onClick={handleAI3}
            disabled={ai3Loading}
            className="inline-flex items-center gap-1.5 rounded bg-[var(--portal)] px-4 py-1.5 text-sm font-medium text-white transition-all hover:brightness-110 disabled:opacity-50"
            title="Generate AI3 Report (Assets, Income, Insurance, Inventory)"
          >
            {ai3Loading ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <span className="material-icons-outlined text-[18px]">description</span>
            )}
            AI3
          </button>

          {/* + New Account Button */}
          <button
            onClick={() => setShowNewAccount(true)}
            className="inline-flex items-center gap-1.5 rounded bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white transition-all hover:bg-emerald-500"
            title="Add a new account for this client"
          >
            <span className="material-icons-outlined text-[18px]">add</span>
            New Account
          </button>
        </div>
      </div>

      {/* Row 2: Meta chips */}
      <div className="mt-4 flex flex-wrap gap-2">
        {age != null && (
          <MetaChip icon="cake" label={`${age} yrs`} />
        )}
        {location && (
          <MetaChip icon="location_on" label={location} />
        )}
        {timezone && (
          <MetaChip icon="schedule" label={String(timezone)} />
        )}
      </div>

      {/* Row 3: Comms Quick Actions — own row, data-aware */}
      {onCommsAction && (() => {
        const cellPhone = (client.cell_phone as string) || ''
        const primaryPhone = (client.phone as string) || ''
        const altPhone = (client.alt_phone as string) || ''
        const phoneType = ((client.phone_type as string) || '').toLowerCase()
        const altPhoneType = ((client.alt_phone_type as string) || '').toLowerCase()
        const email = (client.email as string) || ''

        const isValidPhone = (p: string) => p.replace(/[^0-9]/g, '').length >= 10
        const isCellType = (t: string) => t === 'cell' || t === 'mobile'

        // Can we CALL? Any phone number present
        const hasAnyPhone = isValidPhone(cellPhone) || isValidPhone(primaryPhone) || isValidPhone(altPhone)
        const bestCallNumber = isValidPhone(cellPhone) ? cellPhone : isValidPhone(primaryPhone) ? primaryPhone : altPhone

        // Can we TEXT? Cell phone field always works. Primary/Alt work only if type is Cell/Mobile
        const canText = isValidPhone(cellPhone)
          || (isValidPhone(primaryPhone) && isCellType(phoneType))
          || (isValidPhone(altPhone) && isCellType(altPhoneType))
        const bestTextNumber = isValidPhone(cellPhone) ? cellPhone
          : (isValidPhone(primaryPhone) && isCellType(phoneType)) ? primaryPhone
          : altPhone

        // Can we EMAIL?
        const hasEmail = email.includes('@')

        // Build tooltip with the actual number/email that will be used
        const callTip = hasAnyPhone ? `Call ${bestCallNumber}` : 'No phone number on file'
        const textTip = canText ? `Text ${bestTextNumber}` : 'No mobile number on file'
        const emailTip = hasEmail ? `Email ${email}` : 'No email on file'

        const btnBase = 'inline-flex items-center gap-1.5 rounded-lg border px-4 py-2 text-sm font-medium transition-all'
        const btnActive = (color: string) => `border-${color}-500/30 bg-${color}-500/10 text-${color}-400 hover:bg-${color}-500/20 cursor-pointer`
        const btnDisabled = 'border-[var(--border-subtle)] bg-transparent text-[var(--text-muted)] opacity-30 cursor-not-allowed'

        return (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              onClick={() => hasAnyPhone ? onCommsAction('call') : undefined}
              disabled={!hasAnyPhone}
              className={`${btnBase} ${hasAnyPhone ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20' : btnDisabled}`}
              title={callTip}
            >
              <span className="material-icons-outlined text-[16px]">call</span>
              Call
            </button>
            <button
              onClick={() => canText ? onCommsAction('sms') : undefined}
              disabled={!canText}
              className={`${btnBase} ${canText ? 'border-blue-500/30 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20' : btnDisabled}`}
              title={textTip}
            >
              <span className="material-icons-outlined text-[16px]">sms</span>
              Text
            </button>
            <button
              onClick={() => hasEmail ? onCommsAction('email') : undefined}
              disabled={!hasEmail}
              className={`${btnBase} ${hasEmail ? 'border-purple-500/30 bg-purple-500/10 text-purple-400 hover:bg-purple-500/20' : btnDisabled}`}
              title={emailTip}
            >
              <span className="material-icons-outlined text-[16px]">email</span>
              Email
            </button>
          </div>
        )
      })()}

      {/* Generate Kit Dialog — inline panel below the header */}
      {showKitDialog && (
        <div className="mt-4 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">
              <span className="material-icons-outlined mr-1 align-middle" style={{ fontSize: '18px', color: 'var(--portal)' }}>inventory_2</span>
              Generate Kit — {fullName}
            </h3>
            <button
              onClick={resetKitDialog}
              className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            >
              <span className="material-icons-outlined" style={{ fontSize: '18px' }}>close</span>
            </button>
          </div>

          {!kitResult ? (
            <div className="mt-3 space-y-3">
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="text-xs font-medium text-[var(--text-muted)]">Platform</label>
                  <select
                    value={kitPlatform}
                    onChange={(e) => setKitPlatform(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--portal)] focus:outline-none"
                  >
                    <option value="">Select...</option>
                    {KIT_PLATFORMS.map((p) => <option key={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-[var(--text-muted)]">Registration</label>
                  <select
                    value={kitRegType}
                    onChange={(e) => setKitRegType(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--portal)] focus:outline-none"
                  >
                    <option value="">Select...</option>
                    {KIT_REG_TYPES.map((r) => <option key={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-[var(--text-muted)]">Action</label>
                  <select
                    value={kitAction}
                    onChange={(e) => setKitAction(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--portal)] focus:outline-none"
                  >
                    <option value="">Select...</option>
                    {KIT_ACTIONS.map((a) => <option key={a}>{a}</option>)}
                  </select>
                </div>
              </div>

              {kitError && (
                <div className="flex items-center gap-2 rounded-lg bg-red-500/10 px-3 py-2">
                  <span className="material-icons-outlined text-red-400" style={{ fontSize: '14px' }}>error</span>
                  <span className="text-xs text-red-400">{kitError}</span>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={handleBuildKit}
                  disabled={!kitFormReady || kitBuilding}
                  className="inline-flex items-center gap-1.5 rounded px-4 py-1.5 text-sm font-medium text-white transition-all disabled:opacity-50"
                  style={{ backgroundColor: 'var(--portal)' }}
                >
                  {kitBuilding ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    <span className="material-icons-outlined text-[16px]">build</span>
                  )}
                  {kitBuilding ? 'Building...' : 'Build Kit'}
                </button>
                <button
                  onClick={resetKitDialog}
                  className="rounded px-3 py-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              {/* Kit result summary */}
              <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 px-3 py-2">
                <span className="material-icons-outlined text-emerald-400" style={{ fontSize: '16px' }}>check_circle</span>
                <span className="text-sm text-emerald-400">
                  Kit built — {kitResult.form_count} forms assembled
                </span>
              </div>

              <div className="space-y-1 text-xs text-[var(--text-secondary)]">
                <p><strong>Kit ID:</strong> {kitResult.kit_id}</p>
                <p><strong>Config:</strong> {kitPlatform} / {kitRegType} / {kitAction}</p>
              </div>

              {/* Layers preview */}
              {kitResult.layers && (
                <div className="space-y-1.5">
                  {Object.entries(kitResult.layers).map(([layer, layerForms]) => (
                    <div key={layer} className="rounded bg-[var(--bg-card)] px-3 py-2">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                        {layer.replace(/_/g, ' ')}
                      </span>
                      <span className="ml-2 text-[10px] text-[var(--text-muted)]">
                        {(layerForms as unknown[]).length} forms
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {kitError && (
                <div className="flex items-center gap-2 rounded-lg bg-red-500/10 px-3 py-2">
                  <span className="material-icons-outlined text-red-400" style={{ fontSize: '14px' }}>error</span>
                  <span className="text-xs text-red-400">{kitError}</span>
                </div>
              )}

              {!kitPackageCreated ? (
                <div className="flex gap-2">
                  <button
                    onClick={handleCreatePackage}
                    disabled={kitCreatingPackage}
                    className="inline-flex items-center gap-1.5 rounded px-4 py-1.5 text-sm font-medium text-white transition-all disabled:opacity-50"
                    style={{ backgroundColor: 'var(--portal)' }}
                  >
                    {kitCreatingPackage ? (
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    ) : (
                      <span className="material-icons-outlined text-[16px]">package_2</span>
                    )}
                    {kitCreatingPackage ? 'Creating...' : 'Create Package'}
                  </button>
                  <button
                    onClick={resetKitDialog}
                    className="rounded px-3 py-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  >
                    Close
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="material-icons-outlined text-emerald-400" style={{ fontSize: '16px' }}>check_circle</span>
                  <span className="text-sm text-emerald-400">Package created — view in DEX Tracker</span>
                  <button
                    onClick={resetKitDialog}
                    className="ml-auto rounded px-3 py-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  >
                    Done
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* New Account Modal */}
      {showNewAccount && (
        <NewAccountModal
          clientId={client.client_id || _clientId}
          clientName={fullName}
          onClose={() => setShowNewAccount(false)}
        />
      )}

      {/* Hidden AI3 Report — rendered off-screen for PDF capture */}
      {ai3Data && (
        <div style={{ position: 'fixed', left: '-9999px', top: 0 }}>
          <AI3Report ref={ai3Ref} data={ai3Data} />
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// New Account Modal
// ---------------------------------------------------------------------------

interface NewAccountModalProps {
  clientId: string
  clientName: string
  onClose: () => void
}

interface CarrierOption {
  id: string
  name: string
  product_types: string[]
}

function NewAccountModal({ clientId, clientName, onClose }: NewAccountModalProps) {
  const [carriers, setCarriers] = useState<CarrierOption[]>([])
  const [productType, setProductType] = useState('')
  const [carrierName, setCarrierName] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [status, setStatus] = useState('Active')
  const [effectiveDate, setEffectiveDate] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const { showToast } = useToast()

  useEffect(() => {
    getDocs(query(collection(getDb(), 'carriers'), orderBy('name')))
      .then(snap => setCarriers(snap.docs.map(d => ({ id: d.id, ...d.data() }) as CarrierOption)))
      .catch(() => {})
  }, [])

  const allProductTypes = useMemo(() => {
    const types = new Set<string>()
    carriers.forEach(c => (c.product_types || []).forEach(t => types.add(t)))
    return Array.from(types).sort()
  }, [carriers])

  const filteredCarriers = useMemo(() =>
    productType ? carriers.filter(c => (c.product_types || []).includes(productType)) : carriers,
    [carriers, productType]
  )

  const handleSubmit = useCallback(async () => {
    if (!productType || !carrierName) { setError('Product type and carrier are required'); return }
    setSubmitting(true)
    setError('')
    try {
      await addDoc(collection(getDb(), 'clients', clientId, 'accounts'), {
        client_id: clientId,
        carrier_name: carrierName,
        product_type: productType,
        account_number: accountNumber.trim() || null,
        status,
        effective_date: effectiveDate || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      showToast('Account added', 'success')
      onClose()
    } catch {
      setError('Failed to save — please try again')
    } finally {
      setSubmitting(false)
    }
  }, [clientId, productType, carrierName, accountNumber, status, effectiveDate, showToast, onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-5 py-4">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">New Account — {clientName}</h3>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
            <span className="material-icons-outlined" style={{ fontSize: '18px' }}>close</span>
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          {/* Product Type */}
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Product Type *</label>
            <select
              value={productType}
              onChange={e => { setProductType(e.target.value); setCarrierName('') }}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--portal)] focus:outline-none"
            >
              <option value="">Select...</option>
              {allProductTypes.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>

          {/* Carrier */}
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Carrier *</label>
            <select
              value={carrierName}
              onChange={e => setCarrierName(e.target.value)}
              disabled={!productType}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--portal)] focus:outline-none disabled:opacity-50"
            >
              <option value="">Select...</option>
              {filteredCarriers.map(c => <option key={c.id}>{c.name}</option>)}
            </select>
          </div>

          {/* Status + Account Number */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Status</label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value)}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--portal)] focus:outline-none"
              >
                {['Active', 'Pending', 'Inactive'].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Account #</label>
              <input
                type="text"
                value={accountNumber}
                onChange={e => setAccountNumber(e.target.value)}
                placeholder="Optional"
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--portal)] focus:outline-none"
              />
            </div>
          </div>

          {/* Effective Date */}
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Effective Date</label>
            <input
              type="date"
              value={effectiveDate}
              onChange={e => setEffectiveDate(e.target.value)}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--portal)] focus:outline-none"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-500/10 px-3 py-2">
              <span className="material-icons-outlined text-red-400" style={{ fontSize: '14px' }}>error</span>
              <span className="text-xs text-red-400">{error}</span>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-[var(--border-subtle)] px-5 py-4">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)]">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !productType || !carrierName}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-emerald-500 disabled:opacity-50"
          >
            {submitting ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : null}
            {submitting ? 'Saving...' : 'Add Account'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Status Badge
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase()
  let colorClass = 'bg-[var(--bg-surface)] text-[var(--text-muted)]'
  if (s === 'active' || s === 'client') {
    colorClass = 'bg-emerald-500/15 text-emerald-400'
  } else if (s === 'prospect' || s === 'lead') {
    colorClass = 'bg-blue-500/15 text-blue-400'
  } else if (s === 'inactive' || s === 'lost') {
    colorClass = 'bg-red-500/15 text-red-400'
  } else if (s === 'pending') {
    colorClass = 'bg-amber-500/15 text-amber-400'
  } else if (s === 'deceased') {
    colorClass = 'bg-gray-500/15 text-gray-400'
  }

  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${colorClass}`}>
      {status}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Meta Chip
// ---------------------------------------------------------------------------

function MetaChip({ icon, label }: { icon: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-medium)] px-3 py-1 text-xs text-[var(--text-secondary)]">
      <span className="material-icons-outlined text-[14px] text-[var(--text-muted)]">{icon}</span>
      {label}
    </span>
  )
}
