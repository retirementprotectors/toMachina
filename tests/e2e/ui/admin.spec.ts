import { test, expect } from '@playwright/test'

test.describe('Admin Module', () => {
  test('renders admin panel with config tabs', async ({ page }) => {
    await page.goto('/admin')

    // AdminPanel has NO h1 — it renders tab buttons directly
    // Default tab is "Team Config". Wait for tab buttons to appear.
    await expect(page.getByText('Team Config')).toBeVisible({ timeout: 15000 })

    // Other tabs should be visible too
    await expect(page.getByText('Permissions Audit')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('ACF Config')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('Firestore Config')).toBeVisible({ timeout: 10000 })

    // Admin description text should be present (for leaders: "Team permissions and module access audit")
    const description = page.getByText(/permissions|module access/i)
    await expect(description.first()).toBeVisible({ timeout: 10000 })
  })
})
