export type CircuitState = 'closed' | 'open' | 'half_open';
export interface CircuitBreakerOptions {
    failureThreshold?: number;
    resetTimeoutMs?: number;
    halfOpenMaxAttempts?: number;
}
export declare class CircuitBreaker {
    private state;
    private failureCount;
    private lastFailureTime;
    private halfOpenAttempts;
    private readonly failureThreshold;
    private readonly resetTimeoutMs;
    private readonly halfOpenMaxAttempts;
    private readonly onStateChange?;
    constructor(options?: CircuitBreakerOptions, onStateChange?: (from: CircuitState, to: CircuitState) => void);
    getState(): CircuitState;
    execute<T>(fn: () => Promise<T>): Promise<T>;
    private onSuccess;
    private onFailure;
    private transition;
    reset(): void;
}
export declare class CircuitBreakerOpenError extends Error {
    readonly retryAfterMs: number;
    constructor(retryAfterMs: number);
}
