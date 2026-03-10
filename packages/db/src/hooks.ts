'use client'

import { useEffect, useState } from 'react'
import {
  doc,
  onSnapshot,
  type DocumentReference,
  type Query,
  type DocumentData,
} from 'firebase/firestore'
import { getDb } from './firestore'

export function useDocument<T = DocumentData>(path: string, id: string) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!id) {
      setData(null)
      setLoading(false)
      return
    }

    const ref = doc(getDb(), path, id) as DocumentReference<T>
    const unsubscribe = onSnapshot(
      ref,
      (snap) => {
        setData(snap.exists() ? (snap.data() as T) : null)
        setLoading(false)
      },
      (err) => {
        setError(err)
        setLoading(false)
      }
    )

    return () => unsubscribe()
  }, [path, id])

  return { data, loading, error }
}

export function useCollection<T = DocumentData>(q: Query | null, key?: string) {
  const [data, setData] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!q) {
      setData([])
      setLoading(false)
      return
    }

    setLoading(true)
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const docs = snap.docs.map((d) => ({ ...d.data(), _id: d.id }) as T)
        setData(docs)
        setLoading(false)
      },
      (err) => {
        setError(err)
        setLoading(false)
      }
    )

    return () => unsubscribe()
  }, [key ?? 'default'])

  return { data, loading, error }
}
