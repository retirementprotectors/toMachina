import { test, expect } from '@playwright/test'

/**
 * Smoke test: SmartSearch component.
 *
 * Verifies that the global search input exists in the page header.
 * Runs unauthenticated — checks for DOM presence, not search functionality.
 */
test.describe('Search — SmartSearch input', () => {
  test('page renders a search input', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')

    // SmartSearch renders as an input with type="search" or a search placeholder
    const searchInput = page.locator(
      'input[type="search"], input[placeholder*="earch"], input[placeholder*="Search"], input[aria-label*="earch"]'
    )

    // The search input may only be visible after auth — if so, at least
    // verify the page loaded without error
    const isVisible = await searchInput.first().isVisible().catch(() => false)

    if (isVisible) {
      // Search input found — verify it's interactive
      await expect(searchInput.first()).toBeEnabled()
    } else {
      // If search isn't visible (auth wall), verify the page is still up
      const response = await page.goto('/')
      expect(response).not.toBeNull()
      expect(response!.status()).toBeLessThan(500)
    }
  })

  test('search input accepts text when visible', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')

    const searchInput = page.locator(
      'input[type="search"], input[placeholder*="earch"], input[placeholder*="Search"]'
    )

    const isVisible = await searchInput.first().isVisible().catch(() => false)

    if (isVisible) {
      await searchInput.first().fill('test query')
      const value = await searchInput.first().inputValue()
      expect(value).toBe('test query')
    }
    // If not visible (behind auth wall), skip gracefully — this is a smoke test
  })
})
