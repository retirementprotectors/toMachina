/** Canonical app brand definitions — identical across all portals. */

export type AppKey = 'atlas' | 'cam' | 'comms' | 'dex' | 'c3' | 'command-center' | 'david-hub' | 'forge' | 'leadership-center' | 'pipeline-studio' | 'pipelines'

export interface AppBrand {
  color: string
  icon: string
  label: string
  description: string
}

export const APP_BRANDS: Record<AppKey, AppBrand> = {
  atlas:              { color: '#3182ce', icon: 'hub',         label: 'ATLAS',            description: 'Data Operating System' },
  comms:              { color: '#6366f1', icon: 'forum',       label: 'COMMS Center',     description: 'Client Communications' },
  cam:                { color: '#d69e2e', icon: 'payments',    label: 'CAM',              description: 'Compensation Manager' },
  dex:                { color: '#38a169', icon: 'description', label: 'DEX',              description: 'Document Exchange' },
  c3:                 { color: '#e53e3e', icon: 'campaign',    label: 'C3',               description: 'Campaign Engine' },
  'command-center':   { color: '#718096', icon: 'speed',       label: 'Command Center',   description: 'Metrics Dashboard' },
  'david-hub':        { color: '#40bc58', icon: 'calculate',   label: 'DAVID HUB',        description: 'M&A Deal Evaluation' },
  forge:               { color: '#e07c3e', icon: 'construction', label: 'FORGE',             description: 'Build Tracker' },
  'leadership-center': { color: '#a78bfa', icon: 'leaderboard', label: 'Leadership Center', description: 'Leadership Intelligence' },
  'pipeline-studio':   { color: '#14b8a6', icon: 'architecture',  label: 'Pipeline Studio',  description: 'Pipeline Design Tool' },
  pipelines:           { color: '#4a7ab5', icon: 'route',        label: 'Pipelines',        description: 'Pipeline Factory' },
} as const
