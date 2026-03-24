'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
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
    const normalized = phone.replace(/^\+1/, '').replace(/\D/g, '')

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

/* ─── CP05: Ring audio helper ─── */

function createRingAudio(): HTMLAudioElement | null {
  try {
    // Generate a simple ring tone using AudioContext as base64 data URI
    // This avoids needing a static audio file
    const ctx = new AudioContext()
    const sampleRate = ctx.sampleRate
    const duration = 1.5 // seconds per ring cycle
    const frames = Math.floor(sampleRate * duration)
    const buffer = ctx.createBuffer(1, frames, sampleRate)
    const data = buffer.getChannelData(0)

    // Two-tone ring: 440Hz + 480Hz (standard US ring pattern)
    for (let i = 0; i < frames; i++) {
      const t = i / sampleRate
      // Ring for 0.8s, silence for 0.7s
      if (t < 0.8) {
        data[i] = 0.3 * (Math.sin(2 * Math.PI * 440 * t) + Math.sin(2 * Math.PI * 480 * t))
      } else {
        data[i] = 0
      }
    }

    // Convert AudioBuffer to WAV blob
    const wavBuffer = audioBufferToWav(buffer)
    const blob = new Blob([wavBuffer], { type: 'audio/wav' })
    const url = URL.createObjectURL(blob)

    const audio = new Audio(url)
    audio.loop = true
    void ctx.close()
    return audio
  } catch {
    return null
  }
}

function audioBufferToWav(buffer: AudioBuffer): ArrayBuffer {
  const numChannels = buffer.numberOfChannels
  const sampleRate = buffer.sampleRate
  const length = buffer.length * numChannels * 2
  const out = new ArrayBuffer(44 + length)
  const view = new DataView(out)
  const data = buffer.getChannelData(0)

  // WAV header
  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i))
  }
  writeStr(0, 'RIFF')
  view.setUint32(4, 36 + length, true)
  writeStr(8, 'WAVE')
  writeStr(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * numChannels * 2, true)
  view.setUint16(32, numChannels * 2, true)
  view.setUint16(34, 16, true)
  writeStr(36, 'data')
  view.setUint32(40, length, true)

  let offset = 44
  for (let i = 0; i < buffer.length; i++) {
    const sample = Math.max(-1, Math.min(1, data[i]))
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true)
    offset += 2
  }
  return out
}

/* ─── Hook ─── */

export interface UseIncomingCallReturn {
  incomingCall: InboundCall | null
  answerCall: () => void
  declineCall: () => void
}

export function useIncomingCall(): UseIncomingCallReturn {
  const [incomingCall, setIncomingCall] = useState<InboundCall | null>(null)
  const ringAudioRef = useRef<HTMLAudioElement | null>(null)
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  /* CP05: Stop ring audio + clear timer */
  const stopRing = useCallback(() => {
    if (ringAudioRef.current) {
      ringAudioRef.current.pause()
      ringAudioRef.current.currentTime = 0
    }
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current)
      dismissTimerRef.current = null
    }
  }, [])

  useEffect(() => {
    const handleIncoming = async (evt: CustomEvent<TwilioIncomingCallEvent>) => {
      const { twilioCall, callerPhone } = evt.detail

      // Store raw Twilio call on window so answerCall/declineCall can reach it
      window.__activeTwilioCall = twilioCall

      // Look up the client in Firestore
      const client = await lookupClientByPhone(callerPhone)
      const callerName = client?.name ?? 'Unknown Caller'

      setIncomingCall({
        id: `incoming-${Date.now()}`,
        callerName,
        callerPhone,
        book: client?.book ?? '',
        assignedAgent: client?.assignedAgent ?? '',
        startedAt: new Date(),
      })

      /* CP05: Play ring audio */
      try {
        if (!ringAudioRef.current) {
          ringAudioRef.current = createRingAudio()
        }
        if (ringAudioRef.current) {
          ringAudioRef.current.currentTime = 0
          void ringAudioRef.current.play()
        }
      } catch {
        // Non-fatal — ring is nice-to-have
      }

      /* CP05: Browser notification (works even when tab is backgrounded) */
      try {
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('Incoming Call', {
            body: `${callerName} — ${callerPhone}`,
            icon: '/favicon.ico',
            tag: 'incoming-call',
          })
        }
      } catch {
        // Non-fatal
      }

      /* CP05: Auto-dismiss after 25s (Twilio typically cancels at ~20s) */
      dismissTimerRef.current = setTimeout(() => {
        stopRing()
        setIncomingCall(null)
        window.__activeTwilioCall = undefined
      }, 25000)

      /* Listen for Twilio call cancel (e.g., caller hangs up before answer) */
      const call = twilioCall as { on?: (event: string, cb: () => void) => void }
      if (call?.on) {
        call.on('cancel', () => {
          stopRing()
          setIncomingCall(null)
          window.__activeTwilioCall = undefined
        })
        call.on('disconnect', () => {
          stopRing()
          setIncomingCall(null)
          window.__activeTwilioCall = undefined
        })
      }
    }

    /* CP05: Request notification permission on mount */
    if ('Notification' in window && Notification.permission === 'default') {
      void Notification.requestPermission()
    }

    window.addEventListener('twilio-incoming-call', handleIncoming)
    return () => {
      window.removeEventListener('twilio-incoming-call', handleIncoming)
      stopRing()
    }
  }, [stopRing])

  const answerCall = useCallback(() => {
    stopRing()
    const call = window.__activeTwilioCall as { accept?: () => void } | undefined
    if (call?.accept) {
      call.accept()
    }
  }, [stopRing])

  const declineCall = useCallback(() => {
    stopRing()
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
  }, [incomingCall, stopRing])

  return { incomingCall, answerCall, declineCall }
}
