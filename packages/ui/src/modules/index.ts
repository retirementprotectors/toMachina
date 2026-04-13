// Shared feature modules — rendered identically across all portals via CSS variable theming.
// Each portal page imports from here and passes a `portal` prop.

export { MyRpiProfile } from './MyRpiProfile'
export { ConnectPanel } from './ConnectPanel'

export { CamDashboard } from './CamDashboard'
export { C3Manager } from './C3Manager'
export { DexDocCenter } from './DexDocCenter'
export { MegazordCommandCenter } from './MegazordCommandCenter'
export { MusashiCommandCenter } from './MusashiCommandCenter'
export { CommandCenter, CommandCenterPage } from './CommandCenter'
export type { CommandCenterPageProps } from './CommandCenter'
export { LeadershipCenter } from './LeadershipCenter'
export { AdminPanel } from './AdminPanel'
export { CommsCenter } from './CommsCenter'
export { CommsModule } from './CommsModule'
export { OmniPanel } from './OmniPanel'
export type { OmniPanelProps, OmniTab } from './OmniPanel'

export { PipelineStudio } from './PipelineStudio'
export { SystemSynergy } from './SystemSynergy'
export type { SystemSynergyProps } from './SystemSynergy'
export { PipelineKanban } from './PipelineKanban'
export { PipelineInstance } from './PipelineInstance'
export { PipelineAdmin } from './PipelineAdmin'
export { Forge } from './Forge'
export { ForgeAudit } from './ForgeAudit'
export { ForgeConfirmWalkthrough } from './ForgeConfirmWalkthrough'
export { ProZone, TerritoryBuilder, SpecialistConfigEditor } from './ProZone'

export { QueRegistry } from './QueRegistry'
export { QueWorkbench } from './QueWorkbench'
export { Guardian } from './Guardian'
export { IntakeQueue } from './IntakeQueue'
export { ActionQueue } from './ActionQueue'

export { NotificationsModule, UnreadBadge } from './Notifications'

export { MDJPanel } from './MDJPanel'

export { ClientDocuments } from './ClientDocuments'
export { AccountDocuments } from './AccountDocuments'

export { RSPYellowQUE, RSPTransitionPanel, RSPServiceHandoff, RSPAccountReview, RSPAuthStatus, RSPBlueGate, RSPClientProfile, RSPDiscoveryPanel, RSPReportTracker } from './RSPPipeline'
export type { RSPYellowQUEProps, RSPAccount, RSPAccountReviewProps, RSPAuthStatusProps, RSPBlueGateProps, RSPClientProfileProps, RSPDiscoveryPanelProps, RSPReportTrackerProps } from './RSPPipeline'

export { SenseiHeatmap } from './SenseiHeatmap'

export { MystAIPage, MystAIBioCard, MystAIBioPage, MystAISection } from './MystAI'
export type { MystAIPageProps, MystAIBioCardProps, MystAIBioPageProps, MystAISectionProps } from './MystAI'

export { SenseiProvider, useSensei, SenseiToggle, SenseiOverlay, SenseiPopup, SENSEI_REGISTRY, getSenseiEntry } from './SenseiMode'
export type { SenseiToggleProps, SenseiRegistryEntry } from './SenseiMode'
