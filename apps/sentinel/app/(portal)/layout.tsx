'use client'

import { useState, useCallback } from 'react'
import { useAuth } from '@tomachina/auth'
import { PortalSidebar } from './components/PortalSidebar'
import { TopBar } from './components/TopBar'
import { SignInScreen } from './components/SignInScreen'
import { LoadingScreen } from './components/LoadingScreen'
import { CommsModule } from '@tomachina/ui/src/modules/CommsModule'
import { TwilioDeviceProvider } from '@tomachina/ui/src/modules/CommsModule/TwilioDeviceProvider'
import { ConnectPanel } from '@tomachina/ui/src/modules/ConnectPanel'
import { NotificationsModule } from '@tomachina/ui/src/modules/Notifications'
import { MDJPanel } from '@tomachina/ui/src/modules/MDJPanel'
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
  const [mdjOpen, setMdjOpen] = useState(false)

  const panelOpen = commsOpen || connectOpen || notificationsOpen || mdjOpen

  const toggleComms = useCallback(() => {
    setCommsOpen((v) => !v)
    setConnectOpen(false)
    setNotificationsOpen(false)
    setMdjOpen(false)
  }, [])

  const closeComms = useCallback(() => {
    setCommsOpen(false)
  }, [])

  const toggleConnect = useCallback(() => {
    setConnectOpen((v) => !v)
    setCommsOpen(false)
    setNotificationsOpen(false)
    setMdjOpen(false)
  }, [])

  const closeConnect = useCallback(() => {
    setConnectOpen(false)
  }, [])

  const toggleNotifications = useCallback(() => {
    setNotificationsOpen((v) => !v)
    setCommsOpen(false)
    setConnectOpen(false)
    setMdjOpen(false)
  }, [])

  const closeNotifications = useCallback(() => {
    setNotificationsOpen(false)
  }, [])

  const toggleMdj = useCallback(() => {
    setMdjOpen((v) => !v)
    setCommsOpen(false)
    setConnectOpen(false)
    setNotificationsOpen(false)
  }, [])

  const closeMdj = useCallback(() => {
    setMdjOpen(false)
  }, [])

  if (loading) return <LoadingScreen />
  if (!user) return <SignInScreen onSignIn={signIn} />

  return (
    <TwilioDeviceProvider authenticated={!!user}>
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
        onMdjToggle={toggleMdj}
        mdjOpen={mdjOpen}
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
      <ConnectPanel portal="sentinel" open={connectOpen} onClose={closeConnect} />

      {/* Notifications Module — slide-out panel */}
      <NotificationsModule portal="sentinel" open={notificationsOpen} onClose={closeNotifications} />

      {/* MDJ — AI Assistant slide-out panel.
          ZRD-PLAT-MT belt flag: hide for partner users until MT-014 lands
          VOLTRON partner-context awareness. Prevents default-DB PHI leakage. */}
      {!user?.partnerId && (
        <MDJPanel portal="sentinel" open={mdjOpen} onClose={closeMdj} />
      )}

      {/* FORGE Report — screenshot + auto-fill issue tracker */}
      <ReportButton portal="sentinel" />
    </div>
    </TwilioDeviceProvider>
  )
}
