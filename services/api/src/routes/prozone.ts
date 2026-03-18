import { Router, type Request, type Response } from 'express'
import { getFirestore } from 'firebase-admin/firestore'
import {
  successResponse,
  errorResponse,
  getPaginationParams,
  param,
} from '../lib/helpers.js'

export const prozoneRoutes = Router()

// ─── Helper: load specialist config by ID ───
async function loadSpecialistConfig(configId: string) {
  const db = getFirestore()
  const doc = await db.collection('specialist_configs').doc(configId).get()
  if (!doc.exists) return null
  return { id: doc.id, ...doc.data() } as Record<string, unknown>
}

// ─── Helper: load territory by ID ───
async function loadTerritory(territoryId: string) {
  const db = getFirestore()
  const doc = await db.collection('territories').doc(territoryId).get()
  if (!doc.exists) return null
  return { id: doc.id, ...doc.data() } as Record<string, unknown>
}

// ─── Helper: calculate age from DOB string ───
function calculateAge(dob: string): number | null {
  if (!dob) return null
  const birthDate = new Date(dob)
  if (isNaN(birthDate.getTime())) return null
  const now = new Date()
  let age = now.getFullYear() - birthDate.getFullYear()
  const monthDiff = now.getMonth() - birthDate.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birthDate.getDate())) {
    age--
  }
  return age
}

// ─── Helper: get ISO week start/end dates ───
function getWeekDates(weekStr: string): { start: Date; end: Date } | null {
  // Format: YYYY-WNN
  const match = weekStr.match(/^(\d{4})-W(\d{1,2})$/)
  if (!match) return null
  const year = parseInt(match[1])
  const week = parseInt(match[2])
  if (week < 1 || week > 53) return null

  // ISO week: Jan 4 is always in week 1
  const jan4 = new Date(year, 0, 4)
  const dayOfWeek = jan4.getDay() || 7 // ISO: Monday = 1
  const mondayOfWeek1 = new Date(jan4)
  mondayOfWeek1.setDate(jan4.getDate() - dayOfWeek + 1)

  const start = new Date(mondayOfWeek1)
  start.setDate(start.getDate() + (week - 1) * 7)

  const end = new Date(start)
  end.setDate(start.getDate() + 6) // Sunday

  return { start, end }
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/**
 * GET /prospects/:specialist_id
 * Get prospects organized by zone for a specialist.
 * Queries clients in specialist's territory, applies meeting criteria, groups by zone, sorts by priority.
 */
prozoneRoutes.get('/prospects/:specialist_id', async (req: Request, res: Response) => {
  try {
    const configId = param(req.params.specialist_id)
    const config = await loadSpecialistConfig(configId)
    if (!config) {
      res.status(404).json(errorResponse('Specialist config not found'))
      return
    }

    const territory = await loadTerritory(config.territory_id as string)
    if (!territory) {
      res.status(404).json(errorResponse('Territory not found'))
      return
    }

    const db = getFirestore()
    const params = getPaginationParams(req)
    const counties = (territory.counties as Array<{ county: string; zone_id: string }>) || []
    const countyNames = counties.map(c => c.county)
    const state = territory.state as string

    if (countyNames.length === 0) {
      res.json(successResponse({ zones: [], total_prospects: 0 }))
      return
    }

    // Firestore 'in' queries are limited to 30 values; chunk if needed
    const chunks: string[][] = []
    for (let i = 0; i < countyNames.length; i += 30) {
      chunks.push(countyNames.slice(i, i + 30))
    }

    const allClients: Record<string, unknown>[] = []
    for (const chunk of chunks) {
      const snap = await db.collection('clients')
        .where('state', '==', state)
        .where('county', 'in', chunk)
        .limit(params.limit * 10) // fetch more to allow filtering
        .get()

      for (const doc of snap.docs) {
        const data = doc.data()
        const status = (data.client_status as string) || ''
        if (status === 'Active' || status === 'Active - Internal') {
          allClients.push({ id: doc.id, ...data })
        }
      }
    }

    // Apply meeting criteria and group by zone
    const meetingCriteria = config.meeting_criteria as Record<string, unknown> | undefined
    const fieldCriteria = (meetingCriteria?.field || {}) as Record<string, unknown>
    const maxAge = (fieldCriteria.max_age as number) || 999

    // Build county-to-zone lookup
    const countyZoneMap = new Map<string, string>()
    for (const c of counties) {
      countyZoneMap.set(c.county.toLowerCase(), c.zone_id)
    }

    // Build tier lookup from tier_map
    const tierMap = (config.tier_map as Array<{ zone_id: string; tier: string }>) || []
    const zoneTierMap = new Map<string, string>()
    for (const entry of tierMap) {
      zoneTierMap.set(entry.zone_id, entry.tier)
    }

    // Group clients by zone
    const zoneGroups = new Map<string, Record<string, unknown>[]>()

    for (const client of allClients) {
      const county = ((client.county as string) || '').toLowerCase()
      const zoneId = countyZoneMap.get(county)
      if (!zoneId) continue

      // Apply age filter
      const age = calculateAge(client.dob as string)
      if (age !== null && age > maxAge) continue

      if (!zoneGroups.has(zoneId)) {
        zoneGroups.set(zoneId, [])
      }
      zoneGroups.get(zoneId)!.push({
        client_id: client.id || client.client_id,
        first_name: client.first_name,
        last_name: client.last_name,
        county: client.county,
        city: client.city,
        zip: client.zip,
        age,
        client_status: client.client_status,
      })
    }

    // Build zone response with tier info
    const zones = (territory.zones as Array<{ zone_id: string; zone_name: string }>) || []
    const zoneResults = zones.map(zone => ({
      zone_id: zone.zone_id,
      zone_name: zone.zone_name,
      tier: zoneTierMap.get(zone.zone_id) || 'Unknown',
      prospects: (zoneGroups.get(zone.zone_id) || []).sort((a, b) => {
        // Sort: older clients first (higher priority)
        const ageA = (a.age as number) ?? 0
        const ageB = (b.age as number) ?? 0
        return ageB - ageA
      }),
      prospect_count: (zoneGroups.get(zone.zone_id) || []).length,
    }))

    // Sort zones by tier (I first, IV last)
    const tierOrder: Record<string, number> = { 'I': 1, 'II': 2, 'III': 3, 'IV': 4 }
    zoneResults.sort((a, b) => (tierOrder[a.tier] || 99) - (tierOrder[b.tier] || 99))

    const totalProspects = zoneResults.reduce((sum, z) => sum + z.prospect_count, 0)

    res.json(successResponse({
      specialist: config.specialist_name,
      territory: territory.territory_name,
      zones: zoneResults,
      total_prospects: totalProspects,
    }))
  } catch (err) {
    console.error('GET /api/prozone/prospects error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

/**
 * GET /schedule/:specialist_id/:week
 * Get weekly schedule with tier-appropriate time slots.
 * Week format: YYYY-WNN.
 */
prozoneRoutes.get('/schedule/:specialist_id/:week', async (req: Request, res: Response) => {
  try {
    const configId = param(req.params.specialist_id)
    const weekStr = param(req.params.week)
    const config = await loadSpecialistConfig(configId)
    if (!config) {
      res.status(404).json(errorResponse('Specialist config not found'))
      return
    }

    const weekDates = getWeekDates(weekStr)
    if (!weekDates) {
      res.status(400).json(errorResponse('Invalid week format. Use YYYY-WNN (e.g. 2026-W12)'))
      return
    }

    const officeDays = (config.office_days as string[]) || []
    const fieldDays = (config.field_days as string[]) || []
    const slotTemplates = (config.slot_templates as Array<Record<string, unknown>>) || []
    const tierMap = (config.tier_map as Array<{ zone_id: string; tier: string; county?: string }>) || []

    // Build slot template lookup by tier
    const templateByTier = new Map<string, Record<string, unknown>>()
    for (const tpl of slotTemplates) {
      templateByTier.set(tpl.tier as string, tpl)
    }

    // Generate schedule for each day of the week
    const schedule: Array<Record<string, unknown>> = []
    const current = new Date(weekDates.start)

    for (let i = 0; i < 7; i++) {
      const dayName = DAY_NAMES[current.getDay()]
      const dateStr = current.toISOString().split('T')[0]
      const isOfficeDay = officeDays.includes(dayName)
      const isFieldDay = fieldDays.includes(dayName)

      if (!isOfficeDay && !isFieldDay) {
        // Day off
        schedule.push({
          date: dateStr,
          day: dayName,
          type: 'off',
          slots: [],
        })
      } else if (isOfficeDay) {
        // Office day: use Tier I template (or first available)
        const officeTpl = templateByTier.get('I') || slotTemplates[0] || {}
        const slotsCount = (officeTpl.slots_per_day as number) || 6
        const firstSlot = (officeTpl.first_slot as string) || '9:30'
        const duration = (officeTpl.slot_duration_minutes as number) || 90

        const slots = generateSlots(firstSlot, slotsCount, duration)

        schedule.push({
          date: dateStr,
          day: dayName,
          type: 'office',
          slots: slots.map(s => ({
            time: s,
            duration_minutes: duration,
            status: 'available',
          })),
        })
      } else {
        // Field day: generate slots per tier zone assignments
        // Group tier map by tier for the day
        const tierGroups = new Map<string, Array<{ zone_id: string; county?: string }>>()
        for (const entry of tierMap) {
          const tier = entry.tier
          if (!tierGroups.has(tier)) tierGroups.set(tier, [])
          tierGroups.get(tier)!.push({ zone_id: entry.zone_id, county: entry.county })
        }

        const fieldSlots: Array<Record<string, unknown>> = []
        for (const [tier, zones] of tierGroups) {
          const tpl = templateByTier.get(tier)
          if (!tpl) continue
          const slotsCount = (tpl.slots_per_day as number) || 4
          const firstSlot = (tpl.first_slot as string) || '10:00'
          const duration = (tpl.slot_duration_minutes as number) || 90

          const times = generateSlots(firstSlot, slotsCount, duration)
          for (const time of times) {
            fieldSlots.push({
              time,
              duration_minutes: duration,
              tier,
              zones: zones.map(z => z.zone_id),
              status: 'available',
              departure_time: (tpl.departure_time as string) || undefined,
              return_time: (tpl.return_time as string) || undefined,
            })
          }
        }

        // Sort field slots by time
        fieldSlots.sort((a, b) => {
          const ta = timeToMinutes(a.time as string)
          const tb = timeToMinutes(b.time as string)
          return ta - tb
        })

        schedule.push({
          date: dateStr,
          day: dayName,
          type: 'field',
          slots: fieldSlots,
        })
      }

      current.setDate(current.getDate() + 1)
    }

    res.json(successResponse({
      specialist: config.specialist_name,
      week: weekStr,
      week_start: weekDates.start.toISOString().split('T')[0],
      week_end: weekDates.end.toISOString().split('T')[0],
      schedule,
    }))
  } catch (err) {
    console.error('GET /api/prozone/schedule error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

/**
 * GET /zone-leads/:specialist_id/:zone_id
 * Get opportunistic zone leads when specialist is already in a zone.
 * Applies zone_lead_criteria from specialist config.
 */
prozoneRoutes.get('/zone-leads/:specialist_id/:zone_id', async (req: Request, res: Response) => {
  try {
    const configId = param(req.params.specialist_id)
    const zoneId = param(req.params.zone_id)
    const config = await loadSpecialistConfig(configId)
    if (!config) {
      res.status(404).json(errorResponse('Specialist config not found'))
      return
    }

    const territory = await loadTerritory(config.territory_id as string)
    if (!territory) {
      res.status(404).json(errorResponse('Territory not found'))
      return
    }

    // Find counties in this zone
    const counties = (territory.counties as Array<{ county: string; zone_id: string }>) || []
    const zoneCounties = counties.filter(c => c.zone_id === zoneId).map(c => c.county)
    const state = territory.state as string

    if (zoneCounties.length === 0) {
      res.json(successResponse({ zone_id: zoneId, leads: [], total: 0 }))
      return
    }

    const db = getFirestore()
    const criteria = (config.zone_lead_criteria || {}) as Record<string, unknown>
    const activeMedicareAll = criteria.active_medicare_all as boolean
    const activeLa80Plus = criteria.active_la_80plus as boolean
    const noCoreUnder80 = criteria.no_core_under_80 as boolean

    // Query clients in zone counties
    const chunks: string[][] = []
    for (let i = 0; i < zoneCounties.length; i += 30) {
      chunks.push(zoneCounties.slice(i, i + 30))
    }

    const allClients: Record<string, unknown>[] = []
    for (const chunk of chunks) {
      const snap = await db.collection('clients')
        .where('state', '==', state)
        .where('county', 'in', chunk)
        .get()

      for (const doc of snap.docs) {
        const data = doc.data()
        const status = (data.client_status as string) || ''
        if (status === 'Active' || status === 'Active - Internal') {
          allClients.push({ id: doc.id, ...data })
        }
      }
    }

    // Apply zone lead criteria
    const leads: Record<string, unknown>[] = []

    for (const client of allClients) {
      const age = calculateAge(client.dob as string)
      const reasons: string[] = []

      // Active Medicare (all ages) — flag all clients with active Medicare
      if (activeMedicareAll) {
        const hasMedicare = ((client.has_medicare as boolean) ||
          ((client.account_types as string) || '').toLowerCase().includes('medicare'))
        if (hasMedicare) {
          reasons.push('Active Medicare client')
        }
      }

      // Active LA 80+ — life/annuity clients over 80
      if (activeLa80Plus && age !== null && age >= 80) {
        const hasLA = ((client.has_life as boolean) || (client.has_annuity as boolean) ||
          ((client.account_types as string) || '').toLowerCase().match(/life|annuity/))
        if (hasLA) {
          reasons.push('Active L&A client age 80+')
        }
      }

      // No core products under 80 — clients under 80 with no core product
      if (noCoreUnder80 && age !== null && age < 80) {
        const hasCore = ((client.account_types as string) || '').toLowerCase().match(/life|annuity|medicare|ria|bd/)
        if (!hasCore) {
          reasons.push('No core product — under 80')
        }
      }

      if (reasons.length > 0) {
        leads.push({
          client_id: client.id || client.client_id,
          first_name: client.first_name,
          last_name: client.last_name,
          county: client.county,
          city: client.city,
          zip: client.zip,
          age,
          reasons,
        })
      }
    }

    // Sort: older clients first
    leads.sort((a, b) => {
      const ageA = (a.age as number) ?? 0
      const ageB = (b.age as number) ?? 0
      return ageB - ageA
    })

    res.json(successResponse({
      zone_id: zoneId,
      specialist: config.specialist_name,
      territory: territory.territory_name,
      leads,
      total: leads.length,
    }))
  } catch (err) {
    console.error('GET /api/prozone/zone-leads error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ─── Utility: generate slot times ───
function generateSlots(firstSlot: string, count: number, durationMinutes: number): string[] {
  const slots: string[] = []
  let minutes = timeToMinutes(firstSlot)
  for (let i = 0; i < count; i++) {
    slots.push(minutesToTime(minutes))
    minutes += durationMinutes
  }
  return slots
}

function timeToMinutes(time: string): number {
  const parts = time.replace(/\s*(am|pm)\s*/i, '').split(':')
  let hours = parseInt(parts[0]) || 0
  const mins = parseInt(parts[1]) || 0
  // Handle AM/PM if present
  if (/pm/i.test(time) && hours < 12) hours += 12
  if (/am/i.test(time) && hours === 12) hours = 0
  return hours * 60 + mins
}

function minutesToTime(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60)
  const mins = totalMinutes % 60
  return `${hours}:${mins.toString().padStart(2, '0')}`
}
