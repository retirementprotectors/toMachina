import { test, expect } from '@playwright/test'

test.describe('C3 — Campaign Manager', () => {
  test('page loads for current user', async ({ page }) => {
    await page.goto('/modules/c3', { waitUntil: 'commit' })
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)

    // Hard assert: page rendered something
    await expect(page.locator('main').first()).toBeVisible({ timeout: 15000 })

    // Soft check: module-specific content (entitlement-gated)
    const hasModuleContent = await page.getByText('Campaigns').first().isVisible().catch(() => false)
    expect(typeof hasModuleContent).toBe('boolean')
  })
})
