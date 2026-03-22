import { test, expect } from '@playwright/test'

test.describe('Communications Module', () => {
  test('opens slide-out panel with tabs', async ({ page }) => {
    await page.goto('/')

    // Wait for sidebar to load
    await expect(page.getByText('WORKSPACES')).toBeVisible({ timeout: 15000 })

    // Click the Comms button in the bottom action bar
    await page.getByText('Comms').click()

    // Communications header should appear in the slide-out
    await expect(page.getByText('Communications')).toBeVisible({ timeout: 10000 })
  })
})
