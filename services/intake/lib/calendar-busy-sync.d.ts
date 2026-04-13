/**
 * calendar-busy-sync.ts — BKG-08
 * Syncs Google Calendar busy periods to Firestore calendar_busy collection.
 * Runs every 30 minutes via Cloud Scheduler.
 */
interface CalendarBusySyncResult {
    success: boolean;
    users_synced: number;
    months_written: number;
    errors: string[];
}
export declare function syncCalendarBusy(): Promise<CalendarBusySyncResult>;
export {};
//# sourceMappingURL=calendar-busy-sync.d.ts.map