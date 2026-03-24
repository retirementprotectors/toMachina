'use client'

import { useState, useCallback } from 'react'
import { useAuth } from '@tomachina/auth'
import { PortalSidebar } from './components/PortalSidebar'
import { TopBar } from './components/TopBar'
import { SignInScreen } from './components/SignInScreen'
import { LoadingScreen } from './components/LoadingScreen'
import { CommsModule } from '@tomachina/ui/src/modules/CommsModule'
import { ConnectPanel } from '@tomachina/ui/src/modules/ConnectPanel'
import { NotificationsModule } from '@tomachina/ui/src/modules/Notifications'
import { ReportButton } from '@tomachina/ui'

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, loading, signIn } = useAuth()
  const [commsOpen, setCommsOpen] = useState(false)
  const [connectOpen, setConnectOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)

  const panelOpen = commsOpen || connectOpen || notificationsOpen

  const toggleComms = useCallback(() => {
    setCommsOpen((v) => !v)
    setConnectOpen(false)
    setNotificationsOpen(false)
  }, [])

  const closeComms = useCallback(() => {
    setCommsOpen(false)
  }, [])

  const toggleConnect = useCallback(() => {
    setConnectOpen((v) => !v)
    setCommsOpen(false)
    setNotificationsOpen(false)
  }, [])

  const closeConnect = useCallback(() => {
    setConnectOpen(false)
  }, [])

  const toggleNotifications = useCallback(() => {
    setNotificationsOpen((v) => !v)
    setCommsOpen(false)
    setConnectOpen(false)
  }, [])

  const closeNotifications = useCallback(() => {
    setNotificationsOpen(false)
  }, [])

  if (loading) return <LoadingScreen />
  if (!user) return <SignInScreen onSignIn={signIn} />

  return (
    <>
    {/* TRK-13677: Push-not-overlay — set panel push width via CSS custom property */}
    <style>{`
      :root { --panel-push-width: 0px; }
      @media (min-width: 1024px) { :root { --panel-push-width: 360px; } }
      @media (min-width: 1400px) { :root { --panel-push-width: 460px; } }
    `}</style>
    <div className="flex h-screen bg-[var(--bg-primary)]">
      <PortalSidebar
        onCommsToggle={toggleComms}
        commsOpen={commsOpen}
        onConnectToggle={toggleConnect}
        connectOpen={connectOpen}
        onNotificationsToggle={toggleNotifications}
        notificationsOpen={notificationsOpen}
        panelOpen={panelOpen}
      />
      <div
        className="flex flex-1 flex-col overflow-hidden transition-[margin-right] duration-200 ease-in-out"
        style={panelOpen ? { marginRight: 'var(--panel-push-width, 0px)' } : undefined}
      >
        <TopBar user={user} />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>

      {/* Communications Module — slide-out panel */}
      <CommsModule open={commsOpen} onClose={closeComms} />

      {/* RPI Connect — slide-out panel */}
      <ConnectPanel portal="riimo" open={connectOpen} onClose={closeConnect} />

      {/* Notifications Module — slide-out panel */}
      <NotificationsModule portal="riimo" open={notificationsOpen} onClose={closeNotifications} />

      {/* FORGE Report — screenshot + auto-fill issue tracker */}
      <ReportButton portal="riimo" />
    </div>
    </>
  )
}
