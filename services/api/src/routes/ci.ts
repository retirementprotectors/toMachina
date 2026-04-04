import { Router, type Request, type Response } from 'express'
import { getFirestore } from 'firebase-admin/firestore'
import crypto from 'crypto'

const CI_COLLECTION = 'ci_runs'

export const ciWebhookRoutes = Router()
export const ciRoutes = Router()

// ─── POST /webhook/ci — GitHub workflow_run webhook receiver ───
// Mounted BEFORE express.json() (raw body for HMAC validation)
// No auth required — GitHub authenticates via HMAC signature
ciWebhookRoutes.post('/', async (req: Request, res: Response) => {
  const secret = process.env.GITHUB_WEBHOOK_SECRET
  if (!secret) {
    res.status(500).json({ success: false, error: 'Webhook secret not configured' })
    return
  }

  // HMAC-SHA256 Signature Validation
  const signature = req.headers['x-hub-signature-256'] as string | undefined
  if (!signature) {
    res.status(401).json({ success: false, error: 'Missing signature header' })
    return
  }

  const rawBody = (req as Request & { rawBody?: Buffer }).rawBody
  if (!rawBody) {
    res.status(400).json({ success: false, error: 'Missing raw body' })
    return
  }

  const expected = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex')

  const sigBuf = Buffer.from(signature)
  const expBuf = Buffer.from(expected)
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    res.status(401).json({ success: false, error: 'Invalid signature' })
    return
  }

  // Parse payload
  let payload: Record<string, unknown>
  try {
    payload = JSON.parse(rawBody.toString('utf8'))
  } catch {
    res.status(400).json({ success: false, error: 'Invalid JSON payload' })
    return
  }

  const event = req.headers['x-github-event'] as string
  if (event !== 'workflow_run') {
    res.json({ success: true, action: 'ignored', event })
    return
  }

  const action = payload.action as string
  const run = payload.workflow_run as Record<string, unknown>
  if (!run) {
    res.status(400).json({ success: false, error: 'Missing workflow_run payload' })
    return
  }

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
    pr_title: null as string | null,
    actor: ((run.actor as Record<string, unknown>)?.login as string) || '',
    started_at: startedAt,
    completed_at: action === 'completed' ? completedAt : null,
    duration_seconds: durationSeconds,
    html_url: (run.html_url as string) || '',
    jobs: [] as Array<Record<string, unknown>>,
    updated_at: now,
  }

  try {
    const db = getFirestore()
    await db.collection(CI_COLLECTION).doc(runId).set(ciRun, { merge: true })
    res.json({ success: true, action, run_id: runId, workflow })
  } catch (err) {
    console.error('[ci-webhook] Firestore write failed:', err)
    res.status(500).json({ success: false, error: 'Failed to store CI run' })
  }
})

// ─── GET /api/ci — Returns recent CI runs grouped by workflow ───
ciRoutes.get('/', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const workflow = (req.query.workflow as string) || ''
    const branch = (req.query.branch as string) || ''
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50)

    let query = db.collection(CI_COLLECTION).orderBy('updated_at', 'desc').limit(limit)
    if (workflow) query = query.where('workflow', '==', workflow) as typeof query
    if (branch) query = query.where('branch', '==', branch) as typeof query

    const snap = await query.get()
    const runs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))

    const grouped: Record<string, unknown[]> = {}
    for (const run of runs) {
      const wf = (run as Record<string, unknown>).workflow as string
      if (!grouped[wf]) grouped[wf] = []
      grouped[wf].push(run)
    }

    res.json({ success: true, data: { runs, grouped, total: runs.length } })
  } catch (err) {
    console.error('[ci] GET / error:', err)
    res.status(500).json({ success: false, error: String(err) })
  }
})

// ─── GET /api/ci/latest — Latest run per workflow (for badges) ───
ciRoutes.get('/latest', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const workflows = ['CI', 'CodeQL', 'Deploy', 'Pages']
    const latest: Record<string, unknown> = {}

    for (const wf of workflows) {
      const snap = await db.collection(CI_COLLECTION)
        .where('workflow', '==', wf)
        .orderBy('updated_at', 'desc')
        .limit(1)
        .get()
      if (!snap.empty) {
        latest[wf] = { id: snap.docs[0].id, ...snap.docs[0].data() }
      }
    }

    res.json({ success: true, data: latest })
  } catch (err) {
    console.error('[ci] GET /latest error:', err)
    res.status(500).json({ success: false, error: String(err) })
  }
})
