'use client'

/**
 * Consistent avatar color palette — 10 distinct colors.
 * Hash the full name to deterministically pick a color.
 */
const AVATAR_COLORS = [
  '#4a7ab5', // blue (portal)
  '#6366f1', // indigo
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#f59e0b', // amber
  '#10b981', // emerald
  '#3b82f6', // blue
  '#ef4444', // red
  '#14b8a6', // teal-light
  '#f97316', // orange
]

function hashName(name: string): number {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

interface ClientAvatarProps {
  firstName: string
  lastName: string
  size?: number
}

export function ClientAvatar({ firstName, lastName, size = 36 }: ClientAvatarProps) {
  const firstInitial = (firstName || '?').charAt(0).toUpperCase()
  const lastInitial = (lastName || '?').charAt(0).toUpperCase()
  const fullName = `${firstName} ${lastName}`.trim()
  const colorIndex = hashName(fullName) % AVATAR_COLORS.length
  const bgColor = AVATAR_COLORS[colorIndex]

  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full font-semibold text-white"
      style={{
        width: size,
        height: size,
        backgroundColor: bgColor,
        fontSize: size * 0.38,
      }}
      title={fullName}
    >
      {firstInitial}
      {lastInitial}
    </div>
  )
}
