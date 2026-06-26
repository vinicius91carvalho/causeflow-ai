declare module '@vectorize-io/hindsight-client' {
    export class HindsightClient {
        constructor(opts: { baseUrl: string; apiKey?: string });
        retain(bankId: string, content: string, opts?: any): Promise<void>;
        recall(bankId: string, query: string, opts?: any): Promise<{ results: Array<{ text: string; type: string; score?: number }> }>;
        reflect(bankId: string, query: string, opts?: any): Promise<{ text: string }>;
        createBank(bankId: string, opts?: any): Promise<void>;
        updateBankConfig(bankId: string, config: any): Promise<void>;
        createDirective(bankId: string, name: string, content: string, opts?: any): Promise<void>;
    }
}
