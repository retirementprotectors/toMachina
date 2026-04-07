/**
 * Authenticated fetch helper for CommandCenter components.
 * Attaches Firebase Auth token to all API requests.
 */

import { getAuth } from 'firebase/auth'

export async function authFetch(url: string, init?: RequestInit): Promise<Response> {
  const auth = getAuth()
  const user = auth.currentUser
  const headers = new Headers(init?.headers)

  if (user) {
    try {
      const token = await user.getIdToken(true)
      headers.set('Authorization', `Bearer ${token}`)
    } catch {
      // Fall through without token — middleware will reject if required
    }
  }

  return fetch(url, { ...init, headers })
}
