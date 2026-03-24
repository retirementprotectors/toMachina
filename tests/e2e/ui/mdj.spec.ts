import { test, expect } from '@playwright/test'

test.describe('MDJ Panel', () => {
  test('MDJ button visible in sidebar', async ({ page }) => {
    await page.goto('/')
    const mdjButton = page.locator('button[title="MyDigitalJosh"]')
    await expect(mdjButton).toBeVisible()
  })

  test('click MDJ button opens panel', async ({ page }) => {
    await page.goto('/')
    await page.click('button[title="MyDigitalJosh"]')
    const panel = page.locator('textarea[placeholder="Ask MDJ anything..."]')
    await expect(panel).toBeVisible()
  })

  test('send message shows streaming response', async ({ page }) => {
    await page.goto('/')
    await page.click('button[title="MyDigitalJosh"]')
    const input = page.locator('textarea[placeholder="Ask MDJ anything..."]')
    await input.fill('Hello')
    await page.click('button[title="Send message"]')
    // Wait for assistant response to appear
    const response = page.locator('[class*="rounded-bl-md"]')
    await expect(response).toBeVisible({ timeout: 15000 })
  })

  test('close button dismisses MDJ panel', async ({ page }) => {
    await page.goto('/')
    await page.click('button[title="MyDigitalJosh"]')
    await expect(page.locator('textarea[placeholder="Ask MDJ anything..."]')).toBeVisible()
    // Click close button inside the panel
    await page.click('button[title="Close"]')
    await expect(page.locator('textarea[placeholder="Ask MDJ anything..."]')).not.toBeVisible()
  })

  test('new chat button clears messages', async ({ page }) => {
    await page.goto('/')
    await page.click('button[title="MyDigitalJosh"]')
    const input = page.locator('textarea[placeholder="Ask MDJ anything..."]')
    await input.fill('Hello')
    await page.click('button[title="Send message"]')
    await page.waitForTimeout(3000)
    await page.click('button[title="New conversation"]')
    // Should show empty state
    const emptyState = page.locator('text=Ask me anything')
    await expect(emptyState).toBeVisible()
  })
})
