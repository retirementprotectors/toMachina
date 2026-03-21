/**
 * Learning Library — stores human corrections from the approval pipeline
 * to improve future SUPER_EXTRACT Claude Vision prompts.
 *
 * When a reviewer rejects or corrects an extracted field, the correction
 * is stored in Firestore `learning_library` collection. SUPER_EXTRACT
 * reads these corrections and includes them in the prompt so the system
 * gets smarter with every correction.
 *
 * Ported from watcher.js fetchApprovalLearning() + buildTypeHintsBlock().
 *
 * NOTE: This module only defines types and the prompt-building logic.
 * Firestore reads/writes use context callbacks (no firebase-admin import).
 */

// ── Types ───────────────────────────────────────────────────────────────

/** A single correction record stored in Firestore `learning_library` */
export interface LearningEntry {
  id?: string
  /** The document type this correction applies to (e.g., "Annual Statement") */
  document_type: string
  /** Type of correction: FIELD_KILL, VALUE_CORRECT, CATEGORY_CHANGE, FIELD_ADD */
  learning_type: 'FIELD_KILL' | 'VALUE_CORRECT' | 'CATEGORY_CHANGE' | 'FIELD_ADD'
  /** The field being corrected (for FIELD_KILL, VALUE_CORRECT, FIELD_ADD) */
  target_field?: string
  /** The original extracted value (before correction) */
  original_value?: string
  /** The corrected value (what it should have been) */
  corrected_value?: string
  /** Who made the correction */
  corrected_by?: string
  /** Wire execution ID for audit trail */
  wire_execution_id?: string
  /** Source file that triggered this correction */
  source_file_id?: string
  /** When the correction was made */
  created_at: string
}

/** Aggregated insights for a single document type */
export interface TypeInsights {
  /** Fields frequently rejected by reviewers — map of field name → rejection count */
  kills: Record<string, number>
  /** Fields commonly corrected — map of field name → array of corrected values */
  corrections: Record<string, string[]>
  /** Document type reclassifications — from original type to corrected type */
  reassigns: Array<{ from?: string; to?: string }>
  /** Fields reviewers always add that extraction missed */
  adds: Array<{ field?: string; value?: string }>
}

// ── Aggregation ─────────────────────────────────────────────────────────

/**
 * Aggregate raw learning entries into per-document-type insights.
 * Call this with the full learning_library collection contents.
 */
export function aggregateLearning(entries: LearningEntry[]): Map<string, TypeInsights> {
  const byType = new Map<string, TypeInsights>()

  for (const entry of entries) {
    const docType = entry.document_type
    if (!docType) continue

    if (!byType.has(docType)) {
      byType.set(docType, { kills: {}, corrections: {}, reassigns: [], adds: [] })
    }
    const bucket = byType.get(docType)!

    switch (entry.learning_type) {
      case 'FIELD_KILL': {
        const field = entry.target_field || ''
        bucket.kills[field] = (bucket.kills[field] || 0) + 1
        break
      }
      case 'VALUE_CORRECT': {
        const field = entry.target_field || ''
        if (!bucket.corrections[field]) bucket.corrections[field] = []
        if (entry.corrected_value) bucket.corrections[field].push(entry.corrected_value)
        break
      }
      case 'CATEGORY_CHANGE': {
        bucket.reassigns.push({ from: entry.original_value, to: entry.corrected_value })
        break
      }
      case 'FIELD_ADD': {
        bucket.adds.push({ field: entry.target_field, value: entry.corrected_value })
        break
      }
    }
  }

  return byType
}

// ── Prompt Building ─────────────────────────────────────────────────────

/**
 * Build type-specific intelligence hints for a single document type.
 * These get injected into the Claude Vision extraction prompt.
 */
export function buildTypeHints(
  docType: string,
  insights: TypeInsights | undefined,
  taxonomyHints?: { extraction_hints?: string; required_fields?: string; suppress_fields?: string }
): string {
  const parts: string[] = []

  // Taxonomy-level hints (static, from document_taxonomy config)
  if (taxonomyHints) {
    if (taxonomyHints.extraction_hints) {
      parts.push(`EXTRACTION HINTS: ${taxonomyHints.extraction_hints}`)
    }
    if (taxonomyHints.required_fields) {
      parts.push(`REQUIRED FIELDS (you MUST extract these): ${taxonomyHints.required_fields}`)
    }
    if (taxonomyHints.suppress_fields) {
      parts.push(`SUPPRESS FIELDS (do NOT extract these — they are consistently rejected): ${taxonomyHints.suppress_fields}`)
    }
  }

  // Learning-based hints (dynamic, from human corrections)
  if (insights) {
    // Fields frequently killed
    const topKills = Object.entries(insights.kills)
      .filter(([, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
    if (topKills.length > 0) {
      parts.push(`FREQUENTLY REJECTED FIELDS (reviewers kill these — avoid extracting unless very confident): ${topKills.map(([f, c]) => `${f} (${c}x)`).join(', ')}`)
    }

    // Common corrections
    const correctionHints = Object.entries(insights.corrections)
      .filter(([, vals]) => vals.length >= 2)
      .slice(0, 3)
    if (correctionHints.length > 0) {
      const corrTexts = correctionHints.map(([field, vals]) => {
        const unique = [...new Set(vals)].slice(0, 3)
        return `"${field}" is often corrected to: ${unique.join(', ')}`
      })
      parts.push(`COMMON CORRECTIONS: ${corrTexts.join('; ')}`)
    }

    // Category confusion
    if (insights.reassigns.length >= 2) {
      const targets = [...new Set(insights.reassigns.map(r => r.to).filter(Boolean))]
      if (targets.length > 0) {
        parts.push(`CLASSIFICATION WARNING: This type is often reclassified to: ${targets.join(', ')}. Double-check your classification.`)
      }
    }
  }

  if (parts.length === 0) return ''
  return parts.join('\n')
}

/**
 * Build the full TYPE-SPECIFIC INTELLIGENCE block for all document types.
 * This gets appended to the Claude Vision extraction prompt.
 */
export function buildAllTypeHints(
  taxonomyTypes: Array<{ document_type: string; extraction_hints?: string; required_fields?: string; suppress_fields?: string }>,
  learningMap: Map<string, TypeInsights>
): string {
  if (!taxonomyTypes || taxonomyTypes.length === 0) return ''

  const hints: string[] = []
  for (const t of taxonomyTypes) {
    const typeHint = buildTypeHints(t.document_type, learningMap.get(t.document_type), t)
    if (typeHint) {
      hints.push(`[${t.document_type}]\n${typeHint}`)
    }
  }

  if (hints.length === 0) return ''
  return `\nTYPE-SPECIFIC INTELLIGENCE (learned from reviewer corrections):\n${hints.join('\n\n')}`
}

// ── Correction Recording ────────────────────────────────────────────────

/**
 * Build a LearningEntry from an approval rejection/correction.
 * Call this when a reviewer modifies or rejects an extracted field.
 */
export function buildCorrectionEntry(
  documentType: string,
  learningType: LearningEntry['learning_type'],
  options: {
    targetField?: string
    originalValue?: string
    correctedValue?: string
    correctedBy?: string
    wireExecutionId?: string
    sourceFileId?: string
  }
): LearningEntry {
  return {
    document_type: documentType,
    learning_type: learningType,
    target_field: options.targetField,
    original_value: options.originalValue,
    corrected_value: options.correctedValue,
    corrected_by: options.correctedBy,
    wire_execution_id: options.wireExecutionId,
    source_file_id: options.sourceFileId,
    created_at: new Date().toISOString(),
  }
}
