'use client'

import { useState } from 'react'
import type { Client } from '@tomachina/core'
import { formatDate, str } from '../../lib/formatters'
import { SectionCard, DetailField, FieldGrid, EmptyState } from '../../lib/ui-helpers'

function CopyableField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = () => {
    if (!value) return
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-[var(--text-muted)]">{label}</dt>
      <dd className="mt-1 flex items-center gap-2">
        <span className="font-mono text-sm text-[var(--text-primary)]">
          {value || <span className="text-[var(--text-muted)]">&mdash;</span>}
        </span>
        {value && (
          <button
            onClick={handleCopy}
            className="inline-flex h-6 w-6 items-center justify-center rounded text-[var(--text-muted)] hover:text-[var(--portal)] transition-colors"
            title="Copy to clipboard"
          >
            <span className="material-icons-outlined text-[14px]">{copied ? 'check' : 'content_copy'}</span>
          </button>
        )}
      </dd>
    </div>
  )
}

interface IntegrationsTabProps {
  client: Client
}

export function IntegrationsTab({ client }: IntegrationsTabProps) {
  const ghlId = str(client.ghl_contact_id)
  const acfUrl = str(client.gdrive_folder_url) || str(client.acf_url)
  const importSource = str(client.import_source)
  const ghlCreated = str(client.ghl_created_at) || str(client.ghl_date_created)
  const ghlUpdated = str(client.ghl_updated_at) || str(client.ghl_date_updated)
  const dtccId = str(client.dtcc_id)
  const dstId = str(client.dst_id)
  const schwabId = str(client.schwab_id)
  const rbcId = str(client.rbc_id)
  const clientId = str(client.client_id)
  const legacyId = str(client.legacy_id)
  const firestoreId = str((client as Record<string, unknown>)._id)

  const hasGhl = Boolean(ghlId || ghlCreated || ghlUpdated)
  const hasExternal = Boolean(dtccId || dstId || schwabId || rbcId)
  const hasAny = Boolean(hasGhl || acfUrl || importSource || hasExternal || clientId || legacyId || firestoreId)

  if (!hasAny) {
    return <EmptyState icon="integration_instructions" message="No integration data available for this client." />
  }

  return (
    <div className="space-y-4">
      {/* Internal IDs with copy */}
      <SectionCard title="Platform IDs" icon="fingerprint">
        <FieldGrid cols={3}>
          <CopyableField label="Client ID" value={clientId} />
          <CopyableField label="Firestore Doc ID" value={firestoreId} />
          {legacyId && <CopyableField label="Legacy ID" value={legacyId} />}
        </FieldGrid>
      </SectionCard>

      {/* Tags & References */}
      {(str(client.tags) || str(client.jira_key)) && (
        <SectionCard title="Tags & References" icon="label">
          {str(client.tags) && (
            <div className="mb-3">
              <dt className="text-xs uppercase tracking-wide text-[var(--text-muted)] mb-2">Tags</dt>
              <dd className="flex flex-wrap gap-1.5">
                {String(client.tags).split(',').map((t: string) => t.trim()).filter(Boolean).map((tag: string) => (
                  <span key={tag} className="inline-block rounded-full bg-[var(--portal)]/10 px-2.5 py-0.5 text-xs font-medium text-[var(--portal)]">
                    {tag}
                  </span>
                ))}
              </dd>
            </div>
          )}
          {str(client.jira_key) && (
            <CopyableField label="Jira Key (Legacy)" value={str(client.jira_key)} />
          )}
        </SectionCard>
      )}

      {/* Import Source */}
      {importSource && (
        <SectionCard title="Data Source" icon="cloud_download">
          <FieldGrid cols={3}>
            <DetailField label="Import Source" value={importSource} />
            <DetailField label="Import Date" value={formatDate(client.import_date || client.created_at)} />
            <DetailField label="Last Sync" value={formatDate(client.last_sync || client.updated_at)} />
            {str(client.last_import_source) && <DetailField label="Last Import" value={str(client.last_import_source)} />}
            {str(client.last_validated_date) && <DetailField label="Last Validated" value={formatDate(client.last_validated_date)} />}
            {str(client.client_classification) && <DetailField label="Classification" value={str(client.client_classification)} />}
          </FieldGrid>
        </SectionCard>
      )}

      {/* GHL Integration */}
      {hasGhl && (
        <SectionCard title="GoHighLevel (GHL)" icon="link">
          <FieldGrid cols={3}>
            <CopyableField label="GHL Contact ID" value={ghlId} />
            <DetailField label="GHL Created" value={formatDate(ghlCreated)} />
            <DetailField label="GHL Updated" value={formatDate(ghlUpdated)} />
            {str(client.ghl_last_activity) && <DetailField label="Last Activity" value={formatDate(client.ghl_last_activity)} />}
            {str(client.ghl_assigned_to) && <DetailField label="Assigned To" value={str(client.ghl_assigned_to)} />}
          </FieldGrid>
          {str(client.ghl_opportunities) && (
            <div className="mt-3">
              <dt className="text-xs uppercase tracking-wide text-[var(--text-muted)]">GHL Opportunities</dt>
              <dd className="mt-1 text-sm text-[var(--text-primary)] whitespace-pre-wrap">{str(client.ghl_opportunities)}</dd>
            </div>
          )}
        </SectionCard>
      )}

      {/* ACF / Drive */}
      {acfUrl && (
        <SectionCard title="Active Client Folder" icon="folder_shared">
          <div>
            <dt className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Drive Folder</dt>
            <dd className="mt-1">
              <a
                href={acfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--portal)] hover:brightness-110 transition-all"
              >
                <span className="material-icons-outlined text-[16px]">open_in_new</span>
                Open in Google Drive
              </a>
            </dd>
          </div>
        </SectionCard>
      )}

      {/* External System IDs */}
      {hasExternal && (
        <SectionCard title="External Systems" icon="hub">
          <FieldGrid cols={2}>
            {dtccId && <CopyableField label="DTCC ID" value={dtccId} />}
            {dstId && <CopyableField label="DST Vision ID" value={dstId} />}
            {schwabId && <CopyableField label="Schwab ID" value={schwabId} />}
            {rbcId && <CopyableField label="RBC ID" value={rbcId} />}
          </FieldGrid>
        </SectionCard>
      )}

      {/* Timestamps */}
      <SectionCard title="Record Timestamps" icon="schedule">
        <FieldGrid cols={3}>
          <DetailField label="Created" value={formatDate(client.created_at)} />
          <DetailField label="Last Updated" value={formatDate(client.updated_at)} />
          <DetailField label="Last Verified" value={formatDate(client.last_verified)} />
        </FieldGrid>
      </SectionCard>
    </div>
  )
}
