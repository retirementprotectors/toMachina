import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { buildNotification } from '../../../packages/core/src/notifications/build-notification'
import type { CreateNotificationInput } from '../../../packages/core/src/notifications/types'
import { notifySlackSplit, notifySlackCase } from '../../../packages/core/src/atlas/tools/notify-slack'

// ---------------------------------------------------------------------------
// Cluster 5: Notifications Tests
// ---------------------------------------------------------------------------

describe('TRK-13643: createNotification writes', () => {
  it('buildNotification returns a complete notification object', () => {
    const input: CreateNotificationInput = {
      type: 'contact_created',
      entity_type: 'client',
      entity_id: 'e2e-test-client-001',
      entity_name: 'E2E Test Client',
      summary: 'New client created via E2E test',
      source_type: 'system',
      source_label: 'E2E Test Suite',
      hyperlink: '/contacts/e2e-test-client-001',
      portal: 'prodashx',
    }

    const notification = buildNotification('e2e-notif-001', input)

    expect(notification.id).toBe('e2e-notif-001')
    expect(notification.type).toBe('contact_created')
    expect(notification.entity_type).toBe('client')
    expect(notification.summary).toBe('New client created via E2E test')
    expect(notification.read).toBe(false)
    expect(notification.portal).toBe('prodashx')
    // created_at should be an ISO string
    expect(typeof notification.created_at).toBe('string')
    expect(() => new Date(notification.created_at)).not.toThrow()
    expect(new Date(notification.created_at).toISOString()).toBe(notification.created_at)
  })
})

describe('TRK-13618: Slack split notification', () => {
  it('notifySlackSplit is exported and callable', () => {
    expect(typeof notifySlackSplit).toBe('function')
  })

  it('returns null gracefully when no SLACK_BOT_TOKEN is configured', async () => {
    // Ensure no token is set for this test
    const originalToken = process.env.SLACK_BOT_TOKEN
    delete process.env.SLACK_BOT_TOKEN

    const result = await notifySlackSplit({
      channel: 'C000TEST',
      originalFileName: 'e2e-test-scan.pdf',
      totalPages: 5,
      documentCount: 2,
      documents: [
        { type: 'Annual Statement', clientName: 'E2E Test Client', docNum: 1 },
        { type: 'Correspondence', clientName: 'E2E Test Client', docNum: 2 },
      ],
    })

    expect(result).toBeNull()

    // Restore original value if it existed
    if (originalToken) process.env.SLACK_BOT_TOKEN = originalToken
  })
})

describe('TRK-13645: Slack case notification', () => {
  it('notifySlackCase is exported and callable', () => {
    expect(typeof notifySlackCase).toBe('function')
  })

  it('returns null gracefully when no SLACK_BOT_TOKEN is configured', async () => {
    const originalToken = process.env.SLACK_BOT_TOKEN
    delete process.env.SLACK_BOT_TOKEN

    const result = await notifySlackCase({
      channel: 'C000TEST',
      clientName: 'E2E Test Client',
      specialist: 'E2E Tester',
      accounts: [
        {
          carrier_name: 'Test Carrier',
          account_type: 'Annuity',
          account_value: 100000,
        },
      ],
      documentCount: 3,
    })

    expect(result).toBeNull()

    if (originalToken) process.env.SLACK_BOT_TOKEN = originalToken
  })
})

describe('TRK-13647: Click-to-call workflow', () => {
  it('CallPanel component file exists with disposition handling', () => {
    const callPanelPath = resolve(
      __dirname,
      '../../../packages/ui/src/modules/ProZone/CallPanel.tsx'
    )
    const source = readFileSync(callPanelPath, 'utf-8')

    // Disposition handling code exists
    expect(source).toContain('disposition')
    expect(source).toContain('CallDisposition')
    expect(source).toContain('onDispositioned')
  })

  it('CallPanel component has booking/appointment outcome', () => {
    const callPanelPath = resolve(
      __dirname,
      '../../../packages/ui/src/modules/ProZone/CallPanel.tsx'
    )
    const source = readFileSync(callPanelPath, 'utf-8')

    // Booking outcome exists in disposition options
    expect(source).toContain('booked')
    // Call state management exists
    expect(source).toContain('CallState')
    expect(source).toContain('pre_call')
    expect(source).toContain('calling')
  })
})
