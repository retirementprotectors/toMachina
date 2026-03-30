import { getFirestore } from 'firebase-admin/firestore'
import type { ForgeItem } from './types.js'

function getDb() { return getFirestore() }
let lastRunTimestamp: string | null = null
const FORGE_TRACKER_COLLECTION = 'forge_tracker'

export async function pollForgeBoard(): Promise<ForgeItem[]> {
  try {
    let query = db
      .collection(FORGE_TRACKER_COLLECTION)
      .where('type', 'in', ['bug', 'broken'])
      .where('status', '==', 'open')

    if (lastRunTimestamp) {
      query = query.where('created_at', '>', lastRunTimestamp) as typeof query
    }

    const snap = await query.orderBy('created_at', 'asc').get()
    lastRunTimestamp = new Date().toISOString()

    return snap.docs.map((doc) => {
      const data = doc.data()
      return {
        trk_id: data.item_id ?? doc.id,
        title: data.title ?? '',
        description: data.description ?? '',
        type: data.type ?? 'bug',
        priority: data.priority ?? 'P2',
      }
    })
  } catch (err) {
    console.error('[RAIDEN] FORGE poll error:', err)
    return []
  }
}
