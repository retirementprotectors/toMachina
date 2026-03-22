import { test, expect } from '@playwright/test'

test.describe('RPI Connect Module', () => {
  test('opens slide-out panel with tabs', async ({ page }) => {
    await page.goto('/')

    // Wait for sidebar to load (PortalSidebar renders as <aside>)
    await expect(page.locator('aside')).toBeVisible({ timeout: 15000 })

    // Click the Connect button in the sidebar action bar (title="RPI Connect")
    const connectButton = page.locator('button[title="RPI Connect"]')
    await expect(connectButton).toBeVisible({ timeout: 10000 })
    await connectButton.click()

    // Slide-out panel should appear — ConnectPanel renders as a fixed right-0 div
    // ConnectPanel has NO "RPI Connect" header — it goes straight to tab buttons
    // Tab structure: Channels, People, Meet (rendered as buttons inside the panel)
    const panel = page.locator('.fixed.right-0')
    await expect(panel.first()).toBeVisible({ timeout: 10000 })

    await expect(page.getByRole('button', { name: /Channels/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /People/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Meet/i })).toBeVisible()
  })
})
