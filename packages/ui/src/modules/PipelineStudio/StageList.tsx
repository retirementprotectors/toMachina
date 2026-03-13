'use client'

import { useState, useRef, useCallback } from 'react'
import type { FlowStageDef } from '@tomachina/core'

// ============================================================================
// StageList — Left rail: reorderable stage list with drag-and-drop
// ============================================================================

export interface StageListProps {
  stages: FlowStageDef[]
  selectedStageId: string | null
  onSelectStage: (stageId: string) => void
  onAddStage: () => void
  onReorderStages: (stages: FlowStageDef[]) => void
  onDeleteStage: (stageId: string) => void
}

/* --- Context Menu --- */

function StageContextMenu({
  x,
  y,
  onEdit,
  onDuplicate,
  onDelete,
  onClose,
}: {
  x: number
  y: number
  onEdit: () => void
  onDuplicate: () => void
  onDelete: () => void
  onClose: () => void
}) {
  return (
    <>
      {/* Invisible overlay to capture outside clicks */}
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className="fixed z-50 min-w-[140px] rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] py-1 shadow-xl"
        style={{ left: x, top: y }}
      >
        <button
          onClick={onEdit}
          className="flex w-full items-center gap-2 px-3 py-2 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-surface)]"
        >
          <span className="material-icons-outlined" style={{ fontSize: '14px' }}>edit</span>
          Edit
        </button>
        <button
          onClick={onDuplicate}
          className="flex w-full items-center gap-2 px-3 py-2 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-surface)]"
        >
          <span className="material-icons-outlined" style={{ fontSize: '14px' }}>content_copy</span>
          Duplicate
        </button>
        <div className="my-1 border-t border-[var(--border-subtle)]" />
        <button
          onClick={onDelete}
          className="flex w-full items-center gap-2 px-3 py-2 text-xs text-red-400 hover:bg-red-500/5"
        >
          <span className="material-icons-outlined" style={{ fontSize: '14px' }}>delete</span>
          Delete
        </button>
      </div>
    </>
  )
}

/* --- Stage Item --- */

function StageItem({
  stage,
  index,
  isSelected,
  taskCount,
  onSelect,
  onContextMenu,
  onDragStart,
  onDragEnter,
  onDragOver,
  onDrop,
  onDragEnd,
  isDragTarget,
}: {
  stage: FlowStageDef
  index: number
  isSelected: boolean
  taskCount?: number
  onSelect: () => void
  onContextMenu: (e: React.MouseEvent) => void
  onDragStart: (e: React.DragEvent) => void
  onDragEnter: (e: React.DragEvent) => void
  onDragOver: (e: React.DragEvent) => void
  onDrop: (e: React.DragEvent) => void
  onDragEnd: () => void
  isDragTarget: boolean
}) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      onClick={onSelect}
      onContextMenu={onContextMenu}
      className={`flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2.5 transition-all ${
        isSelected
          ? 'border border-[var(--portal)] bg-[var(--portal-glow)]'
          : 'border border-transparent hover:bg-[var(--bg-surface)]'
      } ${isDragTarget ? 'border-dashed border-[var(--portal)] bg-[var(--portal-glow)]' : ''}`}
    >
      {/* Drag handle */}
      <span className="material-icons-outlined shrink-0 cursor-grab text-[var(--text-muted)] active:cursor-grabbing" style={{ fontSize: '14px' }}>
        drag_indicator
      </span>

      {/* Color dot */}
      <span
        className="h-3 w-3 shrink-0 rounded-full border border-white/20"
        style={{ backgroundColor: stage.stage_color || 'var(--portal)' }}
      />

      {/* Stage info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-xs font-medium text-[var(--text-primary)]">
            {stage.stage_name}
          </span>
          {stage.gate_enforced && (
            <span className="material-icons-outlined shrink-0 text-amber-400" style={{ fontSize: '12px' }}>
              lock
            </span>
          )}
        </div>
        {stage.stage_description && (
          <p className="mt-0.5 truncate text-[10px] text-[var(--text-muted)]">
            {stage.stage_description}
          </p>
        )}
      </div>

      {/* Task count badge */}
      {taskCount !== undefined && taskCount > 0 && (
        <span className="shrink-0 rounded-full bg-[var(--bg-surface)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--text-muted)]">
          {taskCount}
        </span>
      )}
    </div>
  )
}

/* --- Main Component --- */

export default function StageList({
  stages,
  selectedStageId,
  onSelectStage,
  onAddStage,
  onReorderStages,
  onDeleteStage,
}: StageListProps) {
  const [contextMenu, setContextMenu] = useState<{
    stageId: string
    x: number
    y: number
  } | null>(null)
  const dragIndexRef = useRef<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  const sorted = [...stages].sort((a, b) => a.stage_order - b.stage_order)

  /* --- Drag handlers --- */
  const handleDragStart = useCallback((index: number) => (e: React.DragEvent) => {
    dragIndexRef.current = index
    e.dataTransfer.effectAllowed = 'move'
    // Set a minimal drag image data to enable drag
    e.dataTransfer.setData('text/plain', String(index))
  }, [])

  const handleDragEnter = useCallback((index: number) => (e: React.DragEvent) => {
    e.preventDefault()
    setDragOverIndex(index)
  }, [])

  const handleDragOver = useCallback((_index: number) => (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }, [])

  const handleDrop = useCallback((dropIndex: number) => (e: React.DragEvent) => {
    e.preventDefault()
    const fromIndex = dragIndexRef.current
    if (fromIndex === null || fromIndex === dropIndex) {
      setDragOverIndex(null)
      return
    }

    const reordered = [...sorted]
    const [moved] = reordered.splice(fromIndex, 1)
    reordered.splice(dropIndex, 0, moved)

    // Reassign stage_order
    const updated = reordered.map((stage, i) => ({
      ...stage,
      stage_order: i + 1,
    }))

    onReorderStages(updated)
    setDragOverIndex(null)
    dragIndexRef.current = null
  }, [sorted, onReorderStages])

  const handleDragEnd = useCallback(() => {
    dragIndexRef.current = null
    setDragOverIndex(null)
  }, [])

  /* --- Context menu handler --- */
  const handleContextMenu = useCallback((stageId: string) => (e: React.MouseEvent) => {
    e.preventDefault()
    setContextMenu({ stageId, x: e.clientX, y: e.clientY })
  }, [])

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-3">
        <div className="flex items-center gap-2">
          <span className="material-icons-outlined" style={{ fontSize: '16px', color: 'var(--portal)' }}>
            layers
          </span>
          <span className="text-xs font-semibold text-[var(--text-primary)]">Stages</span>
          <span className="text-[10px] text-[var(--text-muted)]">({sorted.length})</span>
        </div>
      </div>

      {/* Stage list */}
      <div className="flex-1 space-y-0.5 overflow-y-auto px-2">
        {sorted.map((stage, index) => (
          <StageItem
            key={stage.stage_id}
            stage={stage}
            index={index}
            isSelected={selectedStageId === stage.stage_id}
            onSelect={() => onSelectStage(stage.stage_id)}
            onContextMenu={handleContextMenu(stage.stage_id)}
            onDragStart={handleDragStart(index)}
            onDragEnter={handleDragEnter(index)}
            onDragOver={handleDragOver(index)}
            onDrop={handleDrop(index)}
            onDragEnd={handleDragEnd}
            isDragTarget={dragOverIndex === index}
          />
        ))}

        {sorted.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <span className="material-icons-outlined text-2xl text-[var(--text-muted)]">layers</span>
            <p className="mt-2 text-xs text-[var(--text-muted)]">No stages yet</p>
          </div>
        )}
      </div>

      {/* Add stage button */}
      <div className="border-t border-[var(--border-subtle)] p-2">
        <button
          onClick={onAddStage}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-[var(--border-subtle)] py-2 text-xs font-medium text-[var(--text-muted)] transition-colors hover:border-[var(--portal)] hover:text-[var(--portal)]"
        >
          <span className="material-icons-outlined" style={{ fontSize: '14px' }}>add</span>
          Add Stage
        </button>
      </div>

      {/* Context menu */}
      {contextMenu && (
        <StageContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onEdit={() => {
            onSelectStage(contextMenu.stageId)
            setContextMenu(null)
          }}
          onDuplicate={() => {
            // Duplicate = select and let DetailEditor handle it
            onSelectStage(contextMenu.stageId)
            setContextMenu(null)
          }}
          onDelete={() => {
            onDeleteStage(contextMenu.stageId)
            setContextMenu(null)
          }}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  )
}
