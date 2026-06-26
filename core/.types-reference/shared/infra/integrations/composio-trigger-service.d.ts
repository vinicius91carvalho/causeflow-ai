export interface ComposioTriggerResult {
    composioTriggerId: string;
    connectedAccountId: string;
}
export interface AvailableTrigger {
    slug: string;
    app: string;
    description: string;
}
/**
 * Composio Trigger mappings — maps CauseFlow provider names to known trigger slugs.
 */
export declare const TRIGGER_CATALOG: Record<string, AvailableTrigger[]>;
/**
 * Wraps Composio SDK trigger operations.
 * Falls back to direct HTTP calls when SDK methods are unavailable.
 */
export declare class ComposioTriggerService {
    private baseUrl;
    registerWebhookSubscription(webhookUrl: string): Promise<void>;
    createTrigger(userId: string, triggerSlug: string, triggerConfig: Record<string, unknown>): Promise<ComposioTriggerResult>;
    deleteTrigger(composioTriggerId: string): Promise<void>;
    listAvailableTriggers(): AvailableTrigger[];
    getTriggersForProvider(provider: string): AvailableTrigger[];
    getComposioApp(provider: string): string | undefined;
}
