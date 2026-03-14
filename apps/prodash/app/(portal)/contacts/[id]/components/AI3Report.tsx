'use client'

import { forwardRef } from 'react'

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

interface AI3ReportProps {
  data: AI3Data
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(val: unknown): string {
  if (!val) return '—'
  const s = String(val)
  if (!s || s === 'undefined' || s === 'null') return '—'
  try {
    const d = new Date(s)
    if (isNaN(d.getTime())) return s
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  } catch {
    return s
  }
}

function formatCurrency(val: unknown): string {
  if (val == null || val === '' || val === 0) return '—'
  const n = typeof val === 'number' ? val : parseFloat(String(val))
  if (isNaN(n)) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n)
}

function safeStr(val: unknown): string {
  if (val == null || val === '' || val === 'undefined' || val === 'null') return '—'
  return String(val)
}

function computeAge(dob: unknown): string {
  if (!dob) return '—'
  try {
    const d = new Date(String(dob))
    if (isNaN(d.getTime())) return '—'
    const now = new Date()
    let age = now.getFullYear() - d.getFullYear()
    const m = now.getMonth() - d.getMonth()
    if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--
    return `${age}`
  } catch {
    return '—'
  }
}

// ---------------------------------------------------------------------------
// Inline Styles (required for html2canvas — Tailwind classes don't resolve in hidden div)
// ---------------------------------------------------------------------------

const styles = {
  page: {
    maxWidth: '800px',
    margin: '0 auto',
    padding: '30px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontSize: '12px',
    color: '#1a1a1a',
    backgroundColor: '#ffffff',
    lineHeight: '1.5',
  } as React.CSSProperties,

  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '3px solid #4a7ab5',
    paddingBottom: '16px',
    marginBottom: '24px',
  } as React.CSSProperties,

  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  } as React.CSSProperties,

  logo: {
    height: '48px',
    width: 'auto',
  } as React.CSSProperties,

  headerTitle: {
    fontSize: '22px',
    fontWeight: '700',
    color: '#1a1a1a',
    margin: 0,
  } as React.CSSProperties,

  headerSubtitle: {
    fontSize: '11px',
    color: '#666666',
    margin: 0,
  } as React.CSSProperties,

  headerMeta: {
    textAlign: 'right' as const,
    fontSize: '10px',
    color: '#888888',
  } as React.CSSProperties,

  section: {
    marginBottom: '20px',
  } as React.CSSProperties,

  sectionTitle: {
    fontSize: '14px',
    fontWeight: '700',
    color: '#333333',
    borderBottom: '2px solid #e5e5e5',
    paddingBottom: '6px',
    marginBottom: '12px',
    margin: 0,
  } as React.CSSProperties,

  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    fontSize: '10px',
  } as React.CSSProperties,

  th: {
    backgroundColor: '#f5f7fa',
    border: '1px solid #e5e5e5',
    padding: '6px 8px',
    textAlign: 'left' as const,
    fontWeight: '600',
    fontSize: '10px',
    color: '#333333',
  } as React.CSSProperties,

  td: {
    border: '1px solid #e5e5e5',
    padding: '5px 8px',
    fontSize: '10px',
    color: '#1a1a1a',
  } as React.CSSProperties,

  infoGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '8px',
    fontSize: '11px',
  } as React.CSSProperties,

  infoRow: {
    display: 'flex',
    gap: '8px',
  } as React.CSSProperties,

  infoLabel: {
    fontWeight: '600',
    color: '#555555',
    minWidth: '100px',
  } as React.CSSProperties,

  infoValue: {
    color: '#1a1a1a',
  } as React.CSSProperties,

  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr',
    gap: '12px',
    marginTop: '8px',
  } as React.CSSProperties,

  summaryCard: {
    border: '1px solid #e5e5e5',
    borderRadius: '6px',
    padding: '12px',
    textAlign: 'center' as const,
  } as React.CSSProperties,

  summaryCardTitle: {
    fontSize: '10px',
    fontWeight: '600',
    color: '#4a7ab5',
    textTransform: 'uppercase' as const,
    marginBottom: '4px',
  } as React.CSSProperties,

  summaryCardValue: {
    fontSize: '16px',
    fontWeight: '700',
    color: '#1a1a1a',
  } as React.CSSProperties,

  summaryCardSub: {
    fontSize: '9px',
    color: '#888888',
    marginTop: '2px',
  } as React.CSSProperties,

  categoryHeader: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#4a7ab5',
    marginTop: '12px',
    marginBottom: '6px',
  } as React.CSSProperties,

  footer: {
    marginTop: '30px',
    paddingTop: '12px',
    borderTop: '1px solid #e5e5e5',
    fontSize: '9px',
    color: '#aaaaaa',
    textAlign: 'center' as const,
  } as React.CSSProperties,
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const AI3Report = forwardRef<HTMLDivElement, AI3ReportProps>(
  function AI3Report({ data }, ref) {
    const { client, accounts, connected_contacts, access_items, recent_activities, generated_at, generated_by } = data

    const fullName = [client.first_name, client.last_name].filter(Boolean).join(' ') || 'Unknown Client'
    const age = computeAge(client.dob)

    // Group accounts by category
    const grouped: Record<string, Array<Record<string, unknown> & { category: string }>> = {}
    for (const acct of accounts) {
      const cat = acct.category || 'Other'
      if (!grouped[cat]) grouped[cat] = []
      grouped[cat].push(acct)
    }

    // Compute insurance summary
    const lifeAccounts = accounts.filter(a => a.category === 'Life')
    const annuityAccounts = accounts.filter(a => a.category === 'Annuity')
    const medicareAccounts = accounts.filter(a => a.category === 'Medicare')

    const totalFaceAmount = lifeAccounts.reduce((sum, a) => {
      const v = typeof a.face_amount === 'number' ? a.face_amount : parseFloat(String(a.face_amount || '0'))
      return sum + (isNaN(v) ? 0 : v)
    }, 0)

    const totalPremium = annuityAccounts.reduce((sum, a) => {
      const v = typeof a.premium === 'number' ? a.premium : parseFloat(String(a.premium || '0'))
      return sum + (isNaN(v) ? 0 : v)
    }, 0)

    // Only show last 10 activities
    const displayActivities = recent_activities.slice(0, 10)

    return (
      <div ref={ref} style={styles.page}>
        {/* ================================================================
            Section 1: Header
        ================================================================ */}
        <div style={styles.header}>
          <div style={styles.headerLeft}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/prodashx-transparent.png"
              alt="ProDashX"
              style={styles.logo}
              crossOrigin="anonymous"
            />
            <div>
              <h1 style={styles.headerTitle}>AI3 Report</h1>
              <p style={styles.headerSubtitle}>Assets &bull; Income &bull; Insurance &bull; Inventory</p>
            </div>
          </div>
          <div style={styles.headerMeta}>
            <div>{fullName}</div>
            <div>Generated: {formatDate(generated_at)}</div>
            <div>By: {generated_by}</div>
          </div>
        </div>

        {/* ================================================================
            Section 2: Personal Information
        ================================================================ */}
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>Personal Information</h2>
          <div style={styles.infoGrid}>
            <div style={styles.infoRow}>
              <span style={styles.infoLabel}>Name:</span>
              <span style={styles.infoValue}>{fullName}</span>
            </div>
            <div style={styles.infoRow}>
              <span style={styles.infoLabel}>DOB (Age):</span>
              <span style={styles.infoValue}>
                {formatDate(client.dob)}{age !== '—' ? ` (${age})` : ''}
              </span>
            </div>
            <div style={styles.infoRow}>
              <span style={styles.infoLabel}>Phone:</span>
              <span style={styles.infoValue}>{safeStr(client.phone)}</span>
            </div>
            <div style={styles.infoRow}>
              <span style={styles.infoLabel}>Email:</span>
              <span style={styles.infoValue}>{safeStr(client.email)}</span>
            </div>
            <div style={styles.infoRow}>
              <span style={styles.infoLabel}>Address:</span>
              <span style={styles.infoValue}>{safeStr(client.address)}</span>
            </div>
            <div style={styles.infoRow}>
              <span style={styles.infoLabel}>City/State/Zip:</span>
              <span style={styles.infoValue}>
                {[client.city, client.state].filter(Boolean).join(', ')}{client.zip ? ` ${client.zip}` : ''}
              </span>
            </div>
            <div style={styles.infoRow}>
              <span style={styles.infoLabel}>Timezone:</span>
              <span style={styles.infoValue}>{safeStr(client.timezone)}</span>
            </div>
            <div style={styles.infoRow}>
              <span style={styles.infoLabel}>Status:</span>
              <span style={styles.infoValue}>{safeStr(client.client_status)}</span>
            </div>
          </div>
        </div>

        {/* ================================================================
            Section 3: Estate & Family (Connected Contacts)
        ================================================================ */}
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>Estate &amp; Family</h2>
          {connected_contacts.length === 0 ? (
            <p style={{ fontSize: '11px', color: '#888888', fontStyle: 'italic' }}>
              No connected contacts on file.
            </p>
          ) : (
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Name</th>
                  <th style={styles.th}>Relationship</th>
                  <th style={styles.th}>Phone</th>
                  <th style={styles.th}>Email</th>
                </tr>
              </thead>
              <tbody>
                {connected_contacts.map((cc, i) => (
                  <tr key={i}>
                    <td style={styles.td}>
                      {[cc.first_name, cc.last_name].filter(Boolean).join(' ') || safeStr(cc.name)}
                    </td>
                    <td style={styles.td}>{safeStr(cc.relationship)}</td>
                    <td style={styles.td}>{safeStr(cc.phone)}</td>
                    <td style={styles.td}>{safeStr(cc.email)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* ================================================================
            Section 4: Assets & Accounts (grouped by category)
        ================================================================ */}
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>Assets &amp; Accounts</h2>
          {accounts.length === 0 ? (
            <p style={{ fontSize: '11px', color: '#888888', fontStyle: 'italic' }}>
              No accounts on file.
            </p>
          ) : (
            Object.entries(grouped).map(([category, catAccounts]) => (
              <div key={category}>
                <div style={styles.categoryHeader}>{category} ({catAccounts.length})</div>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Carrier</th>
                      <th style={styles.th}>Product</th>
                      <th style={styles.th}>Policy #</th>
                      <th style={styles.th}>Status</th>
                      <th style={styles.th}>Premium</th>
                      <th style={styles.th}>Face Amount</th>
                      <th style={styles.th}>Effective</th>
                    </tr>
                  </thead>
                  <tbody>
                    {catAccounts.map((acct, i) => (
                      <tr key={i}>
                        <td style={styles.td}>{safeStr(acct.carrier || acct.carrier_name)}</td>
                        <td style={styles.td}>{safeStr(acct.product || acct.product_name)}</td>
                        <td style={styles.td}>{safeStr(acct.policy_number)}</td>
                        <td style={styles.td}>{safeStr(acct.status)}</td>
                        <td style={styles.td}>{formatCurrency(acct.premium)}</td>
                        <td style={styles.td}>{formatCurrency(acct.face_amount)}</td>
                        <td style={styles.td}>{formatDate(acct.effective_date)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))
          )}
        </div>

        {/* ================================================================
            Section 5: Insurance Summary
        ================================================================ */}
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>Insurance Summary</h2>
          <div style={styles.summaryGrid}>
            <div style={styles.summaryCard}>
              <div style={styles.summaryCardTitle}>Medicare</div>
              <div style={styles.summaryCardValue}>{medicareAccounts.length}</div>
              <div style={styles.summaryCardSub}>
                {medicareAccounts.length > 0
                  ? `${safeStr(medicareAccounts[0].carrier || medicareAccounts[0].carrier_name)} - ${safeStr(medicareAccounts[0].product || medicareAccounts[0].product_name)}`
                  : 'No Medicare plans'}
              </div>
            </div>
            <div style={styles.summaryCard}>
              <div style={styles.summaryCardTitle}>Life Insurance</div>
              <div style={styles.summaryCardValue}>{formatCurrency(totalFaceAmount)}</div>
              <div style={styles.summaryCardSub}>
                {lifeAccounts.length} {lifeAccounts.length === 1 ? 'policy' : 'policies'}
              </div>
            </div>
            <div style={styles.summaryCard}>
              <div style={styles.summaryCardTitle}>Annuity</div>
              <div style={styles.summaryCardValue}>{formatCurrency(totalPremium)}</div>
              <div style={styles.summaryCardSub}>
                {annuityAccounts.length} {annuityAccounts.length === 1 ? 'contract' : 'contracts'}
              </div>
            </div>
          </div>
        </div>

        {/* ================================================================
            Section 6: Access Status
        ================================================================ */}
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>Access Status</h2>
          {access_items.length === 0 ? (
            <p style={{ fontSize: '11px', color: '#888888', fontStyle: 'italic' }}>
              No access items on file.
            </p>
          ) : (
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Service</th>
                  <th style={styles.th}>Type</th>
                  <th style={styles.th}>Status</th>
                  <th style={styles.th}>Last Verified</th>
                </tr>
              </thead>
              <tbody>
                {access_items.map((item, i) => (
                  <tr key={i}>
                    <td style={styles.td}>{safeStr(item.service || item.service_name)}</td>
                    <td style={styles.td}>{safeStr(item.type || item.access_type)}</td>
                    <td style={styles.td}>{safeStr(item.status)}</td>
                    <td style={styles.td}>{formatDate(item.last_verified || item.verified_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* ================================================================
            Section 7: Recent Activity
        ================================================================ */}
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>Recent Activity</h2>
          {displayActivities.length === 0 ? (
            <p style={{ fontSize: '11px', color: '#888888', fontStyle: 'italic' }}>
              No recent activity.
            </p>
          ) : (
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Date</th>
                  <th style={styles.th}>Type</th>
                  <th style={styles.th}>Description</th>
                </tr>
              </thead>
              <tbody>
                {displayActivities.map((act, i) => (
                  <tr key={i}>
                    <td style={styles.td}>{formatDate(act.created_at || act.date)}</td>
                    <td style={styles.td}>{safeStr(act.type || act.activity_type)}</td>
                    <td style={styles.td}>{safeStr(act.description || act.summary)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* ================================================================
            Footer
        ================================================================ */}
        <div style={styles.footer}>
          <p>
            AI3 Report &bull; Generated {formatDate(generated_at)} by {generated_by} &bull; Retirement Protectors, Inc. &bull; Confidential
          </p>
        </div>
      </div>
    )
  }
)
