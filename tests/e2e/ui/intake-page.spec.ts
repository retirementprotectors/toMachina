import { test, expect } from '@playwright/test'

test.describe('Quick Intake', () => {
  test('intake form renders', async ({ page }) => {
    await page.goto('/intake', { waitUntil: 'commit' })
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)

    await expect(page.getByText('Quick Intake').first()).toBeVisible({ timeout: 15000 })
    await expect(page.getByText(/Create a new client record/).first()).toBeVisible()
    await expect(page.getByText('Required Information').first()).toBeVisible()
    await expect(page.getByText('Additional Details').first()).toBeVisible()
    await expect(page.getByText('Check for Duplicates').first()).toBeVisible()
  })
})
