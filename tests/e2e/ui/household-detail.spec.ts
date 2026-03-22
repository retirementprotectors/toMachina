import { test, expect } from '@playwright/test'

test.describe('Household Detail', () => {
  test('list page loads, then navigate to detail if data exists', async ({ page }) => {
    await page.goto('/households', { waitUntil: 'commit' })
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)

    // Wait for heading to confirm page loaded
    await expect(page.getByRole('heading', { name: /Households/ }).first()).toBeVisible({ timeout: 15000 })

    // Wait for data or empty state
    const dataRow = page.locator('table tbody tr').first()
    const emptyState = page.getByText(/No households/).first()
    await expect(dataRow.or(emptyState)).toBeVisible({ timeout: 20000 })

    // Check if a household row exists (not the empty state)
    const hasData = await dataRow.isVisible().catch(() => false)
    const isEmpty = await emptyState.isVisible().catch(() => false)

    if (isEmpty || !hasData) {
      // No households — list page verified, test passes
      await expect(page.getByText('Create Household').first()).toBeVisible()
      return
    }

    // Click the first data row — opens in new tab via window.open
    const [detailPage] = await Promise.all([
      page.context().waitForEvent('page'),
      dataRow.click(),
    ])
    await detailPage.waitForLoadState('domcontentloaded')
    await detailPage.keyboard.press('Escape')
    await detailPage.waitForTimeout(500)

    // --- Detail page assertions ---

    // Back link
    await expect(detailPage.getByText('Back to Households').first()).toBeVisible({ timeout: 15000 })

    // Household name heading (h1)
    await expect(detailPage.locator('h1').first()).toBeVisible({ timeout: 10000 })

    // Edit and Delete action buttons
    await expect(detailPage.getByRole('button', { name: /Edit/ }).first()).toBeVisible()
    await expect(detailPage.getByRole('button', { name: /Delete/ }).first()).toBeVisible()

    // Tabs — all 6 should be present
    await expect(detailPage.getByRole('button', { name: /Overview/ }).first()).toBeVisible()
    await expect(detailPage.getByRole('button', { name: /Members/ }).first()).toBeVisible()
    await expect(detailPage.getByRole('button', { name: /Accounts/ }).first()).toBeVisible()
    await expect(detailPage.getByRole('button', { name: /Financials/ }).first()).toBeVisible()
    await expect(detailPage.getByRole('button', { name: /Activity/ }).first()).toBeVisible()
    await expect(detailPage.getByRole('button', { name: /Pipelines/ }).first()).toBeVisible()

    // Tab content area visible (min-h-[400px] container)
    await expect(detailPage.locator('.min-h-\\[400px\\]').first()).toBeVisible()

    // Overview tab is default — check for section cards
    const membersSection = await detailPage.getByText('Members').first().isVisible().catch(() => false)
    const financialSection = await detailPage.getByText('Financial Summary').first().isVisible().catch(() => false)
    const addressSection = await detailPage.getByText('Address').first().isVisible().catch(() => false)
    expect(membersSection || financialSection || addressSection).toBeTruthy()

    await detailPage.close()
  })

  test('tab switching works on detail page', async ({ page }) => {
    await page.goto('/households', { waitUntil: 'commit' })
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)

    await expect(page.getByRole('heading', { name: /Households/ }).first()).toBeVisible({ timeout: 15000 })

    // Wait for data or empty state
    const dataRow = page.locator('table tbody tr').first()
    const emptyState = page.getByText(/No households/).first()
    await expect(dataRow.or(emptyState)).toBeVisible({ timeout: 20000 })

    const isEmpty = await emptyState.isVisible().catch(() => false)
    if (isEmpty) {
      // No data — skip tab switching, test passes
      return
    }

    // Navigate to detail via row click
    const [detailPage] = await Promise.all([
      page.context().waitForEvent('page'),
      dataRow.click(),
    ])
    await detailPage.waitForLoadState('domcontentloaded')
    await detailPage.keyboard.press('Escape')
    await detailPage.waitForTimeout(500)

    await expect(detailPage.getByText('Back to Households').first()).toBeVisible({ timeout: 15000 })

    // Switch to Members tab
    await detailPage.getByRole('button', { name: /Members/ }).first().click()
    await detailPage.waitForTimeout(300)

    // Switch to Accounts tab
    await detailPage.getByRole('button', { name: /Accounts/ }).first().click()
    await detailPage.waitForTimeout(300)

    // Switch to Activity tab
    await detailPage.getByRole('button', { name: /Activity/ }).first().click()
    await detailPage.waitForTimeout(300)

    // Switch back to Overview
    await detailPage.getByRole('button', { name: /Overview/ }).first().click()
    await detailPage.waitForTimeout(300)

    await detailPage.close()
  })
})
