import { test, expect } from '@playwright/test'

test.describe('FORGE Module', () => {
  test('renders with view toggles and items', async ({ page }) => {
    await page.goto('/modules/forge')

    // Wait for FORGE to load — look for the view toggle buttons
    const gridViewBtn = page.locator('button[title="Grid View"]')
    await expect(gridViewBtn).toBeVisible({ timeout: 15000 })

    // All 4 view toggle buttons should be visible
    await expect(page.locator('button[title="Workflow View"]')).toBeVisible()
    await expect(page.locator('button[title="Sprint View"]')).toBeVisible()
    await expect(page.locator('button[title="DeDup"]')).toBeVisible()

    // Confirm Walkthrough link should exist
    const confirmLink = page.locator('a[href="/modules/forge/confirm"]')
    await expect(confirmLink).toBeVisible()
    await expect(confirmLink).toContainText('Confirm Walkthrough')

    // Items should load (tracker items render as cards or rows)
    // In grid view, items appear in a scrollable container
    const items = page.locator('[class*="card"], table tbody tr, [role="row"]')
    await expect(items.first()).toBeVisible({ timeout: 15000 })
  })
})
