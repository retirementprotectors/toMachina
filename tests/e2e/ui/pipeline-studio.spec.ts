import { test, expect } from '@playwright/test'

test.describe('Pipeline Studio Module', () => {
  test('renders pipeline list or empty state', async ({ page }) => {
    await page.goto('/modules/pipeline-studio')

    // PipelineStudio is wrapped in AppWrapper which renders a 4px brand bar + content div
    // Wait for the page content area to be visible
    const content = page.locator('main')
    await expect(content).toBeVisible({ timeout: 15000 })

    // Status filter tabs should be present: All, Published, Draft, Archived
    // These are always rendered regardless of whether pipelines exist
    // Button text includes count, e.g., "All (3)", "Published (2)"
    await expect(page.getByRole('button', { name: /All/i })).toBeVisible({ timeout: 15000 })
    await expect(page.getByRole('button', { name: /Published/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Draft/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Archived/i })).toBeVisible()
  })
})
