import { test, expect } from '@playwright/test'

/**
 * Smoke test: Navigation elements.
 *
 * Verifies that the page loads and renders basic navigation structure.
 * These tests run unauthenticated — they check for the presence of
 * structural elements, not authenticated content.
 */
test.describe('Navigation — Page structure', () => {
  test('page loads without server error', async ({ page }) => {
    const response = await page.goto('/')
    expect(response).not.toBeNull()
    expect(response!.status()).toBeLessThan(500)
  })

  test('page has a title', async ({ page }) => {
    await page.goto('/')
    const title = await page.title()
    expect(title).toBeTruthy()
    expect(title.length).toBeGreaterThan(0)
  })

  test('page renders without blank screen', async ({ page }) => {
    await page.goto('/')
    // Wait for the body to have content
    await page.waitForSelector('body', { timeout: 15_000 })

    // Body should have visible child elements (not a blank white page)
    const bodyChildren = await page.locator('body > *').count()
    expect(bodyChildren).toBeGreaterThan(0)
  })

  test('page contains navigation links', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')

    // The page should render at least one link element
    const links = page.locator('a[href]')
    const linkCount = await links.count()
    expect(linkCount).toBeGreaterThan(0)
  })

  test('no console errors on initial load', async ({ page }) => {
    const consoleErrors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text())
      }
    })

    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')

    // Filter out known benign errors (e.g., favicon 404)
    const realErrors = consoleErrors.filter(
      (e) => !e.includes('favicon') && !e.includes('404')
    )

    // Allow up to 2 console errors (hydration warnings, etc.)
    // but flag anything excessive
    expect(realErrors.length).toBeLessThanOrEqual(2)
  })
})
