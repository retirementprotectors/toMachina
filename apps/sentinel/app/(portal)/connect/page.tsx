'use client'

import { ConnectPanel } from '@tomachina/ui'

export default function ConnectPage() {
  return <ConnectPanel portal="sentinel" open={true} onClose={() => window.history.back()} />
}
