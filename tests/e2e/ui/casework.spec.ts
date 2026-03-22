import { test, expect } from '@playwright/test'

test.describe('Casework', () => {
  test('page structure renders', async ({ page }) => {
    await page.goto('/casework', { waitUntil: 'commit' })
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)

    await expect(page.getByRole('heading', { name: /My Cases/ }).first()).toBeVisible({ timeout: 15000 })
    await expect(page.getByText(/Case management/).first()).toBeVisible()
    await expect(page.getByText('New Case').first()).toBeVisible()
  })

  test('status filters render', async ({ page }) => {
    await page.goto('/casework', { waitUntil: 'commit' })
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)

    // Scope "All" to filter area near "Open" to avoid sidebar collision
    await expect(page.getByRole('button', { name: 'Open' }).first()).toBeVisible({ timeout: 15000 })
    await expect(page.getByRole('button', { name: /In Progress/ }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: 'Blocked' }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: 'Completed' }).first()).toBeVisible()
  })
})
