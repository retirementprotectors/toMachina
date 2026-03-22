import { test, expect } from '@playwright/test'

test.describe('Account Detail — List View', () => {
  // NOTE: No seeded accounts exist — test list page structure only.
  // Full detail page test (/accounts/[clientId]/[accountId]) deferred
  // until seed-test-client.ts is enhanced to create accounts.

  test('accounts list renders with controls', async ({ page }) => {
    await page.goto('/accounts', { waitUntil: 'commit' })
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)

    // Page heading
    await expect(page.locator('h1').first()).toContainText(/account/i, { timeout: 15000 })

    // Filter controls or data table or empty state
    await expect(
      page.locator('input[placeholder*="earch"]')
        .or(page.locator('table'))
        .or(page.getByText('No accounts match').first())
    ).toBeVisible({ timeout: 15000 })
  })
})
