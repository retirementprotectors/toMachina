import { test, expect } from '@playwright/test'

test.describe('Connect — Full Page', () => {
  test('connect panel renders full-page', async ({ page }) => {
    await page.goto('/connect', { waitUntil: 'commit' })
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)

    // Renders ConnectPanel with open={true}
    await expect(
      page.locator('[class*="connect"], [class*="panel"]').first()
        .or(page.getByText(/Connect|Channels|People/i).first())
    ).toBeVisible({ timeout: 15000 })
  })
})
