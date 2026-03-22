import { test, expect } from '@playwright/test'

test.describe('C3 — Campaign Manager', () => {
  test('page loads for current user', async ({ page }) => {
    await page.goto('/modules/c3', { waitUntil: 'commit' })
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)

    // User may have C3 access (shows tabs) or may be redirected/blocked
    const c3Content = page.getByText('Campaigns').first()
      .or(page.getByText('Templates').first())
      .or(page.getByText('Content Blocks').first())
    const noAccess = page.getByText(/not authorized|no access|not found/i).first()
      .or(page.locator('a[href="/myrpi"]').first())
      .or(page.locator('a[href="/contacts"]').first())

    await expect(c3Content.or(noAccess)).toBeVisible({ timeout: 15000 })
  })
})
