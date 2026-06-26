export interface TriggerProviderResult {
    composioTriggerId: string;
    connectedAccountId: string;
}

export interface ITriggerProviderService {
    createTrigger(
        connectedAccountId: string,
        triggerSlug: string,
        triggerConfig: Record<string, unknown>,
        provider?: string,
    ): Promise<TriggerProviderResult>;
}
