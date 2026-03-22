import { test, expect } from '@playwright/test'

/**
 * Smoke test: Authentication redirect.
 *
 * Verifies that unauthenticated users are redirected to the login page
 * (or shown a sign-in prompt) when accessing protected routes.
 */
test.describe('Auth — Unauthenticated redirect', () => {
  test('root page shows login or redirects to sign-in', async ({ page }) => {
    const response = await page.goto('/')
    expect(response).not.toBeNull()
    expect(response!.status()).toBeLessThan(500)

    // The app should either:
    //   a) Redirect to a login/sign-in page, OR
    //   b) Show a sign-in button/form on the page
    // We check for common indicators of either behavior.
    const url = page.url()
    const hasLoginIndicator =
      url.includes('login') ||
      url.includes('sign-in') ||
      url.includes('auth')

    const signInButton = page.locator(
      'button:has-text("Sign"), a:has-text("Sign"), button:has-text("Log"), a:has-text("Log")'
    )
    const signInVisible = await signInButton.first().isVisible().catch(() => false)

    // At least one auth indicator should be present
    expect(hasLoginIndicator || signInVisible).toBeTruthy()
  })

  test('protected route /admin does not return 200 without auth', async ({ page }) => {
    const response = await page.goto('/admin')
    expect(response).not.toBeNull()

    // Should redirect away from admin, or show auth prompt
    const url = page.url()
    const isOnAdmin = url.endsWith('/admin') || url.endsWith('/admin/')

    if (isOnAdmin) {
      // If we stayed on /admin, there should be a sign-in prompt visible
      const signInButton = page.locator(
        'button:has-text("Sign"), a:has-text("Sign")'
      )
      const signInVisible = await signInButton.first().isVisible().catch(() => false)
      expect(signInVisible).toBeTruthy()
    }
    // Otherwise we were redirected — that's the expected behavior
  })

  test('protected route /contacts redirects without auth', async ({ page }) => {
    const response = await page.goto('/contacts')
    expect(response).not.toBeNull()
    expect(response!.status()).toBeLessThan(500)

    const url = page.url()
    const isOnContacts = url.endsWith('/contacts') || url.endsWith('/contacts/')

    if (isOnContacts) {
      const signInButton = page.locator(
        'button:has-text("Sign"), a:has-text("Sign")'
      )
      const signInVisible = await signInButton.first().isVisible().catch(() => false)
      expect(signInVisible).toBeTruthy()
    }
  })
})
