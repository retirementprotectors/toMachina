import { test, expect } from '@playwright/test'

test.describe('Households', () => {
  test('page structure renders', async ({ page }) => {
    await page.goto('/households', { waitUntil: 'commit' })
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)

    await expect(page.getByRole('heading', { name: /Households/ }).first()).toBeVisible({ timeout: 15000 })
    await expect(page.getByText('Create Household').first()).toBeVisible()
    await expect(page.getByPlaceholder('Search households...')).toBeVisible()
  })

  test('status filter buttons render', async ({ page }) => {
    await page.goto('/households', { waitUntil: 'commit' })
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)

    await expect(page.getByRole('button', { name: 'Active', exact: true }).first()).toBeVisible({ timeout: 15000 })
    await expect(page.getByRole('button', { name: 'Inactive', exact: true }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: 'All', exact: true }).first()).toBeVisible()
  })

  test('table columns render', async ({ page }) => {
    await page.goto('/households', { waitUntil: 'commit' })
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)

    await expect(page.locator('th').filter({ hasText: 'Household' }).first()).toBeVisible({ timeout: 15000 })
    await expect(page.locator('th').filter({ hasText: 'Members' }).first()).toBeVisible()
    await expect(page.locator('th').filter({ hasText: 'Primary Contact' }).first()).toBeVisible()
    await expect(page.locator('th').filter({ hasText: 'Location' }).first()).toBeVisible()
    await expect(page.locator('th').filter({ hasText: 'Status' }).first()).toBeVisible()
  })

  test('data or empty state loads', async ({ page }) => {
    await page.goto('/households', { waitUntil: 'commit' })
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)

    // Separate from structure — waits for Firestore fetch
    await expect(
      page.locator('table tbody tr').first()
        .or(page.getByText(/No households/).first())
    ).toBeVisible({ timeout: 20000 })
  })
})
