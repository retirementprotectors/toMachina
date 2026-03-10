import express from 'express'
import cors from 'cors'
import { initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

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
  res.json({ status: 'ok', service: 'tomachina-bridge', timestamp: new Date().toISOString() })
})

interface WriteRequest {
  collection: string
  operation: 'insert' | 'update' | 'delete'
  id?: string
  data?: Record<string, unknown>
}

// Dual-write endpoint
app.post('/write', async (req, res) => {
  const { collection: collName, operation, id, data } = req.body as WriteRequest

  if (!collName || !operation) {
    res.status(400).json({ success: false, error: 'Missing collection or operation' })
    return
  }

  try {
    // Primary: Firestore
    const collRef = db.collection(collName)
    let docId = id

    switch (operation) {
      case 'insert': {
        if (docId) {
          await collRef.doc(docId).set({ ...data, created_at: new Date(), updated_at: new Date() })
        } else {
          const docRef = await collRef.add({ ...data, created_at: new Date(), updated_at: new Date() })
          docId = docRef.id
        }
        break
      }
      case 'update': {
        if (!docId) {
          res.status(400).json({ success: false, error: 'Update requires id' })
          return
        }
        await collRef.doc(docId).update({ ...data, updated_at: new Date() })
        break
      }
      case 'delete': {
        if (!docId) {
          res.status(400).json({ success: false, error: 'Delete requires id' })
          return
        }
        await collRef.doc(docId).delete()
        break
      }
    }

    // Secondary: Sheets (via Sheets API)
    // Phase 2 will wire this up — for now, log intent
    console.log(`[Bridge] Sheets write pending: ${operation} ${collName}/${docId}`)

    res.json({ success: true, id: docId, store: 'firestore' })
  } catch (err) {
    console.error(`[Bridge] Error: ${err}`)
    res.status(500).json({ success: false, error: String(err) })
  }
})

const PORT = parseInt(process.env.PORT || '8081', 10)
app.listen(PORT, () => {
  console.log(`toMachina Bridge listening on port ${PORT}`)
})
