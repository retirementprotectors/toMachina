import { test, expect } from '@playwright/test'

test.describe('Quick Intake FAB', () => {
  /*
   * IntakeFAB is NOT currently rendered in the portal layout.
   * The component exists in packages/ui/src/components/IntakeFAB.tsx
   * but has not been wired into apps/prodash/(portal)/layout.tsx yet.
   * ReportButton (FORGE) is the only FAB currently in the layout.
   *
   * These tests are skipped until IntakeFAB is added to the portal.
   * Tracked in sprint-9 plan: TRK-13553 (move to shared) + TRK-13560 (wire upload).
   */

  test.skip('FAB button visible and expands to actions', async ({ page }) => {
    await page.goto('/')

    // Wait for page to fully load
    await expect(page.locator('aside')).toBeVisible({ timeout: 15000 })

    // The IntakeFAB renders as a DraggableFAB with action buttons
    const fab = page.locator('button:has-text("Quick Client"), button:has-text("add")').first()
    await expect(fab).toBeVisible({ timeout: 10000 })

    // Click the FAB to expand action options
    await fab.click()

    // Should show 3 action options: Quick Client, Upload Document, Paste Data
    await expect(page.getByText('Quick Client')).toBeVisible({ timeout: 5000 })
    await expect(page.getByText('Upload Document')).toBeVisible()
    await expect(page.getByText('Paste Data')).toBeVisible()
  })

  test.skip('paste data action opens modal', async ({ page }) => {
    await page.goto('/')

    const fab = page.locator('button:has-text("Quick Client"), button:has-text("add")').first()
    await expect(fab).toBeVisible({ timeout: 15000 })
    await fab.click()

    // Click Paste Data
    await page.getByText('Paste Data').click()

    // Modal or expanded form should appear with a textarea or paste area
    const pasteArea = page.locator('textarea, [contenteditable="true"]')
    await expect(pasteArea.first()).toBeVisible({ timeout: 5000 })
  })
})
