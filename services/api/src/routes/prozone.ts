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

    // Build ZIP-to-zone lookup (ZIP takes precedence over county)
    const zipZoneMap = new Map<string, string>()
    const territoryZones = (territory.zones as Array<Record<string, unknown>>) || []
    for (const z of territoryZones) {
      const zipAssignments = (z.zip_assignments as Array<{ zip: string; zone_id: string }>) || []
      for (const za of zipAssignments) {
        zipZoneMap.set(za.zip, za.zone_id)
      }
    }

    // Build tier lookup from tier_map
    const tierMap = (config.tier_map as Array<{ zone_id: string; tier: string }>) || []
    const zoneTierMap = new Map<string, string>()
    for (const entry of tierMap) {
      zoneTierMap.set(entry.zone_id, entry.tier)
    }

    // Group clients by zone
    const zoneGroups = new Map<string, Record<string, unknown>[]>()
    const seenClientIds = new Set<string>()

    for (const client of allClients) {
      const county = ((client.county as string) || '').toLowerCase()
      const clientZip = ((client.zip as string) || '').trim()
      // ZIP takes precedence over county for zone resolution
      const zoneId = zipZoneMap.get(clientZip) || countyZoneMap.get(county)
      if (!zoneId) continue

      const clientId = (client.id || client.client_id) as string
      seenClientIds.add(clientId)

      // Apply age filter
      const age = calculateAge(client.dob as string)
      if (age !== null && age > maxAge) continue

      // Inventory computation — same logic as zone-leads endpoint
      const accountTypes = ((client.account_types as string) || '').toLowerCase()
      const hasM = !!(client.has_medicare) || accountTypes.includes('medicare')
      const hasL = !!(client.has_life) || accountTypes.includes('life')
      const hasA = !!(client.has_annuity) || accountTypes.includes('annuity')
      const hasRIA = accountTypes.includes('ria')
      const hasBD = accountTypes.includes('bd')

      const inventory = { has_medicare: hasM, has_life: hasL, has_annuity: hasA, has_ria: hasRIA, has_bd: hasBD }
      const flags: string[] = []
      if (hasM) flags.push('Active Medicare')
      if ((hasL || hasA) && age !== null && age >= 80) flags.push('L&A 80+')
      if (age !== null && age < 80 && !hasL && !hasA && !hasM && !hasRIA && !hasBD) flags.push('No Core Product')

      // Meeting type determination
      const hasLA = hasL || hasA
      let meetingType: 'field' | 'office' | 'none' = 'none'
      const zoneTier = zoneTierMap.get(zoneId) || ''
      const isOuterZone = zoneTier === 'III' || zoneTier === 'IV'
      if (hasLA && age !== null && age < 80 && !isOuterZone) {
        meetingType = 'field'
      } else if (hasLA && (age === null || age >= 80 || isOuterZone)) {
        meetingType = 'office'
      }

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
        phone: client.phone || client.phone_primary || '',
        age,
        client_status: client.client_status,
        source: client.source || '',
        inventory,
        flags,
        meeting_type: meetingType,
      })
    }

    // ─── Cross-sell: pull in clients from other specialist sources ───
    const crossSellSources = (config.cross_sell_sources as string[]) || []
    for (const csSource of crossSellSources) {
      for (const chunk of chunks) {
        const csSnap = await db.collection('clients')
          .where('state', '==', state)
          .where('county', 'in', chunk)
          .where('source', '==', csSource)
          .limit(500)
          .get()
        for (const csDoc of csSnap.docs) {
          const cd = csDoc.data()
          if (seenClientIds.has(csDoc.id)) continue
          seenClientIds.add(csDoc.id)
          const cStatus = (cd.client_status as string) || ''
          if (cStatus !== 'Active' && cStatus !== 'Active - Internal') continue
          const cCounty = ((cd.county as string) || '').toLowerCase()
          const cZip = ((cd.zip as string) || '').trim()
          const cZoneId = zipZoneMap.get(cZip) || countyZoneMap.get(cCounty)
          if (!cZoneId) continue
          const cAge = calculateAge(cd.dob as string)
          const cAcct = ((cd.account_types as string) || '').toLowerCase()
          if (!zoneGroups.has(cZoneId)) zoneGroups.set(cZoneId, [])
          zoneGroups.get(cZoneId)!.push({
            client_id: csDoc.id, first_name: cd.first_name, last_name: cd.last_name,
            county: cd.county, city: cd.city, zip: cd.zip,
            phone: cd.phone || cd.phone_primary || '', age: cAge,
            client_status: cd.client_status, source: cd.source || '',
            inventory: {
              has_medicare: !!(cd.has_medicare) || cAcct.includes('medicare'),
              has_life: !!(cd.has_life) || cAcct.includes('life'),
              has_annuity: !!(cd.has_annuity) || cAcct.includes('annuity'),
              has_ria: cAcct.includes('ria'), has_bd: cAcct.includes('bd'),
            },
            flags: [], meeting_type: 'office', cross_sell_from: csSource,
          })
        }
      }
    }

    // ─── Pipeline Aggregation: find active flow_instances for these prospects ───
    const allClientIds = allClients.map(c => (c.id || c.client_id) as string).filter(Boolean)
    const pipelineMap = new Map<string, { pipeline_key: string; stage: string; priority: string }>()

    if (allClientIds.length > 0) {
      // Query flow_instances with active statuses, then filter entity_type in memory
      const fiSnap = await db.collection('flow_instances')
        .where('stage_status', 'in', ['pending', 'in_progress'])
        .select('entity_id', 'entity_type', 'pipeline_key', 'current_stage', 'priority')
        .get()

      for (const fiDoc of fiSnap.docs) {
        const fi = fiDoc.data()
        const entityType = fi.entity_type as string
        if (entityType !== 'CLIENT' && entityType !== 'HOUSEHOLD') continue
        const entityId = fi.entity_id as string
        if (!entityId) continue
        // Only include if entity_id is among our prospect client_ids
        if (!allClientIds.includes(entityId)) continue
        pipelineMap.set(entityId, {
          pipeline_key: (fi.pipeline_key as string) || '',
          stage: (fi.current_stage as string) || '',
          priority: (fi.priority as string) || '',
        })
      }
    }

    // Build zone response with tier info, flag summaries, and age buckets
    const zones = (territory.zones as Array<{ zone_id: string; zone_name: string }>) || []
    const zoneResults = zones.map(zone => {
      const prospects = (zoneGroups.get(zone.zone_id) || []).sort((a, b) => {
        const ageA = (a.age as number) ?? 0
        const ageB = (b.age as number) ?? 0
        return ageB - ageA
      })

      // Attach pipeline data to prospects that have active flow instances
      for (const p of prospects) {
        const cid = p.client_id as string
        const pipelineData = pipelineMap.get(cid)
        if (pipelineData) {
          p.pipeline = pipelineData
        }
      }

      // Flag summary
      const flagSummary: Record<string, number> = {}
      let flaggedCount = 0
      for (const p of prospects) {
        const pFlags = p.flags as string[]
        if (pFlags.length > 0) flaggedCount++
        for (const f of pFlags) {
          flagSummary[f] = (flagSummary[f] || 0) + 1
        }
      }

      // Age buckets
      let under60 = 0, age60_64 = 0, age65_80 = 0, age80plus = 0
      // BoB breakdown by source
      const bobBreakdown: Record<string, number> = {}
      for (const p of prospects) {
        const a = p.age as number | null
        if (a !== null) {
          if (a < 60) under60++
          else if (a <= 64) age60_64++
          else if (a <= 80) age65_80++
          else age80plus++
        }
        const src = (p.source as string) || 'Unknown'
        bobBreakdown[src] = (bobBreakdown[src] || 0) + 1
      }

      return {
        zone_id: zone.zone_id,
        zone_name: zone.zone_name,
        tier: zoneTierMap.get(zone.zone_id) || 'Unknown',
        prospects,
        prospect_count: prospects.length,
        flagged_count: flaggedCount,
        flag_summary: flagSummary,
        age_buckets: { under_60: under60, '60_64': age60_64, '65_80': age65_80, '80_plus': age80plus },
        bob_breakdown: bobBreakdown,
      }
    })

    // Sort zones by tier (I first, IV last)
    const tierOrder: Record<string, number> = { 'I': 1, 'II': 2, 'III': 3, 'IV': 4 }
    zoneResults.sort((a, b) => (tierOrder[a.tier] || 99) - (tierOrder[b.tier] || 99))

    const totalProspects = zoneResults.reduce((sum, z) => sum + z.prospect_count, 0)
    const totalFlagged = zoneResults.reduce((sum, z) => sum + z.flagged_count, 0)
    const totalInPipeline = zoneResults.reduce((sum, z) => {
      return sum + z.prospects.filter((p: Record<string, unknown>) => !!p.pipeline).length
    }, 0)

    // ─── Pagination params ───
    const offset = parseInt(req.query.offset as string) || 0
    const limit = Math.min(parseInt(req.query.limit as string) || 200, 500)
    const flat = req.query.flat === 'true'

    // ─── Flat mode: flatten all zones into one paginated array ───
    if (flat) {
      const allProspects = zoneResults.flatMap(z =>
        z.prospects.map((p: Record<string, unknown>) => ({
          ...p,
          zone_id: z.zone_id,
          zone_name: z.zone_name,
          zone_tier: z.tier,
        }))
      )
      const paginated = allProspects.slice(offset, offset + limit)
      res.json(successResponse({
        specialist: config.specialist_name,
        territory: territory.territory_name,
        prospects: paginated,
        total_prospects: allProspects.length,
        total_flagged: totalFlagged,
        total_in_pipeline: totalInPipeline,
        meta: { offset, limit, total: allProspects.length },
      }))
      return
    }

    // ─── Default: zone-grouped response with meta ───
    res.json(successResponse({
      specialist: config.specialist_name,
      territory: territory.territory_name,
      zones: zoneResults,
      total_prospects: totalProspects,
      total_flagged: totalFlagged,
      total_in_pipeline: totalInPipeline,
      meta: { offset, limit, total: totalProspects },
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
 * @deprecated — inventory flags + meeting criteria now included in /prospects/:specialist_id.
 * Retained for backward compatibility; remove when old UI components are deleted.
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

/**
 * GET /scorecard
 * Aggregates call metrics from communications collection.
 * Query params: specialist_id, timeline (today|week|month|year|all), team (COR|AST|SPC|ALL), pipeline (retirement|medicare|legacy)
 */
prozoneRoutes.get('/scorecard', async (req: Request, res: Response) => {
  try {
    const specialistId = req.query.specialist_id as string
    const timeline = (req.query.timeline as string) || 'week'
    const team = (req.query.team as string) || 'ALL'
    const pipeline = (req.query.pipeline as string) || ''

    const db = getFirestore()

    // Calculate date range
    const now = new Date()
    let startDate: Date | null = null
    if (timeline === 'today') {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    } else if (timeline === 'week') {
      startDate = new Date(now)
      startDate.setDate(now.getDate() - now.getDay()) // Start of week (Sunday)
    } else if (timeline === 'month') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1)
    } else if (timeline === 'year') {
      startDate = new Date(now.getFullYear(), 0, 1)
    }
    // 'all' = no date filter

    // Query communications collection for outbound voice calls
    let query: FirebaseFirestore.Query = db.collection('communications')
      .where('channel', '==', 'voice')
      .where('direction', '==', 'outbound')

    if (startDate) {
      query = query.where('created_at', '>=', startDate.toISOString())
    }

    // Specialist filter — load config to get associated user email
    if (specialistId && specialistId !== 'ALL') {
      const config = await loadSpecialistConfig(specialistId)
      if (config) {
        const email = config.specialist_email as string
        if (email) {
          query = query.where('sent_by', '==', email)
        }
      }
    }

    const snap = await query.limit(5000).get()

    let attempts = 0
    let connected = 0
    let booked = 0

    for (const doc of snap.docs) {
      const data = doc.data()
      const outcome = (data.outcome as string) || ''

      // Team filter (COR/AST/SPC) — check sent_by user level
      if (team !== 'ALL') {
        const senderLevel = (data.sender_level as string) || ''
        if (senderLevel.toUpperCase() !== team.toUpperCase()) continue
      }

      // Pipeline filter — check pipeline_key on the communication record
      if (pipeline) {
        const commPipeline = (data.pipeline_key as string) || ''
        if (commPipeline.toLowerCase() !== pipeline.toLowerCase()) continue
      }

      attempts++
      if (outcome === 'callback' || outcome === 'booked' || outcome === 'not_interested') {
        connected++
      }
      if (outcome === 'booked') {
        booked++
      }
    }

    res.json(successResponse({
      attempts,
      connected,
      booked,
      percentages: {
        connected: attempts > 0 ? Math.round((connected / attempts) * 1000) / 10 : 0,
        booked: connected > 0 ? Math.round((booked / connected) * 1000) / 10 : 0,
      },
      filters: { specialist_id: specialistId, timeline, team, pipeline },
    }))
  } catch (err) {
    console.error('GET /api/prozone/scorecard error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})


/**
 * POST /enroll — Auto-enroll prospects into PROSPECT_* pipelines.
 * Body: { specialist_id: string, domain?: string }
 * TRK-13538
 */
prozoneRoutes.post('/enroll', async (req: Request, res: Response) => {
  try {
    const body = req.body as { specialist_id?: string; domain?: string }
    const specialistId = body.specialist_id
    if (!specialistId) {
      res.status(400).json(errorResponse('specialist_id required'))
      return
    }

    const db = getFirestore()
    const config = await loadSpecialistConfig(specialistId)
    if (!config) {
      res.status(404).json(errorResponse('Config not found'))
      return
    }

    const territory = await loadTerritory(config.territory_id as string)
    if (!territory) {
      res.status(404).json(errorResponse('Territory not found'))
      return
    }

    const counties = (territory.counties as Array<{ county: string }>) || []
    const countyNames = counties.map(c => c.county)
    const state = territory.state as string
    if (countyNames.length === 0) {
      res.json(successResponse({ enrolled: 0 }))
      return
    }

    const chunks: string[][] = []
    for (let i = 0; i < countyNames.length; i += 30) {
      chunks.push(countyNames.slice(i, i + 30))
    }

    const clientIds: string[] = []
    for (const chunk of chunks) {
      const snap = await db.collection('clients')
        .where('state', '==', state)
        .where('county', 'in', chunk)
        .limit(5000)
        .get()
      for (const doc of snap.docs) {
        const d = doc.data()
        const st = (d.client_status as string) || ''
        if (st === 'Active' || st === 'Active - Internal') {
          clientIds.push(doc.id)
        }
      }
    }

    const existingKeys = new Set<string>()
    const eiSnap = await db.collection('flow_instances')
      .where('entity_type', '==', 'CLIENT')
      .where('stage_status', 'in', ['pending', 'in_progress'])
      .select('entity_id', 'pipeline_key')
      .get()
    for (const doc of eiSnap.docs) {
      const d = doc.data()
      existingKeys.add(d.entity_id + '__' + d.pipeline_key)
    }

    const pipelineKey = body.domain || 'PROSPECT_RETIREMENT'
    const now = new Date().toISOString()
    let enrolled = 0
    let pending: Array<{ ref: FirebaseFirestore.DocumentReference; data: Record<string, unknown> }> = []

    for (const cid of clientIds) {
      if (existingKeys.has(cid + '__' + pipelineKey)) continue

      const ref = db.collection('flow_instances').doc()
      pending.push({
        ref,
        data: {
          instance_id: ref.id, pipeline_key: pipelineKey,
          entity_id: cid, entity_type: 'CLIENT', entity_name: '',
          current_stage: 'new', stage_status: 'pending', priority: 'MEDIUM',
          assigned_to: (config.specialist_email as string) || '',
          created_at: now, updated_at: now,
        },
      })
      enrolled++

      if (pending.length >= 400) {
        const batch = db.batch()
        for (const op of pending) batch.set(op.ref, op.data)
        await batch.commit()
        pending = []
      }
    }

    if (pending.length > 0) {
      const batch = db.batch()
      for (const op of pending) batch.set(op.ref, op.data)
      await batch.commit()
    }

    res.json(successResponse({ enrolled, pipeline: pipelineKey }))
  } catch (err) {
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
