'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import type { Client } from '@tomachina/core'
import { getAge, getInitials, hashColor } from '../lib/formatters'
import { AI3Report } from './AI3Report'
import { getAuth } from 'firebase/auth'
import { useToast } from '@tomachina/ui'

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
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ClientHeader({ client, clientId: _clientId }: ClientHeaderProps) {
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
              {client.household_id && (
                <Link
                  href={`/households/${client.household_id}`}
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
