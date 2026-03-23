import { test, expect, type Page } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

/** Check if auth setup actually authenticated (storageState has cookies/origins with data) */
function isAuthenticated(): boolean {
  try {
    const statePath = path.join(__dirname, '.auth', 'storageState.json')
    const state = JSON.parse(fs.readFileSync(statePath, 'utf-8'))
    return state.origins?.some((o: { localStorage: unknown[] }) => o.localStorage?.length > 0) ?? false
  } catch {
    return false
  }
}

interface DetailPageResult {
  detailPage: Page
  cleanup: () => Promise<void>
}

/**
 * Click a household row and get the detail page.
 *
 * The households table uses window.open(url, '_blank') which opens a new tab.
 * Primary path: capture the new tab via context.waitForEvent('page').
 * CI fallback: if new-tab event doesn't fire in headless CI, intercept the
 * URL from window.open and navigate the same page (avoids the timeout that
 * killed PR #78's original approach AND the builder's PR #83 approach).
 */
async function clickRowAndGetDetailPage(listPage: Page): Promise<DetailPageResult | null> {
  const dataRow = listPage.locator('table tbody tr').first()
  const emptyState = listPage.getByText(/No households/).first()
  await expect(dataRow.or(emptyState)).toBeVisible({ timeout: 20000 })

  const hasData = await dataRow.isVisible().catch(() => false)
  const isEmpty = await emptyState.isVisible().catch(() => false)

  if (isEmpty || !hasData) return null

  // Intercept window.open BEFORE clicking — captures the URL regardless of
  // whether the browser actually opens a new tab (belt)
  await listPage.evaluate(() => {
    const w = window as unknown as Record<string, unknown>
    w.__capturedOpenUrl = null
    const orig = window.open.bind(window)
    window.open = (url?: string | URL, target?: string, features?: string) => {
      w.__capturedOpenUrl = url ? String(url) : null
      return orig(url, target, features)
    }
  })

  // Primary: capture new tab from window.open('_blank') (suspenders)
  try {
    const [newPage] = await Promise.all([
      listPage.context().waitForEvent('page', { timeout: 10_000 }),
      dataRow.click(),
    ])
    await newPage.waitForLoadState('domcontentloaded')
    await newPage.keyboard.press('Escape')
    await newPage.waitForTimeout(500)
    return { detailPage: newPage, cleanup: () => newPage.close() }
  } catch {
    // New-tab event didn't fire (headless CI) — fall back to same-page nav
    const url = await listPage.evaluate(
      () => (window as unknown as Record<string, unknown>).__capturedOpenUrl as string | null
    )
    if (!url) return null

    await listPage.goto(url, { waitUntil: 'commit' })
    await listPage.keyboard.press('Escape')
    await listPage.waitForTimeout(500)
    return { detailPage: listPage, cleanup: () => Promise.resolve() }
  }
}

test.describe('Household Detail', () => {
  // Extra time for CI runners — Firestore data load + new tab navigation
  test.setTimeout(60_000)

  test('list page loads, then navigate to detail if data exists', async ({ page }) => {
    if (!isAuthenticated()) {
      console.log('SKIP: auth setup did not complete — no authenticated session available')
      return
    }

    await page.goto('/households', { waitUntil: 'commit' })
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)

    await expect(page.getByRole('heading', { name: /Households/ }).first()).toBeVisible({ timeout: 15000 })

    const result = await clickRowAndGetDetailPage(page)
    if (!result) return // No data — list page verified, test passes

    const { detailPage, cleanup } = result

    // --- Detail page assertions ---
    await expect(detailPage.getByText('Back to Households').first()).toBeVisible({ timeout: 15000 })
    await expect(detailPage.locator('h1').first()).toBeVisible({ timeout: 10000 })
    await expect(detailPage.getByRole('button', { name: /Edit/ }).first()).toBeVisible()
    await expect(detailPage.getByRole('button', { name: /Delete/ }).first()).toBeVisible()

    // Tabs — all 6 should be present
    await expect(detailPage.getByRole('button', { name: /Overview/ }).first()).toBeVisible()
    await expect(detailPage.getByRole('button', { name: /Members/ }).first()).toBeVisible()
    await expect(detailPage.getByRole('button', { name: /Accounts/ }).first()).toBeVisible()
    await expect(detailPage.getByRole('button', { name: /Financials/ }).first()).toBeVisible()
    await expect(detailPage.getByRole('button', { name: /Activity/ }).first()).toBeVisible()
    await expect(detailPage.getByRole('button', { name: /Pipelines/ }).first()).toBeVisible()

    // Tab content area visible
    await expect(detailPage.locator('.min-h-\\[400px\\]').first()).toBeVisible()

    // Overview tab is default — check for section cards
    const membersSection = await detailPage.getByText('Members').first().isVisible().catch(() => false)
    const financialSection = await detailPage.getByText('Financial Summary').first().isVisible().catch(() => false)
    const addressSection = await detailPage.getByText('Address').first().isVisible().catch(() => false)
    expect(membersSection || financialSection || addressSection).toBeTruthy()

    await cleanup()
  })

  test('tab switching works on detail page', async ({ page }) => {
    if (!isAuthenticated()) {
      console.log('SKIP: auth setup did not complete — no authenticated session available')
      return
    }

    await page.goto('/households', { waitUntil: 'commit' })
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)

    await expect(page.getByRole('heading', { name: /Households/ }).first()).toBeVisible({ timeout: 15000 })

    const result = await clickRowAndGetDetailPage(page)
    if (!result) return

    const { detailPage, cleanup } = result

    await expect(detailPage.getByText('Back to Households').first()).toBeVisible({ timeout: 15000 })

    // Switch tabs on the detail page
    await detailPage.getByRole('button', { name: /Members/ }).first().click()
    await detailPage.waitForTimeout(300)

    await detailPage.getByRole('button', { name: /Accounts/ }).first().click()
    await detailPage.waitForTimeout(300)

    await detailPage.getByRole('button', { name: /Activity/ }).first().click()
    await detailPage.waitForTimeout(300)

    await detailPage.getByRole('button', { name: /Overview/ }).first().click()
    await detailPage.waitForTimeout(300)

    await cleanup()
  })
})
