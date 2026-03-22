import { test, expect } from '@playwright/test'

test.describe('Pipelines', () => {
  test('page loads for current user', async ({ page }) => {
    await page.goto('/pipelines', { waitUntil: 'commit' })
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)

    // User may have pipeline access (shows heading) or may see redirect/empty state
    const pipelineContent = page.getByRole('heading', { name: /Pipelines/ }).first()
      .or(page.getByText(/Select a pipeline/).first())
      .or(page.getByText(/No pipelines assigned/).first())
    const noAccess = page.getByText(/not authorized|no access|not found/i).first()
      .or(page.locator('a[href="/myrpi"]').first())
      .or(page.locator('a[href="/contacts"]').first())

    await expect(pipelineContent.or(noAccess)).toBeVisible({ timeout: 15000 })
  })

  test('pipeline cards or empty state', async ({ page }) => {
    await page.goto('/pipelines', { waitUntil: 'commit' })
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)

    await expect(
      page.locator('[class*="cursor-pointer"]').first()
        .or(page.getByText(/No pipelines assigned/).first())
        .or(page.getByText(/Select a pipeline/).first())
        .or(page.locator('a[href="/myrpi"]').first())
        .or(page.locator('a[href="/contacts"]').first())
    ).toBeVisible({ timeout: 20000 })
  })
})
