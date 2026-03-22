import { test as setup } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

/*
 * Playwright global setup — authenticate via Firebase signInWithEmailAndPassword
 *
 * Approach:
 * 1. Navigate to ProDash (loads Firebase SDK + login page)
 * 2. Call signInWithEmailAndPassword() in the browser context
 * 3. Wait for the portal to render (sidebar visible)
 * 4. Save browser storage state for reuse across all tests
 *
 * Requires: FIREBASE_API_KEY, E2E_TEST_EMAIL, E2E_TEST_PASSWORD env vars
 * Requires: e2e-test@retireprotected.com user in Firebase Auth (email/password provider)
 * Requires: e2e-test user doc in Firestore users collection
 */

const AUTH_DIR = path.join(__dirname, '.auth')
const STORAGE_STATE = path.join(AUTH_DIR, 'storageState.json')

const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY || ''
const TEST_USER_EMAIL = process.env.E2E_TEST_EMAIL || 'e2e-test@retireprotected.com'
const TEST_USER_PASSWORD = process.env.E2E_TEST_PASSWORD || ''

setup('authenticate', async ({ page }) => {
  // Ensure auth directory exists
  if (!fs.existsSync(AUTH_DIR)) {
    fs.mkdirSync(AUTH_DIR, { recursive: true })
  }

  if (!FIREBASE_API_KEY) throw new Error('FIREBASE_API_KEY env var is required')
  if (!TEST_USER_PASSWORD) throw new Error('E2E_TEST_PASSWORD env var is required')

  // Navigate to ProDash — this loads the Firebase SDK and shows the login page
  await page.goto('/')

  // Wait for the login page to fully render (Firebase SDK must be initialized)
  await page.waitForSelector('text=Sign in with Google', { timeout: 30000 })

  // Call signInWithEmailAndPassword() using the Firebase SDK already loaded in the browser
  const signInResult = await page.evaluate(
    async ({ email, password }) => {
      // Firebase Auth is initialized by the app — access it via the global firebase modules
      // The app uses firebase/auth with getAuth() — we need to find the auth instance

      // Wait for Firebase to be ready (the app initializes it on load)
      let attempts = 0
      while (attempts < 20) {
        // Check if Firebase Auth is available via the window object
        // Next.js apps bundle Firebase — try accessing via import cache
        try {
          // The Firebase auth module stores the auth instance internally
          // We can use the REST API approach as a fallback: sign in via fetch
          // then set the persistence directly

          const apiKey = document.querySelector('meta[name="firebase-api-key"]')?.getAttribute('content')
            || Array.from(document.querySelectorAll('script')).find(s => s.textContent?.includes('apiKey'))?.textContent?.match(/"apiKey"\s*:\s*"([^"]+)"/)?.[1]
            || ''

          const key = apiKey || (window as Record<string, unknown>).__NEXT_DATA__
            && JSON.stringify((window as Record<string, unknown>).__NEXT_DATA__).match(/apiKey['"]\s*:\s*['"]([^'"]+)/)?.[1]
            || ''

          if (!key) {
            attempts++
            await new Promise(r => setTimeout(r, 500))
            continue
          }

          // Use Firebase Auth REST API to sign in
          const res = await fetch(
            `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${key}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email, password, returnSecureToken: true }),
            }
          )

          if (!res.ok) {
            const err = await res.json()
            return { success: false, error: `REST sign-in failed: ${err?.error?.message}` }
          }

          const data = await res.json()

          // Now inject into IndexedDB where Firebase SDK reads from
          return new Promise<{ success: boolean; error?: string }>((resolve) => {
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

              const authUser = {
                uid: data.localId,
                email: data.email,
                emailVerified: true,
                displayName: 'E2E Test User',
                isAnonymous: false,
                providerData: [{
                  providerId: 'password',
                  uid: data.email,
                  displayName: 'E2E Test User',
                  email: data.email,
                  phoneNumber: null,
                  photoURL: null,
                }],
                stsTokenManager: {
                  refreshToken: data.refreshToken,
                  accessToken: data.idToken,
                  expirationTime: Date.now() + 3600 * 1000,
                },
                createdAt: String(Date.now()),
                lastLoginAt: String(Date.now()),
                apiKey: key,
                appName: '[DEFAULT]',
              }

              const persistKey = `firebase:authUser:${key}:[DEFAULT]`
              store.put({ fbase_key: persistKey, value: authUser }, persistKey)

              tx.oncomplete = () => {
                resolve({ success: true })
              }
              tx.onerror = () => {
                resolve({ success: false, error: 'IndexedDB write failed' })
              }
            }

            dbReq.onerror = () => {
              resolve({ success: false, error: 'IndexedDB open failed' })
            }
          })
        } catch (e) {
          attempts++
          await new Promise(r => setTimeout(r, 500))
        }
      }
      return { success: false, error: 'Could not find Firebase API key after 20 attempts' }
    },
    { email: TEST_USER_EMAIL, password: TEST_USER_PASSWORD }
  )

  if (!signInResult.success) {
    throw new Error(`Auth setup failed: ${signInResult.error}`)
  }

  // Reload to pick up the IndexedDB auth state
  await page.reload()

  // Wait for the portal to render (sidebar = authenticated)
  await page.waitForSelector('aside, nav, a[href="/myrpi"], a[href="/contacts"]', { timeout: 45000 })

  // Save storage state (cookies, localStorage, etc.) for all tests to reuse
  await page.context().storageState({ path: STORAGE_STATE })
})
