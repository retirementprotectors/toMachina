import { NextRequest, NextResponse } from 'next/server'
import { initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

if (getApps().length === 0) initializeApp({ projectId: 'claude-mcp-484718' })
const db = getFirestore()

export async function POST(req: NextRequest) {
  const form = await req.formData()
  const from = String(form.get('From') || '')
  const body = String(form.get('Body') || '')
  const messageSid = String(form.get('MessageSid') || '')
  const numMedia = Number(form.get('NumMedia') || '0')
  const mediaUrls: string[] = []
  for (let i = 0; i < numMedia; i++) { const u = form.get(`MediaUrl${i}`); if (u) mediaUrls.push(String(u)) }

  let clientId: string | null = null
  try {
    const digits = from.replace(/\D/g, '').replace(/^1/, '')
    const [c, p] = await Promise.all([
      db.collection('clients').where('cell_phone', '==', digits).limit(1).get(),
      db.collection('clients').where('phone', '==', digits).limit(1).get(),
    ])
    const match = c.docs[0] || p.docs[0]
    if (match) clientId = match.id
  } catch (e) { console.error('sms lookup:', e) }

  const id = crypto.randomUUID()
  await db.collection('communications').doc(id).set({
    comm_id: id, channel: 'sms', direction: 'inbound', sender: from, body,
    message_sid: messageSid, media_urls: mediaUrls, status: 'received',
    client_id: clientId, created_at: new Date().toISOString(),
  })

  return new NextResponse('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', { headers: { 'Content-Type': 'text/xml' } })
}
