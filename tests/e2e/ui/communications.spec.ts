import { test, expect } from '@playwright/test'

test.describe('Communications Module', () => {
  test('opens slide-out panel with tabs', async ({ page }) => {
    await page.goto('/')

    // Wait for sidebar to load (PortalSidebar renders as <aside>)
    await expect(page.locator('aside')).toBeVisible({ timeout: 15000 })

    // Click the Comms button in the sidebar action bar (title="Communications")
    const commsButton = page.locator('button[title="Communications"]')
    await expect(commsButton).toBeVisible({ timeout: 10000 })
    await commsButton.click()

    // Slide-out panel should appear — CommsModule renders as a fixed right-0 div
    // The panel has a h2 with "Communications" text
    await expect(page.locator('h2:has-text("Communications")')).toBeVisible({ timeout: 10000 })

    // Tab labels should be present in the panel (Log, Text, Email, Call)
    // The CommsModule renders 4 tab buttons in its header area
    const panel = page.locator('.fixed.right-0').first()
    await expect(panel).toBeVisible()

    // Verify tab labels exist as visible text within the panel
    await expect(panel.getByText('Log')).toBeVisible()
    await expect(panel.getByText('Email')).toBeVisible()
    await expect(panel.getByText('Call')).toBeVisible()
  })
})
