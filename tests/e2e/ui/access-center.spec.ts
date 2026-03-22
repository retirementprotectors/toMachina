import { test, expect } from '@playwright/test'

test.describe('Access Center', () => {
  test('client search view renders initially', async ({ page }) => {
    await page.goto('/service-centers/access', { waitUntil: 'commit' })
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)

    await expect(page.getByRole('heading', { name: /Select a Client/ }).first()).toBeVisible({ timeout: 15000 })
    await expect(page.getByText(/Search by name, email/).first()).toBeVisible()
    await expect(page.locator('input[placeholder*="earch"]').first()).toBeVisible()
  })
})
