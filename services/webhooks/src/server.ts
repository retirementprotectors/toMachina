import express from 'express'
import { initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import crypto from 'crypto'

if (getApps().length === 0) {
  initializeApp({ projectId: process.env.GCP_PROJECT_ID || 'claude-mcp-484718' })
}

const db = getFirestore()
const COLLECTION = 'communications'
const app = express()
app.use(express.urlencoded({ extended: false }))
app.use(express.json())

app.get('/health', (_req, res) => {
  res.json({ success: true, service: 'tm-webhooks', status: 'healthy', timestamp: new Date().toISOString() })
})

async function logComm(data: Record<string, unknown>): Promise<string> {
  const id = crypto.randomUUID()
  await db.collection(COLLECTION).doc(id).set({ comm_id: id, ...data, created_at: new Date().toISOString() })
  return id
}

function xml(res: express.Response, twiml: string) {
  res.set('Content-Type', 'text/xml')
  res.send(twiml)
}

// Outbound — TwiML App callback when Device.connect() fires
app.post('/webhook/voice', async (req, res) => {
  try {
    const to = String(req.body.To || '')
    const from = String(req.body.From || '')
    if (!to) { xml(res, '<Response><Say>No destination.</Say></Response>'); return }

    logComm({ channel: 'voice', direction: 'outbound', recipient: to, sender: from, status: 'initiated', call_type: 'browser_outbound' }).catch(e => console.error(e))

    const cbUrl = `https://tm-webhooks-365181509090.us-central1.run.app/webhook/call-status`
    xml(res, `<?xml version="1.0" encoding="UTF-8"?><Response><Dial callerId="+18886208587" record="record-from-answer-dual"><Number statusCallbackEvent="initiated ringing answered completed" statusCallback="${cbUrl}">${to}</Number></Dial></Response>`)
  } catch (err) {
    console.error('webhook/voice error:', err)
    xml(res, '<Response><Say>Error occurred.</Say></Response>')
  }
})

// Inbound call to 888
app.post('/webhook/voice-incoming', async (req, res) => {
  try {
    const from = String(req.body.From || '')
    const callSid = String(req.body.CallSid || '')
    const identity = process.env.TWILIO_DEFAULT_IDENTITY || 'josh@retireprotected.com'

    logComm({ channel: 'voice', direction: 'inbound', sender: from, call_sid: callSid, status: 'ringing', routed_to: identity }).catch(e => console.error(e))

    xml(res, `<?xml version="1.0" encoding="UTF-8"?><Response><Dial record="record-from-answer-dual"><Client>${identity}</Client></Dial><Say>No one is available. Please leave a message.</Say><Record maxLength="120" /></Response>`)
  } catch (err) {
    console.error('webhook/voice-incoming error:', err)
    xml(res, '<?xml version="1.0" encoding="UTF-8"?><Response></Response>')
  }
})

// Inbound SMS to 888
app.post('/webhook/sms-incoming', async (req, res) => {
  try {
    const from = String(req.body.From || '')
    const body = String(req.body.Body || '')
    const messageSid = String(req.body.MessageSid || '')
    const numMedia = Number(req.body.NumMedia || '0')
    const mediaUrls: string[] = []
    for (let i = 0; i < numMedia; i++) { const u = req.body[`MediaUrl${i}`]; if (u) mediaUrls.push(String(u)) }

    let clientId: string | null = null
    try {
      const digits = from.replace(/\D/g, '').replace(/^1/, '')
      const [c, p] = await Promise.all([
        db.collection('clients').where('cell_phone', '==', digits).limit(1).get(),
        db.collection('clients').where('phone', '==', digits).limit(1).get(),
      ])
      const match = c.docs[0] || p.docs[0]
      if (match) clientId = match.id
    } catch (e) { console.error('sms client lookup:', e) }

    await logComm({ channel: 'sms', direction: 'inbound', sender: from, body, message_sid: messageSid, media_urls: mediaUrls, status: 'received', client_id: clientId })
    xml(res, '<?xml version="1.0" encoding="UTF-8"?><Response></Response>')
  } catch (err) {
    console.error('webhook/sms-incoming error:', err)
    xml(res, '<?xml version="1.0" encoding="UTF-8"?><Response></Response>')
  }
})

// Recording complete callback
app.post('/webhook/recording-status', async (req, res) => {
  try {
    const callSid = String(req.body.CallSid || '')
    const recordingUrl = String(req.body.RecordingUrl || '')
    const recordingSid = String(req.body.RecordingSid || '')
    const recordingDuration = String(req.body.RecordingDuration || '')
    if (callSid) {
      const snap = await db.collection(COLLECTION).where('call_sid', '==', callSid).limit(1).get()
      if (!snap.empty) await snap.docs[0].ref.update({ recording_url: recordingUrl + '.mp3', recording_sid: recordingSid, recording_duration: recordingDuration, updated_at: new Date().toISOString() })
    }
    res.status(204).send()
  } catch (err) { console.error('recording-status error:', err); res.status(204).send() }
})

// Call status change callback
app.post('/webhook/call-status', async (req, res) => {
  try {
    const callSid = String(req.body.CallSid || '')
    const callStatus = String(req.body.CallStatus || '')
    const callDuration = req.body.CallDuration ? String(req.body.CallDuration) : null
    const direction = String(req.body.Direction || '')
    if (callSid) {
      const snap = await db.collection(COLLECTION).where('call_sid', '==', callSid).limit(1).get()
      if (!snap.empty) {
        const u: Record<string, unknown> = { status: callStatus, updated_at: new Date().toISOString() }
        if (callDuration) u.duration = callDuration
        if (direction) u.direction = direction
        if (callStatus === 'completed') u.completed_at = new Date().toISOString()
        await snap.docs[0].ref.update(u)
      }
    }
    res.status(204).send()
  } catch (err) { console.error('call-status error:', err); res.status(204).send() }
})

const PORT = parseInt(process.env.PORT || '8081', 10)
app.listen(PORT, () => console.log(`tm-webhooks listening on port ${PORT}`))

// Cloud Functions export
export { app }
