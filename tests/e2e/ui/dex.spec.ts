import { test, expect } from '@playwright/test'

test.describe('DEX — Document Exchange', () => {
  test('4 tabs render', async ({ page }) => {
    await page.goto('/modules/dex', { waitUntil: 'commit' })
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)

    await expect(page.getByText('Pipeline').first()).toBeVisible({ timeout: 15000 })
    await expect(page.getByText('Forms').first()).toBeVisible()
    await expect(page.getByText('Kits').first()).toBeVisible()
    await expect(page.getByText('Tracker').first()).toBeVisible()
  })
})
