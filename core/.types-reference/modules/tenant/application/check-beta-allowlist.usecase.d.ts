export interface BetaAllowlistResult {
    allowed: boolean;
}
export declare class CheckBetaAllowlistUseCase {
    execute(_email: string): Promise<BetaAllowlistResult>;
}
