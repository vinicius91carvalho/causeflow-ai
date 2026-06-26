import type { ApiKeyId, TenantId } from '../../../shared/domain/value-objects.js';
export type ApiKeyStatus = 'active' | 'revoked';
export interface ApiKey {
    keyId: ApiKeyId;
    tenantId: TenantId;
    name: string;
    keyHash: string;
    prefix: string;
    status: ApiKeyStatus;
    webhookSecretHash?: string;
    lastUsedAt?: string;
    createdAt: string;
    revokedAt?: string;
}
