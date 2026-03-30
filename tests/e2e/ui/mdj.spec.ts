import { test, expect } from '@playwright/test'

test.describe('VOLTRON Panel', () => {
  test('VOLTRON button visible in sidebar', async ({ page }) => {
    await page.goto('/')
    const voltronButton = page.locator('button[title="VOLTRON"]')
    await expect(voltronButton).toBeVisible()
  })

  test('click VOLTRON button opens panel', async ({ page }) => {
    await page.goto('/')
    await page.click('button[title="VOLTRON"]')
    const panel = page.locator('textarea[placeholder="Ask VOLTRON anything..."]')
    await expect(panel).toBeVisible()
  })

  test('send message shows streaming response', async ({ page }) => {
    await page.goto('/')
    await page.click('button[title="VOLTRON"]')
    const input = page.locator('textarea[placeholder="Ask VOLTRON anything..."]')
    await input.fill('Hello')
    await page.click('button[title="Send message"]')
    // Wait for assistant response to appear
    const response = page.locator('[class*="rounded-bl-md"]')
    await expect(response).toBeVisible({ timeout: 15000 })
  })

  test('close button dismisses VOLTRON panel', async ({ page }) => {
    await page.goto('/')
    await page.click('button[title="VOLTRON"]')
    await expect(page.locator('textarea[placeholder="Ask VOLTRON anything..."]')).toBeVisible()
    // Click close button inside the panel
    await page.click('button[title="Close"]')
    await expect(page.locator('textarea[placeholder="Ask VOLTRON anything..."]')).not.toBeVisible()
  })

  test('new chat button clears messages', async ({ page }) => {
    await page.goto('/')
    await page.click('button[title="VOLTRON"]')
    const input = page.locator('textarea[placeholder="Ask VOLTRON anything..."]')
    await input.fill('Hello')
    await page.click('button[title="Send message"]')
    await page.waitForTimeout(3000)
    await page.click('button[title="New conversation"]')
    // Should show empty state
    const emptyState = page.locator('text=Ask me anything')
    await expect(emptyState).toBeVisible()
  })
})
