import { initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

if (getApps().length === 0) {
  initializeApp({ projectId: 'claude-mcp-484718' })
}
const db = getFirestore()

const SEED_ITEMS = [
  { title: 'Default to Active status', description: 'Accounts grid should default status filter to Active, not All', portal: 'PRODASHX', scope: 'Module', component: 'Accounts Grid', section: 'Filters', status: 'built', notes: 'Set useState default to Active' },
  { title: '+ New button opens new Account', description: '+ New button must open new ACCOUNT creation, not contact intake. Currently links to /intake which creates contacts. Need account creation flow.', portal: 'PRODASHX', scope: 'Module', component: 'Accounts Grid', section: 'Header', status: 'not_touched', notes: 'No account creation page exists yet' },
  { title: 'Load ALL accounts (no 500 limit)', description: 'Grid was only loading 500 accounts via limit(). Rewrote to getDocs on full collectionGroup. All 17K+ accounts now loaded.', portal: 'PRODASHX', scope: 'Module', component: 'Accounts Grid', section: 'Body', status: 'built', notes: 'Rewrote data loading' },
  { title: 'Filters work on full dataset', description: 'Status, carrier, search, type filters now operate on ALL accounts, not just the first 500.', portal: 'PRODASHX', scope: 'Module', component: 'Accounts Grid', section: 'Filters', status: 'built', notes: 'Consequence of ACC-003' },
  { title: 'Counts accurate across type pills', description: 'All/Annuity/Life/Medicare/Investment counts now reflect the real totals from full dataset.', portal: 'PRODASHX', scope: 'Module', component: 'Accounts Grid', section: 'Filters', status: 'built', notes: 'Consequence of ACC-003' },
  { title: 'Carrier filter shows all carriers', description: 'Carrier dropdown now populated from ALL accounts, not just first 500.', portal: 'PRODASHX', scope: 'Module', component: 'Accounts Grid', section: 'Filters', status: 'built', notes: 'Consequence of ACC-003' },
  { title: 'Filter section spacing — consolidate rows', description: 'Three rows of filters takes too much vertical space. Needs consolidation into fewer rows.', portal: 'PRODASHX', scope: 'Module', component: 'Accounts Grid', section: 'Filters', status: 'not_touched', notes: '' },
  { title: 'Row click opens account in new tab', description: 'Clicking a row opens the account detail page in a new browser tab.', portal: 'PRODASHX', scope: 'Module', component: 'Accounts Grid', section: 'Body', status: 'built', notes: 'Was already done' },
  { title: 'Cursor pointer on rows', description: 'Rows show pointer cursor on hover to indicate clickability.', portal: 'PRODASHX', scope: 'Module', component: 'Accounts Grid', section: 'Body', status: 'built', notes: 'Was already done' },
  { title: 'DeDup from grid — :: separator fix', description: 'Composite account IDs used - separator which collided with UUID hyphens. Changed to :: separator.', portal: 'PRODASHX', scope: 'Module', component: 'Accounts Grid', section: 'Body', status: 'built', notes: 'Fixed separator format' },
  { title: 'Filter deleted/merged accounts from DeDup', description: 'Deleted and merged accounts should not appear as potential DeDup candidates in the grid.', portal: 'PRODASHX', scope: 'Module', component: 'Accounts Grid', section: 'Body', status: 'not_touched', notes: '' },
  { title: 'Dark background (no gray box on filters)', description: 'Filter section should not have a gray bg-surface container. Dark background throughout.', portal: 'PRODASHX', scope: 'Module', component: 'Accounts Grid', section: 'Filters', status: 'built', notes: 'Removed boxed wrapper' },
  { title: 'Default to Active status', description: 'Contacts grid should default status filter to Active, not All.', portal: 'PRODASHX', scope: 'Module', component: 'Contacts Grid', section: 'Filters', status: 'built', notes: 'Set useState default to Active' },
  { title: 'Remove Business column', description: 'Business column has nothing in it, no filter, invisible in default view. Remove entirely.', portal: 'PRODASHX', scope: 'Module', component: 'Contacts Grid', section: 'Body', status: 'not_touched', notes: '' },
  { title: 'Move ACF closer to Status in default view', description: 'ACF column should be positioned right after Status for quick visibility.', portal: 'PRODASHX', scope: 'Module', component: 'Contacts Grid', section: 'Body', status: 'not_touched', notes: '' },
  { title: 'Dark background (no gray box on filters)', description: 'Filter section should not have bg-surface container. Dark background throughout.', portal: 'PRODASHX', scope: 'Module', component: 'Contacts Grid', section: 'Filters', status: 'built', notes: 'Removed boxed wrapper' },
  { title: 'Filter section spacing consolidation', description: 'Too many rows for filters. Needs tighter layout.', portal: 'PRODASHX', scope: 'Module', component: 'Contacts Grid', section: 'Filters', status: 'not_touched', notes: '' },
  { title: 'Row click opens contact in new tab', description: 'Clicking a row opens contact detail in new browser tab.', portal: 'PRODASHX', scope: 'Module', component: 'Contacts Grid', section: 'Body', status: 'built', notes: 'Was already done' },
  { title: 'Cursor pointer on rows', description: 'Rows show pointer cursor on hover.', portal: 'PRODASHX', scope: 'Module', component: 'Contacts Grid', section: 'Body', status: 'built', notes: 'Was already done' },
  { title: 'Preferred name quotes stripped', description: 'Quotes in preferred names stripped via cleanName().', portal: 'PRODASHX', scope: 'Module', component: 'Contacts Grid', section: 'Body', status: 'built', notes: 'Was already done' },
  { title: 'Merged records filtered from grid', description: 'Records with client_status=merged excluded from grid.', portal: 'PRODASHX', scope: 'Module', component: 'Contacts Grid', section: 'Body', status: 'built', notes: 'Was already done' },
  { title: '0 ACFs showing — data issue', description: 'Zero ACF links showing. acf_link field either not populated or uses different field name.', portal: 'DATA', scope: 'Data', component: 'Contacts Grid', section: 'Data', status: 'not_touched', notes: 'Investigation needed' },
  { title: 'agent_name empty across all clients', description: 'agent_name field is empty across all clients. Likely under different field name.', portal: 'DATA', scope: 'Data', component: 'Contacts Grid', section: 'Data', status: 'not_touched', notes: 'Investigation needed' },
  { title: 'Remove Communications tab', description: 'Communications tab on contact detail is redundant with Communications module.', portal: 'PRODASHX', scope: 'Module', component: 'Contact Detail', section: 'Tabs', status: 'not_touched', notes: '' },
  { title: 'Agents: First Last (not Last, First)', description: 'Agents in Connect tab should display as First Last, not Last First.', portal: 'PRODASHX', scope: 'Module', component: 'Contact Detail', section: 'Connect Tab', status: 'not_touched', notes: '' },
  { title: 'Agents: only active sales team', description: 'Only show active agents from sales teams.', portal: 'PRODASHX', scope: 'Module', component: 'Contact Detail', section: 'Connect Tab', status: 'not_touched', notes: '' },
  { title: 'Suggested connections / group suggestions UI', description: 'UI concept for suggested connections and group suggestions on contact detail.', portal: 'PRODASHX', scope: 'Module', component: 'Contact Detail', section: 'Connect Tab', status: 'not_touched', notes: 'Needs design concept' },
  { title: 'Activity tab sub-filters', description: 'Activity tab needs sub-filters to narrow by type.', portal: 'PRODASHX', scope: 'Module', component: 'Contact Detail', section: 'Activity Tab', status: 'not_touched', notes: '' },
  { title: 'MyRPI on window header only', description: 'MyRPI label should only appear on window/page header, not duplicated.', portal: 'PRODASHX', scope: 'Module', component: 'Contact Detail', section: 'Header', status: 'not_touched', notes: 'Applies to all section headers' },
  { title: 'DL fields 4-on-one-row', description: 'Driver license fields in 4-column grid row.', portal: 'PRODASHX', scope: 'Module', component: 'Contact Detail', section: 'Personal Tab', status: 'built', notes: 'Was already done' },
  { title: 'Aliases/Goes-by rendering', description: 'parseAliases() correctly handles JSON arrays.', portal: 'PRODASHX', scope: 'Module', component: 'Contact Detail', section: 'Personal Tab', status: 'built', notes: 'Was already done' },
  { title: 'Reciprocal connections auto-created', description: 'Inverse relationships auto-created via INVERSE_RELATIONSHIPS map.', portal: 'PRODASHX', scope: 'Module', component: 'Contact Detail', section: 'Connect Tab', status: 'built', notes: 'Was already done' },
  { title: 'Connected accounts work perfectly', description: 'Connected accounts display and navigation works. Confirmed by JDM.', portal: 'PRODASHX', scope: 'Module', component: 'Contact Detail', section: 'Accounts Tab', status: 'confirmed', notes: 'JDM confirmed working' },
  { title: 'AI3 console error — OAuth reauth', description: 'AI3 generation throws invalid_grant error. OAuth token expired.', portal: 'PRODASHX', scope: 'Module', component: 'Contact Detail', section: 'Header', status: 'not_touched', notes: 'Run reauth-scopes.js' },
  { title: 'Account DeDup from grid (:: separator)', description: 'Fixed composite IDs to use :: separator.', portal: 'PRODASHX', scope: 'Module', component: 'DeDup', section: 'Body', status: 'built', notes: 'Changed to :: separator' },
  { title: 'Account DeDup: account link + ACF link rows', description: 'Account DeDup comparison should show account link + ACF link header rows.', portal: 'PRODASHX', scope: 'Module', component: 'DeDup', section: 'Header', status: 'not_touched', notes: '' },
  { title: 'Contact DeDup: client link + ACF link rows', description: 'Contact DeDup comparison header shows clickable client name + ACF link.', portal: 'PRODASHX', scope: 'Module', component: 'DeDup', section: 'Header', status: 'built', notes: 'Was already done' },
  { title: 'Merge moves accounts subcollection', description: 'DeDup merge correctly moves account docs.', portal: 'PRODASHX', scope: 'Module', component: 'DeDup', section: 'Body', status: 'built', notes: 'Was already done' },
  { title: 'Merge moves connected_contacts', description: 'DeDup merge moves connected_contacts via arrayUnion.', portal: 'PRODASHX', scope: 'Module', component: 'DeDup', section: 'Body', status: 'built', notes: 'Was already done' },
  { title: 'Merge moves communications', description: 'DeDup merge moves communications subcollection.', portal: 'PRODASHX', scope: 'Module', component: 'DeDup', section: 'Body', status: 'built', notes: 'Was already done' },
  { title: 'Merge moves access_items', description: 'DeDup merge moves access_items subcollection.', portal: 'PRODASHX', scope: 'Module', component: 'DeDup', section: 'Body', status: 'built', notes: 'Just added' },
  { title: 'Deleted accounts in DeDup suggestions', description: 'Deleted/terminated accounts should not appear as DeDup candidates.', portal: 'PRODASHX', scope: 'Module', component: 'DeDup', section: 'Body', status: 'not_touched', notes: '' },
  { title: 'Platform switcher = toMachina gears logo', description: 'Platform switcher should use three horizontal gears.', portal: 'SHARED', scope: 'Platform', component: 'Sidebar', section: 'Header', status: 'not_touched', notes: 'Design change' },
  { title: 'Remove footer from platform switcher', description: 'Footer on platform switcher popup is unnecessary.', portal: 'SHARED', scope: 'Platform', component: 'Sidebar', section: 'Footer', status: 'not_touched', notes: '' },
  { title: 'Workspace → Workspaces', description: 'Rename sidebar section to Workspaces (plural).', portal: 'SHARED', scope: 'Platform', component: 'Sidebar', section: 'Nav', status: 'not_touched', notes: '' },
  { title: 'Sales Centers → Sales', description: 'Rename sidebar section to Sales.', portal: 'SHARED', scope: 'Platform', component: 'Sidebar', section: 'Nav', status: 'not_touched', notes: '' },
  { title: 'Service Centers → Service', description: 'Rename sidebar section to Service.', portal: 'SHARED', scope: 'Platform', component: 'Sidebar', section: 'Nav', status: 'not_touched', notes: '' },
  { title: 'Archive Sales Center modules', description: 'Medicare, Life, Annuity, Investments replaced. Archive from sidebar.', portal: 'PRODASHX', scope: 'Module', component: 'Sidebar', section: 'Nav', status: 'not_touched', notes: 'Business decision confirmed by JDM' },
  { title: 'Fixed bottom sections: Apps/Comms/Connect/Admin', description: 'Fixed sections at bottom of sidebar in every portal.', portal: 'SHARED', scope: 'Platform', component: 'Sidebar', section: 'Nav', status: 'not_touched', notes: 'Architectural change' },
  { title: 'Apps section collapsible (scrolls up)', description: 'Apps should scroll/unfold up when clicked. Collapsible.', portal: 'SHARED', scope: 'Platform', component: 'Sidebar', section: 'Nav', status: 'not_touched', notes: 'Architectural change' },
  { title: 'Comms/Connect = slider, Admin = section', description: 'Communication and Connect open slide-out panels, Admin opens section page.', portal: 'SHARED', scope: 'Platform', component: 'Sidebar', section: 'Nav', status: 'not_touched', notes: '' },
  { title: 'Header bar global search does not work', description: 'Global search bar in header does not function. Multi-sprint repeat.', portal: 'SHARED', scope: 'Platform', component: 'Header', section: 'Header', status: 'not_touched', notes: 'Multi-sprint repeat' },
  { title: 'Client Lookup does not work', description: 'Access Center client lookup is broken.', portal: 'PRODASHX', scope: 'Module', component: 'Access Center', section: 'Body', status: 'not_touched', notes: 'Multi-sprint repeat' },
  { title: 'Title: Access Center not Access', description: 'Page title should say Access Center.', portal: 'PRODASHX', scope: 'Module', component: 'Access Center', section: 'Header', status: 'not_touched', notes: '' },
  { title: 'Do not repeat title in section', description: 'When in module, do not show title again as section header.', portal: 'PRODASHX', scope: 'Module', component: 'Access Center', section: 'Header', status: 'not_touched', notes: 'Applies to all modules' },
  { title: 'OAuth integrations (AX-12/13)', description: 'Access Center needs real OAuth integrations.', portal: 'PRODASHX', scope: 'Module', component: 'Access Center', section: 'Body', status: 'not_touched', notes: 'Feature work' },
  { title: 'Medicare.gov → cms.gov display', description: 'Display mapping correctly shows cms.gov.', portal: 'PRODASHX', scope: 'Module', component: 'Access Center', section: 'Body', status: 'built', notes: 'Was already done' },
  { title: 'SSA.gov → ssa.gov display', description: 'Display mapping correctly shows ssa.gov.', portal: 'PRODASHX', scope: 'Module', component: 'Access Center', section: 'Body', status: 'built', notes: 'Was already done' },
  { title: 'IRS.gov + MasterCard added', description: 'IRS.gov and MasterCard added to maps.', portal: 'PRODASHX', scope: 'Module', component: 'Access Center', section: 'Body', status: 'built', notes: 'Was already done' },
  { title: 'Authorization field per API', description: 'PortalAccessTable has auth_status column.', portal: 'PRODASHX', scope: 'Module', component: 'Access Center', section: 'Body', status: 'built', notes: 'Was already done' },
  { title: 'Paste window opens but nothing happens', description: 'Quick Intake paste window has no data persistence.', portal: 'PRODASHX', scope: 'Module', component: 'Quick Intake', section: 'Body', status: 'not_touched', notes: 'Functionality broken' },
  { title: 'Upload attachment opens but nothing happens', description: 'Quick Intake upload has no file processing.', portal: 'PRODASHX', scope: 'Module', component: 'Quick Intake', section: 'Body', status: 'not_touched', notes: 'Functionality broken' },
  { title: 'Action buttons: standard pill styling', description: 'Send SMS/Email/Call buttons need standard pill styling.', portal: 'SHARED', scope: 'Module', component: 'Communications', section: 'Footer', status: 'not_touched', notes: '' },
  { title: 'Template management for SMS/email', description: 'Section to add/manage templates missing.', portal: 'SHARED', scope: 'Module', component: 'Communications', section: 'Body', status: 'not_touched', notes: '' },
  { title: 'Client lookup does not work', description: 'Client search within Communications does not function.', portal: 'SHARED', scope: 'Module', component: 'Communications', section: 'Body', status: 'not_touched', notes: '' },
  { title: 'Top-level nav: Log, Text, Email, Call', description: 'Communications should have four sections.', portal: 'SHARED', scope: 'Module', component: 'Communications', section: 'Nav', status: 'not_touched', notes: 'UI redesign' },
  { title: 'Log: filter by SMS/email/voice + all mine', description: 'Need filter by type in Log section.', portal: 'SHARED', scope: 'Module', component: 'Communications', section: 'Body', status: 'not_touched', notes: '' },
  { title: 'Filter pills too round, not tall enough', description: 'Filter pills do not match standard styling.', portal: 'SHARED', scope: 'Module', component: 'Communications', section: 'Filters', status: 'not_touched', notes: '' },
  { title: 'Keyboard number input for dial pad', description: 'Need keyboard typing for phone numbers.', portal: 'SHARED', scope: 'Module', component: 'Communications', section: 'Body', status: 'not_touched', notes: '' },
  { title: 'Search bar on content blocks', description: 'Search bar verification/fix needed.', portal: 'SHARED', scope: 'Module', component: 'Communications', section: 'Body', status: 'not_touched', notes: '' },
  { title: 'People: Google Workspace photos', description: 'Show Google Workspace profile photos.', portal: 'SHARED', scope: 'Module', component: 'RPI Connect', section: 'People', status: 'not_touched', notes: 'Need Google People API' },
  { title: 'People: remove title, email; official name', description: 'People entries: official full name only.', portal: 'SHARED', scope: 'Module', component: 'RPI Connect', section: 'People', status: 'not_touched', notes: '' },
  { title: 'Chat: pop-out slider, not new tab', description: 'Chat should open in slider panel.', portal: 'SHARED', scope: 'Module', component: 'RPI Connect', section: 'Channels', status: 'not_touched', notes: '' },
  { title: 'Channels: open in slider, not new tab', description: 'Channels should open in slider panel.', portal: 'SHARED', scope: 'Module', component: 'RPI Connect', section: 'Channels', status: 'not_touched', notes: '' },
  { title: 'New Channel button does not work', description: 'New Channel button does nothing.', portal: 'SHARED', scope: 'Module', component: 'RPI Connect', section: 'Channels', status: 'not_touched', notes: 'Broken' },
  { title: 'Meet tab is exquisite masterpiece', description: 'Meet tab UI confirmed excellent by JDM.', portal: 'SHARED', scope: 'Module', component: 'RPI Connect', section: 'Meet', status: 'confirmed', notes: 'JDM: absolutely a masterpiece' },
  { title: 'Audit Trail tab added (not requested)', description: 'Audit Trail tab was added but not requested by JDM.', portal: 'SHARED', scope: 'Module', component: 'Admin Panel', section: 'Tabs', status: 'built', notes: 'JDM: never asked for this' },
  { title: 'Team Config audit — understand cascade', description: 'How does permission cascade work?', portal: 'SHARED', scope: 'Module', component: 'Admin Panel', section: 'Team Config', status: 'not_touched', notes: '' },
  { title: 'Team Config — wired into RIIMO?', description: 'Does Team Config connect to RIIMO?', portal: 'SHARED', scope: 'Module', component: 'Admin Panel', section: 'Team Config', status: 'not_touched', notes: '' },
  { title: 'MyDropZone — nothing configured', description: 'MyDropZone has zero admin data.', portal: 'SHARED', scope: 'Module', component: 'Admin Panel', section: 'MyDropZone', status: 'not_touched', notes: 'Needs admin data' },
  { title: 'Meeting Config — nothing configured', description: 'Meeting Configuration has zero admin data.', portal: 'SHARED', scope: 'Module', component: 'Admin Panel', section: 'Meeting Config', status: 'not_touched', notes: 'Needs admin data' },
  { title: 'Incoming call ring/noise mechanism', description: 'No mechanism for ringing on incoming calls.', portal: 'INFRA', scope: 'Platform', component: 'Incoming Calls', section: 'Body', status: 'not_touched', notes: 'Twilio integration' },
  { title: 'Call center routing configuration', description: 'No call center routing config.', portal: 'INFRA', scope: 'Platform', component: 'Incoming Calls', section: 'Body', status: 'not_touched', notes: 'Twilio integration' },
  { title: 'Voicemail configuration', description: 'No voicemail setup.', portal: 'INFRA', scope: 'Platform', component: 'Incoming Calls', section: 'Body', status: 'not_touched', notes: 'Twilio integration' },
  { title: 'Phone call UX during active call', description: 'No UX for active call screen.', portal: 'INFRA', scope: 'Platform', component: 'Incoming Calls', section: 'Body', status: 'not_touched', notes: '' },
  { title: 'Shane Parmenter duplicate in users', description: 'shaneparmenter@gmail.com is stale artifact. Real record is shane@retireprotected.com.', portal: 'DATA', scope: 'Data', component: 'Firestore Users', section: 'Data', status: 'not_touched', notes: 'Awaiting approval' },
  { title: 'Steve Abernathey duplicate in clients', description: 'Two Active docs with identical data.', portal: 'DATA', scope: 'Data', component: 'Firestore Clients', section: 'Data', status: 'not_touched', notes: 'Awaiting approval' },
  { title: 'BoB values audit — CLEAN', description: '8 distinct book_of_business values. No issues.', portal: 'DATA', scope: 'Data', component: 'Firestore Clients', section: 'Data', status: 'confirmed', notes: 'Audited, clean' },
  { title: 'agent_name empty — investigate field', description: 'agent_name empty across all clients.', portal: 'DATA', scope: 'Data', component: 'Firestore Clients', section: 'Data', status: 'not_touched', notes: '' },
  { title: 'ACF links showing 0 — investigate field', description: 'acf_link field appears empty on all client docs.', portal: 'DATA', scope: 'Data', component: 'Firestore Clients', section: 'Data', status: 'not_touched', notes: '' },
  { title: 'access_items subcollection — document it', description: 'Understand access_items subcollection purpose.', portal: 'DATA', scope: 'Data', component: 'Firestore Clients', section: 'Data', status: 'not_touched', notes: '' },
  { title: 'Enrichment strategy', description: 'Need enrichment approach for client records.', portal: 'DATA', scope: 'Data', component: 'Platform', section: 'Data', status: 'deferred', notes: 'Decision needed from JDM' },
  { title: 'New Contact UX', description: 'Need proper new contact creation UX.', portal: 'PRODASHX', scope: 'Module', component: 'Contacts Grid', section: 'Body', status: 'deferred', notes: 'Decision needed from JDM' },
  { title: 'Client-level docs', description: 'Need client-level document storage approach.', portal: 'PRODASHX', scope: 'Module', component: 'Contact Detail', section: 'Docs', status: 'deferred', notes: 'Decision needed from JDM' },
]

async function seed() {
  // Delete existing tracker_items
  const existing = await db.collection('tracker_items').get()
  if (existing.docs.length > 0) {
    const deleteBatch = db.batch()
    existing.docs.forEach(doc => deleteBatch.delete(doc.ref))
    await deleteBatch.commit()
    console.log(`Deleted ${existing.docs.length} existing tracker items`)
  }

  // Write new items (94 items, fits in one batch of 500)
  const batch = db.batch()
  for (const [i, item] of SEED_ITEMS.entries()) {
    const itemId = `TRK-${String(i + 1).padStart(3, '0')}`
    const ref = db.collection('tracker_items').doc(itemId)
    batch.set(ref, {
      item_id: itemId,
      ...item,
      sprint_id: null,
      created_by: 'seed@retireprotected.com',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
  }
  await batch.commit()
  console.log(`Seeded ${SEED_ITEMS.length} tracker items`)
}

seed().catch(console.error)
