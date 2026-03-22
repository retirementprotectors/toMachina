/**
 * TRK-532: Auth Helper — Firebase ID token via REST API.
 * Signs in with email/password (same approach as Playwright auth setup).
 * No service account required — works with user ADC locally and WIF in CI.
 */

import { FIREBASE_API_KEY } from './constants.js'

let cachedToken: string | null = null
let tokenExpiresAt = 0

const TEST_EMAIL = process.env.E2E_TEST_EMAIL || 'e2e-test@retireprotected.com'
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD || ''

/**
 * Get a valid Firebase ID token for the test user.
 * Uses signInWithPassword REST API — no service account needed.
 * Caches with 50-minute TTL (tokens last 1 hour).
 */
export async function getTestAuthToken(): Promise<string> {
  const now = Date.now()
  if (cachedToken && now < tokenExpiresAt) {
    return cachedToken
  }

  const apiKey = FIREBASE_API_KEY || process.env.FIREBASE_API_KEY
  if (!apiKey) {
    throw new Error('FIREBASE_API_KEY is required for auth')
  }
  if (!TEST_PASSWORD) {
    throw new Error('E2E_TEST_PASSWORD is required for auth')
  }

  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
        returnSecureToken: true,
      }),
    }
  )

  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(`Firebase sign-in failed (${response.status}): ${errorBody}`)
  }

  const data = await response.json() as { idToken: string; expiresIn: string }
  cachedToken = data.idToken
  tokenExpiresAt = now + 50 * 60 * 1000

  return cachedToken
}
