'use client'

import { useState, useEffect, useRef, useCallback, type ReactNode } from 'react'
import { getAuth } from 'firebase/auth'
import { doc, getDoc, updateDoc, getFirestore } from 'firebase/firestore'

// ---------------------------------------------------------------------------
// DraggableFAB — draggable floating action button with Firestore persistence
// ---------------------------------------------------------------------------

interface DraggableFABProps {
  fabId: string
  defaultPosition: { bottom: number; right: number }
  children: ReactNode
}

/** Debounce timer for Firestore persistence */
let saveTimers: Record<string, ReturnType<typeof setTimeout>> = {}

function debouncedSave(fabId: string, pos: { left: number; top: number }) {
  if (saveTimers[fabId]) clearTimeout(saveTimers[fabId])
  saveTimers[fabId] = setTimeout(async () => {
    try {
      const auth = getAuth()
      const email = auth.currentUser?.email
      if (!email) return
      const db = getFirestore()
      const userRef = doc(db, 'users', email)
      await updateDoc(userRef, {
        [`employee_profile.fab_positions.${fabId}`]: pos,
      })
    } catch {
      // Silently fail — position is still saved locally in state
    }
  }, 500)
}

export function DraggableFAB({ fabId, defaultPosition, children }: DraggableFABProps) {
  // Convert bottom/right default to left/top for positioning
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)
  const dragging = useRef(false)
  const offset = useRef({ x: 0, y: 0 })
  const hasMoved = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Load saved position on mount
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const auth = getAuth()
        const email = auth.currentUser?.email
        if (!email) {
          if (!cancelled) {
            setPos({
              left: window.innerWidth - defaultPosition.right - 48,
              top: window.innerHeight - defaultPosition.bottom - 48,
            })
          }
          return
        }
        const db = getFirestore()
        const userRef = doc(db, 'users', email)
        const snap = await getDoc(userRef)
        if (cancelled) return
        const saved = snap.data()?.employee_profile?.fab_positions?.[fabId]
        if (saved && typeof saved.left === 'number' && typeof saved.top === 'number') {
          // Clamp to current viewport
          setPos({
            left: Math.min(Math.max(0, saved.left), window.innerWidth - 48),
            top: Math.min(Math.max(0, saved.top), window.innerHeight - 48),
          })
        } else {
          setPos({
            left: window.innerWidth - defaultPosition.right - 48,
            top: window.innerHeight - defaultPosition.bottom - 48,
          })
        }
      } catch {
        if (!cancelled) {
          setPos({
            left: window.innerWidth - defaultPosition.right - 48,
            top: window.innerHeight - defaultPosition.bottom - 48,
          })
        }
      }
    }
    load()
    return () => { cancelled = true }
  }, [fabId, defaultPosition.bottom, defaultPosition.right])

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    // Only drag from the container itself, not from child interactive elements
    dragging.current = true
    hasMoved.current = false
    const rect = containerRef.current?.getBoundingClientRect()
    if (rect) {
      offset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }
    }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }, [])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return
    hasMoved.current = true
    const newLeft = Math.min(Math.max(0, e.clientX - offset.current.x), window.innerWidth - 48)
    const newTop = Math.min(Math.max(0, e.clientY - offset.current.y), window.innerHeight - 48)
    setPos({ left: newLeft, top: newTop })
  }, [])

  const handlePointerUp = useCallback(() => {
    if (dragging.current && hasMoved.current && pos) {
      debouncedSave(fabId, pos)
    }
    dragging.current = false
    hasMoved.current = false
  }, [fabId, pos])

  if (!pos) return null

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        left: pos.left,
        top: pos.top,
        zIndex: 40,
        touchAction: 'none',
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {children}
    </div>
  )
}
