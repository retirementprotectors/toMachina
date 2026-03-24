import { NextRequest, NextResponse } from 'next/server'
import { initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

if (getApps().length === 0) initializeApp({ projectId: 'claude-mcp-484718' })
const db = getFirestore()

export async function POST(req: NextRequest) {
  const form = await req.formData()
  const callSid = String(form.get('CallSid') || '')
  const recordingUrl = String(form.get('RecordingUrl') || '')
  const recordingSid = String(form.get('RecordingSid') || '')
  const recordingDuration = String(form.get('RecordingDuration') || '')

  if (callSid) {
    const snap = await db.collection('communications').where('call_sid', '==', callSid).limit(1).get()
    if (!snap.empty) {
      await snap.docs[0].ref.update({
        recording_url: recordingUrl + '.mp3', recording_sid: recordingSid,
        recording_duration: recordingDuration, updated_at: new Date().toISOString(),
      })
    }
  }
  return new NextResponse(null, { status: 204 })
}
