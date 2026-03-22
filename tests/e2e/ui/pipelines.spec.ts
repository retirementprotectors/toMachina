import { test, expect } from '@playwright/test'

test.describe('Pipelines', () => {
  test('page structure renders', async ({ page }) => {
    await page.goto('/pipelines', { waitUntil: 'commit' })
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)

    await expect(page.getByRole('heading', { name: /Pipelines/ }).first()).toBeVisible({ timeout: 15000 })
    await expect(page.getByText(/Select a pipeline/).first()).toBeVisible()
  })

  test('pipeline cards or empty state', async ({ page }) => {
    await page.goto('/pipelines', { waitUntil: 'commit' })
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)

    await expect(
      page.locator('[class*="cursor-pointer"]').first()
        .or(page.getByText(/No pipelines assigned/).first())
    ).toBeVisible({ timeout: 20000 })
  })
})
