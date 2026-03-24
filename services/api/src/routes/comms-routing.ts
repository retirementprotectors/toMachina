/**
 * CP07: Smart Call Routing
 * CP08: Voicemail Config
 *
 * Resolves which Twilio Client identity to route inbound calls to,
 * based on the caller's phone number and client assignment in Firestore.
 */

import { getFirestore } from 'firebase-admin/firestore'

/**
 * Look up client by phone number, find their assigned agent,
 * and return that agent's email as the Twilio Client identity.
 * Falls back to TWILIO_DEFAULT_IDENTITY env var.
 */
export async function resolveCallRouting(fromNumber: string): Promise<string> {
  const envDefault = process.env.TWILIO_DEFAULT_IDENTITY
  const fallbackId = envDefault || 'josh@retireprotected.com'
  try {
    const db = getFirestore()
    const digits = fromNumber.replace(/\D/g, '').replace(/^1/, '')
    if (!digits) return fallbackId

    const [cellSnap, phoneSnap] = await Promise.all([
      db.collection('clients').where('cell_phone', '==', digits).limit(1).get(),
      db.collection('clients').where('phone', '==', digits).limit(1).get(),
    ])
    const clientDoc = cellSnap.docs[0] || phoneSnap.docs[0]
    if (!clientDoc) return fallbackId

    const client = clientDoc.data()
    const agent = client.assigned_agent || client.agent_name || ''
    if (!agent) return fallbackId

    const agentSnap = await db
      .collection('users')
      .where('display_name', '==', agent)
      .limit(1)
      .get()
    if (!agentSnap.empty) {
      const email = agentSnap.docs[0].data().email
      if (email) return email
    }

    return fallbackId
  } catch {
    return fallbackId
  }
}

/**
 * CP08: Read voicemail configuration from Firestore config/voicemail doc.
 */
export async function getVoicemailConfig(): Promise<{
  greeting: string
  maxLength: number
  transcribe: boolean
}> {
  const defaults = {
    greeting:
      "Thank you for calling Retirement Protectors. We're unable to take your call right now. Please leave a message and we'll get back to you as soon as possible.",
    maxLength: 120,
    transcribe: true,
  }
  try {
    const db = getFirestore()
    const doc = await db.collection('config').doc('voicemail').get()
    if (!doc.exists) return defaults
    const data = doc.data() || {}
    return {
      greeting: data.greeting_text || defaults.greeting,
      maxLength: data.max_length || defaults.maxLength,
      transcribe: data.transcription_enabled !== false,
    }
  } catch {
    return defaults
  }
}
