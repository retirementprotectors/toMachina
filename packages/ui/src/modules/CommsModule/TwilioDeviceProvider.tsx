'use client'

/**
 * TwilioDeviceProvider — TRK-13658
 *
 * Manages the Twilio Voice SDK Device lifecycle:
 * - Fetches an access token from /api/comms/token on mount (when authenticated)
 * - Creates and registers a Device so it can make + receive calls
 * - Auto-refreshes the token when tokenWillExpire fires
 * - Destroys the Device on unmount
 *
 * Exposed via useTwilioDevice() hook:
 *   device, isReady, makeCall, incomingCall, answerCall, rejectCall,
 *   hangup, activeCall, isMuted, toggleMute
 *
 * Dynamic import keeps the Twilio SDK out of the SSR bundle.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import { fetchValidated } from '../fetchValidated'

/* ─── Types ─── */

// We import the Twilio Call type for typing only — the actual SDK is loaded dynamically
type TwilioCall = import('@twilio/voice-sdk').Call
type TwilioDevice = import('@twilio/voice-sdk').Device

export interface TwilioDeviceContextValue {
  /** Whether the Device is registered and ready to make/receive calls */
  isReady: boolean
  /** Initiate an outbound call to a phone number */
  makeCall: (to: string) => Promise<TwilioCall | null>
  /** Pending incoming call (if any) */
  incomingCall: TwilioCall | null
  /** Accept the current incoming call */
  answerCall: () => void
  /** Reject the current incoming call */
  rejectCall: () => void
  /** Hang up the active call */
  hangup: () => void
  /** Currently active call (outbound or answered inbound) */
  activeCall: TwilioCall | null
  /** Whether the active call's microphone is muted */
  isMuted: boolean
  /** Toggle mute on the active call */
  toggleMute: () => void
  /** Send DTMF digits on the active call */
  sendDigits: (digits: string) => void
}

const TwilioDeviceContext = createContext<TwilioDeviceContextValue | null>(null)

export function useTwilioDevice(): TwilioDeviceContextValue {
  const ctx = useContext(TwilioDeviceContext)
  if (!ctx) throw new Error('useTwilioDevice must be used inside TwilioDeviceProvider')
  return ctx
}

/* ─── Provider ─── */

interface TwilioDeviceProviderProps {
  /** Whether the user is authenticated — Device only initializes when true */
  authenticated: boolean
  children: React.ReactNode
}

export function TwilioDeviceProvider({ authenticated, children }: TwilioDeviceProviderProps) {
  const deviceRef = useRef<TwilioDevice | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [activeCall, setActiveCall] = useState<TwilioCall | null>(null)
  const [incomingCall, setIncomingCall] = useState<TwilioCall | null>(null)
  const [isMuted, setIsMuted] = useState(false)

  /* ── Fetch access token ── */
  const fetchToken = useCallback(async (): Promise<string | null> => {
    try {
      const res = await fetchValidated<{ token: string; identity: string }>('/api/comms/token', {
        method: 'POST',
      })
      if (!res.success || !res.data?.token) return null
      return res.data.token
    } catch {
      return null
    }
  }, [])

  /* ── Initialize Device ── */
  useEffect(() => {
    if (!authenticated) return
    // Guard: only run in browser
    if (typeof window === 'undefined') return

    let cancelled = false

    async function init() {
      const token = await fetchToken()
      if (!token || cancelled) return

      // Dynamic import keeps SDK out of SSR bundle
      const { Device } = await import('@twilio/voice-sdk')

      if (cancelled) return

      const { Call } = await import('@twilio/voice-sdk')

      const device = new Device(token, {
        // Emit tokenWillExpire 60 seconds before expiry
        tokenRefreshMs: 60000,
        // Use Opus codec for better quality
        codecPreferences: [Call.Codec.Opus, Call.Codec.PCMU],
      })

      deviceRef.current = device

      // Register to receive incoming calls
      await device.register()

      if (!cancelled) setIsReady(true)

      /* Token refresh */
      device.on('tokenWillExpire', async () => {
        const newToken = await fetchToken()
        if (newToken) device.updateToken(newToken)
      })

      /* Incoming call */
      device.on('incoming', (call: TwilioCall) => {
        setIncomingCall(call)

        // If the incoming call is rejected or cancelled without answering, clear it
        call.on('cancel', () => setIncomingCall(null))
        call.on('reject', () => setIncomingCall(null))
        call.on('disconnect', () => {
          setIncomingCall(null)
          setActiveCall(null)
          setIsMuted(false)
        })
      })

      /* Device destroyed */
      device.on('destroyed', () => {
        setIsReady(false)
      })
    }

    init()

    return () => {
      cancelled = true
      if (deviceRef.current) {
        deviceRef.current.destroy()
        deviceRef.current = null
      }
      setIsReady(false)
      setActiveCall(null)
      setIncomingCall(null)
      setIsMuted(false)
    }
  }, [authenticated, fetchToken])

  /* ── makeCall ── */
  const makeCall = useCallback(async (to: string): Promise<TwilioCall | null> => {
    if (!deviceRef.current || !isReady) return null
    try {
      const call = await deviceRef.current.connect({ params: { To: to } })

      call.on('accept', () => {
        setActiveCall(call)
        setIsMuted(false)
      })

      call.on('mute', (muted: boolean) => {
        setIsMuted(muted)
      })

      call.on('disconnect', () => {
        setActiveCall(null)
        setIsMuted(false)
      })

      call.on('error', () => {
        setActiveCall(null)
        setIsMuted(false)
      })

      return call
    } catch {
      return null
    }
  }, [isReady])

  /* ── answerCall ── */
  const answerCall = useCallback(() => {
    if (!incomingCall) return
    incomingCall.accept()
    setActiveCall(incomingCall)
    setIncomingCall(null)
    setIsMuted(false)

    incomingCall.on('mute', (muted: boolean) => {
      setIsMuted(muted)
    })
  }, [incomingCall])

  /* ── rejectCall ── */
  const rejectCall = useCallback(() => {
    if (!incomingCall) return
    incomingCall.reject()
    setIncomingCall(null)
  }, [incomingCall])

  /* ── hangup ── */
  const hangup = useCallback(() => {
    activeCall?.disconnect()
    setActiveCall(null)
    setIsMuted(false)
  }, [activeCall])

  /* ── toggleMute ── */
  const toggleMute = useCallback(() => {
    if (!activeCall) return
    const newMuted = !isMuted
    activeCall.mute(newMuted)
    // State is updated via the 'mute' event listener on the call
  }, [activeCall, isMuted])

  /* ── sendDigits ── */
  const sendDigits = useCallback((digits: string) => {
    activeCall?.sendDigits(digits)
  }, [activeCall])

  const value: TwilioDeviceContextValue = {
    isReady,
    makeCall,
    incomingCall,
    answerCall,
    rejectCall,
    hangup,
    activeCall,
    isMuted,
    toggleMute,
    sendDigits,
  }

  return (
    <TwilioDeviceContext.Provider value={value}>
      {children}
    </TwilioDeviceContext.Provider>
  )
}
