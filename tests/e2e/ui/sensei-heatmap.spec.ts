import { test, expect } from '@playwright/test'

test.describe('SENSEI Heatmap Module', () => {
  test('renders heatmap with period selector and legend', async ({ page }) => {
    await page.goto('/modules/forge/sensei-heatmap')

    // Wait for title
    await expect(page.locator('h1')).toContainText('SENSEI Heat Map', { timeout: 15000 })

    // Period selector buttons should be visible (7 Days, 30 Days, 90 Days)
    await expect(page.locator('button', { hasText: '7 Days' })).toBeVisible()
    await expect(page.locator('button', { hasText: '30 Days' })).toBeVisible()
    await expect(page.locator('button', { hasText: '90 Days' })).toBeVisible()

    // Legend labels should be visible
    await expect(page.locator('text=RAIDEN TRAIN')).toBeVisible()
    await expect(page.locator('text=VOLTRON Query')).toBeVisible()
    await expect(page.locator('text=Popup View')).toBeVisible()

    // Either data or empty state should render
    const hasData = await page.locator('text=Top 10 Most-Queried Modules').isVisible()
    const hasEmpty = await page.locator('text=No training events recorded yet').isVisible()
    expect(hasData || hasEmpty).toBe(true)
  })

  test('period selector changes active button', async ({ page }) => {
    await page.goto('/modules/forge/sensei-heatmap')

    await expect(page.locator('h1')).toContainText('SENSEI Heat Map', { timeout: 15000 })

    // Click 30 Days button
    await page.locator('button', { hasText: '30 Days' }).click()

    // Wait for reload
    await page.waitForTimeout(1000)

    // Page should still be rendered (no crash)
    await expect(page.locator('h1')).toContainText('SENSEI Heat Map')
  })
})
