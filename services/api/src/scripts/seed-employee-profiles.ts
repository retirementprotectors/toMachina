#!/usr/bin/env npx tsx
/**
 * Seed Employee Profiles — TRK-080 + TRK-081
 *
 * Populates employee_profile data for MyRPI DropZone Quick Links
 * and calendar_booking_types for Meeting Config.
 *
 * Run: npx tsx services/api/src/scripts/seed-employee-profiles.ts
 *
 * Idempotent: merges into existing user documents without overwriting
 * unrelated fields.
 *
 * TODO: JDM — fill in actual values for each team member below.
 */

import { initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

if (getApps().length === 0) {
  initializeApp({ projectId: 'claude-mcp-484718' })
}

const db = getFirestore()

// ---------------------------------------------------------------------------
// Team Member Profiles — TRK-080
// ---------------------------------------------------------------------------
// TODO: JDM — Replace placeholder values with real data for each person.
//   meet_link:    Google Meet room link (e.g., https://meet.google.com/xxx-xxxx-xxx)
//   folder_url:   Google Drive intake folder URL
//   booking_slug: External booking page URL (Google Calendar or Calendly)
//   drive_folder_url: HR/personal Drive folder link
// ---------------------------------------------------------------------------

interface EmployeeProfile {
  email: string
  meet_room: {
    meet_link: string
    folder_url: string
  }
  booking_slug: string
  drive_folder_url: string
  drop_zone: {
    doc_type_preferences: string[]
  }
}

const TEAM_PROFILES: EmployeeProfile[] = [
  {
    email: 'josh@retireprotected.com',
    meet_room: {
      meet_link: '', // TODO: JDM — Google Meet personal room link
      folder_url: '', // TODO: JDM — Drive intake folder URL
    },
    booking_slug: '', // TODO: JDM — Booking page URL
    drive_folder_url: '', // TODO: JDM — HR folder link
    drop_zone: {
      doc_type_preferences: ['correspondence', 'insurance_policy', 'financial_statement', 'application_form'],
    },
  },
  {
    email: 'john@retireprotected.com',
    meet_room: {
      meet_link: '', // TODO: JDM — Google Meet personal room link
      folder_url: '', // TODO: JDM — Drive intake folder URL
    },
    booking_slug: '', // TODO: JDM — Booking page URL
    drive_folder_url: '', // TODO: JDM — HR folder link
    drop_zone: {
      doc_type_preferences: ['correspondence', 'insurance_policy', 'financial_statement', 'application_form'],
    },
  },
  {
    email: 'nikki@retireprotected.com',
    meet_room: {
      meet_link: '', // TODO: JDM — Google Meet personal room link
      folder_url: '', // TODO: JDM — Drive intake folder URL
    },
    booking_slug: '', // TODO: JDM — Booking page URL
    drive_folder_url: '', // TODO: JDM — HR folder link
    drop_zone: {
      doc_type_preferences: ['correspondence', 'insurance_policy', 'medical_record', 'id_document'],
    },
  },
  {
    email: 'vinnie@retireprotected.com',
    meet_room: {
      meet_link: '', // TODO: JDM — Google Meet personal room link
      folder_url: '', // TODO: JDM — Drive intake folder URL
    },
    booking_slug: '', // TODO: JDM — Booking page URL
    drive_folder_url: '', // TODO: JDM — HR folder link
    drop_zone: {
      doc_type_preferences: ['application_form', 'insurance_policy', 'financial_statement'],
    },
  },
  {
    email: 'matt@retireprotected.com',
    meet_room: {
      meet_link: '', // TODO: JDM — Google Meet personal room link
      folder_url: '', // TODO: JDM — Drive intake folder URL
    },
    booking_slug: '', // TODO: JDM — Booking page URL
    drive_folder_url: '', // TODO: JDM — HR folder link
    drop_zone: {
      doc_type_preferences: ['correspondence', 'financial_statement', 'insurance_policy'],
    },
  },
  {
    email: 'aprille@retireprotected.com',
    meet_room: {
      meet_link: '', // TODO: JDM — Google Meet personal room link
      folder_url: '', // TODO: JDM — Drive intake folder URL
    },
    booking_slug: '', // TODO: JDM — Booking page URL
    drive_folder_url: '', // TODO: JDM — HR folder link
    drop_zone: {
      doc_type_preferences: ['correspondence', 'medical_record', 'id_document'],
    },
  },
]

// ---------------------------------------------------------------------------
// Meeting Types — TRK-081
// ---------------------------------------------------------------------------
// Default calendar_booking_types seeded per division.
// JDM: confirm or adjust these defaults.
// ---------------------------------------------------------------------------

interface MeetingType {
  name: string
  duration_minutes: number
  category: string
}

const DEFAULT_MEETING_TYPES: Record<string, MeetingType[]> = {
  // Leadership: all meeting types
  leadership: [
    { name: 'Initial Consultation', duration_minutes: 60, category: 'Sales' },
    { name: 'Annual Review', duration_minutes: 30, category: 'Service' },
    { name: 'Quick Check-In', duration_minutes: 15, category: 'Service' },
    { name: 'Medicare Enrollment', duration_minutes: 45, category: 'Medicare' },
    { name: 'Financial Planning Review', duration_minutes: 60, category: 'Advisory' },
    { name: 'Leadership Standup', duration_minutes: 15, category: 'Internal' },
  ],
  // Sales: sales + service meetings
  sales: [
    { name: 'Initial Consultation', duration_minutes: 60, category: 'Sales' },
    { name: 'Annual Review', duration_minutes: 30, category: 'Service' },
    { name: 'Quick Check-In', duration_minutes: 15, category: 'Service' },
    { name: 'Medicare Enrollment', duration_minutes: 45, category: 'Medicare' },
  ],
  // Service: service meetings only
  service: [
    { name: 'Annual Review', duration_minutes: 30, category: 'Service' },
    { name: 'Quick Check-In', duration_minutes: 15, category: 'Service' },
    { name: 'Medicare Enrollment', duration_minutes: 45, category: 'Medicare' },
  ],
  // B2B: advisory + internal
  b2b: [
    { name: 'Financial Planning Review', duration_minutes: 60, category: 'Advisory' },
    { name: 'Quick Check-In', duration_minutes: 15, category: 'Service' },
    { name: 'Leadership Standup', duration_minutes: 15, category: 'Internal' },
  ],
}

// Map email → meeting type set
const EMAIL_TO_MEETING_SET: Record<string, string> = {
  'josh@retireprotected.com': 'leadership',
  'john@retireprotected.com': 'leadership',
  'nikki@retireprotected.com': 'service',
  'vinnie@retireprotected.com': 'sales',
  'matt@retireprotected.com': 'b2b',
  'aprille@retireprotected.com': 'leadership',
}

// ---------------------------------------------------------------------------
// Execution
// ---------------------------------------------------------------------------

async function main() {
  console.log('[seed] Starting employee profile + meeting type seed...\n')

  // Find user docs by email
  const usersSnap = await db.collection('users').get()
  const emailToDocId = new Map<string, string>()
  for (const d of usersSnap.docs) {
    const email = (d.data().email as string || '').toLowerCase()
    if (email) emailToDocId.set(email, d.id)
  }

  let profilesSeeded = 0
  let meetingTypesSeeded = 0

  for (const profile of TEAM_PROFILES) {
    const docId = emailToDocId.get(profile.email.toLowerCase())
    if (!docId) {
      console.log(`[seed] SKIP: No user doc found for ${profile.email}`)
      continue
    }

    // Build the employee_profile merge payload
    const update: Record<string, unknown> = {
      'employee_profile.meet_room': profile.meet_room,
      'employee_profile.booking_slug': profile.booking_slug,
      'employee_profile.drive_folder_url': profile.drive_folder_url,
      'employee_profile.drop_zone.doc_type_preferences': profile.drop_zone.doc_type_preferences,
      updated_at: new Date().toISOString(),
    }

    // Add meeting types (TRK-081)
    const meetingSet = EMAIL_TO_MEETING_SET[profile.email.toLowerCase()]
    if (meetingSet && DEFAULT_MEETING_TYPES[meetingSet]) {
      update['employee_profile.calendar_booking_types'] = DEFAULT_MEETING_TYPES[meetingSet]
      meetingTypesSeeded++
    }

    await db.collection('users').doc(docId).update(update)
    profilesSeeded++

    const hasData = profile.meet_room.meet_link || profile.booking_slug
    console.log(`[seed] ${hasData ? 'OK' : 'PLACEHOLDER'}: ${profile.email} (doc: ${docId})`)
  }

  console.log(`\n[seed] Done. ${profilesSeeded} profiles seeded, ${meetingTypesSeeded} meeting type sets applied.`)

  if (TEAM_PROFILES.some(p => !p.meet_room.meet_link)) {
    console.log('\n[seed] NOTE: Some profiles have empty meet_link/booking_slug/folder_url.')
    console.log('[seed] JDM: Fill in the TODO values in this script and re-run.')
  }
}

main().catch(err => {
  console.error('[seed] Failed:', err)
  process.exit(1)
})
