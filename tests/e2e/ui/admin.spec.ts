import { test, expect } from '@playwright/test'

test.describe('Admin Module', () => {
  test('renders admin panel with config sections', async ({ page }) => {
    await page.goto('/admin')

    // Wait for admin panel to load
    await expect(page.locator('h1')).toContainText(/admin/i, { timeout: 15000 })

    // Admin tab navigation should be visible
    // AdminPanel has tabs: module-config, team-config, acf-config, acf-audit, doc-taxonomy, firestore-config
    const tabButtons = page.locator('button, [role="tab"]')
    await expect(tabButtons.first()).toBeVisible({ timeout: 15000 })

    // Team Config section should be accessible
    await expect(page.getByText(/team config/i)).toBeVisible({ timeout: 10000 })

    // User list should load (the AdminPanel shows a list of UserRecords)
    // Look for any user-related content (email, name, role indicators)
    const userList = page.locator('table, [class*="grid"], [class*="list"]')
    await expect(userList.first()).toBeVisible({ timeout: 15000 })
  })
})
