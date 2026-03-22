import { test, expect } from '@playwright/test'

test.describe('Command Center', () => {
  test('unique page elements render', async ({ page }) => {
    await page.goto('/modules/command-center', { waitUntil: 'commit' })
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)

    // Unique heading — only appears on Command Center
    await expect(page.getByText('Command Center').first()).toBeVisible({ timeout: 15000 })
    // Unique subtitle — cannot false-pass on any other page
    await expect(page.getByText('Cross-platform leadership visibility').first()).toBeVisible()
  })

  test('metric cards render', async ({ page }) => {
    await page.goto('/modules/command-center', { waitUntil: 'commit' })
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)

    await expect(page.getByText('Total Clients').first()).toBeVisible({ timeout: 20000 })
    await expect(page.getByText('Pipeline Health').first()).toBeVisible()
  })
})
