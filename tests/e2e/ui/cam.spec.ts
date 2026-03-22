import { test, expect } from '@playwright/test'

test.describe('CAM — Commission Automation', () => {
  test('tabs render', async ({ page }) => {
    await page.goto('/modules/cam', { waitUntil: 'commit' })
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)

    // At least one of the 7 tab labels visible
    await expect(
      page.getByText(/Carriers|Agents|Comp Grids|Projections|Reconciliation/i).first()
    ).toBeVisible({ timeout: 15000 })
  })
})
