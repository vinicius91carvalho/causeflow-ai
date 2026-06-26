import { Composio } from '@composio/core';
/**
 * Singleton Composio client (v3 SDK).
 * Returns null if COMPOSIO_API_KEY is not configured.
 */
export declare function getComposioClient(): Composio | null;
/**
 * Mapping of CauseFlow integration types to Composio app names.
 */
export declare const COMPOSIO_APP_MAP: Record<string, string>;
/**
 * Providers managed by Composio (OAuth + actions).
 */
export declare const COMPOSIO_PROVIDERS: Set<string>;
/**
 * Providers handled by our own infra (IAM roles, connection strings, API keys).
 */
export declare const DIY_PROVIDERS: Set<string>;
