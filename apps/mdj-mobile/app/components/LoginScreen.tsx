'use client'

import { useAuth } from '@tomachina/auth'

export function LoginScreen() {
  const { signIn } = useAuth()

  return (
    <div className="flex flex-col items-center justify-center min-h-dvh px-8 safe-top safe-bottom">
      {/* Logo */}
      <div className="flex flex-col items-center mb-12">
        <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-[var(--mdj-purple)] to-[#4c1d95] flex items-center justify-center mb-6 shadow-lg shadow-purple-900/30">
          <span className="text-white text-4xl font-extrabold tracking-tight">M</span>
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight mb-2">MDJ</h1>
        <p className="text-[var(--text-secondary)] text-center text-sm leading-relaxed">
          My Digital Josh<br />
          AI-powered sales assistant
        </p>
      </div>

      {/* Sign in */}
      <button
        onClick={signIn}
        className="w-full max-w-xs flex items-center justify-center gap-3 px-6 py-4 rounded-2xl
          bg-[var(--mdj-purple)] text-white font-semibold text-base
          active:scale-[0.97] transition-transform"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
        </svg>
        Sign in with Google
      </button>

      <p className="mt-6 text-[var(--text-muted)] text-xs text-center">
        @retireprotected.com accounts only
      </p>

      {/* Footer */}
      <div className="absolute bottom-8 flex flex-col items-center">
        <p className="text-[var(--text-muted)] text-[10px] tracking-widest uppercase">
          Powered by toMachina
        </p>
      </div>
    </div>
  )
}
