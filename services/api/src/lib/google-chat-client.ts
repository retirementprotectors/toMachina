/**
 * Google Chat API client for RPI Connect (TKO-CONN-002 through TKO-CONN-007).
 *
 * Auth strategy mirrors calendar-client.ts:
 *   1. GOOGLE_CHAT_CREDENTIALS env var (JSON key — local dev)
 *   2. Keyless domain-wide delegation via IAM signJwt (Cloud Run — no key needed)
 *
 * Prerequisites (one-time, admin action — TKO-CONN-001 instructions):
 *   - GCP OAuth client flipped to Internal in Cloud Console
 *   - Domain-wide delegation authorized for the Chat scopes listed below
 *   - chat.googleapis.com API enabled in GCP project claude-mcp-484718
 *
 * Scopes required (passed in getGoogleProvider() after TKO-CONN-001):
 *   https://www.googleapis.com/auth/chat.spaces
 *   https://www.googleapis.com/auth/chat.spaces.readonly
 *   https://www.googleapis.com/auth/chat.messages
 *   https://www.googleapis.com/auth/chat.messages.readonly
 *   https://www.googleapis.com/auth/chat.messages.reactions
 *   https://www.googleapis.com/auth/chat.memberships
 *   https://www.googleapis.com/auth/chat.memberships.readonly
 *   https://www.googleapis.com/auth/chat.users.readstate
 */

import { google } from 'googleapis'

const TOKEN_URL = 'https://oauth2.googleapis.com/token'

/** All scopes needed for full CONNECT feature set (TKO-CONN-001 through 007) */
export const CHAT_SCOPES = [
  'https://www.googleapis.com/auth/chat.spaces',
  'https://www.googleapis.com/auth/chat.spaces.readonly',
  'https://www.googleapis.com/auth/chat.messages',
  'https://www.googleapis.com/auth/chat.messages.readonly',
  'https://www.googleapis.com/auth/chat.messages.reactions',
  'https://www.googleapis.com/auth/chat.memberships',
  'https://www.googleapis.com/auth/chat.memberships.readonly',
  'https://www.googleapis.com/auth/chat.users.readstate',
] as const

export interface ChatSpace {
  name: string
  spaceId: string
  displayName: string
  spaceType: 'SPACE' | 'GROUP_CHAT' | 'DIRECT_MESSAGE' | string
  memberCount?: number
}

export interface ChatMessage {
  name: string
  messageId: string
  text: string
  sender: {
    name: string
    displayName: string
    email?: string
  }
  createTime: string
  threadName?: string
}

export interface ChatMember {
  name: string
  memberEmail: string
  displayName: string
  role: 'ROLE_MEMBER' | 'ROLE_MANAGER' | string
}

export interface ChatReadState {
  name: string
  lastReadTime: string | null
}

/**
 * Build an auth client that impersonates a Workspace user for Chat API calls.
 * Strategy 1 (local dev): GOOGLE_CHAT_CREDENTIALS env var with JWT signing.
 * Strategy 2 (Cloud Run): keyless DWD via IAM Credentials signJwt.
 */
async function getImpersonatedChatAuth(userEmail: string) {
  const scopeStr = CHAT_SCOPES.join(' ')

  // Strategy 1: explicit key JSON (local dev / standalone SA key)
  const credsJson = process.env.GOOGLE_CHAT_CREDENTIALS ?? process.env.GOOGLE_CALENDAR_CREDENTIALS
  if (credsJson) {
    const credentials = JSON.parse(credsJson) as {
      client_email: string
      private_key: string
    }
    return new google.auth.JWT({
      email: credentials.client_email,
      key: credentials.private_key,
      scopes: CHAT_SCOPES as unknown as string[],
      subject: userEmail,
    })
  }

  // Strategy 2: keyless DWD via IAM Credentials signJwt (Cloud Run)
  const defaultAuth = new google.auth.GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/iam'],
  })
  const creds = await defaultAuth.getCredentials()
  const saEmail = creds.client_email
  if (!saEmail) throw new Error('Could not determine service account email for Chat DWD')

  const now = Math.floor(Date.now() / 1000)
  const claimSet = {
    iss: saEmail,
    sub: userEmail,
    scope: scopeStr,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600,
  }

  const iamClient = await defaultAuth.getClient()
  const signResponse = await iamClient.request<{ signedJwt: string }>({
    url: `https://iam.googleapis.com/v1/projects/-/serviceAccounts/${saEmail}:signJwt`,
    method: 'POST',
    data: { payload: JSON.stringify(claimSet) },
  })

  const tokenResponse = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${signResponse.data.signedJwt}`,
  })
  const tokenData = (await tokenResponse.json()) as { access_token: string }

  const oauth2 = new google.auth.OAuth2()
  oauth2.setCredentials({ access_token: tokenData.access_token })
  return oauth2
}

/**
 * List all Google Chat Spaces the user is a member of.
 * Maps to GET /api/connect/spaces
 */
export async function listChatSpaces(userEmail: string): Promise<ChatSpace[]> {
  const auth = await getImpersonatedChatAuth(userEmail)
  const chat = google.chat({ version: 'v1', auth })

  const response = await chat.spaces.list({ pageSize: 50 })
  const spaces = response.data.spaces || []

  return spaces.map((s): ChatSpace => ({
    name: s.name || '',
    spaceId: s.name?.replace('spaces/', '') || '',
    displayName: s.displayName || s.name || '',
    spaceType: s.spaceType || 'SPACE',
    memberCount: s.membershipCount?.joinedDirectHumanUserCount ?? undefined,
  }))
}

/**
 * Get a single Chat Space by name (e.g. "spaces/AAAAxxxxxx").
 */
export async function getChatSpace(userEmail: string, spaceName: string): Promise<ChatSpace | null> {
  const auth = await getImpersonatedChatAuth(userEmail)
  const chat = google.chat({ version: 'v1', auth })

  const response = await chat.spaces.get({ name: spaceName })
  const s = response.data
  if (!s) return null

  return {
    name: s.name || '',
    spaceId: s.name?.replace('spaces/', '') || '',
    displayName: s.displayName || s.name || '',
    spaceType: s.spaceType || 'SPACE',
    memberCount: s.membershipCount?.joinedDirectHumanUserCount ?? undefined,
  }
}

/**
 * List messages in a Google Chat Space.
 * Maps to GET /api/connect/spaces/:spaceId/messages
 * pageToken is used for pagination (TKO-CONN-007 polling uses it for delta fetches).
 */
export async function listChatMessages(
  userEmail: string,
  spaceName: string,
  opts?: { pageToken?: string; pageSize?: number }
): Promise<{ messages: ChatMessage[]; nextPageToken?: string }> {
  const auth = await getImpersonatedChatAuth(userEmail)
  const chat = google.chat({ version: 'v1', auth })

  const response = await chat.spaces.messages.list({
    parent: spaceName,
    pageSize: opts?.pageSize ?? 50,
    pageToken: opts?.pageToken,
    orderBy: 'createTime asc',
  })

  const raw = response.data.messages || []
  const messages: ChatMessage[] = raw.map((m): ChatMessage => ({
    name: m.name || '',
    messageId: m.name?.split('/').pop() || '',
    text: m.text || m.formattedText || '',
    sender: {
      name: m.sender?.name || '',
      displayName: m.sender?.displayName || m.sender?.name || 'Unknown',
      email: m.sender?.type === 'HUMAN' ? (m.sender as Record<string, unknown>).email as string | undefined : undefined,
    },
    createTime: m.createTime || '',
    threadName: m.thread?.name || undefined,
  }))

  return {
    messages,
    nextPageToken: response.data.nextPageToken ?? undefined,
  }
}

/**
 * Send a message to a Google Chat Space.
 * Maps to POST /api/connect/spaces/:spaceId/messages
 */
export async function sendChatMessage(
  userEmail: string,
  spaceName: string,
  text: string,
  threadName?: string
): Promise<ChatMessage> {
  const auth = await getImpersonatedChatAuth(userEmail)
  const chat = google.chat({ version: 'v1', auth })

  const response = await chat.spaces.messages.create({
    parent: spaceName,
    requestBody: {
      text,
      ...(threadName ? { thread: { name: threadName } } : {}),
    },
  })

  const m = response.data
  return {
    name: m.name || '',
    messageId: m.name?.split('/').pop() || '',
    text: m.text || '',
    sender: {
      name: m.sender?.name || '',
      displayName: m.sender?.displayName || 'Unknown',
    },
    createTime: m.createTime || new Date().toISOString(),
    threadName: m.thread?.name || undefined,
  }
}

/**
 * List members of a Google Chat Space.
 * Maps to GET /api/connect/spaces/:spaceId/members
 */
export async function listChatMembers(
  userEmail: string,
  spaceName: string
): Promise<ChatMember[]> {
  const auth = await getImpersonatedChatAuth(userEmail)
  const chat = google.chat({ version: 'v1', auth })

  const response = await chat.spaces.members.list({ parent: spaceName, pageSize: 100 })
  const raw = response.data.memberships || []

  return raw
    .filter((m) => m.member?.type === 'HUMAN')
    .map((m): ChatMember => ({
      name: m.name || '',
      memberEmail: (m.member as Record<string, unknown> | undefined)?.['email'] as string ?? '',
      displayName: m.member?.displayName || m.member?.name || '',
      role: m.role || 'ROLE_MEMBER',
    }))
}

/**
 * Get the read state (last read position) for a user in a space.
 * Requires chat.users.readstate scope (TKO-CONN-006).
 * Returns null if the scope is not yet granted.
 */
export async function getSpaceReadState(
  userEmail: string,
  spaceName: string
): Promise<ChatReadState | null> {
  const auth = await getImpersonatedChatAuth(userEmail)
  const chat = google.chat({ version: 'v1', auth })

  // readstate API: users/{user}/spaces/{space}/spaceReadState
  const readStateName = `users/me/spaces/${spaceName.replace('spaces/', '')}/spaceReadState`
  try {
    const response = await (chat.users.spaces as unknown as {
      getSpaceReadState: (params: { name: string }) => Promise<{ data: { name?: string; lastReadTime?: string } }>
    }).getSpaceReadState({ name: readStateName })
    return {
      name: response.data.name || readStateName,
      lastReadTime: response.data.lastReadTime ?? null,
    }
  } catch {
    // Scope not granted yet — return null gracefully
    return null
  }
}

/**
 * List DM spaces for the user (type = DIRECT_MESSAGE).
 * Maps to GET /api/connect/dms
 */
export async function listDMSpaces(userEmail: string): Promise<ChatSpace[]> {
  const spaces = await listChatSpaces(userEmail)
  return spaces.filter((s) => s.spaceType === 'DIRECT_MESSAGE')
}
