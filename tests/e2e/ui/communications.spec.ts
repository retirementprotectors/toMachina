import { test, expect } from '@playwright/test'

test.describe('Communications Module', () => {
  test('opens slide-out panel', async ({ page }) => {
    await page.goto('/', { waitUntil: 'commit' })
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)

    // Wait for sidebar
    await expect(page.getByText('WORKSPACES').first()).toBeVisible({ timeout: 15000 })

    // Click Comms in the bottom action bar
    await page.getByText('Comms', { exact: true }).click()

    // Communications heading should appear
    await expect(page.locator('h2:has-text("Communications")')).toBeVisible({ timeout: 10000 })
  })
})
