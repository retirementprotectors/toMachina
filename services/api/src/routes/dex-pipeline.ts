/**
 * DEX Pipeline routes — Document package lifecycle, PDF generation, DocuSign integration.
 * Ported from DEX_Pipeline.gs, DEX_PDFFiller.gs, DEX_DocuSign.gs.
 *
 * Collections:
 *   dex_packages       — package lifecycle (DRAFT -> READY -> SENT -> SIGNED -> COMPLETE)
 *   dex_package_events — audit trail for every status transition
 */

import { Router, type Request, type Response } from 'express'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import {
  successResponse, errorResponse, getPaginationParams, paginatedQuery,
  validateRequired, param, writeThroughBridge,
} from '../lib/helpers.js'
import type { DexPackageCreateData, DexPackageListDTO } from '@tomachina/core'

export const dexPipelineRoutes = Router()

const PACKAGES = 'dex_packages'
const EVENTS = 'dex_package_events'
const KITS = 'dex_kits'
const FORMS = 'dex_forms'
const MAPPINGS = 'dex_field_mappings'

// Pipeline statuses — mirrors DEX_Pipeline.gs PIPELINE_STATUS
const STATUS = {
  DRAFT: 'DRAFT',
  READY: 'READY',
  SENT: 'SENT',
  VIEWED: 'VIEWED',
  SIGNED: 'SIGNED',
  SUBMITTED: 'SUBMITTED',
  COMPLETE: 'COMPLETE',
  VOIDED: 'VOIDED',
  DECLINED: 'DECLINED',
} as const

type PackageStatus = typeof STATUS[keyof typeof STATUS]

// ============================================================================
// Package CRUD
// ============================================================================

/**
 * POST /api/dex-pipeline/packages
 * Create a package from a kit (status: DRAFT)
 */
dexPipelineRoutes.post('/packages', async (req: Request, res: Response) => {
  try {
    const body = req.body as Record<string, unknown>
    const err = validateRequired(body, ['kit_id', 'client_id', 'client_name'])
    if (err) { res.status(400).json(errorResponse(err)); return }

    const db = getFirestore()
    const now = new Date().toISOString()
    const packageId = `PKG_${Date.now()}_${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`
    const userEmail = (req as any).user?.email || 'api'

    // Fetch the kit to get form_ids and kit_name
    const kitId = String(body.kit_id)
    const kitDoc = await db.collection(KITS).doc(kitId).get()
    const kitData = kitDoc.exists ? (kitDoc.data() || {}) : {}

    const data: Record<string, unknown> = {
      package_id: packageId,
      client_id: String(body.client_id),
      client_name: String(body.client_name),
      client_email: String(body.client_email || ''),
      client_phone: String(body.client_phone || ''),
      kit_id: kitId,
      kit_name: String(body.kit_name || kitData.kit_name || 'Custom Kit'),
      form_ids: (body.form_ids as string[]) || (kitData.form_ids as string[]) || [],
      status: STATUS.DRAFT,
      delivery_method: String(body.delivery_method || 'EMAIL'),
      created_at: now,
      updated_at: now,
      sent_at: null,
      viewed_at: null,
      signed_at: null,
      submitted_at: null,
      completed_at: null,
      docusign_envelope_id: null,
      pdf_storage_ref: null,
      notes: String(body.notes || ''),
      draft_state: body.draft_state || null,
      _created_by: userEmail,
    }

    const bridgeResult = await writeThroughBridge(PACKAGES, 'insert', packageId, data)
    if (!bridgeResult.success) await db.collection(PACKAGES).doc(packageId).set(data)

    // Log creation event
    await logPackageEvent(db, packageId, 'CREATED', null, STATUS.DRAFT, 'system', userEmail, {})

    res.status(201).json(successResponse({
      package_id: packageId,
      status: STATUS.DRAFT,
      kit_id: kitId,
      form_count: ((data.form_ids as string[]) || []).length,
    }))
  } catch (err) {
    console.error('POST /api/dex-pipeline/packages error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

/**
 * GET /api/dex-pipeline/packages/summary
 * Counts by status (for pipeline viz)
 * NOTE: This route MUST be before /packages/:id to avoid matching "summary" as an :id
 */
dexPipelineRoutes.get('/packages/summary', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const snap = await db.collection(PACKAGES).get()

    const counts: Record<string, number> = {
      DRAFT: 0,
      READY: 0,
      SENT: 0,
      VIEWED: 0,
      SIGNED: 0,
      SUBMITTED: 0,
      COMPLETE: 0,
      VOIDED: 0,
      DECLINED: 0,
      total: 0,
    }

    snap.docs.forEach(doc => {
      const status = doc.data().status as string
      if (counts.hasOwnProperty(status)) {
        counts[status]++
      }
      counts.total++
    })

    res.json(successResponse(counts))
  } catch (err) {
    console.error('GET /api/dex-pipeline/packages/summary error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

/**
 * GET /api/dex-pipeline/packages
 * List packages (filter by status, client_id)
 */
dexPipelineRoutes.get('/packages', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const params = getPaginationParams(req)
    if (!params.orderBy) params.orderBy = 'created_at'

    let query = db.collection(PACKAGES) as FirebaseFirestore.Query<FirebaseFirestore.DocumentData>
    if (req.query.status) query = query.where('status', '==', req.query.status)
    if (req.query.client_id) query = query.where('client_id', '==', req.query.client_id)

    const result = await paginatedQuery(query, PACKAGES, params)
    res.json(successResponse(result.data, { pagination: result.pagination }))
  } catch (err) {
    console.error('GET /api/dex-pipeline/packages error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

/**
 * GET /api/dex-pipeline/packages/:id
 * Package detail + status timeline (events)
 */
dexPipelineRoutes.get('/packages/:id', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const id = param(req.params.id)
    const doc = await db.collection(PACKAGES).doc(id).get()
    if (!doc.exists) { res.status(404).json(errorResponse('Package not found')); return }

    // Fetch event timeline
    const eventsSnap = await db.collection(EVENTS)
      .where('package_id', '==', id)
      .orderBy('timestamp', 'asc')
      .get()
    const events = eventsSnap.docs.map(d => ({ id: d.id, ...d.data() }))

    res.json(successResponse({
      package: { id: doc.id, ...doc.data() },
      timeline: events,
    }))
  } catch (err) {
    console.error('GET /api/dex-pipeline/packages/:id error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

/**
 * PATCH /api/dex-pipeline/packages/:id/status
 * Manual status update
 */
dexPipelineRoutes.patch('/packages/:id/status', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const id = param(req.params.id)
    const body = req.body as Record<string, unknown>
    const newStatus = String(body.status || '')
    const userEmail = (req as any).user?.email || 'api'

    if (!newStatus || !Object.values(STATUS).includes(newStatus as PackageStatus)) {
      res.status(400).json(errorResponse(`Invalid status: ${newStatus}. Valid: ${Object.values(STATUS).join(', ')}`))
      return
    }

    const doc = await db.collection(PACKAGES).doc(id).get()
    if (!doc.exists) { res.status(404).json(errorResponse('Package not found')); return }

    const oldStatus = (doc.data() as Record<string, unknown>).status as string
    const now = new Date().toISOString()

    const updates: Record<string, unknown> = {
      status: newStatus,
      updated_at: now,
    }

    // Set timestamp fields based on status
    const timestampField = statusToTimestampField(newStatus)
    if (timestampField) updates[timestampField] = now

    if (body.notes) updates.notes = String(body.notes)

    const bridgeResult = await writeThroughBridge(PACKAGES, 'update', id, updates)
    if (!bridgeResult.success) await db.collection(PACKAGES).doc(id).update(updates)

    await logPackageEvent(db, id, 'STATUS_CHANGE', oldStatus, newStatus, 'manual', userEmail, {
      notes: body.notes || null,
    })

    res.json(successResponse({ package_id: id, old_status: oldStatus, new_status: newStatus }))
  } catch (err) {
    console.error('PATCH /api/dex-pipeline/packages/:id/status error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ============================================================================
// PDF Generation
// ============================================================================

/**
 * POST /api/dex-pipeline/packages/:id/generate-pdf
 * Read kit, resolve fields, call PDF_SERVICE /fill-and-merge, update status to READY
 */
dexPipelineRoutes.post('/packages/:id/generate-pdf', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const id = param(req.params.id)
    const userEmail = (req as any).user?.email || 'api'

    const pkgDoc = await db.collection(PACKAGES).doc(id).get()
    if (!pkgDoc.exists) { res.status(404).json(errorResponse('Package not found')); return }

    const pkg = pkgDoc.data() as Record<string, unknown>
    const formIds = (pkg.form_ids || []) as string[]

    if (formIds.length === 0) {
      res.status(400).json(errorResponse('Package has no forms to generate'))
      return
    }

    // Fetch forms
    const formsMap: Record<string, Record<string, unknown>> = {}
    const chunks = chunkArray(formIds, 30)
    for (const chunk of chunks) {
      const snap = await db.collection(FORMS).where('form_id', 'in', chunk).get()
      snap.docs.forEach(d => { formsMap[d.data().form_id as string] = { id: d.id, ...d.data() } })
    }

    // Fetch all field mappings
    const mappingsMap: Record<string, Array<Record<string, unknown>>> = {}
    for (const chunk of chunks) {
      const snap = await db.collection(MAPPINGS).where('form_id', 'in', chunk).get()
      snap.docs.forEach(d => {
        const data = d.data()
        const fid = data.form_id as string
        if (!mappingsMap[fid]) mappingsMap[fid] = []
        mappingsMap[fid].push(data)
      })
    }

    // Fetch client data
    const clientDoc = await db.collection('clients').doc(String(pkg.client_id)).get()
    const clientData = clientDoc.exists ? (clientDoc.data() || {}) : {}

    // User-provided input from request body
    const userInput = ((req.body as Record<string, unknown>).input || {}) as Record<string, unknown>

    // Build forms array for PDF_SERVICE /fill-and-merge
    const pdfForms: Array<{ pdfUrl?: string; formName: string; data: Record<string, string> }> = []
    let totalFilled = 0
    let totalMissing = 0

    for (const formId of formIds) {
      const form = formsMap[formId]
      if (!form) continue

      const mappings = mappingsMap[formId] || []
      const fieldData: Record<string, string> = {}

      for (const mapping of mappings) {
        const source = String(mapping.data_source || '')
        const value = resolveDataSource(source, clientData as Record<string, unknown>, userInput)

        if (value) {
          fieldData[String(mapping.field_name)] = value
          totalFilled++
        } else if (mapping.default_value) {
          fieldData[String(mapping.field_name)] = String(mapping.default_value)
          totalFilled++
        } else if (mapping.required) {
          totalMissing++
        }
      }

      // Use pdf_template_id or gdrive_link as the PDF source URL
      const pdfUrl = String(form.pdf_template_id || form.gdrive_link || '')
      if (pdfUrl) {
        pdfForms.push({
          pdfUrl: convertGDriveToPdfUrl(pdfUrl),
          formName: String(form.form_name || formId),
          data: fieldData,
        })
      }
    }

    if (pdfForms.length === 0) {
      res.status(400).json(errorResponse('No forms with PDF sources found'))
      return
    }

    // Call PDF_SERVICE /fill-and-merge
    const pdfServiceUrl = process.env.PDF_SERVICE_URL
    if (!pdfServiceUrl) {
      res.status(500).json(errorResponse('PDF_SERVICE_URL not configured'))
      return
    }

    const pdfResponse = await fetch(`${pdfServiceUrl.replace(/\/+$/, '')}/fill-and-merge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        forms: pdfForms,
        flatten: true,
      }),
    })

    const pdfResult = await pdfResponse.json() as Record<string, unknown>

    if (!pdfResult.success) {
      res.status(502).json(errorResponse(`PDF generation failed: ${pdfResult.error || 'Unknown error'}`))
      return
    }

    // Store PDF reference on the package — for now, store base64 inline
    // In production, this would go to Cloud Storage
    const now = new Date().toISOString()
    const updates: Record<string, unknown> = {
      status: STATUS.READY,
      pdf_storage_ref: `inline:${id}`,
      updated_at: now,
    }

    // Store base64 in a separate subcollection doc to avoid bloating the package doc
    await db.collection(PACKAGES).doc(id).collection('artifacts').doc('filled_pdf').set({
      pdf_base64: pdfResult.pdfBase64,
      page_count: pdfResult.pageCount,
      form_count: pdfResult.formCount,
      results: pdfResult.results,
      generated_at: now,
    })

    const bridgeResult = await writeThroughBridge(PACKAGES, 'update', id, updates)
    if (!bridgeResult.success) await db.collection(PACKAGES).doc(id).update(updates)

    await logPackageEvent(db, id, 'PDF_GENERATED', pkg.status as string, STATUS.READY, 'system', userEmail, {
      page_count: pdfResult.pageCount,
      form_count: pdfResult.formCount,
      filled_count: totalFilled,
      missing_count: totalMissing,
    })

    res.json(successResponse({
      package_id: id,
      pdf_page_count: pdfResult.pageCount,
      filled_count: totalFilled,
      missing_count: totalMissing,
      form_results: pdfResult.results,
    }))
  } catch (err) {
    console.error('POST /api/dex-pipeline/packages/:id/generate-pdf error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ============================================================================
// DocuSign Integration
// ============================================================================

/**
 * POST /api/dex-pipeline/packages/:id/send-docusign
 * Get JWT via PDF_SERVICE, create DocuSign envelope, update status to SENT
 */
dexPipelineRoutes.post('/packages/:id/send-docusign', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const id = param(req.params.id)
    const userEmail = (req as any).user?.email || 'api'

    const pkgDoc = await db.collection(PACKAGES).doc(id).get()
    if (!pkgDoc.exists) { res.status(404).json(errorResponse('Package not found')); return }

    const pkg = pkgDoc.data() as Record<string, unknown>

    if (pkg.status !== STATUS.READY) {
      res.status(400).json(errorResponse(`Package must be in READY status to send. Current: ${pkg.status}`))
      return
    }

    if (!pkg.client_email) {
      res.status(400).json(errorResponse('Package requires client_email for DocuSign'))
      return
    }

    // Fetch the generated PDF
    const artifactDoc = await db.collection(PACKAGES).doc(id).collection('artifacts').doc('filled_pdf').get()
    if (!artifactDoc.exists) {
      res.status(400).json(errorResponse('No generated PDF found. Run generate-pdf first.'))
      return
    }
    const pdfBase64 = (artifactDoc.data() as Record<string, unknown>).pdf_base64 as string

    // DocuSign config from env
    const dsConfig = {
      integrationKey: process.env.DOCUSIGN_INTEGRATION_KEY || '',
      userId: process.env.DOCUSIGN_USER_ID || '',
      accountId: process.env.DOCUSIGN_ACCOUNT_ID || '',
      baseUri: process.env.DOCUSIGN_BASE_URI || 'https://demo.docusign.net',
      privateKey: process.env.DOCUSIGN_PRIVATE_KEY || '',
    }

    if (!dsConfig.integrationKey || !dsConfig.userId || !dsConfig.accountId || !dsConfig.privateKey) {
      res.status(500).json(errorResponse('DocuSign environment variables not configured (DOCUSIGN_INTEGRATION_KEY, DOCUSIGN_USER_ID, DOCUSIGN_ACCOUNT_ID, DOCUSIGN_PRIVATE_KEY)'))
      return
    }

    const pdfServiceUrl = process.env.PDF_SERVICE_URL
    if (!pdfServiceUrl) {
      res.status(500).json(errorResponse('PDF_SERVICE_URL not configured'))
      return
    }

    // Step 1: Get DocuSign access token via PDF_SERVICE
    const tokenResponse = await fetch(`${pdfServiceUrl.replace(/\/+$/, '')}/docusign/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        integrationKey: dsConfig.integrationKey,
        userId: dsConfig.userId,
        privateKey: dsConfig.privateKey,
        isDemo: dsConfig.baseUri.includes('demo'),
      }),
    })

    const tokenResult = await tokenResponse.json() as Record<string, unknown>
    if (!tokenResult.success || !tokenResult.access_token) {
      res.status(502).json(errorResponse(`DocuSign token failed: ${tokenResult.error || 'Unknown error'}`))
      return
    }

    const accessToken = tokenResult.access_token as string
    const deliveryMethod = String(pkg.delivery_method || 'EMAIL')

    // Step 2: Build signer definition
    const signer: Record<string, unknown> = {
      email: String(pkg.client_email),
      name: String(pkg.client_name),
      recipientId: '1',
      routingOrder: '1',
      tabs: {
        signHereTabs: [{
          documentId: '1',
          pageNumber: '1',
          xPosition: '100',
          yPosition: '700',
        }],
      },
    }

    // SMS delivery
    if (pkg.client_phone && (deliveryMethod === 'SMS' || deliveryMethod === 'BOTH')) {
      let phone = String(pkg.client_phone).replace(/\D/g, '')
      if (phone.length === 10) phone = '+1' + phone
      else if (!phone.startsWith('+')) phone = '+' + phone

      if (deliveryMethod === 'SMS') {
        signer.deliveryMethod = 'SMS'
        signer.phoneNumber = {
          countryCode: phone.substring(0, phone.length - 10) || '+1',
          number: phone.slice(-10),
        }
      } else if (deliveryMethod === 'BOTH') {
        signer.additionalNotifications = [{
          secondaryDeliveryMethod: 'SMS',
          phoneNumber: {
            countryCode: phone.substring(0, phone.length - 10) || '+1',
            number: phone.slice(-10),
          },
        }]
      }
    }

    // Step 3: Create envelope
    const envelopeDefinition = {
      emailSubject: `Documents Ready for Signature - ${pkg.client_name}`,
      documents: [{
        documentBase64: pdfBase64,
        name: String(pkg.kit_name || 'Document Package'),
        fileExtension: 'pdf',
        documentId: '1',
      }],
      recipients: {
        signers: [signer],
      },
      status: 'sent',
    }

    const envelopeUrl = `${dsConfig.baseUri}/restapi/v2.1/accounts/${dsConfig.accountId}/envelopes`
    const envelopeResponse = await fetch(envelopeUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(envelopeDefinition),
    })

    const envelopeResult = await envelopeResponse.json() as Record<string, unknown>

    if (!envelopeResult.envelopeId) {
      res.status(502).json(errorResponse(`DocuSign envelope creation failed: ${envelopeResult.message || envelopeResult.errorCode || 'Unknown error'}`))
      return
    }

    // Step 4: Update package
    const now = new Date().toISOString()
    const updates: Record<string, unknown> = {
      status: STATUS.SENT,
      docusign_envelope_id: envelopeResult.envelopeId,
      sent_at: now,
      updated_at: now,
    }

    const bridgeResult = await writeThroughBridge(PACKAGES, 'update', id, updates)
    if (!bridgeResult.success) await db.collection(PACKAGES).doc(id).update(updates)

    await logPackageEvent(db, id, 'DOCUSIGN_SENT', STATUS.READY, STATUS.SENT, 'system', userEmail, {
      envelope_id: envelopeResult.envelopeId,
      delivery_method: deliveryMethod,
    })

    res.json(successResponse({
      package_id: id,
      envelope_id: envelopeResult.envelopeId,
      status: STATUS.SENT,
      delivery_method: deliveryMethod,
    }))
  } catch (err) {
    console.error('POST /api/dex-pipeline/packages/:id/send-docusign error:', err)
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

function statusToTimestampField(status: string): string | null {
  switch (status) {
    case STATUS.SENT: return 'sent_at'
    case STATUS.VIEWED: return 'viewed_at'
    case STATUS.SIGNED: return 'signed_at'
    case STATUS.SUBMITTED: return 'submitted_at'
    case STATUS.COMPLETE: return 'completed_at'
    default: return null
  }
}

async function logPackageEvent(
  db: FirebaseFirestore.Firestore,
  packageId: string,
  eventType: string,
  fromStatus: string | null,
  toStatus: string,
  source: string,
  actor: string,
  metadata: Record<string, unknown>
) {
  const eventId = `EVT_${Date.now()}_${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`
  await db.collection(EVENTS).doc(eventId).set({
    event_id: eventId,
    package_id: packageId,
    event_type: eventType,
    from_status: fromStatus,
    to_status: toStatus,
    source,
    actor,
    metadata,
    timestamp: new Date().toISOString(),
  })
}

/**
 * Resolve a data source string to a value, following dex.ts resolveDataSource pattern
 */
function resolveDataSource(
  source: string,
  clientData: Record<string, unknown>,
  userInput: Record<string, unknown>
): string {
  if (!source) return ''
  const [namespace, field] = source.split('.')
  if (!field) return ''

  switch (namespace) {
    case 'client':
      return String(clientData[field] || '')
    case 'input':
      return String(userInput[field] || '')
    case 'firm':
      return FIRM_DATA[field] || ''
    case 'static':
      return field
    default:
      return ''
  }
}

const FIRM_DATA: Record<string, string> = {
  name: 'Gradient Securities',
  name_gwm: 'Gradient Wealth Management',
  name_gi: 'Gradient Investments',
  address: '11550 Ash St Suite 200',
  city: 'Leawood',
  state: 'KS',
  zip: '66211',
  phone: '(855) 855-4772',
  crd_gs: '159174',
  crd_gwm: '159258',
}

/**
 * Convert a Google Drive link to a direct download URL
 */
function convertGDriveToPdfUrl(link: string): string {
  if (!link) return ''

  // Already a direct URL (not GDrive)
  if (!link.includes('drive.google.com') && !link.includes('docs.google.com')) return link

  // Extract file ID from /file/d/FILE_ID/...
  const match1 = link.match(/\/file\/d\/([^/]+)/)
  if (match1) return `https://drive.google.com/uc?export=download&id=${match1[1]}`

  // Extract file ID from ?id=FILE_ID
  const match2 = link.match(/[?&]id=([^&]+)/)
  if (match2) return `https://drive.google.com/uc?export=download&id=${match2[1]}`

  return link
}
