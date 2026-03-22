/**
 * DEX (Document Efficiency) routes — Form library, field mappings, rules, kit builder.
 * Ported from DEX GAS engine.
 */

import { Router, type Request, type Response } from 'express'
import { getFirestore, type Query, type DocumentData } from 'firebase-admin/firestore'
import {
  successResponse, errorResponse, getPaginationParams, paginatedQuery,
  stripInternalFields, validateRequired, param, writeThroughBridge,
} from '../lib/helpers.js'
import { dex } from '@tomachina/core'

export const dexRoutes = Router()

// QUE output generation endpoint — generates deliverables from QUE session data
dexRoutes.post('/packages', async (req: Request, res: Response) => {
  try {
    const { source, session_id, output_types } = req.body as Record<string, unknown>
    if (source !== 'que') {
      res.status(400).json(errorResponse('Only source: "que" is currently supported'))
      return
    }
    if (!session_id) {
      res.status(400).json(errorResponse('session_id is required'))
      return
    }
    // Placeholder — will wire to actual PDF generation + Drive filing in Sprint C enhancement
    res.json(successResponse({
      message: 'QUE output generation queued',
      session_id,
      output_types: output_types || ['summary', 'comparison', 'factfinder'],
      status: 'queued',
    }))
  } catch (err) {
    console.error('POST /api/dex/packages error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

const FORMS = dex.COLLECTIONS.FORMS
const MAPPINGS = dex.COLLECTIONS.FIELD_MAPPINGS
const RULES = dex.COLLECTIONS.RULES
const KITS = dex.COLLECTIONS.KITS

// ============================================================================
// Forms CRUD
// ============================================================================

dexRoutes.get('/forms', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const params = getPaginationParams(req)
    if (!params.orderBy) params.orderBy = 'form_id'
    params.orderDir = 'asc'

    let query: Query<DocumentData> = db.collection(FORMS)
    if (req.query.carrier) query = query.where('source', '==', req.query.carrier)
    if (req.query.source) query = query.where('source', '==', req.query.source)
    if (req.query.category) query = query.where('category', '==', req.query.category)
    if (req.query.document_type) query = query.where('document_type', '==', req.query.document_type)
    if (req.query.status) query = query.where('status', '==', req.query.status)

    const result = await paginatedQuery(query, FORMS, params)
    res.json(successResponse(result.data, { pagination: result.pagination }))
  } catch (err) {
    console.error('GET /api/dex/forms error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

dexRoutes.get('/forms/:id', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const id = param(req.params.id)
    const doc = await db.collection(FORMS).doc(id).get()
    if (!doc.exists) { res.status(404).json(errorResponse('Form not found')); return }

    // Also fetch field mappings for this form
    const mappingsSnap = await db.collection(MAPPINGS)
      .where('form_id', '==', id)
      .orderBy('mapping_id', 'asc')
      .get()
    const mappings = mappingsSnap.docs.map(d => ({ id: d.id, ...d.data() }))

    res.json(successResponse({
      form: { id: doc.id, ...doc.data() },
      mappings,
      mapping_count: mappings.length,
    }))
  } catch (err) {
    console.error('GET /api/dex/forms/:id error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

dexRoutes.post('/forms', async (req: Request, res: Response) => {
  try {
    const body = req.body as Record<string, unknown>
    const err = validateRequired(body, ['form_name', 'source', 'category'])
    if (err) { res.status(400).json(errorResponse(err)); return }

    const db = getFirestore()
    const id = String(body.form_id || `FORM_${Date.now()}`)
    const now = new Date().toISOString()
    const data = {
      form_id: id,
      form_name: String(body.form_name),
      source: String(body.source),
      category: String(body.category),
      status: String(body.status || 'ACTIVE'),
      document_type: String(body.document_type || 'pdf'),
      pdf_template_id: String(body.pdf_template_id || ''),
      notes: String(body.notes || ''),
      created_at: now,
      updated_at: now,
      _created_by: (req as any).user?.email || 'api',
    }

    const bridgeResult = await writeThroughBridge(FORMS, 'insert', id, data)
    if (!bridgeResult.success) await db.collection(FORMS).doc(id).set(data)

    res.status(201).json(successResponse({ form_id: id }))
  } catch (err) {
    console.error('POST /api/dex/forms error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

dexRoutes.patch('/forms/:id', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const id = param(req.params.id)
    const doc = await db.collection(FORMS).doc(id).get()
    if (!doc.exists) { res.status(404).json(errorResponse('Form not found')); return }

    const body = req.body as Record<string, unknown>
    const updates: Record<string, unknown> = { ...body, updated_at: new Date().toISOString(), _updated_by: (req as any).user?.email || 'api' }
    delete updates.form_id
    delete updates.created_at

    const bridgeResult = await writeThroughBridge(FORMS, 'update', id, updates)
    if (!bridgeResult.success) await db.collection(FORMS).doc(id).update(updates)

    res.json(successResponse({ form_id: id, updated: true }))
  } catch (err) {
    console.error('PATCH /api/dex/forms/:id error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ============================================================================
// Field Mappings
// ============================================================================

dexRoutes.get('/mappings', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    let query: Query<DocumentData> = db.collection(MAPPINGS)
    if (req.query.form_id) query = query.where('form_id', '==', req.query.form_id)
    if (req.query.carrier) query = query.where('carrier', '==', req.query.carrier)
    if (req.query.data_source) query = query.where('data_source', '==', req.query.data_source)

    const snap = await query.get()
    const raw = snap.docs.map(d => ({ id: d.id, ...d.data() }))

    // If ?ux=true, enhance each mapping with full UX config
    if (req.query.ux === 'true') {
      const enhanced = raw.map((m) => {
        const mapping = m as unknown as dex.DexFieldMapping
        const uxConfig = dex.buildUxConfig(mapping)
        return { ...m, _ux: uxConfig }
      })
      res.json(successResponse(enhanced, { pagination: { count: enhanced.length, total: enhanced.length } }))
    } else {
      res.json(successResponse(raw, { pagination: { count: raw.length, total: raw.length } }))
    }
  } catch (err) {
    console.error('GET /api/dex/mappings error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

dexRoutes.post('/mappings', async (req: Request, res: Response) => {
  try {
    const body = req.body as Record<string, unknown>
    const err = validateRequired(body, ['form_id', 'field_name', 'data_source'])
    if (err) { res.status(400).json(errorResponse(err)); return }

    const db = getFirestore()
    const id = String(body.mapping_id || `MAP_${Date.now()}`)
    const now = new Date().toISOString()
    const data = { ...body, mapping_id: id, status: 'ACTIVE', created_at: now, updated_at: now }

    await db.collection(MAPPINGS).doc(id).set(data)
    res.status(201).json(successResponse({ mapping_id: id }))
  } catch (err) {
    console.error('POST /api/dex/mappings error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ============================================================================
// Mapping Presets
// ============================================================================

dexRoutes.get('/mappings/presets', async (_req: Request, res: Response) => {
  try {
    res.json(successResponse(dex.OPTION_PRESETS))
  } catch (err) {
    console.error('GET /api/dex/mappings/presets error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ============================================================================
// Taxonomy — carriers, products, accountTypes, transactions
// ============================================================================

const TAXONOMY_COLLECTIONS: Record<string, string> = {
  carriers: dex.COLLECTIONS.TAXONOMY_CARRIERS,
  products: dex.COLLECTIONS.TAXONOMY_PRODUCTS,
  accountTypes: dex.COLLECTIONS.TAXONOMY_ACCOUNT_TYPES,
  transactions: dex.COLLECTIONS.TAXONOMY_TRANSACTIONS,
}

dexRoutes.get('/taxonomy/:type', async (req: Request, res: Response) => {
  try {
    const taxonomyType = param(req.params.type)
    const collectionName = TAXONOMY_COLLECTIONS[taxonomyType]
    if (!collectionName) {
      res.status(400).json(errorResponse(`Invalid taxonomy type: "${taxonomyType}". Use: carriers, products, accountTypes, transactions`))
      return
    }

    const db = getFirestore()
    const snap = await db.collection(collectionName).get()
    let items = snap.docs.map(d => ({ id: d.id, ...d.data() }))

    // Apply domain filter if provided
    const domain = req.query.domain as string | undefined
    if (domain && domain !== 'ALL') {
      items = dex.filterByDomain(items as Array<{ domain?: string;[key: string]: unknown }>, domain) as typeof items
    }

    res.json(successResponse(items, { pagination: { count: items.length, total: items.length }, type: taxonomyType }))
  } catch (err) {
    console.error('GET /api/dex/taxonomy/:type error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ============================================================================
// Rules
// ============================================================================

dexRoutes.get('/rules', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    let query: Query<DocumentData> = db.collection(RULES)
    if (req.query.product_type) query = query.where('product_type', '==', req.query.product_type)
    if (req.query.registration_type) query = query.where('registration_type', '==', req.query.registration_type)
    if (req.query.action) query = query.where('action', '==', req.query.action)

    const snap = await query.get()
    const data = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    res.json(successResponse(data, { pagination: { count: data.length, total: data.length } }))
  } catch (err) {
    console.error('GET /api/dex/rules error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

dexRoutes.post('/rules', async (req: Request, res: Response) => {
  try {
    const body = req.body as Record<string, unknown>
    const err = validateRequired(body, ['product_type', 'registration_type', 'action'])
    if (err) { res.status(400).json(errorResponse(err)); return }

    const db = getFirestore()
    const id = String(body.rule_id || `RULE_${Date.now()}`)
    const now = new Date().toISOString()
    const data = { ...body, rule_id: id, status: 'ACTIVE', created_at: now, updated_at: now }

    await db.collection(RULES).doc(id).set(data)
    res.status(201).json(successResponse({ rule_id: id }))
  } catch (err) {
    console.error('POST /api/dex/rules error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ============================================================================
// Kit Builder — THE core DEX feature
// ============================================================================

dexRoutes.post('/kits/build', async (req: Request, res: Response) => {
  try {
    const body = req.body as Record<string, unknown>
    const err = validateRequired(body, ['client_id', 'product_type', 'registration_type', 'action'])
    if (err) { res.status(400).json(errorResponse(err)); return }

    const db = getFirestore()
    const productType = String(body.product_type)
    const registrationType = String(body.registration_type)
    const action = String(body.action)
    const clientId = String(body.client_id)
    const userEmail = (req as any).user?.email || 'api'

    // Step 1: Find matching rule
    const rulesSnap = await db.collection(RULES)
      .where('product_type', '==', productType)
      .where('registration_type', '==', registrationType)
      .where('action', '==', action)
      .limit(1)
      .get()

    if (rulesSnap.empty) {
      res.status(404).json(errorResponse(`No kit rule found for ${productType} / ${registrationType} / ${action}`))
      return
    }

    const rule = rulesSnap.docs[0].data()

    // Step 2: Collect all form IDs from rule layers
    const allFormIds = [
      ...(rule.firm_client || []),
      ...(rule.firm_account || []),
      ...(rule.product_forms || []),
      ...(rule.supporting || []),
      ...(rule.disclosures || []),
    ] as string[]

    // Step 3: Fetch forms
    const formsMap: Record<string, Record<string, unknown>> = {}
    if (allFormIds.length > 0) {
      // Firestore 'in' queries limited to 30 items
      const chunks = chunkArray(allFormIds, 30)
      for (const chunk of chunks) {
        const snap = await db.collection(FORMS).where('form_id', 'in', chunk).get()
        snap.docs.forEach(d => { formsMap[d.data().form_id as string] = { id: d.id, ...d.data() } })
      }
    }

    // Step 4: Fetch field mappings for all forms
    const mappingsMap: Record<string, Array<Record<string, unknown>>> = {}
    if (allFormIds.length > 0) {
      const chunks = chunkArray(allFormIds, 30)
      for (const chunk of chunks) {
        const snap = await db.collection(MAPPINGS).where('form_id', 'in', chunk).get()
        snap.docs.forEach(d => {
          const data = d.data()
          const fid = data.form_id as string
          if (!mappingsMap[fid]) mappingsMap[fid] = []
          mappingsMap[fid].push({ id: d.id, ...data })
        })
      }
    }

    // Step 5: Fetch client data
    const clientDoc = await db.collection('clients').doc(clientId).get()
    const clientData = clientDoc.exists ? (clientDoc.data() || {}) : {}

    // Step 6: Map client fields to form fields
    const layers = {
      firm_client: buildFormLayer(rule.firm_client || [], formsMap, mappingsMap, clientData),
      firm_account: buildFormLayer(rule.firm_account || [], formsMap, mappingsMap, clientData),
      product: buildFormLayer(rule.product_forms || [], formsMap, mappingsMap, clientData),
      supporting: buildFormLayer(rule.supporting || [], formsMap, mappingsMap, clientData),
      disclosures: buildFormLayer(rule.disclosures || [], formsMap, mappingsMap, clientData),
    }

    const allForms = [
      ...layers.firm_client, ...layers.firm_account,
      ...layers.product, ...layers.supporting, ...layers.disclosures,
    ]

    // Step 7: Save kit record
    const kitId = crypto.randomUUID()
    const now = new Date().toISOString()
    const kitRecord = {
      kit_id: kitId,
      client_id: clientId,
      client_name: `${clientData.first_name || ''} ${clientData.last_name || ''}`.trim() || clientId,
      product_type: productType,
      registration_type: registrationType,
      action,
      rule_id: rule.rule_id,
      form_ids: allFormIds,
      form_count: allForms.length,
      status: 'Generated',
      created_by: userEmail,
      created_at: now,
      updated_at: now,
    }

    const bridgeResult = await writeThroughBridge(KITS, 'insert', kitId, kitRecord)
    if (!bridgeResult.success) await db.collection(KITS).doc(kitId).set(kitRecord)

    res.status(201).json(successResponse({
      kit_id: kitId,
      client_id: clientId,
      form_count: allForms.length,
      layers,
      forms: allForms,
    }))
  } catch (err) {
    console.error('POST /api/dex/kits/build error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

dexRoutes.get('/kits', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const params = getPaginationParams(req)
    if (!params.orderBy) params.orderBy = 'created_at'

    let query: Query<DocumentData> = db.collection(KITS)
    if (req.query.client_id) query = query.where('client_id', '==', req.query.client_id)
    if (req.query.status) query = query.where('status', '==', req.query.status)

    const result = await paginatedQuery(query, KITS, params)
    res.json(successResponse(result.data, { pagination: result.pagination }))
  } catch (err) {
    console.error('GET /api/dex/kits error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

dexRoutes.get('/kits/:id', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const id = param(req.params.id)
    const doc = await db.collection(KITS).doc(id).get()
    if (!doc.exists) { res.status(404).json(errorResponse('Kit not found')); return }

    const kit = doc.data() as Record<string, unknown>
    const formIds = (kit.form_ids || []) as string[]

    // Fetch forms for this kit
    const forms: Record<string, unknown>[] = []
    if (formIds.length > 0) {
      const chunks = chunkArray(formIds, 30)
      for (const chunk of chunks) {
        const snap = await db.collection(FORMS).where('form_id', 'in', chunk).get()
        snap.docs.forEach(d => forms.push({ id: d.id, ...d.data() }))
      }
    }

    res.json(successResponse({ kit: { id: doc.id, ...kit }, forms }))
  } catch (err) {
    console.error('GET /api/dex/kits/:id error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

dexRoutes.post('/kits/:id/fill', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const id = param(req.params.id)
    const doc = await db.collection(KITS).doc(id).get()
    if (!doc.exists) { res.status(404).json(errorResponse('Kit not found')); return }

    const kit = doc.data() as Record<string, unknown>
    const formIds = (kit.form_ids || []) as string[]

    // Fetch all mappings for kit forms
    const allMappings: Array<Record<string, unknown>> = []
    if (formIds.length > 0) {
      const chunks = chunkArray(formIds, 30)
      for (const chunk of chunks) {
        const snap = await db.collection(MAPPINGS).where('form_id', 'in', chunk).get()
        snap.docs.forEach(d => allMappings.push(d.data()))
      }
    }

    // Fetch client data
    const clientDoc = await db.collection('clients').doc(String(kit.client_id)).get()
    const clientData = clientDoc.exists ? (clientDoc.data() || {}) : {}

    // Resolve field values
    const userInput = (req.body as Record<string, unknown>).input || {}
    const filledFields: Array<{ form_id: string; field_name: string; pdf_field: string; value: string; source: string }> = []
    const missingFields: Array<{ form_id: string; field_name: string; source: string; required: boolean }> = []

    for (const mapping of allMappings) {
      const source = String(mapping.data_source || '')
      const value = resolveDataSource(source, clientData, userInput as Record<string, unknown>)

      if (value) {
        filledFields.push({
          form_id: String(mapping.form_id),
          field_name: String(mapping.field_name),
          pdf_field: String(mapping.field_name),
          value,
          source,
        })
      } else if (mapping.required) {
        missingFields.push({
          form_id: String(mapping.form_id),
          field_name: String(mapping.field_name),
          source,
          required: true,
        })
      }
    }

    // Update kit status
    await db.collection(KITS).doc(id).update({
      status: missingFields.length === 0 ? 'Ready' : 'Needs Data',
      updated_at: new Date().toISOString(),
    })

    res.json(successResponse({
      kit_id: id,
      filled_count: filledFields.length,
      missing_count: missingFields.length,
      filled_fields: filledFields,
      missing_fields: missingFields,
      status: missingFields.length === 0 ? 'Ready for PDF generation' : 'Missing required fields',
    }))
  } catch (err) {
    console.error('POST /api/dex/kits/:id/fill error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ============================================================================
// Helpers
// ============================================================================

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size))
  }
  return chunks
}

function buildFormLayer(
  formIds: string[],
  formsMap: Record<string, Record<string, unknown>>,
  mappingsMap: Record<string, Array<Record<string, unknown>>>,
  clientData: Record<string, unknown>
): Array<{ form_id: string; form_name: string; fields: Array<{ pdf_field: string; value: string; source: string }> }> {
  return formIds.map(fid => {
    const form = formsMap[fid] || { form_name: fid }
    const mappings = mappingsMap[fid] || []
    const fields = mappings.map(m => {
      const source = String(m.data_source || '')
      return {
        pdf_field: String(m.field_name),
        value: resolveDataSource(source, clientData, {}),
        source,
      }
    })
    return {
      form_id: fid,
      form_name: String(form.form_name || fid),
      fields,
    }
  })
}

/**
 * Resolve a data source reference using @tomachina/core.
 * Wraps dex.resolveDataSource with the local call signature for backward compat.
 */
function resolveDataSource(
  source: string,
  clientData: Record<string, unknown>,
  userInput: Record<string, unknown>
): string {
  return dex.resolveDataSource(source, clientData, {}, userInput)
}
