import { getFirestore } from 'firebase-admin/firestore'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AssembledContent {
  campaign_id: string
  template_id: string
  channel: string
  touchpoint: string
  subject: string
  body: string
  raw_body: string // before merge field replacement
  blocks_used: string[]
  missing_blocks: string[]
  merge_fields_applied: string[]
}

export interface MergeContext {
  first_name?: string
  last_name?: string
  full_name?: string
  email?: string
  phone?: string
  agent_name?: string
  agent_email?: string
  agent_phone?: string
  company?: string
  calendar_link?: string
  [key: string]: string | undefined
}

// Block slot order — matches C3 GAS assembly logic
const BODY_SLOTS = [
  'greeting_block',
  'intro_block',
  'valueprop_block',
  'painpoint_block',
  'cta_block',
  'signature_block',
  'compliance_block',
] as const

// ---------------------------------------------------------------------------
// Campaign Assembler
// ---------------------------------------------------------------------------

/**
 * Assemble a campaign template into final content.
 * Resolves template → block slots → content → merge fields.
 */
export async function assembleCampaign(
  campaignId: string,
  templateId: string,
  mergeContext?: MergeContext
): Promise<AssembledContent> {
  const db = getFirestore()

  // 1. Get template
  const templateDoc = await db.collection('templates').doc(templateId).get()
  if (!templateDoc.exists) throw new Error(`Template ${templateId} not found`)
  const template = templateDoc.data() as Record<string, unknown>

  // Verify template belongs to campaign
  if (template.campaign_id && template.campaign_id !== campaignId) {
    throw new Error(`Template ${templateId} does not belong to campaign ${campaignId}`)
  }

  // 2. Resolve block IDs from template slots
  const blockIds: string[] = []
  const subjectBlockId = template.subject_block as string | undefined

  if (subjectBlockId) blockIds.push(subjectBlockId)
  for (const slot of BODY_SLOTS) {
    const blockId = template[slot] as string | undefined
    if (blockId) blockIds.push(blockId)
  }

  // 3. Fetch all blocks in one batch
  const blockMap = new Map<string, Record<string, unknown>>()
  if (blockIds.length > 0) {
    // Firestore `in` queries limited to 30 — batch if needed
    const chunks = chunkArray(blockIds, 30)
    for (const chunk of chunks) {
      const snap = await db
        .collection('content_blocks')
        .where('block_id', 'in', chunk)
        .get()
      snap.docs.forEach((d) => {
        const data = d.data()
        const id = (data.block_id as string) || d.id
        blockMap.set(id, data)
      })

      // Also try matching by doc ID for blocks stored with _id
      const missingFromChunk = chunk.filter((id) => !blockMap.has(id))
      for (const id of missingFromChunk) {
        const doc = await db.collection('content_blocks').doc(id).get()
        if (doc.exists) {
          blockMap.set(id, doc.data() as Record<string, unknown>)
        }
      }
    }
  }

  // 4. Assemble subject
  const blocksUsed: string[] = []
  const missingBlocks: string[] = []

  let subject = ''
  if (subjectBlockId) {
    const subjectBlock = blockMap.get(subjectBlockId)
    if (subjectBlock) {
      subject = String(subjectBlock.content || '')
      blocksUsed.push(subjectBlockId)
    } else {
      missingBlocks.push(subjectBlockId)
    }
  }

  // 5. Assemble body in slot order
  const bodyParts: string[] = []
  for (const slot of BODY_SLOTS) {
    const blockId = template[slot] as string | undefined
    if (!blockId) continue
    const block = blockMap.get(blockId)
    if (block) {
      bodyParts.push(String(block.content || ''))
      blocksUsed.push(blockId)
    } else {
      missingBlocks.push(blockId)
    }
  }

  const rawBody = bodyParts.join('\n\n')
  let body = rawBody

  // 6. Apply merge fields
  const fieldsApplied: string[] = []
  if (mergeContext) {
    subject = applyMergeFields(subject, mergeContext, fieldsApplied)
    body = applyMergeFields(body, mergeContext, fieldsApplied)
  }

  return {
    campaign_id: campaignId,
    template_id: templateId,
    channel: String(template.channel || 'email'),
    touchpoint: String(template.touchpoint || ''),
    subject,
    body,
    raw_body: rawBody,
    blocks_used: blocksUsed,
    missing_blocks: missingBlocks,
    merge_fields_applied: [...new Set(fieldsApplied)],
  }
}

/**
 * Assemble ALL templates for a campaign.
 * Returns one AssembledContent per template.
 */
export async function assembleCampaignFull(
  campaignId: string,
  mergeContext?: MergeContext
): Promise<AssembledContent[]> {
  const db = getFirestore()

  const templateSnap = await db
    .collection('templates')
    .where('campaign_id', '==', campaignId)
    .get()

  if (templateSnap.empty) return []

  const results: AssembledContent[] = []
  for (const doc of templateSnap.docs) {
    const assembled = await assembleCampaign(campaignId, doc.id, mergeContext)
    results.push(assembled)
  }

  // Sort by touchpoint day
  results.sort((a, b) => {
    const dayA = parseInt(a.touchpoint.replace(/\D/g, '')) || 0
    const dayB = parseInt(b.touchpoint.replace(/\D/g, '')) || 0
    return dayA - dayB
  })

  return results
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function applyMergeFields(
  text: string,
  context: MergeContext,
  applied: string[]
): string {
  return text.replace(/\{(\w+)\}/g, (match, field) => {
    const key = field as string
    // Try exact match
    if (context[key] !== undefined) {
      applied.push(key)
      return context[key] || ''
    }
    // Try lowercase
    const lower = key.toLowerCase()
    if (context[lower] !== undefined) {
      applied.push(lower)
      return context[lower] || ''
    }
    // Leave unresolved merge fields as-is (for CRM-time replacement)
    return match
  })
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size))
  }
  return chunks
}
