import { test as setup } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

/*
 * Playwright global setup — authenticate via Firebase REST API + IndexedDB injection
 *
 * 1. Sign in via Firebase REST API (server-side, using env var API key)
 * 2. Navigate to ProDash login page (loads Firebase SDK)
 * 3. Inject auth state into IndexedDB (where Firebase SDK v9+ reads from)
 * 4. Reload — Firebase SDK picks up auth, portal renders
 * 5. Save browser state for reuse across all tests
 */

const AUTH_DIR = path.join(__dirname, '.auth')
const STORAGE_STATE = path.join(AUTH_DIR, 'storageState.json')

const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY || ''
const TEST_USER_EMAIL = process.env.E2E_TEST_EMAIL || 'e2e-test@retireprotected.com'
const TEST_USER_PASSWORD = process.env.E2E_TEST_PASSWORD || ''

setup('authenticate', async ({ page }) => {
  if (!fs.existsSync(AUTH_DIR)) {
    fs.mkdirSync(AUTH_DIR, { recursive: true })
  }
  if (!FIREBASE_API_KEY) throw new Error('FIREBASE_API_KEY env var is required')
  if (!TEST_USER_PASSWORD) throw new Error('E2E_TEST_PASSWORD env var is required')

  // Step 1: Sign in via Firebase REST API (server-side — no browser needed yet)
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

  const { idToken, refreshToken, localId } = await res.json()

  // Step 2: Navigate to ProDash (loads Firebase SDK + shows login page)
  await page.goto('/')
  await page.waitForLoadState('domcontentloaded')

  // Step 3: Inject auth state into IndexedDB (where Firebase SDK v9+ reads from)
  const injected = await page.evaluate(
    ({ idToken, refreshToken, localId, email, apiKey }) => {
      return new Promise<boolean>((resolve) => {
        const dbReq = indexedDB.open('firebaseLocalStorageDb', 1)

        dbReq.onupgradeneeded = () => {
          const db = dbReq.result
          if (!db.objectStoreNames.contains('firebaseLocalStorage')) {
            db.createObjectStore('firebaseLocalStorage')
          }
        }

        dbReq.onsuccess = () => {
          const db = dbReq.result
          const tx = db.transaction('firebaseLocalStorage', 'readwrite')
          const store = tx.objectStore('firebaseLocalStorage')

          const persistKey = `firebase:authUser:${apiKey}:[DEFAULT]`
          const authUser = {
            uid: localId,
            email,
            emailVerified: true,
            displayName: 'E2E Test User',
            isAnonymous: false,
            providerData: [{
              providerId: 'password',
              uid: email,
              displayName: 'E2E Test User',
              email,
              phoneNumber: null,
              photoURL: null,
            }],
            stsTokenManager: {
              refreshToken,
              accessToken: idToken,
              expirationTime: Date.now() + 3600 * 1000,
            },
            createdAt: String(Date.now()),
            lastLoginAt: String(Date.now()),
            apiKey,
            appName: '[DEFAULT]',
          }

          store.put({ fbase_key: persistKey, value: authUser }, persistKey)
          tx.oncomplete = () => resolve(true)
          tx.onerror = () => resolve(false)
        }

        dbReq.onerror = () => resolve(false)
      })
    },
    { idToken, refreshToken, localId, email: TEST_USER_EMAIL, apiKey: FIREBASE_API_KEY }
  )

  if (!injected) {
    throw new Error('Failed to inject auth state into IndexedDB')
  }

  // Step 4: Reload — Firebase SDK reads IndexedDB on init, picks up auth
  await page.reload()

  // Step 5: Wait for the portal to render (any authenticated element)
  await page.waitForSelector('aside, nav, a[href="/myrpi"], a[href="/contacts"]', { timeout: 45000 })

  // Save storage state for all module tests to reuse
  await page.context().storageState({ path: STORAGE_STATE })
})
