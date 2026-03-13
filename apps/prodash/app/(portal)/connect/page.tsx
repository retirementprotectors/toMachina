'use client'

import { ConnectPanel } from '@tomachina/ui'

/* RPI Connect — standalone page view (opens panel inline) */
export default function ConnectPage() {
  return <ConnectPanel portal="prodashx" open={true} onClose={() => window.history.back()} />
}
