'use client'

import type { ReactNode } from 'react'
import { APP_BRANDS, type AppKey } from './brands'

interface AppWrapperProps {
  appKey: AppKey
  children: ReactNode
}

/**
 * Wraps an app module's content when opened.
 * Shows a thin brand-color top bar, then renders children in the portal's theme.
 */
export function AppWrapper({ appKey, children }: AppWrapperProps) {
  const brand = APP_BRANDS[appKey]
  if (!brand) return <>{children}</>

  return (
    <div className="flex flex-col h-full">
      {/* Brand identity bar — 4px in the app's permanent color */}
      <div
        className="w-full shrink-0"
        style={{ height: 4, backgroundColor: brand.color }}
      />
      {/* Content area — uses portal CSS variables for theming */}
      <div className="flex-1 overflow-y-auto p-6">
        {children}
      </div>
    </div>
  )
}
