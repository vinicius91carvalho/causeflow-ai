import type { TenantId } from '../../domain/value-objects.js';
export type OAuthProvider = 'trello' | 'notion' | 'shortcut' | 'jira' | 'linear' | 'hubspot' | 'confluence';
export interface OAuthToken {
    tenantId: TenantId;
    provider: OAuthProvider;
    accessToken: string;
    refreshToken?: string;
    expiresAt?: string;
    scopes?: string[];
    metadata?: Record<string, string>;
    createdAt: string;
    updatedAt: string;
}
/** Metadata-only view — NEVER contains plaintext tokens */
export interface OAuthTokenInfo {
    tenantId: TenantId;
    provider: OAuthProvider;
    connected: boolean;
    expiresAt?: string;
    scopes?: string[];
    metadata?: Record<string, string>;
    createdAt: string;
    updatedAt: string;
}
export interface OAuthTokenStore {
    /** Saves token with encryption — plaintext never persists */
    save(token: OAuthToken): Promise<void>;
    /** Returns metadata only — no tokens exposed */
    findInfo(tenantId: TenantId, provider: OAuthProvider): Promise<OAuthTokenInfo | null>;
    /** Returns decrypted token — use ONLY inside secure execution contexts (agent tool calls) */
    getDecryptedToken(tenantId: TenantId, provider: OAuthProvider): Promise<string | null>;
    delete(tenantId: TenantId, provider: OAuthProvider): Promise<void>;
    /** Returns metadata only — no tokens exposed */
    listByTenant(tenantId: TenantId): Promise<OAuthTokenInfo[]>;
}
