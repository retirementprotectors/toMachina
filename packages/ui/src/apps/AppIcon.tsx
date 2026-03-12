'use client'

import { APP_BRANDS, type AppKey } from './brands'

interface AppIconProps {
  appKey: AppKey
  size?: number
}

/** Branded circle icon for an app — same appearance on every portal. */
export function AppIcon({ appKey, size = 28 }: AppIconProps) {
  const brand = APP_BRANDS[appKey]
  if (!brand) return null

  const iconSize = Math.round(size * 0.57) // ~16px at 28px size

  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full"
      style={{
        width: size,
        height: size,
        backgroundColor: brand.color,
      }}
    >
      <span
        className="material-icons-outlined text-white"
        style={{ fontSize: `${iconSize}px` }}
      >
        {brand.icon}
      </span>
    </span>
  )
}
