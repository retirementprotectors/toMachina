import { test, expect } from '@playwright/test'

test.describe('ProZone', () => {
  test('unique page elements render', async ({ page }) => {
    await page.goto('/modules/prozone', { waitUntil: 'commit' })
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)

    // Unique top bar label — only appears on ProZone
    await expect(page.getByText('ProZONE').first()).toBeVisible({ timeout: 15000 })
  })

  test('5 tabs render', async ({ page }) => {
    await page.goto('/modules/prozone', { waitUntil: 'commit' })
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)

    await expect(page.getByRole('button', { name: /TEAM/ }).first()).toBeVisible({ timeout: 15000 })
    await expect(page.getByRole('button', { name: /MARKET/ }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: /TARGET/ }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: /FLOW/ }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: /INVENTORY/ }).first()).toBeVisible()
  })

  test('empty state shows when no specialist selected', async ({ page }) => {
    await page.goto('/modules/prozone', { waitUntil: 'commit' })
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)

    await expect(page.getByText(/Select a specialist/).first()).toBeVisible({ timeout: 15000 })
  })
})
