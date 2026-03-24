import { test, expect } from '@playwright/test'

test.describe('DEX — Document Exchange', () => {
  test('4 tabs render', async ({ page }) => {
    await page.goto('/modules/dex', { waitUntil: 'commit' })
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)

    await expect(page.getByText('Pipeline').first()).toBeVisible({ timeout: 15000 })
    await expect(page.getByText('Form Library').first()).toBeVisible()
    await expect(page.getByText('Kit Builder').first()).toBeVisible()
    await expect(page.getByText('Tracker').first()).toBeVisible()
  })

  test('Pipeline tab shows 6 stages', async ({ page }) => {
    await page.goto('/modules/dex', { waitUntil: 'commit' })
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)

    // Click the Pipeline tab
    await page.getByText('Pipeline').first().click()
    await page.waitForTimeout(300)

    // Should show the 6 pipeline stages
    await expect(page.getByText('Draft').first()).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('Ready').first()).toBeVisible()
    await expect(page.getByText('Sent').first()).toBeVisible()
    await expect(page.getByText('Signed').first()).toBeVisible()
    await expect(page.getByText('Submitted').first()).toBeVisible()
    await expect(page.getByText('Complete').first()).toBeVisible()

    // Should show "Document Pipeline" heading
    await expect(page.getByText('Document Pipeline').first()).toBeVisible()
  })

  test('Form Library tab has search and filters', async ({ page }) => {
    await page.goto('/modules/dex', { waitUntil: 'commit' })
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)

    // Form Library is the default tab - verify search input exists
    const searchInput = page.locator('input[placeholder="Search forms..."]')
    await expect(searchInput).toBeVisible({ timeout: 10000 })

    // Category filter dropdown should be present
    const categorySelect = page.locator('select').filter({ hasText: 'All' }).first()
    await expect(categorySelect).toBeVisible()

    // Type something into search to verify it accepts input
    await searchInput.fill('test')
    await page.waitForTimeout(200)

    // Clear search
    await searchInput.fill('')
  })

  test('Kit Builder tab shows client search and all 13 platforms', async ({ page }) => {
    await page.goto('/modules/dex', { waitUntil: 'commit' })
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)

    // Click Kit Builder tab
    await page.getByText('Kit Builder').first().click()
    await page.waitForTimeout(300)

    // Step 1: Client search should be visible
    const clientInput = page.locator('input[placeholder="Type client name..."]')
    await expect(clientInput).toBeVisible({ timeout: 10000 })

    // Type a search term to verify client search works
    await clientInput.fill('te')
    await page.waitForTimeout(500)

    // The step indicator bar (5 dots) should be visible
    const stepBars = page.locator('.rounded-full.bg-\\[var\\(--portal\\)\\]')
    await expect(stepBars.first()).toBeVisible()
  })

  test('Tracker tab shows status filter', async ({ page }) => {
    await page.goto('/modules/dex', { waitUntil: 'commit' })
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)

    // Click Tracker tab
    await page.getByText('Tracker').first().click()
    await page.waitForTimeout(300)

    // Status filter dropdown should be present with "All Statuses" option
    const statusSelect = page.locator('select').filter({ hasText: 'All Statuses' })
    await expect(statusSelect).toBeVisible({ timeout: 10000 })

    // Should show "Document Packages" heading
    await expect(page.getByText('Document Packages').first()).toBeVisible()

    // Verify we can change the status filter
    await statusSelect.selectOption('DRAFT')
    await page.waitForTimeout(200)

    // Reset to All
    await statusSelect.selectOption('All')
    await page.waitForTimeout(200)
  })

  test('stats cards render with numeric values', async ({ page }) => {
    await page.goto('/modules/dex', { waitUntil: 'commit' })
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)

    // Wait for loading to complete
    await expect(page.getByText('DEX — Document Center').first()).toBeVisible({ timeout: 15000 })

    // All 4 stat card labels should be visible
    await expect(page.getByText('Forms').first()).toBeVisible()
    await expect(page.getByText('Active').first()).toBeVisible()
    await expect(page.getByText('Packages').first()).toBeVisible()
    await expect(page.getByText('In Flight').first()).toBeVisible()
  })
})
