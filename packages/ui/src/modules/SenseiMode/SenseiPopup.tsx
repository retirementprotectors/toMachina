/**
 * SenseiPopup — TRK-SNS-008
 *
 * Floating card triggered on click of overlay dot.
 * Shows: module name, description, 'View Training' link.
 * Dismissible. Positioned near element.
 */

'use client'

import React from 'react'
import { useSensei } from './SenseiProvider'
import { getSenseiEntry } from './sensei-registry'

export function SenseiPopup() {
  const { popupState, hidePopup } = useSensei()

  if (!popupState) return null

  const entry = getSenseiEntry(popupState.moduleId)
  if (!entry) return null

  const top = Math.min(popupState.anchorRect.bottom + 8, window.innerHeight - 200)
  const left = Math.min(popupState.anchorRect.left, window.innerWidth - 320)

  return (
    <>
      <div
        className="fixed inset-0 z-[99]"
        onClick={hidePopup}
      />
      <div
        className="fixed z-[100] w-[300px] rounded-xl shadow-xl border"
        style={{
          top,
          left,
          background: 'var(--bg-card, #fff)',
          borderColor: 'rgba(245,158,11,0.3)',
        }}
      >
        <div className="p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span
                className="material-icons-outlined"
                style={{ fontSize: '18px', color: 'rgb(245,158,11)' }}
              >
                school
              </span>
              <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                {entry.label}
              </h3>
            </div>
            <button
              onClick={hidePopup}
              className="text-xs cursor-pointer"
              style={{ color: 'var(--text-muted)' }}
            >
              <span className="material-icons-outlined" style={{ fontSize: '16px' }}>close</span>
            </button>
          </div>
          <p className="text-xs mb-3" style={{ color: 'var(--text-secondary)' }}>
            Training content available for this module.
          </p>
          <a
            href={`/api/sensei/${entry.moduleId}/training`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-medium rounded-lg px-3 py-1.5 transition-colors"
            style={{
              background: 'rgba(245,158,11,0.12)',
              color: 'rgb(245,158,11)',
            }}
          >
            <span className="material-icons-outlined" style={{ fontSize: '14px' }}>open_in_new</span>
            View Full Training
          </a>
        </div>
      </div>
    </>
  )
}
