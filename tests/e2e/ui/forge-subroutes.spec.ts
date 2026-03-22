import { test, expect } from '@playwright/test'

test.describe('FORGE — Subroutes', () => {
  test('audit page loads', async ({ page }) => {
    await page.goto('/modules/forge/audit', { waitUntil: 'commit' })
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)

    await expect(
      page.locator('h1, h2, table, [class*="card"]').first()
    ).toBeVisible({ timeout: 15000 })
  })

  test('confirm page loads', async ({ page }) => {
    await page.goto('/modules/forge/confirm', { waitUntil: 'commit' })
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)

    await expect(
      page.locator('h1, h2, [class*="card"], [class*="step"]').first()
    ).toBeVisible({ timeout: 15000 })
  })
})
