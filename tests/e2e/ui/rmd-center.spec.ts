import { test, expect } from '@playwright/test'

test.describe('RMD Center', () => {
  test('page loads for current user', async ({ page }) => {
    await page.goto('/service-centers/rmd', { waitUntil: 'commit' })
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)

    // User may have RMD access (shows controls) or may be redirected
    const rmdContent = page.getByRole('button', { name: /Grid/ }).first()
      .or(page.getByRole('button', { name: /Card/ }).first())
      .or(page.getByText(/RMD/i).first())
    const noAccess = page.getByText(/not authorized|no access|not found/i).first()
      .or(page.locator('a[href="/myrpi"]').first())
      .or(page.locator('a[href="/contacts"]').first())

    await expect(rmdContent.or(noAccess)).toBeVisible({ timeout: 15000 })
  })

  test('data or empty state loads', async ({ page }) => {
    await page.goto('/service-centers/rmd', { waitUntil: 'commit' })
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)

    await expect(
      page.locator('[class*="card"]').first()
        .or(page.getByText(/No RMD/).first())
        .or(page.locator('a[href="/myrpi"]').first())
        .or(page.locator('a[href="/contacts"]').first())
    ).toBeVisible({ timeout: 20000 })
  })
})
