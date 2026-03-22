import { test, expect } from '@playwright/test'

test.describe('Quick Intake FAB', () => {
  test('FAB button visible and expands to actions', async ({ page }) => {
    await page.goto('/')

    // Wait for page to fully load
    await expect(page.locator('aside')).toBeVisible({ timeout: 15000 })

    // The IntakeFAB renders as a DraggableFAB in the bottom-right area
    // Look for the FAB button (it has a material icon, typically "add" or intake-related)
    const fab = page.locator('button:has(span.material-icons-outlined:text("add")), [class*="fab"], [class*="FAB"]').first()
    await expect(fab).toBeVisible({ timeout: 10000 })

    // Click the FAB to expand action options
    await fab.click()

    // Should show 3 action options: Quick Client, Upload Document, Paste Data
    await expect(page.getByText('Quick Client')).toBeVisible({ timeout: 5000 })
    await expect(page.getByText('Upload Document')).toBeVisible()
    await expect(page.getByText('Paste Data')).toBeVisible()
  })

  test('paste data action opens modal', async ({ page }) => {
    await page.goto('/')

    // Open FAB
    const fab = page.locator('button:has(span.material-icons-outlined:text("add")), [class*="fab"], [class*="FAB"]').first()
    await expect(fab).toBeVisible({ timeout: 15000 })
    await fab.click()

    // Click Paste Data
    await page.getByText('Paste Data').click()

    // Modal or expanded form should appear with a textarea or paste area
    const pasteArea = page.locator('textarea, [contenteditable="true"], [class*="paste"]')
    await expect(pasteArea.first()).toBeVisible({ timeout: 5000 })
  })
})
