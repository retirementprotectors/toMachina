// ─── MEGAZORD — UI Module Barrel ────────────────────────────────────────────
// Subdir module shape (matches SystemSynergy/CommandCenter convention).
// MegazordCommandCenter is the public entrypoint; Dashboard + MeshView are
// internal sub-views composed by CommandCenter. Future guardian/ subdir lands
// from RONIN per Guardian-consolidation directive (SHINOB1 2026-04-14).
// ─────────────────────────────────────────────────────────────────────────────

export { MegazordCommandCenter } from './MegazordCommandCenter'
export { MegazordDashboard } from './MegazordDashboard'
export { MegazordMeshView } from './MegazordMeshView'
