import { test, expect } from '@playwright/test'

test.describe('Navigation — Sidebar + Header', () => {
  test('sidebar renders section labels and action bar', async ({ page }) => {
    await page.goto('/')

    // Dismiss any overlay/splash
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)

    // ProDashX logo
    await expect(page.locator('img[src*="prodashx"]')).toBeVisible({ timeout: 15000 })

    // Section labels (uppercase in sidebar)
    await expect(page.getByText('WORKSPACES')).toBeVisible()
    await expect(page.getByText('SERVICE')).toBeVisible()

    // APPS section
    await expect(page.getByText('APPS')).toBeVisible()

    // Bottom action bar labels
    await expect(page.getByText('Comms', { exact: true })).toBeVisible()
    await expect(page.getByText('Connect', { exact: true })).toBeVisible()
    await expect(page.getByText('Alerts', { exact: true })).toBeVisible()
  })

  test('header renders search and user info', async ({ page }) => {
    await page.goto('/')
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)

    // Search bar
    await expect(page.locator('input[placeholder*="earch"]')).toBeVisible({ timeout: 15000 })

    // User label
    await expect(page.getByText('User')).toBeVisible()
  })
})
