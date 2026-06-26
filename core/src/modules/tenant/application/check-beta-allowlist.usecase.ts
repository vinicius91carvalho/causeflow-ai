
export interface BetaAllowlistResult {
    allowed: boolean;
}

export class CheckBetaAllowlistUseCase {
    execute(_email: string): Promise<BetaAllowlistResult> {
        // In dev/staging, always allow. Production will use DynamoDB lookup.
        return Promise.resolve({ allowed: true });
    }
}
