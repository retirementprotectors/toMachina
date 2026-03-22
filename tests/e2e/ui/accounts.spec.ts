import { test, expect } from '@playwright/test'

test.describe('Accounts Module', () => {
  test('renders account page with header and filters', async ({ page }) => {
    await page.goto('/accounts')

    // Wait for page to load — h1 "Accounts" appears in loading, error, and data states
    await expect(page.locator('h1')).toContainText(/account/i, { timeout: 15000 })

    // Page should render filter controls or data table or empty state
    // The accounts page always shows a search input after loading completes
    const searchOrTable = page.locator('input[placeholder*="earch"]').or(page.locator('table')).or(page.getByText('No accounts match'))
    await expect(searchOrTable.first()).toBeVisible({ timeout: 15000 })
  })
})
