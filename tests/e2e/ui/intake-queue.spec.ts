import { test, expect } from '@playwright/test'

test.describe('Intake Queue', () => {
  test('page structure renders', async ({ page }) => {
    await page.goto('/admin/intake-queue', { waitUntil: 'commit' })
    await page.keyboard.press('Escape')
    // Extra wait — 15s auto-poll creates race condition
    await page.waitForTimeout(1500)

    await expect(page.getByText('Intake Queue').first()).toBeVisible({ timeout: 15000 })
  })

  test('filter pills render', async ({ page }) => {
    await page.goto('/admin/intake-queue', { waitUntil: 'commit' })
    await page.keyboard.press('Escape')
    await page.waitForTimeout(1500)

    await expect(page.getByRole('button', { name: 'All', exact: true }).first()).toBeVisible({ timeout: 15000 })
    await expect(page.getByRole('button', { name: 'Queued' }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: 'Reviewing' }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: 'Approved' }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: 'Complete' }).first()).toBeVisible()
  })

  test('table columns render', async ({ page }) => {
    await page.goto('/admin/intake-queue', { waitUntil: 'commit' })
    await page.keyboard.press('Escape')
    await page.waitForTimeout(1500)

    await expect(page.locator('th').filter({ hasText: 'File Name' }).first()).toBeVisible({ timeout: 15000 })
    await expect(page.locator('th').filter({ hasText: 'Source' }).first()).toBeVisible()
    await expect(page.locator('th').filter({ hasText: 'Status' }).first()).toBeVisible()
    await expect(page.locator('th').filter({ hasText: 'Created' }).first()).toBeVisible()
  })

  test('data or empty state loads', async ({ page }) => {
    await page.goto('/admin/intake-queue', { waitUntil: 'commit' })
    await page.keyboard.press('Escape')
    await page.waitForTimeout(1500)

    await expect(
      page.locator('table tbody tr').first()
        .or(page.getByText(/No items match/).first())
    ).toBeVisible({ timeout: 20000 })
  })
})
