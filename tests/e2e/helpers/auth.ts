/**
 * TRK-532: Auth Helper — Firebase custom token → ID token exchange.
 * Creates a custom token via Firebase Admin, exchanges it for an ID token
 * via the Firebase Auth REST API.
 */

import { getAuth } from 'firebase-admin/auth'
import { TEST_USER_EMAIL, FIREBASE_API_KEY } from './constants.js'

let cachedToken: string | null = null
let tokenExpiresAt = 0

/**
 * Get a valid Firebase ID token for the test user.
 * Caches with 50-minute TTL (tokens last 1 hour).
 */
export async function getTestAuthToken(): Promise<string> {
  const now = Date.now()
  if (cachedToken && now < tokenExpiresAt) {
    return cachedToken
  }

  // Step 1: Create custom token via Firebase Admin
  const customToken = await getAuth().createCustomToken(TEST_USER_EMAIL, {
    email: TEST_USER_EMAIL,
  })

  // Step 2: Exchange custom token for ID token via REST API
  const apiKey = FIREBASE_API_KEY || process.env.FIREBASE_API_KEY
  if (!apiKey) {
    throw new Error('FIREBASE_API_KEY is required for auth token exchange')
  }

  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: customToken,
        returnSecureToken: true,
      }),
    }
  )

  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(`Token exchange failed (${response.status}): ${errorBody}`)
  }

  const data = await response.json() as { idToken: string; expiresIn: string }
  cachedToken = data.idToken
  // Cache for 50 minutes (tokens expire in 60)
  tokenExpiresAt = now + 50 * 60 * 1000

  return cachedToken
}
