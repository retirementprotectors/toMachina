/**
 * Call routing + voicemail config helpers.
 * CP07: Smart routing — looks up client's assigned_agent to route inbound calls.
 * CP08: Voicemail config — reads greeting + settings from Firestore config/ docs.
 */

import { getFirestore } from 'firebase-admin/firestore'

const DEFAULT_IDENTITY = process.env.TWILIO_DEFAULT_IDENTITY || 'josh@retireprotected.com'

/**
 * Resolve the Twilio Client identity to ring for an inbound call.
 * Looks up the caller's phone number → client doc → assigned_agent email.
 * Falls back to DEFAULT_IDENTITY if no match found.
 */
export async function resolveCallRouting(fromPhone: string): Promise<string> {
  if (!fromPhone) return DEFAULT_IDENTITY

  try {
    const db = getFirestore()
    // Normalize phone — strip everything except digits, keep last 10
    const digits = fromPhone.replace(/\D/g, '').slice(-10)
    if (digits.length < 10) return DEFAULT_IDENTITY

    // Try matching by phone field
    const snap = await db
      .collection('clients')
      .where('phone', '>=', digits.slice(-10))
      .where('phone', '<=', digits.slice(-10) + '\uf8ff')
      .limit(1)
      .get()

    if (!snap.empty) {
      const clientData = snap.docs[0].data()
      const agentEmail = clientData.assigned_agent || clientData.agent_email
      if (agentEmail && typeof agentEmail === 'string') {
        return agentEmail
      }
    }

    return DEFAULT_IDENTITY
  } catch (err) {
    console.error('resolveCallRouting error:', err)
    return DEFAULT_IDENTITY
  }
}

interface VoicemailConfig {
  greeting: string
  maxLength: number
  transcribe: boolean
}

const DEFAULT_VM_CONFIG: VoicemailConfig = {
  greeting: "We're sorry, no one is available to take your call. Please leave a message after the tone.",
  maxLength: 120,
  transcribe: false,
}

/**
 * Load voicemail configuration from Firestore config/voicemail doc.
 * Falls back to defaults if doc doesn't exist.
 */
export async function getVoicemailConfig(): Promise<VoicemailConfig> {
  try {
    const db = getFirestore()
    const doc = await db.collection('config').doc('voicemail').get()

    if (!doc.exists) return DEFAULT_VM_CONFIG

    const data = doc.data() as Record<string, unknown>
    return {
      greeting: typeof data.greeting === 'string' ? data.greeting : DEFAULT_VM_CONFIG.greeting,
      maxLength: typeof data.maxLength === 'number' ? data.maxLength : DEFAULT_VM_CONFIG.maxLength,
      transcribe: typeof data.transcribe === 'boolean' ? data.transcribe : DEFAULT_VM_CONFIG.transcribe,
    }
  } catch (err) {
    console.error('getVoicemailConfig error:', err)
    return DEFAULT_VM_CONFIG
  }
}
