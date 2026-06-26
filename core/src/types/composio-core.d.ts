/* eslint-disable @typescript-eslint/no-explicit-any */
declare module '@composio/core' {
    export class Composio {
        constructor(opts: { apiKey: string });
        create(userId: string): Promise<any>;
        connectedAccounts: {
            list(opts: { userIds: string[] }): Promise<{ items?: any[] }>;
            delete(connectedAccountId: string): Promise<void>;
        };
        triggers: {
            setup(opts: { connectedAccountId: string; triggerName: string; config: Record<string, unknown> }): Promise<any>;
            create(userId: string, triggerSlug: string, opts: any): Promise<any>;
            list(opts: { connectedAccountIds: string[] }): Promise<any[]>;
            disable(opts: { triggerId: string }): Promise<void>;
            delete(triggerId: string): Promise<void>;
            subscribe(callback: (data: any) => void): { unsubscribe(): void };
        };
    }
}
