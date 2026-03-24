'use client'

import { useState, useCallback, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { useAuth } from '@tomachina/auth'
import { PortalSidebar } from './components/PortalSidebar'
import { TopBar } from './components/TopBar'
import { SignInScreen } from './components/SignInScreen'
import { LoadingScreen } from './components/LoadingScreen'
import { CommsModule } from '@tomachina/ui/src/modules/CommsModule'
import type { ClientResult } from '@tomachina/ui/src/modules/CommsModule'
import { TwilioDeviceProvider } from '@tomachina/ui/src/modules/CommsModule/TwilioDeviceProvider'
import { ConnectPanel } from '@tomachina/ui/src/modules/ConnectPanel'
import { NotificationsModule } from '@tomachina/ui/src/modules/Notifications'
import { ReportButton } from '@tomachina/ui'

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, loading, signIn } = useAuth()
  const pathname = usePathname()
  const [commsOpen, setCommsOpen] = useState(false)
  const [connectOpen, setConnectOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [activeContact, setActiveContact] = useState<ClientResult | null>(null)

  // Clear active contact when navigating away from a contact detail page
  useEffect(() => {
    const isContactDetail = pathname?.match(/^\/contacts\/([a-zA-Z0-9-]+)$/)
    if (!isContactDetail) {
      setActiveContact(null)
    }
  }, [pathname])

  const [commsInitialTab, setCommsInitialTab] = useState<'sms' | 'email' | 'call' | null>(null)

  // Listen for comms-action events from client detail buttons
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail
      const channel = detail?.channel as 'sms' | 'email' | 'call'
      if (channel) {
        if (detail.contact) {
          setActiveContact(detail.contact as ClientResult)
        }
        setCommsInitialTab(channel)
        setCommsOpen(true)
        setConnectOpen(false)
        setNotificationsOpen(false)
      }
    }
    window.addEventListener('comms-action', handler)
    return () => window.removeEventListener('comms-action', handler)
  }, [])

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

      {/* Communications Module — slide-out panel (auto-fills To from active client) */}
      <CommsModule open={commsOpen} onClose={closeComms} activeContact={activeContact} initialTab={commsInitialTab} />

      {/* RPI Connect — slide-out panel */}
      <ConnectPanel portal="prodash" open={connectOpen} onClose={closeConnect} />

      {/* Notifications Module — slide-out panel */}
      <NotificationsModule portal="prodash" open={notificationsOpen} onClose={closeNotifications} />

      {/* FORGE Report — screenshot + auto-fill issue tracker */}
      <ReportButton portal="prodashx" />
    </div>
    </TwilioDeviceProvider>
  )
}
