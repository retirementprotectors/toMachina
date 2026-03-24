import { NextRequest, NextResponse } from 'next/server'
import { initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

if (getApps().length === 0) initializeApp({ projectId: 'claude-mcp-484718' })
const db = getFirestore()

export async function POST(req: NextRequest) {
  const form = await req.formData()
  const callSid = String(form.get('CallSid') || '')
  const callStatus = String(form.get('CallStatus') || '')
  const callDuration = form.get('CallDuration') ? String(form.get('CallDuration')) : null
  const direction = String(form.get('Direction') || '')

  if (callSid) {
    const snap = await db.collection('communications').where('call_sid', '==', callSid).limit(1).get()
    if (!snap.empty) {
      const u: Record<string, unknown> = { status: callStatus, updated_at: new Date().toISOString() }
      if (callDuration) u.duration = callDuration
      if (direction) u.direction = direction
      if (callStatus === 'completed') u.completed_at = new Date().toISOString()
      await snap.docs[0].ref.update(u)
    }
  }
  return new NextResponse(null, { status: 204 })
}
