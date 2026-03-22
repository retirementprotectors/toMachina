import { test, expect } from '@playwright/test'

test.describe('RPI Connect Module', () => {
  test('opens slide-out panel with tabs', async ({ page }) => {
    await page.goto('/')

    // Wait for sidebar to load
    await expect(page.locator('aside')).toBeVisible({ timeout: 15000 })

    // Click the Connect button in the sidebar action bar
    const connectButton = page.locator('button[title="RPI Connect"]')
    await expect(connectButton).toBeVisible({ timeout: 10000 })
    await connectButton.click()

    // Slide-out panel should appear
    const panel = page.locator('div.fixed.right-0, [class*="fixed"][class*="right-0"]').first()
    await expect(panel).toBeVisible({ timeout: 10000 })

    // "RPI Connect" or "Connect" header text
    await expect(page.getByText(/RPI Connect|Connect/)).toBeVisible()

    // Tab structure: Channels, People, Meet
    await expect(page.getByText('Channels')).toBeVisible()
    await expect(page.getByText('People')).toBeVisible()
    await expect(page.getByText('Meet')).toBeVisible()
  })
})
