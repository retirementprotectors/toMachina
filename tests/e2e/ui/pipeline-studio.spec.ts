import { test, expect } from '@playwright/test'

test.describe('Pipeline Studio Module', () => {
  test('renders pipeline list or editor', async ({ page }) => {
    await page.goto('/modules/pipeline-studio')

    // PipelineStudioApp shows a pipeline list by default
    // Wait for the pipeline cards to render (StudioPipelineCard components)
    // Each card shows pipeline name, status badge, and section assignment
    const pipelineContent = page.locator('main')
    await expect(pipelineContent).toBeVisible({ timeout: 15000 })

    // Status filter should be present (all, active, draft, archived)
    const filterArea = page.getByText(/all|active|draft|archived/i).first()
    await expect(filterArea).toBeVisible({ timeout: 15000 })

    // Pipeline cards should render with status badges
    // Look for Published/Draft/Archived labels from STATUS_STYLES
    const statusBadge = page.getByText(/published|draft|archived/i).first()
    await expect(statusBadge).toBeVisible({ timeout: 15000 })
  })
})
