import { test, expect } from '@playwright/test'

test.describe('MyRPI Module', () => {
  test('renders profile page with user info', async ({ page }) => {
    await page.goto('/myrpi')

    // MyRpiProfile has NO h1 — it renders user info cards directly
    // Wait for the profile to load by looking for user name or section headers
    // The test user is "E2E Test User" (injected in auth.setup.ts)
    // MyRpiProfile renders the user's display name prominently
    const profileContent = page.locator('main')
    await expect(profileContent).toBeVisible({ timeout: 15000 })

    // "Communication Preferences" section is always rendered
    await expect(page.getByText('Communication Preferences')).toBeVisible({ timeout: 15000 })

    // "My Drop Zone" section should be visible
    await expect(page.getByText('My Drop Zone')).toBeVisible({ timeout: 10000 })
  })
})
