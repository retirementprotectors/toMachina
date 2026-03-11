// toMachina Shared UI Components
// Phase 1 will port PortalStandard.html components here

export { Sidebar } from './components/Sidebar'
export { Modal } from './components/Modal'
export { ToastProvider, useToast } from './components/Toast'
export { ConfirmProvider, useConfirm } from './components/ConfirmDialog'
export { LoadingOverlay } from './components/LoadingOverlay'
export { SmartLookup } from './components/SmartLookup'
export { DataTable } from './components/DataTable'
export { KanbanBoard } from './components/KanbanBoard'
export type { KanbanCard, KanbanColumn } from './components/KanbanBoard'
export { PortalSwitcher } from './components/PortalSwitcher'

// Shared feature modules
export * from './modules'
