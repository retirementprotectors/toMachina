import { test, expect } from '@playwright/test'

test.describe('MyRPI Module', () => {
  test('renders profile page with user info', async ({ page }) => {
    await page.goto('/myrpi')

    // Wait for profile section to load
    await expect(page.locator('h1')).toContainText(/my.*rpi|profile/i, { timeout: 15000 })

    // User name should be displayed somewhere on the page
    // MyRpiProfile loads the user record and displays name, role, etc.
    const profileSection = page.locator('main')
    await expect(profileSection).toBeVisible({ timeout: 15000 })

    // QR code or user details section should render (MyRpiProfile uses QRCodeSVG)
    // Look for SVG (QR code) or user detail cards
    const contentArea = page.locator('main [class*="card"], main [class*="grid"], main svg')
    await expect(contentArea.first()).toBeVisible({ timeout: 15000 })

    // MyDropZone section (employee drive folder integration)
    // Look for "DropZone" or "Drive" or file-related content
    await expect(
      page.getByText(/drop.*zone|drive|my.*files/i).or(page.locator('[class*="dropzone"]'))
    ).toBeVisible({ timeout: 10000 })
  })
})
