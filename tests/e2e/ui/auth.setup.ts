import { test as setup } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

/*
 * Playwright global setup — authenticate via Firebase Auth REST API
 *
 * Approach:
 * 1. Sign in with email/password via Firebase Auth REST endpoint
 * 2. Navigate to ProDash and inject the Firebase ID token into the app
 * 3. Save browser storage state for reuse across all tests
 *
 * Requires: FIREBASE_API_KEY env var + test user with email/password auth enabled
 */

const AUTH_DIR = path.join(__dirname, '.auth')
const STORAGE_STATE = path.join(AUTH_DIR, 'storageState.json')

const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY || ''
const TEST_USER_EMAIL = process.env.E2E_TEST_EMAIL || 'e2e-test@retireprotected.com'
const TEST_USER_PASSWORD = process.env.E2E_TEST_PASSWORD || ''

interface FirebaseSignInResponse {
  idToken: string
  email: string
  refreshToken: string
  expiresIn: string
  localId: string
}

async function getFirebaseIdToken(): Promise<FirebaseSignInResponse> {
  if (!FIREBASE_API_KEY) {
    throw new Error('FIREBASE_API_KEY env var is required for E2E auth')
  }
  if (!TEST_USER_PASSWORD) {
    throw new Error('E2E_TEST_PASSWORD env var is required for E2E auth')
  }

  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: TEST_USER_EMAIL,
        password: TEST_USER_PASSWORD,
        returnSecureToken: true,
      }),
    }
  )

  if (!res.ok) {
    const err = await res.json()
    throw new Error(`Firebase sign-in failed: ${err?.error?.message || res.statusText}`)
  }

  return res.json()
}

setup('authenticate', async ({ page }) => {
  // Ensure auth directory exists
  if (!fs.existsSync(AUTH_DIR)) {
    fs.mkdirSync(AUTH_DIR, { recursive: true })
  }

  // Get Firebase ID token
  const { idToken, refreshToken, localId, email } = await getFirebaseIdToken()

  // Navigate to ProDash
  await page.goto('/')

  // Inject Firebase Auth state into IndexedDB
  // Firebase stores auth data in IndexedDB under 'firebaseLocalStorageDb'
  await page.evaluate(
    ({ idToken, refreshToken, localId, email, apiKey }) => {
      // Firebase Auth persistence key format
      const persistenceKey = `firebase:authUser:${apiKey}:[DEFAULT]`
      const authUser = {
        uid: localId,
        email: email,
        emailVerified: true,
        displayName: email.split('@')[0],
        isAnonymous: false,
        providerData: [
          {
            providerId: 'password',
            uid: email,
            displayName: null,
            email: email,
            phoneNumber: null,
            photoURL: null,
          },
        ],
        spiAccessToken: idToken,
        apiKey: apiKey,
        appName: '[DEFAULT]',
        createdAt: String(Date.now()),
        lastLoginAt: String(Date.now()),
        stsTokenManager: {
          refreshToken: refreshToken,
          accessToken: idToken,
          expirationTime: Date.now() + 3600 * 1000,
        },
      }
      localStorage.setItem(persistenceKey, JSON.stringify(authUser))
    },
    { idToken, refreshToken, localId, email, apiKey: process.env.FIREBASE_API_KEY || '' }
  )

  // Reload to pick up the injected auth state
  await page.reload()

  // Wait for the app to render the authenticated state
  // The sidebar or user profile link indicates successful auth
  await page.waitForSelector('a[href="/myrpi"], aside', { timeout: 30000 })

  // Save storage state for all tests to reuse
  await page.context().storageState({ path: STORAGE_STATE })
})
