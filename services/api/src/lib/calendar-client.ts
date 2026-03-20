/**
 * Google Calendar API client for RPI Connect module.
 * Uses service account with domain-wide delegation to impersonate users.
 *
 * Auth strategy (in priority order):
 * 1. GOOGLE_CALENDAR_CREDENTIALS env var (JSON key — local dev)
 * 2. Keyless DWD via IAM Credentials signJwt (Cloud Run — no key needed)
 *
 * Prerequisites:
 * - Domain-wide delegation enabled in Workspace Admin for the SA client ID
 * - Calendar scope authorized: https://www.googleapis.com/auth/calendar
 * - For keyless: SA needs roles/iam.serviceAccountTokenCreator on itself
 */

import { google, type calendar_v3 } from 'googleapis'
import { randomUUID } from 'crypto'

const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'

/**
 * Shape returned to the frontend (matches packages/ui/src/modules/ConnectPanel.tsx MeetingData).
 */
export interface CalendarMeeting {
  title: string
  participants: string[]
  timeLabel: string
  joinable: boolean
  meetLink: string | null
}

/**
 * Build an auth client that impersonates a Workspace user via domain-wide delegation.
 *
 * Strategy 1 (local dev): Use GOOGLE_CALENDAR_CREDENTIALS env var with JWT signing.
 * Strategy 2 (Cloud Run): Use IAM Credentials API signJwt — keyless, uses the
 * compute SA's built-in identity to sign a delegated JWT without a local private key.
 */
async function getImpersonatedAuth(userEmail: string) {
  // Strategy 1: explicit key JSON (local dev)
  const credsJson = process.env.GOOGLE_CALENDAR_CREDENTIALS
  if (credsJson) {
    const credentials = JSON.parse(credsJson) as {
      client_email: string
      private_key: string
    }
    return new google.auth.JWT({
      email: credentials.client_email,
      key: credentials.private_key,
      scopes: [CALENDAR_SCOPE],
      subject: userEmail,
    })
  }

  // Strategy 2: keyless DWD via IAM Credentials signJwt (Cloud Run)
  const defaultAuth = new google.auth.GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/iam'],
  })
  const creds = await defaultAuth.getCredentials()
  const saEmail = creds.client_email
  if (!saEmail) throw new Error('Could not determine service account email for Calendar DWD')

  const now = Math.floor(Date.now() / 1000)
  const claimSet = {
    iss: saEmail,
    sub: userEmail,
    scope: CALENDAR_SCOPE,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600,
  }

  // Sign the JWT using IAM Credentials API (no local key needed)
  const iamClient = await defaultAuth.getClient()
  const signResponse = await iamClient.request<{ signedJwt: string }>({
    url: `https://iam.googleapis.com/v1/projects/-/serviceAccounts/${saEmail}:signJwt`,
    method: 'POST',
    data: { payload: JSON.stringify(claimSet) },
  })

  // Exchange signed JWT for an OAuth2 access token
  const tokenResponse = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${signResponse.data.signedJwt}`,
  })
  const tokenData = (await tokenResponse.json()) as { access_token: string }

  // Return an OAuth2 client with the delegated token
  const oauth2 = new google.auth.OAuth2()
  oauth2.setCredentials({ access_token: tokenData.access_token })
  return oauth2
}

/**
 * Format event start/end into a user-friendly time label.
 * Examples: "10:30 AM", "in 5 min", "2:00 - 3:00 PM"
 */
function formatTimeLabel(
  start: calendar_v3.Schema$EventDateTime | undefined,
  end: calendar_v3.Schema$EventDateTime | undefined
): string {
  if (!start) return ''

  const startDate = start.dateTime ? new Date(start.dateTime) : null
  const endDate = end?.dateTime ? new Date(end.dateTime) : null

  if (!startDate) {
    // All-day event
    return start.date || 'All day'
  }

  const now = new Date()
  const diffMs = startDate.getTime() - now.getTime()
  const diffMin = Math.round(diffMs / 60000)

  // If starting within the next 15 minutes
  if (diffMin > 0 && diffMin <= 15) {
    return `in ${diffMin} min`
  }

  // If currently in progress
  if (diffMin <= 0 && endDate && endDate.getTime() > now.getTime()) {
    return 'Now'
  }

  // Format as "10:30 AM - 11:00 AM"
  const fmt = (d: Date) =>
    d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })

  if (endDate) {
    return `${fmt(startDate)} - ${fmt(endDate)}`
  }
  return fmt(startDate)
}

/**
 * Fetch today's upcoming calendar events for a user.
 * Uses domain-wide delegation to impersonate the user.
 */
export async function getUserCalendarEvents(
  userEmail: string
): Promise<CalendarMeeting[]> {
  const auth = await getImpersonatedAuth(userEmail)
  const calendar = google.calendar({ version: 'v3', auth })

  const now = new Date()
  const endOfDay = new Date(now)
  endOfDay.setHours(23, 59, 59, 999)

  const response = await calendar.events.list({
    calendarId: 'primary',
    timeMin: now.toISOString(),
    timeMax: endOfDay.toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
    maxResults: 20,
  })

  const events = response.data.items || []

  return events.map((event): CalendarMeeting => {
    const meetLink =
      event.hangoutLink ||
      event.conferenceData?.entryPoints?.find(
        (ep: calendar_v3.Schema$EntryPoint) => ep.entryPointType === 'video'
      )?.uri ||
      null

    const startTime = event.start?.dateTime ? new Date(event.start.dateTime) : null
    const endTime = event.end?.dateTime ? new Date(event.end.dateTime) : null
    const isNowOrSoon =
      startTime != null &&
      endTime != null &&
      startTime.getTime() - Date.now() < 15 * 60 * 1000 &&
      endTime.getTime() > Date.now()

    return {
      title: event.summary || '(No title)',
      participants: (event.attendees || [])
        .filter((a: calendar_v3.Schema$EventAttendee) => !a.self)
        .map((a: calendar_v3.Schema$EventAttendee) => a.displayName || a.email || 'Unknown'),
      timeLabel: formatTimeLabel(event.start, event.end),
      joinable: Boolean(meetLink) && isNowOrSoon,
      meetLink,
    }
  })
}

/**
 * Create a quick Google Meet meeting via Calendar API.
 * Creates an event with an auto-generated Meet link.
 * Returns the Meet link and event ID.
 */
export async function createQuickMeet(
  userEmail: string,
  title?: string
): Promise<{ meetLink: string | null; eventId: string | null }> {
  const auth = await getImpersonatedAuth(userEmail)
  const calendar = google.calendar({ version: 'v3', auth })

  const now = new Date()
  const end = new Date(now.getTime() + 30 * 60 * 1000) // 30 minutes from now

  const response = await calendar.events.insert({
    calendarId: 'primary',
    conferenceDataVersion: 1,
    requestBody: {
      summary: title || 'Quick Meeting',
      start: { dateTime: now.toISOString() },
      end: { dateTime: end.toISOString() },
      conferenceData: {
        createRequest: {
          requestId: randomUUID(),
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      },
    },
  })

  const meetLink =
    response.data.hangoutLink ||
    response.data.conferenceData?.entryPoints?.find(
      (ep) => ep.entryPointType === 'video'
    )?.uri ||
    null

  return {
    meetLink,
    eventId: response.data.id || null,
  }
}
