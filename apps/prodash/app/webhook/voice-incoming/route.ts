import { NextRequest, NextResponse } from 'next/server'
import { initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

if (getApps().length === 0) initializeApp({ projectId: 'claude-mcp-484718' })
const db = getFirestore()

export async function POST(req: NextRequest) {
  const form = await req.formData()
  const from = String(form.get('From') || '')
  const callSid = String(form.get('CallSid') || '')
  const identity = process.env.TWILIO_DEFAULT_IDENTITY || 'josh@retireprotected.com'

  const id = crypto.randomUUID()
  db.collection('communications').doc(id).set({
    comm_id: id, channel: 'voice', direction: 'inbound', sender: from, call_sid: callSid,
    status: 'ringing', routed_to: identity, created_at: new Date().toISOString(),
  }).catch(e => console.error('webhook/voice-incoming log:', e))

  const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Dial record="record-from-answer-dual"><Client>${identity}</Client></Dial><Say>No one is available. Please leave a message.</Say><Record maxLength="120" /></Response>`
  return new NextResponse(twiml, { headers: { 'Content-Type': 'text/xml' } })
}
