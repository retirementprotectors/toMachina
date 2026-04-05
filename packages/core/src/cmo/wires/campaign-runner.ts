/**
 * WIRE_CAMPAIGN Tool Runner (MUS-O03)
 *
 * Step implementations for the Digital Artisan wire:
 * C3 create → audience targeting → schedule → execute send
 *
 * All steps hit the toMachina API C3 campaign routes.
 * AEP Blackout enforced at step 3 for Medicare campaigns.
 */
import type { ToolRunner, CampaignInput } from '../types'

/** Check if a date falls in AEP blackout window (Oct 1 – Dec 7) */
function isAepBlackout(dateStr: string): boolean {
  const date = new Date(dateStr)
  const month = date.getMonth() // 0-indexed
  const day = date.getDate()
  // Oct 1 (month 9) through Dec 7 (month 11, day 7)
  if (month === 9 || month === 10) return true // October, November
  if (month === 11 && day <= 7) return true // Dec 1-7
  return false
}

/** Build toolRunner for WIRE_CAMPAIGN given typed input */
export function createCampaignRunner(
  apiCall: (method: string, path: string, body?: Record<string, unknown>) => Promise<unknown>,
): ToolRunner {
  return async (toolId, _input, context) => {
    const campaignInput = context as unknown as CampaignInput & Record<string, unknown>

    switch (toolId) {
      case 'c3-campaigns': {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
        const result = await apiCall('POST', '/api/campaigns', {
          templateId: campaignInput.templateId,
          market: campaignInput.market,
          name: `${campaignInput.market}-${timestamp}`,
        }) as { success?: boolean; data?: { id?: string; campaignId?: string }; error?: string }
        if (!result.success) {
          return { success: false, error: result.error || 'Failed to create campaign' }
        }
        const campaignId = result.data?.id || result.data?.campaignId
        if (!campaignId) {
          return { success: false, error: 'Campaign creation did not return an ID' }
        }
        return { success: true, output: { campaignId } }
      }

      case 'c3-campaign-analytics': {
        const campaignId = context.campaignId as string
        if (!campaignId) {
          return { success: false, error: 'No campaignId in context from previous step' }
        }
        const result = await apiCall('POST', `/api/campaigns/${campaignId}/audience`, {
          segment: campaignInput.audience.segment,
          filters: campaignInput.audience.filters,
        }) as { success?: boolean; data?: { recipientCount?: number }; error?: string }
        if (!result.success) {
          return { success: false, error: result.error || 'Failed to target audience' }
        }
        return {
          success: true,
          output: {
            targetingConfirmed: true,
            recipientCount: result.data?.recipientCount || 0,
          },
        }
      }

      case 'c3-campaign-send': {
        const campaignId = context.campaignId as string
        if (!campaignId) {
          return { success: false, error: 'No campaignId in context from previous step' }
        }

        // Determine if this is the schedule step or execute step
        const isScheduleStep = !context.scheduled

        if (isScheduleStep) {
          // AEP Blackout enforcement
          const isMedicare = campaignInput.market?.toLowerCase().includes('medicare')
          if (isMedicare && campaignInput.schedule?.startAt && isAepBlackout(campaignInput.schedule.startAt)) {
            return {
              success: false,
              error: 'AEP Blackout: Medicare campaigns blocked Oct 1 – Dec 7',
            }
          }

          const result = await apiCall('POST', `/api/campaigns/${campaignId}/schedule`, {
            type: campaignInput.schedule.type,
            startAt: campaignInput.schedule.startAt,
            endAt: campaignInput.schedule.endAt,
            cadenceDays: campaignInput.schedule.cadenceDays,
          }) as { success?: boolean; error?: string }
          if (!result.success) {
            return { success: false, error: result.error || 'Failed to schedule campaign' }
          }
          return {
            success: true,
            output: { scheduled: true, scheduledAt: campaignInput.schedule.startAt },
          }
        } else {
          // Execute send
          const result = await apiCall('POST', `/api/campaigns/${campaignId}/send`, {
            channels: campaignInput.sendChannels,
          }) as { success?: boolean; data?: { recipientCount?: number; status?: string }; error?: string }
          if (!result.success) {
            return { success: false, error: result.error || 'Failed to execute campaign send' }
          }
          return {
            success: true,
            output: {
              campaignId,
              status: result.data?.status || 'sent',
              recipientCount: result.data?.recipientCount || 0,
              channels: campaignInput.sendChannels,
            },
          }
        }
      }

      default:
        return { success: false, error: `Unknown tool: ${toolId}` }
    }
  }
}
