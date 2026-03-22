import { test, expect } from '@playwright/test'

test.describe('Beni Center — Beneficiary Management', () => {
  test('page controls render', async ({ page }) => {
    await page.goto('/service-centers/beni', { waitUntil: 'commit' })
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)

    await expect(page.getByRole('button', { name: /Grid/ }).first()).toBeVisible({ timeout: 15000 })
    await expect(page.getByRole('button', { name: /Card/ }).first()).toBeVisible()
    await expect(page.locator('input[placeholder*="earch"]').first()).toBeVisible()
  })

  test('issue type filters render', async ({ page }) => {
    await page.goto('/service-centers/beni', { waitUntil: 'commit' })
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)

    // Use getByRole to avoid Material Icon text collision
    await expect(page.getByRole('button', { name: 'All', exact: true }).first()).toBeVisible({ timeout: 15000 })
    await expect(page.getByRole('button', { name: /Empty/ }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: /Conflict/ }).first()).toBeVisible()
  })

  test('summary stats render', async ({ page }) => {
    await page.goto('/service-centers/beni', { waitUntil: 'commit' })
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)

    await expect(page.getByText('Empty Beneficiaries').first()).toBeVisible({ timeout: 15000 })
    await expect(page.getByText('Conflicts Detected').first()).toBeVisible()
    await expect(page.getByText('Reviewed').first()).toBeVisible()
    await expect(page.getByText('Healthy').first()).toBeVisible()
  })

  test('data or empty state loads', async ({ page }) => {
    await page.goto('/service-centers/beni', { waitUntil: 'commit' })
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)

    await expect(
      page.locator('[class*="card"]').first()
        .or(page.getByText(/No beneficiary/).first())
    ).toBeVisible({ timeout: 20000 })
  })
})
