'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useEntitlements, canAccessModule } from '@tomachina/auth'
import { AdminPanel } from '@tomachina/ui'

export function AdminGuard() {
  const router = useRouter()
  const { ctx, loading } = useEntitlements()

  useEffect(() => {
    if (!loading && !canAccessModule(ctx, 'PRODASH_ADMIN')) {
      router.replace('/')
    }
  }, [ctx, loading, router])

  if (loading) return <div className="flex h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--portal)] border-t-transparent" /></div>
  if (!canAccessModule(ctx, 'PRODASH_ADMIN')) return null

  return <AdminPanel portal="prodashx" />
}
