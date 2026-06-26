export declare const INVESTIGATION_PROGRESS_CHANNEL = "causeflow:investigation:progress";
export interface ProgressEvent {
    eventType: string;
    tenantId: string;
    payload: Record<string, unknown>;
}
/**
 * Publishes a progress event to a Redis channel.
 * Creates a short-lived connection per publish (worker context).
 */
export declare function publishProgress(channel: string, event: ProgressEvent): Promise<void>;
/**
 * Subscribes to a Redis channel for progress events.
 * Returns an unsubscribe function. Used by the main backend process.
 */
export declare function subscribeProgress(channel: string, handler: (event: ProgressEvent) => void): Promise<() => Promise<void>>;
