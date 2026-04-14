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
import { OmniPanel } from '@tomachina/ui/src/modules/OmniPanel'
import { ConnectPanel } from '@tomachina/ui/src/modules/ConnectPanel'

// TRK-EPIC-08 Phase 0: OmniPanel v2 behind feature flag. When enabled, the
// rebuilt OmniPanel (PRs #409-414) replaces the legacy CommsModule slide-out.
// Flip via NEXT_PUBLIC_OMNIPANEL_V2_ENABLED=true. Off by default in prod, on
// in dev. 'sms' maps to 'text' because OmniPanel's tab keys differ from the
// legacy CommsModule tab keys.
const OMNIPANEL_V2 = process.env.NEXT_PUBLIC_OMNIPANEL_V2_ENABLED === 'true'
function mapInitialTab(t: 'sms' | 'email' | 'call' | null | undefined): 'call' | 'text' | 'email' | 'log' | null {
  if (!t) return null
  if (t === 'sms') return 'text'
  return t
}
import { NotificationsModule } from '@tomachina/ui/src/modules/Notifications'
import { MDJPanel } from '@tomachina/ui/src/modules/MDJPanel'
import { ReportButton } from '@tomachina/ui'
import { SenseiProvider, SenseiOverlay, SenseiPopup } from '@tomachina/ui/src/modules/SenseiMode'

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
  const [mdjOpen, setMdjOpen] = useState(false)
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
        setMdjOpen(false)
      }
    }
    window.addEventListener('comms-action', handler)
    return () => window.removeEventListener('comms-action', handler)
  }, [])

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

  const toggleMdj = useCallback(() => {
    setMdjOpen((v) => !v)
    setCommsOpen(false)
    setConnectOpen(false)
    setNotificationsOpen(false)
  }, [])

  const closeMdj = useCallback(() => {
    setMdjOpen(false)
  }, [])

  const closeNotifications = useCallback(() => {
    setNotificationsOpen(false)
  }, [])

  if (loading) return <LoadingScreen />
  if (!user) return <SignInScreen onSignIn={signIn} />

  return (
    <SenseiProvider>
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

      {/* Communications — OmniPanel v2 (PRs #409-414 rebuild) behind flag, else legacy CommsModule */}
      {OMNIPANEL_V2 ? (
        <OmniPanel open={commsOpen} onClose={closeComms} activeContact={activeContact} initialTab={mapInitialTab(commsInitialTab)} />
      ) : (
        <CommsModule open={commsOpen} onClose={closeComms} activeContact={activeContact} initialTab={commsInitialTab} />
      )}

      {/* RPI Connect — slide-out panel */}
      <ConnectPanel portal="prodash" open={connectOpen} onClose={closeConnect} />

      {/* Notifications Module — slide-out panel */}
      <NotificationsModule portal="prodash" open={notificationsOpen} onClose={closeNotifications} />

      {/* VOLTRON — AI Assistant slide-out panel.
          ZRD-PLAT-MT belt flag: hide for users with a partner_id claim until
          MT-014 ships partner-context awareness in the MDJ Agent. Prevents
          VOLTRON from serving RPI's default-DB data to partner users. */}
      {!user?.partnerId && (
        <MDJPanel portal="prodash" open={mdjOpen} onClose={closeMdj} />
      )}

      {/* FORGE Report — screenshot + auto-fill issue tracker */}
      <ReportButton portal="prodashx" />

      {/* SENSEI — Training overlay + popup */}
      <SenseiOverlay />
      <SenseiPopup />
    </div>
    </TwilioDeviceProvider>
    </SenseiProvider>
  )
}
