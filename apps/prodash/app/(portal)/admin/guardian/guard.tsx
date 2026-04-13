'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useEntitlements, canAccessModule } from '@tomachina/auth'
import { Guardian } from '@tomachina/ui'

export function PageGuard() {
  const router = useRouter()
  const { ctx, loading } = useEntitlements()

  useEffect(() => {
    if (!loading && !canAccessModule(ctx, 'GUARDIAN')) {
      router.replace('/')
    }
  }, [ctx, loading, router])

  if (loading) return <div className="flex h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--portal)] border-t-transparent" /></div>
  if (!canAccessModule(ctx, 'GUARDIAN')) return null

  return <Guardian portal="PRODASHX" />
}
