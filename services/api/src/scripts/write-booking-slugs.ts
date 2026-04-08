import { initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

if (getApps().length === 0) {
  initializeApp({ projectId: 'claude-mcp-484718' })
}
const db = getFirestore()

const SLUG_MAP: Record<string, string> = {
  'josh@retireprotected.com': 'jdm',
  'john@retireprotected.com': 'john',
  'shane@retireprotected.com': 'shane',
  'nikki@retireprotected.com': 'nikki',
  'vince@retireprotected.com': 'vince',
  'matt@retireprotected.com': 'matt',
  'aprille@retireprotected.com': 'aprille',
  'archer@retireprotected.com': 'archer',
  'robert@retireprotected.com': 'robert',
  'lucas@retireprotected.com': 'lucas',
  'angelique@retireprotected.com': 'angelique',
  'susan@retireprotected.com': 'susan',
}

const dryRun = process.argv.includes('--dry-run')

async function run() {
  console.log(dryRun ? '=== DRY RUN ===' : '=== LIVE WRITE ===')
  for (const [email, slug] of Object.entries(SLUG_MAP)) {
    const docRef = db.collection('users').doc(email)
    const doc = await docRef.get()
    if (!doc.exists) { console.log(`SKIP ${email} — not found`); continue }
    const data = doc.data()!
    let profile: Record<string, unknown> = {}
    if (typeof data.employee_profile === 'string') {
      try { profile = JSON.parse(data.employee_profile) } catch { profile = {} }
    } else if (data.employee_profile && typeof data.employee_profile === 'object') {
      profile = data.employee_profile as Record<string, unknown>
    }
    const existing = profile.booking_slug
    if (dryRun) {
      console.log(`${email}: current=${existing || 'none'} → ${slug}`)
    } else {
      profile.booking_slug = slug
      await docRef.update({ employee_profile: profile })
      console.log(`✓ ${email} → booking_slug: ${slug}`)
    }
  }
  console.log('\nDone.')
}
run().then(() => process.exit(0)).catch(err => { console.error('Fatal:', err); process.exit(1) })
