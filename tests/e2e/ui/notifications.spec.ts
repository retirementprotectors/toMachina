import { test, expect } from '@playwright/test'

test.describe('Notifications Panel', () => {
  test('opens and shows tabs', async ({ page }) => {
    await page.goto('/', { waitUntil: 'commit' })
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)

    // Wait for sidebar to load
    await expect(page.getByText('WORKSPACES').first()).toBeVisible({ timeout: 15000 })

    // Click Alerts toggle in bottom action bar
    await page.getByText('Alerts', { exact: true }).click()
    await page.waitForTimeout(500)

    // Notifications heading should appear in the slide-out panel
    await expect(page.getByText('Notifications').first()).toBeVisible({ timeout: 10000 })

    // 6 tabs present inside the panel
    const panel = page.locator('[class*="fixed"]').filter({ hasText: 'Notifications' }).first()
    await expect(panel.getByText('All').first()).toBeVisible()
    await expect(panel.getByText('Contact').first()).toBeVisible()
    await expect(panel.getByText('Account').first()).toBeVisible()
    await expect(panel.getByText('MyRPI').first()).toBeVisible()
    await expect(panel.getByText('Data').first()).toBeVisible()
    await expect(panel.getByText('Approvals').first()).toBeVisible()
  })
})
