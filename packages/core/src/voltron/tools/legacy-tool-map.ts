// ─── VOLTRON Legacy Tool Map — TRK-13741 ────────────────────────────────────
// Maps ALL 82 hand-coded tools (57 TM API + 25 MCP Bridge) to VoltronRegistryEntry
// format. This is the migration bridge: existing tool definitions stay in their
// source files (tm-api-tools.ts, mcp-bridge.ts) while this map makes them
// visible to the VOLTRON registry.
//
// Metadata only — no implementation changes. Chat is unaffected.
//
// Entitlement mapping:
//   required_level 0 (OWNER)     → ADMIN
//   required_level 1 (EXECUTIVE) → VP
//   required_level 2 (LEADER)    → DIRECTOR
//   required_level 3 (USER)      → COORDINATOR
//
// MCP tools without required_level use OS-rules classification:
//   requires_approval: true       → SPECIALIST (approval-gated, no autonomous use)
//   requires_approval: false      → COORDINATOR (read-only safe)
// ─────────────────────────────────────────────────────────────────────────────

import type { VoltronRegistryEntry, VoltronToolSource, VoltronUserRole } from '../types'

// ─── Level-to-Role Mapping ──────────────────────────────────────────────────
// NOTE: All entry() calls below use string literals (e.g. 'COORDINATOR') instead
// of levelToRole() so the registry generator's regex parser can extract the role.
// Mapping: level 0 → ADMIN, 1 → VP, 2 → DIRECTOR, 3 → COORDINATOR

// ─── Helper: Build a registry entry ─────────────────────────────────────────

function entry(
  tool_id: string,
  description: string,
  source: VoltronToolSource,
  entitlement_min: VoltronUserRole,
  parameters: Record<string, unknown>,
  server_only: boolean,
): VoltronRegistryEntry {
  return {
    tool_id,
    name: tool_id,
    description,
    type: 'ATOMIC',
    source,
    entitlement_min,
    parameters,
    server_only,
    generated_at: '',  // Set at registry generation time
  }
}

// ─── TM API Tools (57) ─────────────────────────────────────────────────────
// Source: /home/jdm/mdj-server/src/tools/tm-api-tools.ts
// All are API_ROUTE source, all are server_only.

const TM_API_TOOLS: VoltronRegistryEntry[] = [
  // ── CLIENTS (7) ───────────────────────────────────────────────────────────
  entry('tm_clients_search', 'Search clients by last name prefix. Returns id, name, email, phone, status, account_count.', 'API_ROUTE', 'COORDINATOR', {
    type: 'object', properties: { q: { type: 'string', description: 'Search query (last name prefix, min 2 chars)' } }, required: ['q'],
  }, true),
  entry('tm_clients_list', 'List clients with optional status filter and pagination. Ordered by last name ascending.', 'API_ROUTE', 'COORDINATOR', {
    type: 'object', properties: { status: { type: 'string' }, q: { type: 'string' }, limit: { type: 'number' }, startAfter: { type: 'string' } },
  }, true),
  entry('tm_clients_get', 'Get a single client record by Firestore document ID. Returns full client data.', 'API_ROUTE', 'COORDINATOR', {
    type: 'object', properties: { id: { type: 'string', description: 'Client Firestore document ID' } }, required: ['id'],
  }, true),
  entry('tm_clients_get_accounts', 'Get all financial accounts for a client. Optionally filter by account type category.', 'API_ROUTE', 'COORDINATOR', {
    type: 'object', properties: { id: { type: 'string', description: 'Client Firestore document ID' }, type: { type: 'string' } }, required: ['id'],
  }, true),
  entry('tm_clients_get_activities', 'Get activity log for a client (notes, changes, events). Ordered newest first.', 'API_ROUTE', 'COORDINATOR', {
    type: 'object', properties: { id: { type: 'string', description: 'Client Firestore document ID' }, limit: { type: 'number' } }, required: ['id'],
  }, true),
  entry('tm_clients_create', 'Create a new client record. Requires first_name and last_name.', 'API_ROUTE', 'COORDINATOR', {
    type: 'object', properties: { first_name: { type: 'string' }, last_name: { type: 'string' }, email: { type: 'string' }, phone: { type: 'string' }, dob: { type: 'string' }, state: { type: 'string' }, zip: { type: 'string' }, status: { type: 'string' } }, required: ['first_name', 'last_name'],
  }, true),
  entry('tm_clients_update', 'Update an existing client record (partial update). Only provided fields are changed.', 'API_ROUTE', 'COORDINATOR', {
    type: 'object', properties: { id: { type: 'string' }, first_name: { type: 'string' }, last_name: { type: 'string' }, email: { type: 'string' }, phone: { type: 'string' }, dob: { type: 'string' }, state: { type: 'string' }, zip: { type: 'string' }, status: { type: 'string' } }, required: ['id'],
  }, true),

  // ── ACCOUNTS (4) ──────────────────────────────────────────────────────────
  entry('tm_accounts_list', 'List all financial accounts across all clients. Filter by type, status, or carrier name.', 'API_ROUTE', 'COORDINATOR', {
    type: 'object', properties: { type: { type: 'string' }, status: { type: 'string' }, q: { type: 'string' }, limit: { type: 'number' } },
  }, true),
  entry('tm_accounts_get', 'Get a single account record by client ID and account ID.', 'API_ROUTE', 'COORDINATOR', {
    type: 'object', properties: { clientId: { type: 'string' }, accountId: { type: 'string' } }, required: ['clientId', 'accountId'],
  }, true),
  entry('tm_accounts_create', 'Create a new financial account under a client. Requires account_type.', 'API_ROUTE', 'COORDINATOR', {
    type: 'object', properties: { clientId: { type: 'string' }, account_type: { type: 'string' }, account_type_category: { type: 'string' }, carrier_name: { type: 'string' }, policy_number: { type: 'string' }, status: { type: 'string' }, premium: { type: 'number' }, face_amount: { type: 'number' } }, required: ['clientId', 'account_type'],
  }, true),
  entry('tm_accounts_update', 'Update an existing account record (partial update).', 'API_ROUTE', 'COORDINATOR', {
    type: 'object', properties: { clientId: { type: 'string' }, accountId: { type: 'string' }, carrier_name: { type: 'string' }, policy_number: { type: 'string' }, status: { type: 'string' }, premium: { type: 'number' }, face_amount: { type: 'number' } }, required: ['clientId', 'accountId'],
  }, true),

  // ── HOUSEHOLDS (3) ────────────────────────────────────────────────────────
  entry('tm_households_list', 'List all households. Filter by status or assigned user.', 'API_ROUTE', 'COORDINATOR', {
    type: 'object', properties: { status: { type: 'string' }, assigned_user_id: { type: 'string' }, search: { type: 'string' }, limit: { type: 'number' } },
  }, true),
  entry('tm_households_get', 'Get a single household record with members list.', 'API_ROUTE', 'COORDINATOR', {
    type: 'object', properties: { id: { type: 'string', description: 'Household Firestore document ID' } }, required: ['id'],
  }, true),
  entry('tm_households_meeting_prep', 'Generate structured meeting prep data for a household — member inventory, financial aggregates, opportunities, action items.', 'API_ROUTE', 'COORDINATOR', {
    type: 'object', properties: { id: { type: 'string', description: 'Household Firestore document ID' } }, required: ['id'],
  }, true),

  // ── SEARCH (1) ────────────────────────────────────────────────────────────
  entry('tm_search_global', 'Global search across clients, accounts, households, and producers.', 'API_ROUTE', 'COORDINATOR', {
    type: 'object', properties: { q: { type: 'string', description: 'Search query' }, scope: { type: 'string' }, limit: { type: 'number' } }, required: ['q'],
  }, true),

  // ── PIPELINES (2) ─────────────────────────────────────────────────────────
  entry('tm_pipelines_list', 'List all pipelines (sales, onboarding, service).', 'API_ROUTE', 'COORDINATOR', {
    type: 'object', properties: { status: { type: 'string' }, limit: { type: 'number' } },
  }, true),
  entry('tm_pipelines_get', 'Get a single pipeline by ID with stage details.', 'API_ROUTE', 'COORDINATOR', {
    type: 'object', properties: { id: { type: 'string', description: 'Pipeline Firestore document ID' } }, required: ['id'],
  }, true),

  // ── FLOW ENGINE (8) ───────────────────────────────────────────────────────
  entry('tm_flow_my_active', 'Get active flow instances for the current user.', 'API_ROUTE', 'COORDINATOR', {
    type: 'object', properties: { status: { type: 'string' }, limit: { type: 'number' } },
  }, true),
  entry('tm_flow_pipelines_list', 'List all flow pipeline definitions.', 'API_ROUTE', 'COORDINATOR', {
    type: 'object', properties: {},
  }, true),
  entry('tm_flow_pipeline_get', 'Get a flow pipeline definition by key.', 'API_ROUTE', 'COORDINATOR', {
    type: 'object', properties: { key: { type: 'string', description: 'Pipeline key' } }, required: ['key'],
  }, true),
  entry('tm_flow_pipeline_stages', 'Get stages for a flow pipeline.', 'API_ROUTE', 'COORDINATOR', {
    type: 'object', properties: { key: { type: 'string', description: 'Pipeline key' } }, required: ['key'],
  }, true),
  entry('tm_flow_instances_list', 'List all flow instances with optional filters.', 'API_ROUTE', 'COORDINATOR', {
    type: 'object', properties: { pipeline_key: { type: 'string' }, status: { type: 'string' }, limit: { type: 'number' } },
  }, true),
  entry('tm_flow_instance_get', 'Get a single flow instance by ID.', 'API_ROUTE', 'COORDINATOR', {
    type: 'object', properties: { id: { type: 'string', description: 'Instance Firestore document ID' } }, required: ['id'],
  }, true),
  entry('tm_flow_instance_create', 'Create a new flow pipeline instance. Triggers downstream automations.', 'API_ROUTE', 'COORDINATOR', {
    type: 'object', properties: { pipeline_key: { type: 'string' }, entity_id: { type: 'string' }, entity_type: { type: 'string' }, entity_name: { type: 'string' } }, required: ['pipeline_key', 'entity_id', 'entity_type'],
  }, true),
  entry('tm_flow_instance_update', 'Update a flow instance (advance stage, update status).', 'API_ROUTE', 'COORDINATOR', {
    type: 'object', properties: { id: { type: 'string' }, stage_key: { type: 'string' }, status: { type: 'string' } }, required: ['id'],
  }, true),
  entry('tm_flow_task_update', 'Update a flow task (complete, reassign, add notes).', 'API_ROUTE', 'COORDINATOR', {
    type: 'object', properties: { id: { type: 'string' }, status: { type: 'string' }, assigned_to: { type: 'string' }, notes: { type: 'string' } }, required: ['id'],
  }, true),

  // ── COMMUNICATIONS (5) ────────────────────────────────────────────────────
  entry('tm_communications_list', 'List communication records with optional filters.', 'API_ROUTE', 'COORDINATOR', {
    type: 'object', properties: { client_id: { type: 'string' }, type: { type: 'string' }, limit: { type: 'number' } },
  }, true),
  entry('tm_communications_get', 'Get a single communication record by ID.', 'API_ROUTE', 'COORDINATOR', {
    type: 'object', properties: { id: { type: 'string', description: 'Communication Firestore document ID' } }, required: ['id'],
  }, true),
  entry('tm_comms_send_email', 'Send an email via the TM API comms service. Requires approval.', 'API_ROUTE', 'COORDINATOR', {
    type: 'object', properties: { to: { type: 'string' }, subject: { type: 'string' }, body: { type: 'string' }, client_id: { type: 'string' } }, required: ['to', 'subject', 'body'],
  }, true),
  entry('tm_comms_send_sms', 'Send an SMS via the TM API comms service. Requires approval.', 'API_ROUTE', 'COORDINATOR', {
    type: 'object', properties: { to: { type: 'string' }, message: { type: 'string' }, client_id: { type: 'string' } }, required: ['to', 'message'],
  }, true),
  entry('tm_comms_send_voice', 'Initiate an outbound voice call via TM API. Requires approval.', 'API_ROUTE', 'COORDINATOR', {
    type: 'object', properties: { to: { type: 'string' }, client_id: { type: 'string' }, script: { type: 'string' } }, required: ['to'],
  }, true),
  entry('tm_comms_log_call', 'Log a completed call (no outbound dial). Internal record only.', 'API_ROUTE', 'COORDINATOR', {
    type: 'object', properties: { client_id: { type: 'string' }, direction: { type: 'string' }, duration: { type: 'number' }, notes: { type: 'string' } }, required: ['client_id'],
  }, true),
  entry('tm_comms_status', 'Check delivery status of a sent communication by SID.', 'API_ROUTE', 'COORDINATOR', {
    type: 'object', properties: { sid: { type: 'string', description: 'Communication SID' } }, required: ['sid'],
  }, true),

  // ── QUE (5) ───────────────────────────────────────────────────────────────
  entry('tm_que_sessions_list', 'List QUE quoting sessions with optional filters.', 'API_ROUTE', 'COORDINATOR', {
    type: 'object', properties: { client_id: { type: 'string' }, status: { type: 'string' }, limit: { type: 'number' } },
  }, true),
  entry('tm_que_session_create', 'Create a new QUE quoting session (draft — no external action).', 'API_ROUTE', 'COORDINATOR', {
    type: 'object', properties: { client_id: { type: 'string' }, session_type: { type: 'string' } }, required: ['client_id'],
  }, true),
  entry('tm_que_session_get', 'Get a single QUE session by ID with all quotes.', 'API_ROUTE', 'COORDINATOR', {
    type: 'object', properties: { sessionId: { type: 'string', description: 'QUE session ID' } }, required: ['sessionId'],
  }, true),
  entry('tm_que_quote_add', 'Add a quote to a draft QUE session (no send, no client mutation).', 'API_ROUTE', 'COORDINATOR', {
    type: 'object', properties: { sessionId: { type: 'string' }, carrier_name: { type: 'string' }, product_name: { type: 'string' }, premium: { type: 'number' }, benefits: { type: 'object' } }, required: ['sessionId', 'carrier_name', 'product_name'],
  }, true),
  entry('tm_que_session_update', 'Update status/fields on a QUE session — internal only.', 'API_ROUTE', 'COORDINATOR', {
    type: 'object', properties: { sessionId: { type: 'string' }, status: { type: 'string' }, notes: { type: 'string' } }, required: ['sessionId'],
  }, true),

  // ── REVENUE (3) ───────────────────────────────────────────────────────────
  entry('tm_revenue_list', 'List revenue records. Leader+ access (required_level 2).', 'API_ROUTE', 'DIRECTOR', {
    type: 'object', properties: { agent_id: { type: 'string' }, period: { type: 'string' }, limit: { type: 'number' } },
  }, true),
  entry('tm_revenue_get', 'Get a single revenue record by ID. Leader+ access.', 'API_ROUTE', 'DIRECTOR', {
    type: 'object', properties: { id: { type: 'string', description: 'Revenue record ID' } }, required: ['id'],
  }, true),
  entry('tm_revenue_summary_by_agent', 'Get revenue summary grouped by agent. Leader+ access.', 'API_ROUTE', 'DIRECTOR', {
    type: 'object', properties: { period: { type: 'string' }, team_id: { type: 'string' } },
  }, true),

  // ── PRODUCERS (2) ─────────────────────────────────────────────────────────
  entry('tm_producers_list', 'List all producers/agents. Leader+ access.', 'API_ROUTE', 'DIRECTOR', {
    type: 'object', properties: { status: { type: 'string' }, team_id: { type: 'string' }, limit: { type: 'number' } },
  }, true),
  entry('tm_producers_get', 'Get a single producer/agent record by ID. Leader+ access.', 'API_ROUTE', 'DIRECTOR', {
    type: 'object', properties: { id: { type: 'string', description: 'Producer Firestore document ID' } }, required: ['id'],
  }, true),

  // ── ATLAS (4) ─────────────────────────────────────────────────────────────
  entry('tm_atlas_sources_list', 'List ATLAS data sources. Executive+ access.', 'API_ROUTE', 'VP', {
    type: 'object', properties: {},
  }, true),
  entry('tm_atlas_tools_list', 'List ATLAS tools and their status. Executive+ access.', 'API_ROUTE', 'VP', {
    type: 'object', properties: {},
  }, true),
  entry('tm_atlas_wires_list', 'List ATLAS wire definitions and execution history. Executive+ access.', 'API_ROUTE', 'VP', {
    type: 'object', properties: {},
  }, true),
  entry('tm_atlas_health', 'Get ATLAS system health status. Executive+ access.', 'API_ROUTE', 'VP', {
    type: 'object', properties: {},
  }, true),

  // ── NOTIFICATIONS (3) ─────────────────────────────────────────────────────
  entry('tm_notifications_list', 'List notifications for the current user.', 'API_ROUTE', 'COORDINATOR', {
    type: 'object', properties: { status: { type: 'string' }, limit: { type: 'number' } },
  }, true),
  entry('tm_notifications_mark_read', 'Mark a single notification as read.', 'API_ROUTE', 'COORDINATOR', {
    type: 'object', properties: { id: { type: 'string', description: 'Notification ID' } }, required: ['id'],
  }, true),
  entry('tm_notifications_read_all', 'Mark all notifications as read for the current user.', 'API_ROUTE', 'COORDINATOR', {
    type: 'object', properties: {},
  }, true),

  // ── SPRINTS (3) ───────────────────────────────────────────────────────────
  entry('tm_sprints_list', 'List all FORGE sprints.', 'API_ROUTE', 'COORDINATOR', {
    type: 'object', properties: { status: { type: 'string' }, limit: { type: 'number' } },
  }, true),
  entry('tm_sprints_get', 'Get a single sprint by ID.', 'API_ROUTE', 'COORDINATOR', {
    type: 'object', properties: { id: { type: 'string', description: 'Sprint ID' } }, required: ['id'],
  }, true),
  entry('tm_sprints_create', 'Create a new FORGE sprint. No downstream automation.', 'API_ROUTE', 'COORDINATOR', {
    type: 'object', properties: { name: { type: 'string' }, description: { type: 'string' }, target_date: { type: 'string' } }, required: ['name'],
  }, true),

  // ── TRACKER (4) ───────────────────────────────────────────────────────────
  entry('tm_tracker_list', 'List all tracker tickets with optional filters.', 'API_ROUTE', 'COORDINATOR', {
    type: 'object', properties: { sprint_id: { type: 'string' }, status: { type: 'string' }, assigned_to: { type: 'string' }, limit: { type: 'number' } },
  }, true),
  entry('tm_tracker_get', 'Get a single tracker ticket by ID.', 'API_ROUTE', 'COORDINATOR', {
    type: 'object', properties: { id: { type: 'string', description: 'Tracker ticket ID' } }, required: ['id'],
  }, true),
  entry('tm_tracker_create', 'Create a new tracker ticket. No downstream automation.', 'API_ROUTE', 'COORDINATOR', {
    type: 'object', properties: { title: { type: 'string' }, description: { type: 'string' }, sprint_id: { type: 'string' }, assigned_to: { type: 'string' }, priority: { type: 'string' } }, required: ['title'],
  }, true),
  entry('tm_tracker_update', 'Update a tracker ticket (status, assignment, fields).', 'API_ROUTE', 'COORDINATOR', {
    type: 'object', properties: { id: { type: 'string' }, title: { type: 'string' }, status: { type: 'string' }, assigned_to: { type: 'string' }, priority: { type: 'string' }, notes: { type: 'string' } }, required: ['id'],
  }, true),
]

// ─── MCP Bridge Tools (25) ──────────────────────────────────────────────────
// Source: /home/jdm/mdj-server/src/tools/mcp-bridge.ts
// All are MCP source, all are server_only.

const MCP_BRIDGE_TOOLS: VoltronRegistryEntry[] = [
  // ── GMAIL (3) ─────────────────────────────────────────────────────────────
  entry('mcp_gmail_send_email', 'Send an email via Gmail. Use for any outbound email from JDM or RPI.', 'MCP', 'SPECIALIST', {
    type: 'object', properties: { to: { type: 'string' }, subject: { type: 'string' }, body: { type: 'string' }, cc: { type: 'string' } }, required: ['to', 'subject', 'body'],
  }, true),
  entry('mcp_gmail_search_emails', 'Search emails in Gmail using Gmail query syntax.', 'MCP', 'COORDINATOR', {
    type: 'object', properties: { query: { type: 'string' }, max_results: { type: 'number' } }, required: ['query'],
  }, true),
  entry('mcp_gmail_read_email', 'Read the full content of a specific email by message ID.', 'MCP', 'COORDINATOR', {
    type: 'object', properties: { message_id: { type: 'string' } }, required: ['message_id'],
  }, true),

  // ── SLACK (3) ─────────────────────────────────────────────────────────────
  entry('mcp_slack_post_message', 'Post a message to a Slack channel or DM a user. Requires approval.', 'MCP', 'SPECIALIST', {
    type: 'object', properties: { channel: { type: 'string' }, text: { type: 'string' }, thread_ts: { type: 'string' } }, required: ['channel', 'text'],
  }, true),
  entry('mcp_slack_get_channel_history', 'Retrieve recent messages from a Slack channel.', 'MCP', 'COORDINATOR', {
    type: 'object', properties: { channel_id: { type: 'string' }, limit: { type: 'number' } }, required: ['channel_id'],
  }, true),
  entry('mcp_slack_search_public', 'Search public Slack messages and channels by keyword.', 'MCP', 'COORDINATOR', {
    type: 'object', properties: { query: { type: 'string' }, count: { type: 'number' } }, required: ['query'],
  }, true),

  // ── GOOGLE DRIVE (4) ──────────────────────────────────────────────────────
  entry('mcp_gdrive_search', 'Search for files and folders in Google Drive by name or content.', 'MCP', 'COORDINATOR', {
    type: 'object', properties: { query: { type: 'string' }, page_size: { type: 'number' } }, required: ['query'],
  }, true),
  entry('mcp_gdrive_list_folder', 'List the contents of a Google Drive folder by folder ID.', 'MCP', 'COORDINATOR', {
    type: 'object', properties: { folder_id: { type: 'string' }, page_size: { type: 'number' } }, required: ['folder_id'],
  }, true),
  entry('mcp_gdrive_get_sheet_content', 'Read the content of a Google Sheet by file ID.', 'MCP', 'COORDINATOR', {
    type: 'object', properties: { spreadsheet_id: { type: 'string' }, range: { type: 'string' } }, required: ['spreadsheet_id'],
  }, true),
  entry('mcp_gdrive_create_doc', 'Create a new Google Doc in Drive with given title and content.', 'MCP', 'COORDINATOR', {
    type: 'object', properties: { title: { type: 'string' }, content: { type: 'string' }, folder_id: { type: 'string' } }, required: ['title', 'content'],
  }, true),

  // ── GOOGLE CALENDAR (3) ───────────────────────────────────────────────────
  entry('mcp_calendar_list_events', 'List upcoming calendar events within a time range.', 'MCP', 'COORDINATOR', {
    type: 'object', properties: { calendar_id: { type: 'string' }, time_min: { type: 'string' }, time_max: { type: 'string' }, max_results: { type: 'number' } }, required: ['calendar_id'],
  }, true),
  entry('mcp_calendar_create_event', 'Create a new calendar event. Requires approval.', 'MCP', 'SPECIALIST', {
    type: 'object', properties: { calendar_id: { type: 'string' }, summary: { type: 'string' }, start: { type: 'string' }, end: { type: 'string' }, description: { type: 'string' }, attendees: { type: 'string' }, location: { type: 'string' } }, required: ['calendar_id', 'summary', 'start', 'end'],
  }, true),
  entry('mcp_calendar_search_events', 'Search calendar events by keyword across all calendars.', 'MCP', 'COORDINATOR', {
    type: 'object', properties: { query: { type: 'string' }, time_min: { type: 'string' }, max_results: { type: 'number' } }, required: ['query'],
  }, true),

  // ── RPI-WORKSPACE (3) ─────────────────────────────────────────────────────
  entry('mcp_workspace_execute_script', 'Execute a Google Apps Script function on a GAS project.', 'MCP', 'COORDINATOR', {
    type: 'object', properties: { script_id: { type: 'string' }, function_name: { type: 'string' }, parameters: { type: 'array' } }, required: ['script_id', 'function_name'],
  }, true),
  entry('mcp_workspace_meet_get_transcript', 'Retrieve the transcript from a Google Meet recording.', 'MCP', 'COORDINATOR', {
    type: 'object', properties: { meeting_id: { type: 'string' } }, required: ['meeting_id'],
  }, true),
  entry('mcp_workspace_send_message', 'Send a Google Chat message to a space or user. Requires approval.', 'MCP', 'SPECIALIST', {
    type: 'object', properties: { space_name: { type: 'string' }, text: { type: 'string' } }, required: ['space_name', 'text'],
  }, true),

  // ── RPI-BUSINESS (3) ──────────────────────────────────────────────────────
  entry('mcp_business_calculate_commission', 'Calculate commission for an agent on a policy sale.', 'MCP', 'COORDINATOR', {
    type: 'object', properties: { agent_id: { type: 'string' }, carrier: { type: 'string' }, product_type: { type: 'string' }, premium: { type: 'number' }, state: { type: 'string' } }, required: ['agent_id', 'carrier', 'product_type', 'premium'],
  }, true),
  entry('mcp_business_analyze_transcript', 'Analyze a meeting transcript for action items, insights, and follow-ups.', 'MCP', 'COORDINATOR', {
    type: 'object', properties: { transcript: { type: 'string' }, context: { type: 'string' } }, required: ['transcript'],
  }, true),
  entry('mcp_business_get_person', 'Look up a person (client, agent, or team member) in the RPI database.', 'MCP', 'COORDINATOR', {
    type: 'object', properties: { identifier: { type: 'string' }, type: { type: 'string' } }, required: ['identifier'],
  }, true),

  // ── RPI-HEALTHCARE (3) ────────────────────────────────────────────────────
  entry('mcp_healthcare_lookup_npi', 'Look up a healthcare provider by NPI number or name in the NPPES registry.', 'MCP', 'COORDINATOR', {
    type: 'object', properties: { npi: { type: 'string' }, name: { type: 'string' }, state: { type: 'string' } },
  }, true),
  entry('mcp_healthcare_search_codes', 'Search ICD-10 diagnosis or procedure codes by description or code prefix.', 'MCP', 'COORDINATOR', {
    type: 'object', properties: { query: { type: 'string' }, code_type: { type: 'string' } }, required: ['query'],
  }, true),
  entry('mcp_healthcare_search_plans', 'Search Medicare Advantage / Part D plans available in a specific county.', 'MCP', 'COORDINATOR', {
    type: 'object', properties: { county_fips: { type: 'string' }, plan_year: { type: 'number' }, plan_type: { type: 'string' } }, required: ['county_fips'],
  }, true),

  // ── RPI-COMMS (3) ─────────────────────────────────────────────────────────
  entry('mcp_comms_send_sms', 'Send an SMS message via RPI comms service. Requires approval.', 'MCP', 'SPECIALIST', {
    type: 'object', properties: { to: { type: 'string' }, message: { type: 'string' }, from: { type: 'string' } }, required: ['to', 'message'],
  }, true),
  entry('mcp_comms_send_email', 'Send a transactional email via the RPI comms service. Requires approval.', 'MCP', 'SPECIALIST', {
    type: 'object', properties: { to: { type: 'string' }, subject: { type: 'string' }, body: { type: 'string' }, template: { type: 'string' } }, required: ['to', 'subject', 'body'],
  }, true),
  entry('mcp_comms_initiate_call', 'Initiate an outbound call via the RPI comms service. Requires approval.', 'MCP', 'SPECIALIST', {
    type: 'object', properties: { to: { type: 'string' }, from: { type: 'string' }, script: { type: 'string' } }, required: ['to'],
  }, true),
]

// ─── Combined Registry ──────────────────────────────────────────────────────

/**
 * All 82 legacy hand-coded tools mapped to VoltronRegistryEntry format.
 * Used by the registry generator to include these in voltron_registry.
 *
 * Counts: 57 TM API + 25 MCP Bridge = 82 total.
 */
export const LEGACY_TOOL_MAP: VoltronRegistryEntry[] = [
  ...TM_API_TOOLS,
  ...MCP_BRIDGE_TOOLS,
]

/**
 * Get a legacy tool entry by tool_id.
 */
export function getLegacyToolById(toolId: string): VoltronRegistryEntry | undefined {
  return LEGACY_TOOL_MAP.find((t) => t.tool_id === toolId)
}

/**
 * Get all legacy tools filtered by source.
 */
export function getLegacyToolsBySource(source: VoltronToolSource): VoltronRegistryEntry[] {
  return LEGACY_TOOL_MAP.filter((t) => t.source === source)
}

/**
 * Get all legacy tool IDs as a Set (for fast membership checks).
 */
export function getLegacyToolIds(): Set<string> {
  return new Set(LEGACY_TOOL_MAP.map((t) => t.tool_id))
}

/**
 * Validate that all legacy tool IDs are unique. Returns duplicates if any.
 */
export function validateLegacyToolMap(): { valid: boolean; duplicates: string[] } {
  const seen = new Set<string>()
  const duplicates: string[] = []
  for (const tool of LEGACY_TOOL_MAP) {
    if (seen.has(tool.tool_id)) {
      duplicates.push(tool.tool_id)
    }
    seen.add(tool.tool_id)
  }
  return { valid: duplicates.length === 0, duplicates }
}
