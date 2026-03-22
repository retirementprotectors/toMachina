import { test, expect } from '@playwright/test'

test.describe('Accounts Module', () => {
  test('renders account list with data', async ({ page }) => {
    await page.goto('/accounts')

    // Wait for page to load
    await expect(page.locator('h1')).toContainText(/account/i, { timeout: 15000 })

    // Account grid/table should be visible
    const grid = page.locator('table, [role="grid"], [class*="grid"]')
    await expect(grid.first()).toBeVisible({ timeout: 15000 })

    // At least 1 account row/card
    const items = page.locator('table tbody tr, [role="row"], [class*="card"]')
    await expect(items.first()).toBeVisible({ timeout: 15000 })
  })
})
