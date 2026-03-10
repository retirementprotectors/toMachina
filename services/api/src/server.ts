import express from 'express'
import cors from 'cors'
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

// Initialize Firebase Admin
if (getApps().length === 0) {
  initializeApp({
    projectId: process.env.GCP_PROJECT_ID || 'claude-mcp-484718',
  })
}

const db = getFirestore()
const app = express()

app.use(cors({ origin: true }))
app.use(express.json())

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'tomachina-api', timestamp: new Date().toISOString() })
})

// Placeholder routes — Phase 1 will build these out
app.get('/api/clients', async (_req, res) => {
  try {
    const snap = await db.collection('clients').limit(25).get()
    const clients = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    res.json({ success: true, data: clients, count: clients.length })
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) })
  }
})

app.get('/api/clients/:id', async (req, res) => {
  try {
    const doc = await db.collection('clients').doc(req.params.id).get()
    if (!doc.exists) {
      res.status(404).json({ success: false, error: 'Client not found' })
      return
    }
    res.json({ success: true, data: { id: doc.id, ...doc.data() } })
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) })
  }
})

// Start server
const PORT = parseInt(process.env.PORT || '8080', 10)
app.listen(PORT, () => {
  console.log(`toMachina API listening on port ${PORT}`)
})
