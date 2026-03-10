'use client'

import { type ReactNode } from 'react'

interface SidebarSection {
  key: string
  label: string
  icon?: string
  items: SidebarItem[]
}

interface SidebarItem {
  key: string
  label: string
  href: string
  icon?: string
  badge?: number
}

interface SidebarProps {
  sections: SidebarSection[]
  collapsed?: boolean
  onToggle?: () => void
  children?: ReactNode
}

export function Sidebar({ sections, collapsed, onToggle, children }: SidebarProps) {
  return (
    <aside
      className={`flex flex-col border-r border-[var(--border)] bg-[var(--bg-secondary)] transition-all ${
        collapsed ? 'w-16' : 'w-64'
      }`}
    >
      {children}
      <nav className="flex-1 overflow-y-auto p-2">
        {sections.map((section) => (
          <div key={section.key} className="mb-4">
            {!collapsed && (
              <h3 className="px-3 py-1 text-xs font-semibold uppercase text-[var(--text-muted)]">
                {section.label}
              </h3>
            )}
            {section.items.map((item) => (
              <a
                key={item.key}
                href={item.href}
                className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
              >
                {item.icon && <span>{item.icon}</span>}
                {!collapsed && <span>{item.label}</span>}
                {!collapsed && item.badge !== undefined && (
                  <span className="ml-auto rounded-full bg-[var(--portal)] px-2 py-0.5 text-xs text-white">
                    {item.badge}
                  </span>
                )}
              </a>
            ))}
          </div>
        ))}
      </nav>
    </aside>
  )
}
