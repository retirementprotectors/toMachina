import { test, expect } from '@playwright/test'

test.describe('Contacts Module', () => {
  test('renders contact list with data', async ({ page }) => {
    await page.goto('/contacts')

    // Wait for the page title to confirm navigation
    await expect(page.locator('h1')).toContainText(/contact/i, { timeout: 15000 })

    // Table or list of contacts should be visible
    const table = page.locator('table, [role="grid"]')
    await expect(table).toBeVisible({ timeout: 15000 })

    // At least 1 data row
    const rows = page.locator('table tbody tr, [role="row"]')
    await expect(rows.first()).toBeVisible({ timeout: 15000 })

    // Search input should exist
    const searchInput = page.locator('input[type="search"], input[placeholder*="earch"]')
    await expect(searchInput.first()).toBeVisible()
  })

  test('click row navigates to detail', async ({ page }) => {
    await page.goto('/contacts')

    // Wait for data rows
    const firstRow = page.locator('table tbody tr, [role="row"]').first()
    await expect(firstRow).toBeVisible({ timeout: 15000 })

    // Click the first row
    await firstRow.click()

    // Should navigate to a detail page (URL changes to include client ID)
    await page.waitForURL(/\/contacts\//, { timeout: 10000 })
  })
})
