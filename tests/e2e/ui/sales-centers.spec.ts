import { test, expect } from '@playwright/test'

test.describe('Sales Centers', () => {
  test('SALES section exists in sidebar', async ({ page }) => {
    await page.goto('/', { waitUntil: 'commit' })
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)

    // SALES section label in sidebar
    await expect(page.getByText('SALES').first()).toBeVisible({ timeout: 15000 })
    // Items depend on user entitlements — may be empty
    // If populated, items are pipeline links injected dynamically
  })
})
