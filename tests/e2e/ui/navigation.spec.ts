import { test, expect } from '@playwright/test'

test.describe('Navigation — Sidebar + Header', () => {
  test('sidebar renders section labels and action bar', async ({ page }) => {
    await page.goto('/')

    // ProDashX logo
    await expect(page.locator('img[src*="prodashx"]')).toBeVisible({ timeout: 15000 })

    // Section labels (uppercase in sidebar)
    await expect(page.getByText('WORKSPACES')).toBeVisible()
    await expect(page.getByText('SERVICE')).toBeVisible()

    // APPS section at bottom
    await expect(page.getByText('APPS')).toBeVisible()

    // Bottom action bar: Comms, Connect, Alerts
    await expect(page.getByText('Comms')).toBeVisible()
    await expect(page.getByText('Connect')).toBeVisible()
    await expect(page.getByText('Alerts')).toBeVisible()
  })

  test('header renders search and user profile', async ({ page }) => {
    await page.goto('/')

    // Search bar
    await expect(page.locator('input[placeholder*="earch"]')).toBeVisible({ timeout: 15000 })

    // User label in top-right
    await expect(page.getByText('User')).toBeVisible()
  })
})
