import type { OAuthToken, OAuthTokenStore, OAuthTokenInfo, OAuthProvider } from '../../application/ports/oauth-token-store.port.js';
import type { TokenEncryption } from '../../application/ports/token-encryption.port.js';
import type { TenantId } from '../../domain/value-objects.js';
/**
 * DynamoDB OAuth token store with KMS envelope encryption.
 *
 * Security:
 * - accessToken and refreshToken are encrypted with AES-256-GCM before storage
 * - DEK (data encryption key) is KMS-encrypted — only KMS can decrypt it
 * - No API, route, or log ever sees the plaintext token
 * - getDecryptedToken() is the ONLY path to plaintext — restricted to agent tool calls
 */
export declare class DynamoOAuthTokenStore implements OAuthTokenStore {
    private readonly encryption;
    constructor(encryption: TokenEncryption);
    save(token: OAuthToken): Promise<void>;
    findInfo(tenantId: TenantId, provider: OAuthProvider): Promise<OAuthTokenInfo | null>;
    getDecryptedToken(tenantId: TenantId, provider: OAuthProvider): Promise<string | null>;
    delete(tenantId: TenantId, provider: OAuthProvider): Promise<void>;
    listByTenant(tenantId: TenantId): Promise<OAuthTokenInfo[]>;
    private toInfo;
}
