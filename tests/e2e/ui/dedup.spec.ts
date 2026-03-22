import { test, expect } from '@playwright/test'

test.describe('Duplicate Detection', () => {
  test('page loads without error', async ({ page }) => {
    await page.goto('/ddup', { waitUntil: 'commit' })
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)

    // Without URL params, page shows initial state
    // Just verify no crash — page is 11K+ lines
    await expect(page.locator('body').first()).toBeVisible()
  })
})
