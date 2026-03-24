import { NextRequest, NextResponse } from 'next/server'
import { initializeApp, getApps, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

if (getApps().length === 0) initializeApp({ projectId: 'claude-mcp-484718' })
const db = getFirestore()

export async function POST(req: NextRequest) {
  const form = await req.formData()
  const to = String(form.get('To') || '')
  const from = String(form.get('From') || '')

  if (!to) {
    return new NextResponse('<Response><Say>No destination.</Say></Response>', { headers: { 'Content-Type': 'text/xml' } })
  }

  // Log outbound call (fire-and-forget)
  const id = crypto.randomUUID()
  db.collection('communications').doc(id).set({
    comm_id: id, channel: 'voice', direction: 'outbound', recipient: to, sender: from,
    status: 'initiated', call_type: 'browser_outbound', created_at: new Date().toISOString(),
  }).catch(e => console.error('webhook/voice log:', e))

  const cbUrl = 'https://prodash.tomachina.com/webhook/call-status'
  const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Dial callerId="+18886208587" record="record-from-answer-dual"><Number statusCallbackEvent="initiated ringing answered completed" statusCallback="${cbUrl}">${to}</Number></Dial></Response>`

  return new NextResponse(twiml, { headers: { 'Content-Type': 'text/xml' } })
}
