import { test, expect } from '@playwright/test'

test.describe('Communications — Full Page', () => {
  test('COMMS Center renders in standalone mode', async ({ page }) => {
    await page.goto('/modules/comms', { waitUntil: 'commit' })
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)

    // Unique heading only in standalone mode
    await expect(page.getByText('COMMS Center').first()).toBeVisible({ timeout: 15000 })
  })

  test('toolbar buttons present', async ({ page }) => {
    await page.goto('/modules/comms', { waitUntil: 'commit' })
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)

    await expect(page.getByText('Send SMS').first()).toBeVisible({ timeout: 15000 })
    await expect(page.getByText('Send Email').first()).toBeVisible()
  })
})
