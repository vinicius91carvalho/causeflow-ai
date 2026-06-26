/**
 * In-memory registry of active investigations.
 * Tracks AbortControllers so running investigations can be cancelled.
 */
export declare class InvestigationRegistry {
    private readonly active;
    private key;
    register(tenantId: string, incidentId: string): AbortController;
    abort(tenantId: string, incidentId: string): boolean;
    remove(tenantId: string, incidentId: string): void;
    isActive(tenantId: string, incidentId: string): boolean;
}
