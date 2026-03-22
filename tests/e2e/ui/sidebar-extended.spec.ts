import { test, expect } from '@playwright/test'

test.describe('Sidebar — Extended Coverage', () => {
  test('all nav sections render', async ({ page }) => {
    await page.goto('/', { waitUntil: 'commit' })
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)

    await expect(page.getByText('WORKSPACES').first()).toBeVisible({ timeout: 15000 })
    await expect(page.getByText('SALES').first()).toBeVisible()
    await expect(page.getByText('SERVICE').first()).toBeVisible()
  })

  test('workspace nav links present', async ({ page }) => {
    await page.goto('/', { waitUntil: 'commit' })
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)

    await expect(page.locator('a[href="/contacts"]').first()).toBeVisible({ timeout: 15000 })
    await expect(page.locator('a[href="/households"]').first()).toBeVisible()
    await expect(page.locator('a[href="/accounts"]').first()).toBeVisible()
  })

  test('service nav links present', async ({ page }) => {
    await page.goto('/', { waitUntil: 'commit' })
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)

    await expect(page.getByText('RMD Center').first()).toBeVisible({ timeout: 15000 })
    await expect(page.getByText('Beni Center').first()).toBeVisible()
    await expect(page.getByText('Access Center').first()).toBeVisible()
  })

  test('app shelf renders', async ({ page }) => {
    await page.goto('/', { waitUntil: 'commit' })
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)

    // APPS section label
    await expect(page.getByText('APPS').first()).toBeVisible({ timeout: 15000 })
  })
})
