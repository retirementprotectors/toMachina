'use client'

interface SignInScreenProps {
  onSignIn: () => Promise<void>
}

export function SignInScreen({ onSignIn }: SignInScreenProps) {
  return (
    <div
      className="flex min-h-screen items-center justify-center"
      style={{ background: 'var(--bg-deepest)' }}
    >
      <div
        className="flex w-full max-w-md flex-col items-center gap-8 rounded-2xl border p-10"
        style={{
          background: 'var(--bg-card)',
          borderColor: 'var(--border)',
          boxShadow: '0 4px 60px rgba(0,0,0,0.4)',
        }}
      >
        {/* toMachina Master Logo */}
        <img
          src="/tomachina-transparent.png"
          alt="toMachina — The Machine"
          style={{ width: '180px', opacity: 0.7 }}
        />

        {/* Portal Logo */}
        <img
          src="/prodashx-transparent.png"
          alt="ProDashX by toMachina"
          style={{ maxWidth: '340px', width: '100%' }}
        />

        {/* Subtle glow divider */}
        <div
          className="h-px w-3/4"
          style={{
            background: 'linear-gradient(90deg, transparent, var(--portal), transparent)',
            opacity: 0.4,
          }}
        />

        {/* Google Sign In Button — proper multi-color icon */}
        <button
          onClick={onSignIn}
          className="flex w-full items-center justify-center gap-3 rounded-lg px-4 py-3.5 text-sm font-semibold transition-all duration-150 hover:brightness-110 active:scale-[0.98]"
          style={{
            background: '#fff',
            color: '#3c4043',
            boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
          }}
        >
          {/* Official Google multi-color icon */}
          <svg width="20" height="20" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
          </svg>
          Sign in with Google
        </button>

        {/* Domain Note */}
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          @retireprotected.com accounts only
        </p>
      </div>
    </div>
  )
}
