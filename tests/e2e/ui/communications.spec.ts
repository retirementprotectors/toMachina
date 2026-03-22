import { test, expect } from '@playwright/test'

test.describe('Communications Module', () => {
  test('opens slide-out panel with tabs', async ({ page }) => {
    await page.goto('/')

    // Wait for sidebar to load
    await expect(page.locator('aside')).toBeVisible({ timeout: 15000 })

    // Click the Comms button in the sidebar action bar
    const commsButton = page.locator('button[title="Communications"]')
    await expect(commsButton).toBeVisible({ timeout: 10000 })
    await commsButton.click()

    // Slide-out panel should appear (fixed right-side overlay)
    const panel = page.locator('div.fixed.right-0, [class*="fixed"][class*="right-0"]').first()
    await expect(panel).toBeVisible({ timeout: 10000 })

    // "Communications" header text should be visible
    await expect(page.getByText('Communications')).toBeVisible()

    // Tab buttons should be present (Log, Text, Email, Call)
    // These tabs use material icons: list_alt, sms, email, phone
    await expect(page.locator('span.material-icons-outlined:text("list_alt"), span:text("list_alt")')).toBeVisible()
    await expect(page.locator('span.material-icons-outlined:text("sms"), span:text("sms")')).toBeVisible()
    await expect(page.locator('span.material-icons-outlined:text("email"), span:text("email")')).toBeVisible()
    await expect(page.locator('span.material-icons-outlined:text("phone"), span:text("phone")')).toBeVisible()
  })
})
