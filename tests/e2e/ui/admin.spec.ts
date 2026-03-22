import { test, expect } from '@playwright/test'

test.describe('Admin Module', () => {
  test('renders admin panel with config tabs', async ({ page }) => {
    await page.goto('/admin')

    // Admin panel shows "Your module permissions" text and tab buttons
    // Screenshot confirms: Team Config, Permissions Audit, ACF Config, Firestore Config, Platform Intel
    await expect(page.getByText('Team Config')).toBeVisible({ timeout: 15000 })

    // Other tabs should be visible
    await expect(page.getByText('Permissions Audit')).toBeVisible()
    await expect(page.getByText('ACF Config')).toBeVisible()
    await expect(page.getByText('Firestore Config')).toBeVisible()

    // Role groups visible (Owner, Executive, Leader, User)
    await expect(page.getByText('Owner')).toBeVisible({ timeout: 10000 })
  })
})
