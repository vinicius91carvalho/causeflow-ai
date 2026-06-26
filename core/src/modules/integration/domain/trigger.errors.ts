export class TriggerAlreadyExistsError extends Error {
    readonly code = 'TRIGGER_ALREADY_EXISTS' as const;
    constructor(public readonly triggerSlug: string, public readonly tenantId: string) {
        super(`Trigger "${triggerSlug}" already exists for this tenant`);
        this.name = 'TriggerAlreadyExistsError';
    }
}
