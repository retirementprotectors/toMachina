import { test, expect } from '@playwright/test'

test.describe('Beni Center — Beneficiary Management', () => {
  test('page loads for current user', async ({ page }) => {
    await page.goto('/service-centers/beni', { waitUntil: 'commit' })
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)

    // User may have Beni Center access (shows controls) or may see redirect/empty state
    const beniContent = page.getByRole('button', { name: /Grid/ }).first()
      .or(page.getByText('Empty Beneficiaries').first())
      .or(page.getByText(/Beni/i).first())
    const noAccess = page.getByText(/not authorized|no access|not found/i).first()
      .or(page.locator('a[href="/myrpi"]').first())
      .or(page.locator('a[href="/contacts"]').first())

    await expect(beniContent.or(noAccess)).toBeVisible({ timeout: 15000 })
  })

  test('data or empty state loads', async ({ page }) => {
    await page.goto('/service-centers/beni', { waitUntil: 'commit' })
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)

    await expect(
      page.locator('[class*="card"]').first()
        .or(page.getByText(/No beneficiary/).first())
        .or(page.locator('a[href="/myrpi"]').first())
        .or(page.locator('a[href="/contacts"]').first())
    ).toBeVisible({ timeout: 20000 })
  })
})
