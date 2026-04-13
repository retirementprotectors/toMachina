/**
 * Hub Dispatcher Types — RON-HD01
 * CXO-aware intake routing. Shared between services/api and portal consumers.
 */

export type CxoTarget = 'megazord' | 'voltron' | 'musashi' | 'raiden' | 'ronin' | 'archive'

export type DispatchChannel = 'slack' | 'email' | 'mdj-panel' | 'dojo-reporter' | 'direct'

export interface DispatchResult {
  cxo_target: CxoTarget
  confidence: number          // 0.0 – 1.0
  ticket_prefix: string       // ZRD- | VOL- | MUS- | RDN- | RON- | ARCHIVE-
  routing_destination: string  // Slack channel ID or queue name
  method: 'keyword' | 'haiku'
}

export const CXO_CONFIG: Record<Exclude<CxoTarget, 'archive'>, {
  prefix: string
  channel_id: string
  label: string
}> = {
  megazord: { prefix: 'ZRD-', channel_id: 'C0ARTUA8RAL', label: 'MEGAZORD (Data/Import)' },
  voltron:  { prefix: 'VOL-', channel_id: 'C0AQT902PB5', label: 'VOLTRON (Client Cases)' },
  musashi:  { prefix: 'MUS-', channel_id: 'command-center', label: 'MUSASHI (Creative)' },
  raiden:   { prefix: 'RDN-', channel_id: 'C0ANMBVMSTV', label: 'RAIDEN (Bugs/Fixes)' },
  ronin:    { prefix: 'RON-', channel_id: 'C0ANMBVMSTV', label: 'RONIN (Features/Build)' },
}
