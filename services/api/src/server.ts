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

// Initialize Firebase Admin
if (getApps().length === 0) {
  initializeApp({
    projectId: process.env.GCP_PROJECT_ID || 'claude-mcp-484718',
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

// Route mounting: normalize body on write routes
app.use('/api/clients', normalizeBody, clientRoutes)
app.use('/api/accounts', normalizeBody, accountRoutes)
app.use('/api/agents', normalizeBody, agentRoutes)
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
