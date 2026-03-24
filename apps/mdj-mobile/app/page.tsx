'use client'

import { useAuth } from '@tomachina/auth'
import { MobileShell } from './components/MobileShell'
import { LoginScreen } from './components/LoginScreen'

export default function HomePage() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-dvh">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[var(--mdj-purple)] flex items-center justify-center animate-pulse">
            <span className="text-white text-xl font-bold">M</span>
          </div>
          <p className="text-[var(--text-secondary)] text-sm">Loading MDJ...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <LoginScreen />
  }

  return <MobileShell />
}
