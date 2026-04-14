'use client'

/**
 * PipelineFieldsForm — shared component for rendering pipeline-specific
 * custom fields (Life, Annuity, Investments, Medicare, etc.) driven by the
 * PIPELINE_FIELD_SCHEMAS registry in @tomachina/core.
 *
 * Fetches GET /api/opportunities/field-schemas/:pipelineKey on mount, then
 * renders inputs dynamically per field type and emits a `custom_fields`
 * object via onChange. Validation is reported via onValidityChange.
 *
 * Consumed by:
 *   - apps/prodash/app/(portal)/pipelines/[key]/page.tsx  (New Case modal, mode=create)
 *   - packages/ui/src/modules/PipelineInstance/InstanceDetail.tsx (detail view, mode=edit)
 *
 * Sprint: RON-OPP-FIELDS-001 (PR A — enabling machinery, no UI wire-up yet)
 */

import { useState, useEffect, useMemo } from 'react'
import type { PipelineFieldSchema, CustomFieldDef } from '@tomachina/core'
import { fetchValidated } from '../fetchValidated'

export interface PipelineFieldsFormProps {
  /** Pipeline key — e.g. 'NBX_LIFE', 'NBX_ANNUITY', 'DELIVERY'. */
  pipelineKey: string
  /** 'create' (blank defaults) or 'edit' (seeded from `values`). */
  mode: 'create' | 'edit'
  /** Current custom_fields object. */
  values?: Record<string, unknown>
  /** Fires on every field change with the updated custom_fields object. */
  onChange?: (next: Record<string, unknown>) => void
  /** Fires whenever required-field validity changes. */
  onValidityChange?: (valid: boolean) => void
  /** API base override. Defaults to NEXT_PUBLIC_API_URL or /api. */
  apiBase?: string
  /** Disable all inputs (e.g. while submitting). */
  disabled?: boolean
  /** Optional className for the outer container. */
  className?: string
}

const DEFAULT_API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api'

interface SchemaResponse {
  success: boolean
  data?: PipelineFieldSchema
  error?: string
}

/* ─── Component ─── */

export function PipelineFieldsForm({
  pipelineKey,
  mode: _mode,
  values,
  onChange,
  onValidityChange,
  apiBase = DEFAULT_API_BASE,
  disabled = false,
  className = '',
}: PipelineFieldsFormProps) {
  const [schema, setSchema] = useState<PipelineFieldSchema | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [localValues, setLocalValues] = useState<Record<string, unknown>>(values ?? {})

  // Fetch schema once per pipelineKey
  useEffect(() => {
    let cancelled = false
    async function loadSchema() {
      setLoading(true)
      setError(null)
      try {
        const result: SchemaResponse = await fetchValidated(
          `${apiBase}/opportunities/field-schemas/${encodeURIComponent(pipelineKey)}`,
        )
        if (cancelled) return
        if (!result.success || !result.data) {
          setError(result.error || `No field schema defined for pipeline "${pipelineKey}"`)
          return
        }
        setSchema(result.data)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Network error loading field schema')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    loadSchema()
    return () => { cancelled = true }
  }, [pipelineKey, apiBase])

  // Re-seed local values when the `values` prop changes (edit-mode reload).
  useEffect(() => {
    setLocalValues(values ?? {})
  }, [values])

  // Validity: every required field must have a non-empty value.
  const isValid = useMemo(() => {
    if (!schema) return false
    return schema.fields.every((f) => {
      if (!f.required) return true
      const v = localValues[f.key]
      return v !== undefined && v !== null && v !== ''
    })
  }, [schema, localValues])

  useEffect(() => {
    onValidityChange?.(isValid)
  }, [isValid, onValidityChange])

  const setField = (key: string, v: unknown) => {
    const next = { ...localValues, [key]: v }
    setLocalValues(next)
    onChange?.(next)
  }

  if (loading) {
    return (
      <div className={`text-sm text-[var(--text-muted)] ${className}`}>
        Loading pipeline fields...
      </div>
    )
  }

  if (error) {
    return (
      <div className={`rounded-lg border border-[var(--error)] bg-[rgba(239,68,68,0.06)] px-3 py-2 text-sm text-[var(--error)] ${className}`}>
        {error}
      </div>
    )
  }

  if (!schema || schema.fields.length === 0) return null

  return (
    <div className={`space-y-3 ${className}`}>
      {schema.fields.map((field) => (
        <FieldRow
          key={field.key}
          field={field}
          value={localValues[field.key]}
          onChange={(v) => setField(field.key, v)}
          disabled={disabled}
        />
      ))}
    </div>
  )
}

/* ─── FieldRow ─── */

interface FieldRowProps {
  field: CustomFieldDef
  value: unknown
  onChange: (v: unknown) => void
  disabled?: boolean
}

function FieldRow({ field, value, onChange, disabled }: FieldRowProps) {
  const labelEl = (
    <label className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">
      {field.label}
      {field.required && <span className="ml-0.5 text-[var(--error)]">*</span>}
    </label>
  )

  const inputCls =
    'w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none transition-colors focus:border-[var(--portal)] disabled:cursor-not-allowed disabled:opacity-60'

  switch (field.type) {
    case 'text':
      return (
        <div>
          {labelEl}
          <input
            type="text"
            value={(value as string | undefined) ?? ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            disabled={disabled}
            className={inputCls}
          />
        </div>
      )

    case 'textarea':
      return (
        <div>
          {labelEl}
          <textarea
            value={(value as string | undefined) ?? ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            disabled={disabled}
            rows={3}
            className={`${inputCls} resize-none`}
          />
        </div>
      )

    case 'currency':
      return (
        <div>
          {labelEl}
          <input
            type="number"
            step="0.01"
            value={(value as string | number | undefined) ?? ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder ?? '0.00'}
            disabled={disabled}
            className={inputCls}
          />
        </div>
      )

    case 'date':
      return (
        <div>
          {labelEl}
          <input
            type="date"
            value={(value as string | undefined) ?? ''}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            className={inputCls}
          />
        </div>
      )

    case 'dropdown':
      return (
        <div>
          {labelEl}
          <select
            value={(value as string | undefined) ?? ''}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            className={inputCls}
          >
            <option value="">{field.placeholder ?? `Select ${field.label.toLowerCase()}...`}</option>
            {(field.options ?? []).map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>
      )

    case 'checkbox':
      return (
        <label className="flex items-center gap-2 text-sm text-[var(--text-primary)]">
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => onChange(e.target.checked)}
            disabled={disabled}
            className="h-4 w-4"
          />
          <span>
            {field.label}
            {field.required && <span className="ml-0.5 text-[var(--error)]">*</span>}
          </span>
        </label>
      )

    case 'file':
      // File upload wiring is a follow-up ticket; record the chosen filename
      // so the field is not silently ignored.
      return (
        <div>
          {labelEl}
          <input
            type="file"
            onChange={(e) => {
              const file = e.target.files?.[0]
              onChange(file ? file.name : '')
            }}
            disabled={disabled}
            className={inputCls}
          />
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            File name recorded. Upload wiring follow-up ticket.
          </p>
        </div>
      )

    default:
      return null
  }
}

export default PipelineFieldsForm
