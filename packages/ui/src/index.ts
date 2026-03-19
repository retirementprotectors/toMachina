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
export { ReportButton } from './components/ReportButton'
export { DraggableFAB } from './components/DraggableFAB'
export { IntakeFAB } from './components/IntakeFAB'
export { WireDiagram, WireDiagramList } from './components/WireDiagram'

// App brand system
export { APP_BRANDS, type AppKey, type AppBrand } from './apps/brands'
export { AppIcon } from './apps/AppIcon'
export { AppWrapper } from './apps/AppWrapper'

// Shared feature modules
export * from './modules'
