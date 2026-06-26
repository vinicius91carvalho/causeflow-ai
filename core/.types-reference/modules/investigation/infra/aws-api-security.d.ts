/**
 * AWS API Security Layer — validates that only read-only actions are allowed.
 *
 * Defense-in-depth:
 * 1. READ_ONLY_PREFIXES allowlist (this file)
 * 2. BLOCKED_ACTIONS explicit denylist (this file)
 * 3. STS session policy (IAM side) — denies writes even if 1+2 are bypassed
 */
export declare function isReadOnlyAction(service: string, action: string): boolean;
export declare function validateAwsApiCall(service: string, action: string): void;
