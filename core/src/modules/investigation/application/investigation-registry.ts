/**
 * In-memory registry of active investigations.
 * Tracks AbortControllers so running investigations can be cancelled.
 */
export class InvestigationRegistry {
    active = new Map<string, AbortController>();
    key(tenantId: string, incidentId: string) {
        return `${tenantId}:${incidentId}`;
    }
    register(tenantId: string, incidentId: string): AbortController {
        const k = this.key(tenantId, incidentId);
        // If already active, abort the previous one
        this.active.get(k)?.abort();
        const controller = new AbortController();
        this.active.set(k, controller);
        return controller;
    }
    abort(tenantId: string, incidentId: string): boolean {
        const k = this.key(tenantId, incidentId);
        const controller = this.active.get(k);
        if (!controller)
            return false;
        controller.abort();
        this.active.delete(k);
        return true;
    }
    remove(tenantId: string, incidentId: string): void {
        this.active.delete(this.key(tenantId, incidentId));
    }
    isActive(tenantId: string, incidentId: string): boolean {
        return this.active.has(this.key(tenantId, incidentId));
    }
}
