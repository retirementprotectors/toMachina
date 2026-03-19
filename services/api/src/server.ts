import express from 'express'
import cors from 'cors'
import { initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { requireAuth } from './middleware/auth.js'
import { normalizeBody } from './middleware/normalize.js'
import { rateLimit } from './middleware/rate-limit.js'
import { requestLogger } from './middleware/request-logger.js'
import { clientRoutes } from './routes/clients.js'
import { accountRoutes } from './routes/accounts.js'
import { agentRoutes } from './routes/agents.js'
import { producerRoutes } from './routes/producers.js'
import { revenueRoutes } from './routes/revenue.js'
import { userRoutes } from './routes/users.js'
import { healthRoutes } from './routes/health.js'
import { opportunityRoutes } from './routes/opportunities.js'
import { pipelineRoutes } from './routes/pipelines.js'
import { carrierRoutes } from './routes/carriers.js'
import { productRoutes } from './routes/products.js'
import { campaignRoutes } from './routes/campaigns.js'
import { caseTaskRoutes } from './routes/case-tasks.js'
import { communicationRoutes } from './routes/communications.js'
import { orgRoutes } from './routes/org.js'
import { campaignSendRoutes } from './routes/campaign-send.js'
import { importRoutes } from './routes/import.js'
import { complianceRoutes } from './routes/compliance.js'
import { bookingRoutes } from './routes/booking.js'
import { syncRoutes } from './routes/sync.js'
import { sparkRoutes } from './routes/spark.js'
import { analyticsRoutes } from './routes/analytics.js'
import { webhookRoutes } from './routes/webhooks.js'
import { rulesRoutes } from './routes/rules.js'
import { medicareQuoteRoutes } from './routes/medicare-quote.js'
import { commsRoutes } from './routes/comms.js'
import { flowRoutes } from './routes/flow.js'
import { templateRoutes } from './routes/templates.js'
import { contentBlockRoutes } from './routes/content-blocks.js'
import { atlasRoutes } from './routes/atlas.js'
import { camRoutes } from './routes/cam.js'
import { approvalRoutes } from './routes/approval.js'
import { wireRoutes } from './routes/wire.js'
import { dexRoutes } from './routes/dex.js'
import { dexPipelineRoutes } from './routes/dex-pipeline.js'
import { campaignAnalyticsRoutes } from './routes/campaign-analytics.js'
import { leadershipRoutes } from './routes/leadership.js'
import { flowAdminRoutes } from './routes/flow-admin.js'
import { searchRoutes } from './routes/search.js'
import { accessRoutes } from './routes/access.js'
import { activityRoutes } from './routes/activities.js'
import { ai3Routes } from './routes/ai3.js'
import { trackerRoutes } from './routes/tracker.js'
import { sprintRoutes } from './routes/sprints.js'
import { unitDefaultRoutes } from './routes/unit-defaults.js'
import { householdRoutes } from './routes/households.js'
import { territoryRoutes } from './routes/territories.js'
import { specialistConfigRoutes } from './routes/specialist-configs.js'
import { prozoneRoutes } from './routes/prozone.js'
import { guardianRoutes } from './routes/guardian.js'
import { dropzoneRoutes } from './routes/dropzone.js'
import { connectRoutes } from './routes/connect.js'
import { intakeQueueRoutes } from './routes/intake-queue.js'
import { acfRoutes } from './routes/acf.js'
import { auditMiddleware } from './middleware/audit.js'

// Initialize Firebase Admin
if (getApps().length === 0) {
  initializeApp({
    projectId: process.env.GCP_PROJECT_ID || 'claude-mcp-484718',
    storageBucket: process.env.STORAGE_BUCKET || 'claude-mcp-484718.firebasestorage.app',
  })
}

export const db = getFirestore()
const app = express()

// Global middleware
app.use(cors({ origin: true }))
app.use(express.json({ limit: '10mb' }))

// Health check — no auth, no rate limit, no logging
app.use('/health', healthRoutes)

// Request logging for all authenticated routes (logs method/path/user/time — NO PHI)
app.use(requestLogger)

// Auth + rate limit for all API routes
app.use('/api', requireAuth, rateLimit)

// Audit trail — logs mutations to activities collection (fire-and-forget, non-blocking)
app.use('/api', auditMiddleware)

// Route mounting: normalize body on write routes
app.use('/api/clients', normalizeBody, clientRoutes)
app.use('/api/accounts', normalizeBody, accountRoutes)
app.use('/api/agents', normalizeBody, agentRoutes) // @deprecated — retained during transition
app.use('/api/producers', normalizeBody, producerRoutes)
app.use('/api/revenue', normalizeBody, revenueRoutes)
app.use('/api/users', userRoutes)
app.use('/api/opportunities', normalizeBody, opportunityRoutes)
app.use('/api/pipelines', pipelineRoutes)
app.use('/api/carriers', carrierRoutes)
app.use('/api/products', productRoutes)
app.use('/api/campaigns', campaignRoutes)
app.use('/api/case-tasks', normalizeBody, caseTaskRoutes)
app.use('/api/communications', communicationRoutes)
app.use('/api/org', orgRoutes)
app.use('/api/campaign-send', normalizeBody, campaignSendRoutes)
app.use('/api/import', normalizeBody, importRoutes)
app.use('/api/compliance', complianceRoutes)
app.use('/api/booking', normalizeBody, bookingRoutes)
app.use('/api/sync', syncRoutes)
app.use('/api/spark', sparkRoutes)
app.use('/api/analytics', analyticsRoutes)
app.use('/api/webhooks', webhookRoutes)
app.use('/api/rules', rulesRoutes)
app.use('/api/medicare-quote', medicareQuoteRoutes)
app.use('/api/comms', commsRoutes)
app.use('/api/flow/admin', normalizeBody, flowAdminRoutes)
app.use('/api/flow', flowRoutes)
app.use('/api/templates', normalizeBody, templateRoutes)
app.use('/api/content-blocks', normalizeBody, contentBlockRoutes)
app.use('/api/atlas', normalizeBody, atlasRoutes)
app.use('/api/cam', normalizeBody, camRoutes)
app.use('/api/approval', normalizeBody, approvalRoutes)
app.use('/api/wire', normalizeBody, wireRoutes)
app.use('/api/dex', normalizeBody, dexRoutes)
app.use('/api/dex-pipeline', normalizeBody, dexPipelineRoutes)
app.use('/api/campaign-analytics', campaignAnalyticsRoutes)
app.use('/api/leadership', normalizeBody, leadershipRoutes)
app.use('/api/search', searchRoutes)
app.use('/api/access', normalizeBody, accessRoutes)
app.use('/api/activities', normalizeBody, activityRoutes)
app.use('/api/ai3', ai3Routes)
app.use('/api/tracker', normalizeBody, trackerRoutes)
app.use('/api/sprints', normalizeBody, sprintRoutes)
app.use('/api/unit-defaults', unitDefaultRoutes)
app.use('/api/households', normalizeBody, householdRoutes)
app.use('/api/territories', normalizeBody, territoryRoutes)
app.use('/api/specialist-configs', normalizeBody, specialistConfigRoutes)
app.use('/api/prozone', prozoneRoutes)
app.use('/api/guardian', normalizeBody, guardianRoutes)
app.use('/api/dropzone', normalizeBody, dropzoneRoutes)
app.use('/api/connect', normalizeBody, connectRoutes)
app.use('/api/intake-queue', normalizeBody, intakeQueueRoutes)
app.use('/api/acf', normalizeBody, acfRoutes)

// 404 handler
app.use((_req: express.Request, res: express.Response) => {
  res.status(404).json({ success: false, error: 'Route not found' })
})

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err.message)
  res.status(500).json({ success: false, error: 'Internal server error' })
})

// Start server
const PORT = parseInt(process.env.PORT || '8080', 10)
app.listen(PORT, () => {
  console.log(`toMachina API listening on port ${PORT}`)
})
