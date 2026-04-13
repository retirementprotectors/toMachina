/**
 * calendar-busy-sync.ts — BKG-08
 * Syncs Google Calendar busy periods to Firestore calendar_busy collection.
 * Runs every 30 minutes via Cloud Scheduler.
 */

import { getFirestore } from 'firebase-admin/firestore'
import { google } from 'googleapis'

const SA_EMAIL = 'claude-mcp-484718@appspot.gserviceaccount.com'
const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.readonly'

interface CalendarBusySyncResult {
  success: boolean
  users_synced: number
  months_written: number
  errors: string[]
}

// ─── Auth (mirrors calendar-client.ts — raw fetch for DWD) ────────────────────

async function getCalendarAuth(userEmail: string) {
  // Local dev: use service account key from env
  const credsJson = process.env.GOOGLE_CALENDAR_CREDENTIALS
  if (credsJson) {
    const creds = JSON.parse(credsJson)
    return new google.auth.JWT({
      email: creds.client_email,
      key: creds.private_key,
      scopes: [CALENDAR_SCOPE],
      subject: userEmail,
    })
  }

  // Cloud: keyless DWD via metadata + signJwt
  const now = Math.floor(Date.now() / 1000)
  const claimSet = {
    iss: SA_EMAIL,
    sub: userEmail,
    scope: CALENDAR_SCOPE,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }

  // Sign JWT via IAM Credentials API (raw fetch, no SDK needed)
  const metadataRes = await fetch(
    'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token',
    { headers: { 'Metadata-Flavor': 'Google' } }
  )
  const metaToken = (await metadataRes.json() as { access_token: string }).access_token

  const signRes = await fetch(
    `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${SA_EMAIL}:signJwt`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${metaToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ payload: JSON.stringify(claimSet) }),
    }
  )
  const signData = await signRes.json() as { signedJwt: string }

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${signData.signedJwt}`,
  })
  const tokenData = await tokenRes.json() as { access_token: string }

  const auth = new google.auth.OAuth2()
  auth.setCredentials({ access_token: tokenData.access_token })
  return auth
}

// ─── Sync Logic ───────────────────────────────────────────────────────────────

export async function syncCalendarBusy(): Promise<CalendarBusySyncResult> {
  const db = getFirestore()
  const errors: string[] = []
  let usersSynced = 0
  let monthsWritten = 0

  // 1. Get bookable agents
  const usersSnap = await db.collection('users').where('status', '==', 'active').get()

  const bookableUsers: Array<{ email: string; slug: string }> = []
  for (const doc of usersSnap.docs) {
    const data = doc.data()
    const profile = data.employee_profile as Record<string, unknown> | undefined
    const slug = profile?.booking_slug as string | undefined
    if (slug && doc.id.includes('@')) {
      bookableUsers.push({ email: doc.id, slug })
    }
  }

  console.log(`[calendar-sync] Found ${bookableUsers.length} bookable users`)

  // 2. For each user, fetch calendar events for current + next month
  const now = new Date()
  const months = [
    { year: now.getFullYear(), month: now.getMonth() + 1 },
    { year: now.getMonth() === 11 ? now.getFullYear() + 1 : now.getFullYear(), month: now.getMonth() === 11 ? 1 : now.getMonth() + 2 },
  ]

  for (const user of bookableUsers) {
    try {
      const auth = await getCalendarAuth(user.email)
      const calendar = google.calendar({ version: 'v3', auth })

      for (const { year, month } of months) {
        const timeMin = new Date(year, month - 1, 1).toISOString()
        const timeMax = new Date(year, month, 0, 23, 59, 59).toISOString()

        const eventsRes = await calendar.events.list({
          calendarId: 'primary',
          timeMin,
          timeMax,
          singleEvents: true,
          orderBy: 'startTime',
          maxResults: 500,
        })

        const periods = (eventsRes.data.items || [])
          .filter(e => e.start?.dateTime && e.end?.dateTime)
          .map(e => ({ start: e.start!.dateTime!, end: e.end!.dateTime! }))

        const docId = `${user.email}_${year}_${month}`
        await db.collection('calendar_busy').doc(docId).set({
          periods,
          synced_at: new Date().toISOString(),
          agent_email: user.email,
          year,
          month,
        })

        monthsWritten++
      }

      usersSynced++
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      errors.push(`${user.email}: ${msg.slice(0, 100)}`)
      console.error(`[calendar-sync] Error for ${user.email}:`, msg)
    }
  }

  console.log(`[calendar-sync] Done: ${usersSynced} users, ${monthsWritten} months, ${errors.length} errors`)
  return { success: errors.length === 0, users_synced: usersSynced, months_written: monthsWritten, errors }
}
