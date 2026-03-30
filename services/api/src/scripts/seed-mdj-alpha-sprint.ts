import { initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

if (getApps().length === 0) {
  initializeApp({ projectId: 'claude-mcp-484718' })
}
const db = getFirestore()

const DISCOVERY_URL = 'https://retirementprotectors.github.io/toMachina/mdj-discovery.html'

const SPRINT = {
  name: 'MDJ-ALPHA — MyDigitalJosh v1.0',
  description:
    'AI-powered conversational assistant wired into the entire toMachina platform. Gives every team member Josh-level capability, 24/7, simultaneously. Portal widget + MDJ1 agent service + 250+ tools + specialist routing + memory system.',
  discovery_url: DISCOVERY_URL,
  plan_link: null,
}

const ITEMS = [
  // --- Phase 1: Foundation ---
  {
    title: 'Firestore collections + rules',
    description:
      'Create mdj_conversations, mdj_client_insights, mdj_specialist_configs, mdj_user_preferences collections. Add Firestore security rules. Seed initial specialist configs (6 specialists).',
    portal: 'INFRA',
    scope: 'Data',
    component: 'MyDigitalJosh',
    section: 'Phase 1: Foundation',
    type: 'idea',
  },
  {
    title: 'MDJ Agent Service scaffold',
    description:
      'Node.js Express server on MDJ1 (port 4200). Health endpoint. Anthropic SDK integration with streaming. systemd service file for auto-restart. Basic Claude API call with system prompt + message → SSE stream response.',
    portal: 'INFRA',
    scope: 'Platform',
    component: 'MyDigitalJosh',
    section: 'Phase 1: Foundation',
    type: 'idea',
  },
  {
    title: 'Cloud Run /api/mdj/* routes — wire to MDJ1',
    description:
      'Update existing mdj.ts route to proxy requests to MDJ1 agent service instead of returning placeholder responses. SSE passthrough from MDJ1 → Cloud Run → portal. Conversation CRUD endpoints (list, get, archive). Mount auth + rbac middleware.',
    portal: 'SHARED',
    scope: 'Platform',
    component: 'MyDigitalJosh',
    section: 'Phase 1: Foundation',
    type: 'idea',
  },
  {
    title: 'MDJPanel widget component',
    description:
      'packages/ui/src/modules/MDJPanel/. Chat UI matching existing slide-out panel pattern (CommsModule reference). Components: index.tsx, ChatThread.tsx, ChatInput.tsx, MessageBubble.tsx. SSE streaming via useMDJStream.ts hook. Responsive widths (w-screen → lg:w-[360px] → min-[1400px]:w-[460px]).',
    portal: 'SHARED',
    scope: 'Module',
    component: 'MyDigitalJosh',
    section: 'Phase 1: Foundation',
    type: 'idea',
  },
  {
    title: 'Portal layout integration',
    description:
      'Add MDJ button to all 3 portal sidebars (action bar, smart_toy icon). Add MDJPanel to all 3 portal layouts (prodash, riimo, sentinel) with mutual-exclusion state. Close other panels when MDJ opens. Export from packages/ui/src/modules/index.ts.',
    portal: 'SHARED',
    scope: 'Module',
    component: 'MyDigitalJosh',
    section: 'Phase 1: Foundation',
    type: 'idea',
  },

  // --- Phase 2: Tools + Permissions ---
  {
    title: 'TM API tool registry',
    description:
      'Define Claude tool definitions for all 57 API route files on the MDJ1 agent service. Each tool: name, description, input_schema, method, path, required_level. Organized by domain (clients, accounts, pipelines, comms, que, atlas, etc.).',
    portal: 'INFRA',
    scope: 'Platform',
    component: 'MyDigitalJosh',
    section: 'Phase 2: Tools + Permissions',
    type: 'idea',
  },
  {
    title: 'MCP bridge',
    description:
      'Connect mdj-server to 8 MCP servers running on MDJ1 (rpi-workspace, rpi-business, rpi-healthcare, rpi-comms, slack, gdrive, google-calendar, gmail). Wrap each MCP tool as a Claude tool definition with mcp_ prefix. 198 tools total.',
    portal: 'INFRA',
    scope: 'Platform',
    component: 'MyDigitalJosh',
    section: 'Phase 2: Tools + Permissions',
    type: 'idea',
  },
  {
    title: 'Permission-scoped tool filtering',
    description:
      'Filter tools by user level (0-3) + module_permissions before each Claude API call. OWNER sees all tools. USER sees read-only + assigned module tools. Tool definitions include required_level and module_key fields. User context forwarded from Cloud Run includes level + permissions.',
    portal: 'INFRA',
    scope: 'Platform',
    component: 'MyDigitalJosh',
    section: 'Phase 2: Tools + Permissions',
    type: 'idea',
  },
  {
    title: 'Review gates',
    description:
      'Implement requires_approval flow on tool execution. When a gated tool is called: pause execution, emit SSE approval_required event with tool name + input preview, wait for user approve/reject. Approve/reject endpoints on Cloud Run. ToolCallCard UI component shows pending state with approve/reject buttons.',
    portal: 'SHARED',
    scope: 'Module',
    component: 'MyDigitalJosh',
    section: 'Phase 2: Tools + Permissions',
    type: 'idea',
  },
  {
    title: 'Tool execution display',
    description:
      'ToolCallCard.tsx component rendered inline in ChatThread. Shows: tool name, input parameters (collapsed by default), execution status (pending/running/completed/failed), result summary. Approve/reject buttons for gated tools. Expandable detail view.',
    portal: 'SHARED',
    scope: 'Module',
    component: 'MyDigitalJosh',
    section: 'Phase 2: Tools + Permissions',
    type: 'idea',
  },

  // --- Phase 3: Specialists + Memory ---
  {
    title: 'Specialist routing engine',
    description:
      'Two-step routing: 1) Keyword match against routing_keywords from mdj_specialist_configs. 2) If no strong match, Claude classification tool (Sonnet, fast/cheap) recommends specialist. System prompt swapped on specialist activation. SpecialistBadge.tsx shows active specialist in MDJPanel header. User can manually switch back.',
    portal: 'INFRA',
    scope: 'Platform',
    component: 'MyDigitalJosh',
    section: 'Phase 3: Specialists + Memory',
    type: 'idea',
  },
  {
    title: 'Seed specialist prompts',
    description:
      'Write system prompts for all 6 specialists: General MDJ, MDJ-Medicare, MDJ-Securities, MDJ-Service, MDJ-DAVID, MDJ-Ops. Each includes: domain expertise instructions, RPI-specific terminology, available tool descriptions, PHI handling rules, user permission context injection. Seed to mdj_specialist_configs collection.',
    portal: 'INFRA',
    scope: 'Data',
    component: 'MyDigitalJosh',
    section: 'Phase 3: Specialists + Memory',
    type: 'idea',
  },
  {
    title: 'Conversation persistence',
    description:
      'Save messages to Firestore mdj_conversations/{id}/messages subcollection on every send/receive. Load conversation history on panel open via useCollection onSnapshot. ConversationList.tsx drawer component shows past conversations with title + timestamp + specialist badge. Archive conversations on delete.',
    portal: 'SHARED',
    scope: 'Module',
    component: 'MyDigitalJosh',
    section: 'Phase 3: Specialists + Memory',
    type: 'idea',
  },
  {
    title: 'Memory extraction pipeline',
    description:
      'Post-conversation (or every 10 messages): run extraction prompt asking Claude to identify new client insights from the conversation. Store structured insights in mdj_client_insights/{client_id}. When a conversation references a client (via page context or explicit mention), load their insights into the system prompt.',
    portal: 'INFRA',
    scope: 'Platform',
    component: 'MyDigitalJosh',
    section: 'Phase 3: Specialists + Memory',
    type: 'idea',
  },
  {
    title: 'Page context awareness',
    description:
      'MDJPanel captures current page context: client_id from /contacts/[id] routes, account_id from account pages, pipeline_key from /pipelines/[key] routes, always captures window.location.pathname. Context sent with every message and included in system prompt so MDJ knows what the user is looking at.',
    portal: 'SHARED',
    scope: 'Module',
    component: 'MyDigitalJosh',
    section: 'Phase 3: Specialists + Memory',
    type: 'idea',
  },

  // --- Phase 4: Production ---
  {
    title: 'MDJ1 production hardening',
    description:
      'Cloudflare Tunnel setup (expose port 4200 securely to Cloud Run). Health monitoring endpoint with uptime, memory usage, active conversations, MCP server status. Auto-restart via systemd. Rate limiting per user. Request logging. Error alerting to Slack.',
    portal: 'INFRA',
    scope: 'Platform',
    component: 'MyDigitalJosh',
    section: 'Phase 4: Production',
    type: 'idea',
  },
  {
    title: 'Long context management',
    description:
      'When conversation exceeds ~80K token budget: generate AI summary of older messages, replace them with summary in context. Store summary on mdj_conversations doc. When starting new conversation, include last 3 conversation summaries as context for continuity.',
    portal: 'INFRA',
    scope: 'Platform',
    component: 'MyDigitalJosh',
    section: 'Phase 4: Production',
    type: 'idea',
  },
  {
    title: 'User preferences',
    description:
      'Settings within MDJ panel: auto_approve_tools (tools user pre-approves, skip review gate), show_tool_details (toggle tool execution cards), default_specialist (prefer a specialist by default), conversation_retention_days. Store in mdj_user_preferences/{email} Firestore collection.',
    portal: 'SHARED',
    scope: 'Module',
    component: 'MyDigitalJosh',
    section: 'Phase 4: Production',
    type: 'idea',
  },
  {
    title: 'E2E testing',
    description:
      'Playwright: MDJ panel open/close, send message, see streamed response, tool card renders, specialist badge appears. Vitest: POST /api/mdj/chat returns SSE stream, conversation CRUD, approve/reject endpoints. Add to CI pipeline.',
    portal: 'SHARED',
    scope: 'Platform',
    component: 'MyDigitalJosh',
    section: 'Phase 4: Production',
    type: 'idea',
  },
  {
    title: 'MDJ Admin Dashboard',
    description:
      'RIIMO admin view (EXECUTIVE+ only): conversation analytics (count, avg length, tool usage), specialist routing stats (which specialists used most), error rates, active conversations, token usage tracking. Reads from mdj_conversations + wire_executions.',
    portal: 'RIIMO',
    scope: 'Module',
    component: 'MyDigitalJosh',
    section: 'Phase 4: Production',
    type: 'idea',
  },
]

async function seed() {
  console.log('Seeding MDJ-ALPHA sprint...')

  // Find the next available TRK number
  const lastItem = await db
    .collection('tracker_items')
    .orderBy('item_id', 'desc')
    .limit(1)
    .get()

  let nextNum = 1
  if (!lastItem.empty) {
    const lastId = lastItem.docs[0].data().item_id as string
    const match = lastId.match(/TRK-(\d+)/)
    if (match) nextNum = parseInt(match[1], 10) + 1
  }

  console.log(`Starting from TRK-${String(nextNum).padStart(3, '0')}`)

  const batch = db.batch()
  const now = new Date().toISOString()

  // Create sprint
  const sprintRef = db.collection('sprints').doc()
  const itemIds: string[] = []

  for (let i = 0; i < ITEMS.length; i++) {
    const itemId = `TRK-${String(nextNum + i).padStart(3, '0')}`
    itemIds.push(itemId)
  }

  batch.set(sprintRef, {
    ...SPRINT,
    item_ids: itemIds,
    status: 'active',
    phase: 'discovery',
    created_by: 'josh@retireprotected.com',
    created_at: now,
    updated_at: now,
  })

  console.log(`Sprint: ${SPRINT.name} (${sprintRef.id})`)
  console.log(`Discovery: ${DISCOVERY_URL}`)

  // Create tracker items
  for (let i = 0; i < ITEMS.length; i++) {
    const item = ITEMS[i]
    const itemId = itemIds[i]
    const itemRef = db.collection('tracker_items').doc(itemId)

    batch.set(itemRef, {
      item_id: itemId,
      title: item.title,
      description: item.description,
      status: 'planned',
      type: item.type,
      portal: item.portal,
      scope: item.scope,
      component: item.component,
      section: item.section,
      sprint_id: sprintRef.id,
      notes: '',
      attachments: [],
      discovery_url: DISCOVERY_URL,
      created_by: 'josh@retireprotected.com',
      created_at: now,
      updated_at: now,
    })

    console.log(`  ${itemId}: ${item.title}`)
  }

  await batch.commit()
  console.log(`\nDone! Created 1 sprint + ${ITEMS.length} tracker items.`)
  console.log(`Sprint ID: ${sprintRef.id}`)
  console.log(`Items: ${itemIds[0]} → ${itemIds[itemIds.length - 1]}`)
}

seed().catch(console.error)
