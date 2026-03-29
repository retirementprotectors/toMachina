import { Router, type Request, type Response } from 'express'
import crypto from 'crypto'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export const webhookDeployRoutes = Router()

/**
 * Send a Slack notification for deploy failures.
 * Uses SLACK_BOT_TOKEN env var. Gracefully degrades if not configured.
 */
async function notifyDeployError(message: string): Promise<void> {
  const token = process.env.SLACK_BOT_TOKEN
  if (!token) {
    console.warn('[webhook/deploy] Slack notification skipped (no SLACK_BOT_TOKEN)')
    return
  }

  const channel = process.env.SLACK_DEPLOY_CHANNEL || 'C0AH592RNQK'
  try {
    const response = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        channel,
        text: `:x: *VOLTRON Deploy Failed*\n\`\`\`${message.slice(0, 1500)}\`\`\``,
      }),
    })

    const result = (await response.json()) as Record<string, unknown>
    if (!result.ok) {
      console.error('[webhook/deploy] Slack API error:', result.error)
    }
  } catch (err) {
    console.error('[webhook/deploy] Slack notification failed:', err)
  }
}

/**
 * POST /webhook/deploy
 * GitHub Webhook receiver for auto-deploy on push to main.
 *
 * - HMAC-SHA256 signature validated against GITHUB_WEBHOOK_SECRET
 * - Only fires on pushes to refs/heads/main
 * - Deploy sequence: git pull → npm ci → npx tsc → systemctl restart mdj-agent.service
 * - On build failure: service NOT restarted, Slack error notification sent
 *
 * Sudoers entry (documented):
 *   File: /etc/sudoers.d/jdm-voltron
 *   jdm ALL=(ALL) NOPASSWD: /bin/systemctl restart mdj-agent.service
 *
 * TRK-13856 / TRK-13862
 */
webhookDeployRoutes.post('/', async (req: Request, res: Response) => {
  const secret = process.env.GITHUB_WEBHOOK_SECRET
  if (!secret) {
    console.error('[webhook/deploy] GITHUB_WEBHOOK_SECRET not configured')
    res.status(500).json({ success: false, error: 'Webhook secret not configured' })
    return
  }

  // --- HMAC-SHA256 Signature Validation ---
  const signature = req.headers['x-hub-signature-256'] as string | undefined
  if (!signature) {
    res.status(401).json({ success: false, error: 'Missing signature header' })
    return
  }

  const rawBody = (req as Request & { rawBody?: Buffer }).rawBody
  if (!rawBody) {
    res.status(400).json({ success: false, error: 'Missing raw body for signature validation' })
    return
  }

  const expected = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex')

  const signatureBuffer = Buffer.from(signature)
  const expectedBuffer = Buffer.from(expected)

  if (signatureBuffer.length !== expectedBuffer.length ||
      !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) {
    res.status(401).json({ success: false, error: 'Invalid signature' })
    return
  }

  // --- Branch Filter: only refs/heads/main ---
  let payload: Record<string, unknown>
  try {
    payload = JSON.parse(rawBody.toString('utf8'))
  } catch {
    res.status(400).json({ success: false, error: 'Invalid JSON payload' })
    return
  }

  const ref = payload.ref as string | undefined
  if (ref !== 'refs/heads/main') {
    res.status(200).json({ success: true, action: 'ignored', reason: `Ref ${ref} is not refs/heads/main` })
    return
  }

  // --- Respond immediately (GitHub expects < 10s) ---
  res.status(200).json({ success: true, action: 'deploy_started' })

  // --- Async deploy sequence ---
  const PROJECT_DIR = process.env.MDJ_AGENT_DIR || '/home/jdm/Projects/toMachina/services/mdj-agent'

  try {
    console.log('[webhook/deploy] Starting deploy sequence...')

    // Step 1: git pull
    console.log('[webhook/deploy] git pull origin main...')
    await execAsync('git pull origin main', { cwd: PROJECT_DIR })

    // Step 2: npm ci
    console.log('[webhook/deploy] npm ci...')
    await execAsync('npm ci', { cwd: PROJECT_DIR, timeout: 120_000 })

    // Step 3: npx tsc (build check)
    console.log('[webhook/deploy] npx tsc...')
    await execAsync('npx tsc', { cwd: PROJECT_DIR, timeout: 60_000 })

    // Step 4: Only restart if all steps succeeded
    console.log('[webhook/deploy] Restarting mdj-agent.service...')
    await execAsync('sudo /bin/systemctl restart mdj-agent.service')

    console.log('[webhook/deploy] Deploy completed successfully')
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    console.error('[webhook/deploy] Deploy FAILED — service NOT restarted:', errorMessage)

    // Slack error notification (fire-and-forget)
    notifyDeployError(errorMessage).catch(() => { /* already logged inside */ })
  }
})
