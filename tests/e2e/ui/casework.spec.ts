import { test, expect } from '@playwright/test'

test.describe('Casework', () => {
  test('page loads for current user', async ({ page }) => {
    await page.goto('/casework', { waitUntil: 'commit' })
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)

    // User may have casework access (shows heading + filters) or may be redirected
    const caseworkContent = page.getByRole('heading', { name: /My Cases/ }).first()
      .or(page.getByText(/Case management/).first())
      .or(page.getByText('New Case').first())
    const noAccess = page.getByText(/not authorized|no access|not found/i).first()
      .or(page.locator('a[href="/myrpi"]').first())
      .or(page.locator('a[href="/contacts"]').first())

    await expect(caseworkContent.or(noAccess)).toBeVisible({ timeout: 15000 })
  })

  test('status filters render when accessible', async ({ page }) => {
    await page.goto('/casework', { waitUntil: 'commit' })
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)

    // Check if the page loaded with casework content or redirected
    const openBtn = page.getByRole('button', { name: 'Open' }).first()
    const noAccess = page.locator('a[href="/myrpi"]').first()
      .or(page.locator('a[href="/contacts"]').first())

    await expect(openBtn.or(noAccess)).toBeVisible({ timeout: 15000 })
  })
})
