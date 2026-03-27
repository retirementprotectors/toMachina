import { initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

if (getApps().length === 0) initializeApp({ projectId: 'claude-mcp-484718' })
const db = getFirestore()

async function run() {
  const now = new Date().toISOString()
  const batch = db.batch()

  batch.update(db.collection('tracker_items').doc('TRK-001'), {
    description: 'Create mdj_conversations, mdj_client_insights, mdj_specialist_configs collections. Add Firestore security rules. Seed initial specialist configs (6 specialists). MDJ user preferences are NOT a separate collection — they are fields on the existing users/{email} document (mdj_preferences object), same pattern as employee_profile and module_permissions.',
    updated_at: now,
  })

  batch.update(db.collection('tracker_items').doc('TRK-018'), {
    description: 'MDJ user preferences stored as users/{email}.mdj_preferences object in Firestore (NOT a separate collection). Fields: auto_approve_tools (string[]), show_tool_details (boolean), default_specialist (string), conversation_retention_days (number). Managed via existing Admin/Config tabs in ProDashX. Team Config + Permissions Audit section exposes MDJ settings alongside existing module_permissions. Admin (EXECUTIVE+) can configure team members MDJ access, auto-approve lists, and default specialists.',
    updated_at: now,
  })

  await batch.commit()
  console.log('Fixed TRK-001 + TRK-018: MDJ prefs → users/{email}.mdj_preferences')
}

run().catch(console.error)
