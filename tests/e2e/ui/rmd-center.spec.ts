import { test, expect } from '@playwright/test'

test.describe('RMD Center', () => {
  test('page controls render', async ({ page }) => {
    await page.goto('/service-centers/rmd', { waitUntil: 'commit' })
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)

    await expect(page.getByRole('button', { name: /Grid/ }).first()).toBeVisible({ timeout: 15000 })
    await expect(page.getByRole('button', { name: /Card/ }).first()).toBeVisible()
    await expect(page.locator('input[placeholder*="earch"]').first()).toBeVisible()
  })

  test('status filters render', async ({ page }) => {
    await page.goto('/service-centers/rmd', { waitUntil: 'commit' })
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)

    await expect(page.getByRole('button', { name: 'All', exact: true }).first()).toBeVisible({ timeout: 15000 })
    await expect(page.getByRole('button', { name: 'Pending' }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: 'Completed' }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: 'Overdue' }).first()).toBeVisible()
  })

  test('data or empty state loads', async ({ page }) => {
    await page.goto('/service-centers/rmd', { waitUntil: 'commit' })
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)

    await expect(
      page.locator('[class*="card"]').first()
        .or(page.getByText(/No RMD/).first())
    ).toBeVisible({ timeout: 20000 })
  })
})
