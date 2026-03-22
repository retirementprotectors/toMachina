import { test, expect } from '@playwright/test'

test.describe('C3 — Campaign Manager', () => {
  test('6 tabs render', async ({ page }) => {
    await page.goto('/modules/c3', { waitUntil: 'commit' })
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)

    await expect(page.getByText('Campaigns').first()).toBeVisible({ timeout: 15000 })
    await expect(page.getByText('Templates').first()).toBeVisible()
    await expect(page.getByText('Content Blocks').first()).toBeVisible()
    await expect(page.getByText('Send Logs').first()).toBeVisible()
    await expect(page.getByText('Drip Sequences').first()).toBeVisible()
    await expect(page.getByText('Delivery Events').first()).toBeVisible()
  })
})
