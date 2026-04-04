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
// CI webhook needs raw body for HMAC validation — must be before json parser
app.post('/webhook/ci', express.raw({ type: '*/*' }), async (req, res) => {
  const secret = process.env.GITHUB_WEBHOOK_SECRET
  if (!secret) { res.status(500).json({ success: false, error: 'Webhook secret not configured' }); return }

  const signature = req.headers['x-hub-signature-256'] as string | undefined
  if (!signature) { res.status(401).json({ success: false, error: 'Missing signature' }); return }

  const rawBody = req.body as Buffer
  if (!rawBody || !Buffer.isBuffer(rawBody)) { res.status(400).json({ success: false, error: 'Missing raw body' }); return }

  const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex')
  const sigBuf = Buffer.from(signature)
  const expBuf = Buffer.from(expected)
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    res.status(401).json({ success: false, error: 'Invalid signature' }); return
  }

  let payload: Record<string, unknown>
  try { payload = JSON.parse(rawBody.toString('utf8')) } catch { res.status(400).json({ success: false, error: 'Invalid JSON' }); return }

  const event = req.headers['x-github-event'] as string
  if (event !== 'workflow_run') { res.json({ success: true, action: 'ignored', event }); return }

  const action = payload.action as string
  const run = payload.workflow_run as Record<string, unknown>
  if (!run) { res.status(400).json({ success: false, error: 'Missing workflow_run' }); return }

  const runId = String(run.id)
  const headCommit = (run.head_commit as Record<string, unknown>) || {}
  const pullRequests = (run.pull_requests as Array<Record<string, unknown>>) || []
  const pr = pullRequests[0] || null
  const now = new Date().toISOString()
  const startedAt = (run.run_started_at as string) || (run.created_at as string) || now
  const completedAt = (run.updated_at as string) || null

  let durationSeconds: number | null = null
  if (action === 'completed' && startedAt && completedAt) {
    durationSeconds = Math.round((new Date(completedAt).getTime() - new Date(startedAt).getTime()) / 1000)
  }

  const workflowName = (run.name as string) || 'Unknown'
  const workflow = workflowName === 'CI' ? 'CI'
    : workflowName === 'CodeQL' ? 'CodeQL'
    : workflowName.includes('deploy') ? 'Deploy'
    : workflowName.includes('pages') ? 'Pages'
    : workflowName

  const ciRun = {
    run_id: Number(run.id),
    workflow,
    workflow_name: workflowName,
    status: (run.status as string) || 'queued',
    conclusion: (run.conclusion as string) || null,
    branch: (run.head_branch as string) || '',
    commit_sha: (run.head_sha as string) || '',
    commit_message: ((headCommit.message as string) || '').split('\n')[0].slice(0, 120),
    pr_number: pr ? (pr.number as number) : null,
    actor: ((run.actor as Record<string, unknown>)?.login as string) || '',
    started_at: startedAt,
    completed_at: action === 'completed' ? completedAt : null,
    duration_seconds: durationSeconds,
    html_url: (run.html_url as string) || '',
    updated_at: now,
  }

  try {
    await db.collection('ci_runs').doc(runId).set(ciRun, { merge: true })
    res.json({ success: true, action, run_id: runId, workflow })
  } catch (err) {
    console.error('[ci-webhook] write failed:', err)
    res.status(500).json({ success: false, error: 'Failed to store CI run' })
  }
})

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
