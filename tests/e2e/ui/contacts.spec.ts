import { test, expect } from '@playwright/test'

test.describe('Contacts Module', () => {
  test('renders contacts page', async ({ page }) => {
    await page.goto('/contacts')

    // Page title
    await expect(page.locator('h1')).toContainText(/contact/i, { timeout: 15000 })

    // Search bar
    await expect(page.locator('input[placeholder*="earch"]').first()).toBeVisible()
  })

  test('shows data or loading state', async ({ page }) => {
    await page.goto('/contacts')

    // In CI the API may not be reachable — accept data OR loading state
    await expect(
      page.getByText(/loading contacts|joyce|abbott/i).first()
    ).toBeVisible({ timeout: 20000 })
  })
})
