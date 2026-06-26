export declare class AppError extends Error {
    readonly code: string;
    readonly statusCode: number;
    readonly details?: Record<string, unknown> | undefined;
    constructor(message: string, code: string, statusCode?: number, details?: Record<string, unknown> | undefined);
    toJSON(): {
        details?: Record<string, unknown> | undefined;
        error: string;
        message: string;
    };
}
export declare class NotFoundError extends AppError {
    constructor(resource: string, id: string);
}
export declare class ValidationError extends AppError {
    constructor(message: string, details?: Record<string, unknown>);
}
export declare class ConflictError extends AppError {
    constructor(message: string);
}
export declare class UnauthorizedError extends AppError {
    constructor(message?: string);
}
export declare class ForbiddenError extends AppError {
    constructor(message?: string);
}
export declare class RateLimitError extends AppError {
    constructor(retryAfterSeconds: number);
}
export declare class PaymentRequiredError extends AppError {
    constructor(message: string, suggestion?: 'upgrade' | 'update_payment' | 'renew' | 'reactivate', details?: Record<string, unknown>);
}
