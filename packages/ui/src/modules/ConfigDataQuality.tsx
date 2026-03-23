'use client'

import { SliderEditor, TableEditor } from './ConfigRegistry'

/* ═══ Types ═══ */

interface ConfigData {
  key: string
  type: string
  category: string
  [field: string]: unknown
}

interface ConfigDataQualityProps {
  configKey: string
  configData: ConfigData
  onUpdate: (data: ConfigData) => void
}

/* ═══ Dedup Thresholds Editor (TRK-CFG-003) ═══ */

const DEDUP_SLIDER_FIELDS = [
  { key: 'name_weight_last', label: 'Last Name Weight', min: 0, max: 100 },
  { key: 'name_weight_first', label: 'First Name Weight', min: 0, max: 100 },
  { key: 'fuzzy_min', label: 'Fuzzy Match Minimum', min: 50, max: 100 },
  { key: 'duplicate_threshold', label: 'Duplicate Flag Threshold', min: 50, max: 100 },
  { key: 'email_exact_score', label: 'Email Exact Match Score', min: 50, max: 100 },
] as const

function DedupEditor({ data, onUpdate }: { data: ConfigData; onUpdate: (d: ConfigData) => void }) {
  return (
    <div className="space-y-4">
      <p className="text-xs" style={{ color: 'var(--text-muted, #64748b)' }}>
        Controls how the dedup engine scores name matches and flags duplicates. Weights must sum to 100.
      </p>
      {DEDUP_SLIDER_FIELDS.map(field => (
        <SliderEditor
          key={field.key}
          label={field.label}
          value={typeof data[field.key] === 'number' ? (data[field.key] as number) : 0}
          min={field.min}
          max={field.max}
          onChange={v => onUpdate({ ...data, [field.key]: v })}
        />
      ))}
    </div>
  )
}

/* ═══ Carrier/Charter Map Editor (TRK-CFG-004) ═══ */

const CARRIER_COLUMNS = [
  { key: 'parent', label: 'Parent Brand' },
  { key: 'charter', label: 'Charter / Legal Entity' },
  { key: 'charter_code', label: 'Code' },
  { key: 'naic', label: 'NAIC' },
] as const

function CarrierCharterEditor({ data, onUpdate }: { data: ConfigData; onUpdate: (d: ConfigData) => void }) {
  const entries = (Array.isArray(data.entries) ? data.entries : []) as Record<string, unknown>[]
  return (
    <TableEditor
      entries={entries}
      columns={CARRIER_COLUMNS.map(c => ({ key: c.key, label: c.label }))}
      onUpdate={(index, field, value) => {
        const updated = [...entries]
        updated[index] = { ...updated[index], [field]: field === 'naic' ? (value === '' ? '' : Number(value) || value) : value }
        onUpdate({ ...data, entries: updated })
      }}
      onAdd={() => {
        onUpdate({ ...data, entries: [...entries, { parent: '', charter: '', charter_code: '', naic: '' }] })
      }}
      onDelete={index => {
        onUpdate({ ...data, entries: entries.filter((_, i) => i !== index) })
      }}
    />
  )
}

/* ═══ Two-Column Map Editor (TRK-CFG-005, 006, 007) ═══ */

function TwoColumnMapEditor({ data, onUpdate, rawLabel, canonLabel }: {
  data: ConfigData
  onUpdate: (d: ConfigData) => void
  rawLabel: string
  canonLabel: string
}) {
  const entries = (Array.isArray(data.entries) ? data.entries : []) as Record<string, unknown>[]
  return (
    <TableEditor
      entries={entries}
      columns={[
        { key: 'raw', label: rawLabel },
        { key: 'canonical', label: canonLabel },
      ]}
      onUpdate={(index, field, value) => {
        const updated = [...entries]
        updated[index] = { ...updated[index], [field]: value }
        onUpdate({ ...data, entries: updated })
      }}
      onAdd={() => {
        onUpdate({ ...data, entries: [...entries, { raw: '', canonical: '' }] })
      }}
      onDelete={index => {
        onUpdate({ ...data, entries: entries.filter((_, i) => i !== index) })
      }}
    />
  )
}

/* ═══ Main Component ═══ */

export function ConfigDataQuality({ configKey, configData, onUpdate }: ConfigDataQualityProps) {
  switch (configKey) {
    case 'dedup_thresholds':
      return <DedupEditor data={configData} onUpdate={onUpdate} />

    case 'carrier_charter_map':
      return <CarrierCharterEditor data={configData} onUpdate={onUpdate} />

    case 'status_map':
      return (
        <TwoColumnMapEditor
          data={configData}
          onUpdate={onUpdate}
          rawLabel="Raw Value"
          canonLabel="Canonical Status"
        />
      )

    case 'carrier_aliases':
      return (
        <TwoColumnMapEditor
          data={configData}
          onUpdate={onUpdate}
          rawLabel="Alias"
          canonLabel="Canonical Carrier Name"
        />
      )

    case 'product_type_map':
      return (
        <TwoColumnMapEditor
          data={configData}
          onUpdate={onUpdate}
          rawLabel="Raw Product Type"
          canonLabel="Canonical Product Type"
        />
      )

    default:
      return (
        <div className="text-center py-8 text-sm" style={{ color: 'var(--text-muted, #64748b)' }}>
          No editor available for <code>{configKey}</code>
        </div>
      )
  }
}
