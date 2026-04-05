/**
 * WIRE ROUTER — Maps file metadata to the correct Ranger (ZRD-O10).
 * Used by all intake channels (Drive, Slack, Email) to determine
 * which Ranger should process a given file.
 */
/** Ranger routing result */
export interface WireRoute {
    rangerId: string;
    wireId: string;
    mode: 'csv' | 'document' | 'commission';
    confidence: number;
    reason: string;
}
/** File metadata for routing decisions */
export interface FileMetadata {
    filename: string;
    mimeType: string;
    size?: number;
    senderHint?: string;
    subjectHint?: string;
}
/**
 * Route a file to the appropriate Ranger based on metadata.
 * Priority: file type → filename patterns → sender hints → default.
 */
export declare function routeToRanger(meta: FileMetadata): WireRoute;
/**
 * Check if a route has high enough confidence for auto-dispatch.
 * Low-confidence routes should be queued for manual review instead.
 */
export declare function isAutoDispatchable(route: WireRoute, threshold?: number): boolean;
//# sourceMappingURL=wire-router.d.ts.map