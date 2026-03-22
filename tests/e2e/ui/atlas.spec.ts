import { test, expect } from '@playwright/test'

test.describe('ATLAS', () => {
  test('section buttons render', async ({ page }) => {
    await page.goto('/modules/atlas', { waitUntil: 'commit' })
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)

    await expect(page.getByText('Import').first()).toBeVisible({ timeout: 15000 })
    await expect(page.getByText('Registry').first()).toBeVisible()
    await expect(page.getByText('Operations').first()).toBeVisible()
  })

  test('section switching works', async ({ page }) => {
    await page.goto('/modules/atlas', { waitUntil: 'commit' })
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)

    await expect(page.getByText('Import').first()).toBeVisible({ timeout: 15000 })

    // Click Registry section
    await page.getByText('Registry').first().click()
    await page.waitForTimeout(500)
  })
})
