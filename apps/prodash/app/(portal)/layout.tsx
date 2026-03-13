'use client'

import { useState, useCallback } from 'react'
import { useAuth } from '@tomachina/auth'
import { PortalSidebar } from './components/PortalSidebar'
import { TopBar } from './components/TopBar'
import { SignInScreen } from './components/SignInScreen'
import { LoadingScreen } from './components/LoadingScreen'
import { CommsModule } from '@tomachina/ui/src/modules/CommsModule'
import { ConnectPanel } from '@tomachina/ui/src/modules/ConnectPanel'

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, loading, signIn } = useAuth()
  const [commsOpen, setCommsOpen] = useState(false)
  const [connectOpen, setConnectOpen] = useState(false)

  const toggleComms = useCallback(() => {
    setCommsOpen((v) => !v)
    setConnectOpen(false)
  }, [])

  const closeComms = useCallback(() => {
    setCommsOpen(false)
  }, [])

  const toggleConnect = useCallback(() => {
    setConnectOpen((v) => !v)
    setCommsOpen(false)
  }, [])

  const closeConnect = useCallback(() => {
    setConnectOpen(false)
  }, [])

  if (loading) return <LoadingScreen />
  if (!user) return <SignInScreen onSignIn={signIn} />

  return (
    <div className="flex h-screen bg-[var(--bg-primary)]">
      <PortalSidebar
        onCommsToggle={toggleComms}
        commsOpen={commsOpen}
        onConnectToggle={toggleConnect}
        connectOpen={connectOpen}
      />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar user={user} />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>

      {/* Communications Module — slide-out panel */}
      <CommsModule open={commsOpen} onClose={closeComms} />

      {/* RPI Connect — slide-out panel */}
      <ConnectPanel portal="prodash" open={connectOpen} onClose={closeConnect} />
    </div>
  )
}
