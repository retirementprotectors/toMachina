'use client'

import { useState, useEffect, useCallback } from 'react'
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore'
import { getDb } from '@tomachina/db'
import type { InboundCall } from './InboundCallCard'

/* ─── Event shape dispatched by TwilioDeviceProvider ─── */

export interface TwilioIncomingCallEvent {
  /** The raw Twilio Call object — typed loosely since Builder 04 owns the SDK types */
  twilioCall: unknown
  /** E.164 caller phone number, e.g. "+15157070207" */
  callerPhone: string
}

/* ─── Extend Window to carry the call ref ─── */

declare global {
  interface WindowEventMap {
    'twilio-incoming-call': CustomEvent<TwilioIncomingCallEvent>
  }
  interface Window {
    /** Builder 04's TwilioDeviceProvider stores the active call here so we can call .accept()/.reject() */
    __activeTwilioCall?: unknown
  }
}

/* ─── Client lookup helper ─── */

async function lookupClientByPhone(phone: string): Promise<{ name: string; book: string; assignedAgent: string } | null> {
  try {
    const db = getDb()
    // Normalize: strip +1 prefix for matching (Firestore stores without country code)
    const normalized = phone.replace(/^\+1/, '').replace(/\D/g, '')

    // Try cell_phone first, then phone
    const cellQuery = query(collection(db, 'clients'), where('cell_phone', '==', normalized))
    const cellSnap = await getDocs(cellQuery)
    if (!cellSnap.empty) {
      const d = cellSnap.docs[0].data()
      return {
        name: [d.first_name, d.last_name].filter(Boolean).join(' ') || 'Unknown Caller',
        book: d.book || '',
        assignedAgent: d.assigned_agent || d.agent_name || '',
      }
    }

    const phoneQuery = query(collection(db, 'clients'), where('phone', '==', normalized))
    const phoneSnap = await getDocs(phoneQuery)
    if (!phoneSnap.empty) {
      const d = phoneSnap.docs[0].data()
      return {
        name: [d.first_name, d.last_name].filter(Boolean).join(' ') || 'Unknown Caller',
        book: d.book || '',
        assignedAgent: d.assigned_agent || d.agent_name || '',
      }
    }

    return null
  } catch {
    return null
  }
}

/* ─── Log declined call to Firestore ─── */

async function logDeclinedCall(phone: string): Promise<void> {
  try {
    const db = getDb()
    await addDoc(collection(db, 'communications'), {
      channel: 'voice',
      direction: 'inbound',
      sender: phone,
      recipient: phone,
      status: 'missed',
      body: '',
      created_at: new Date().toISOString(),
      timestamp: serverTimestamp(),
      notes: 'Call declined by agent',
    })
  } catch {
    // Non-fatal — call continues even if logging fails
  }
}

/* ─── Hook ─── */

export interface UseIncomingCallReturn {
  incomingCall: InboundCall | null
  answerCall: () => void
  declineCall: () => void
}

export function useIncomingCall(): UseIncomingCallReturn {
  const [incomingCall, setIncomingCall] = useState<InboundCall | null>(null)

  useEffect(() => {
    const handleIncoming = async (evt: CustomEvent<TwilioIncomingCallEvent>) => {
      const { twilioCall, callerPhone } = evt.detail

      // Store raw Twilio call on window so answerCall/declineCall can reach it
      window.__activeTwilioCall = twilioCall

      // Look up the client in Firestore
      const client = await lookupClientByPhone(callerPhone)

      setIncomingCall({
        id: `incoming-${Date.now()}`,
        callerName: client?.name ?? 'Unknown Caller',
        callerPhone,
        book: client?.book ?? '',
        assignedAgent: client?.assignedAgent ?? '',
        startedAt: new Date(),
      })
    }

    window.addEventListener('twilio-incoming-call', handleIncoming)
    return () => window.removeEventListener('twilio-incoming-call', handleIncoming)
  }, [])

  const answerCall = useCallback(() => {
    const call = window.__activeTwilioCall as { accept?: () => void } | undefined
    if (call?.accept) {
      call.accept()
    }
    // InboundCallCard stays visible until replaced by ActiveCallScreen (handled in CommsModule)
  }, [])

  const declineCall = useCallback(() => {
    const call = window.__activeTwilioCall as { reject?: () => void } | undefined
    if (call?.reject) {
      call.reject()
    }
    const phone = incomingCall?.callerPhone ?? ''
    if (phone) {
      void logDeclinedCall(phone)
    }
    setIncomingCall(null)
    window.__activeTwilioCall = undefined
  }, [incomingCall])

  return { incomingCall, answerCall, declineCall }
}
