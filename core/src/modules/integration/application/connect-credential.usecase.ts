import { IntegrationEntity } from '../../../shared/infra/db/entities/IntegrationEntity.js';
import { integrationId } from '../../../shared/domain/value-objects.js';
import { ValidationError } from '../../../shared/domain/errors.js';
import { config } from '../../../shared/config/index.js';
import type { TokenEncryption } from '../../../shared/application/ports/token-encryption.port.js';
import type { IEventBus } from '../../../shared/domain/events.js';
import type { TenantId } from '../../../shared/domain/value-objects.js';

export interface ConnectCredentialInput {
    tenantId: TenantId;
    provider: string;
    credentials: Record<string, string>;
    connectedBy: string;
}

export interface ConnectCredentialOutput {
    integrationId: string;
    provider: string;
    status: string;
    connectedBy: string;
    createdAt: string;
}

export class ConnectCredentialUseCase {
    encryption;
    eventBus;
    constructor(encryption: TokenEncryption, eventBus?: IEventBus) {
        this.encryption = encryption;
        this.eventBus = eventBus;
    }
    async execute(input: ConnectCredentialInput): Promise<ConnectCredentialOutput> {
        const { tenantId, provider, credentials, connectedBy } = input;
        if (!provider || typeof provider !== 'string') {
            throw new ValidationError('Provider is required');
        }
        if (!credentials || Object.keys(credentials).length === 0) {
            throw new ValidationError('Credentials are required');
        }

        // Validate AWS credentials by attempting AssumeRole before saving
        if (provider === 'aws' && credentials.roleArn) {
            const { STSClient, AssumeRoleCommand } = await import('@aws-sdk/client-sts');
            const stsClient = new STSClient({
                region: config.aws.region,
                ...(config.sts.stsEndpoint && { endpoint: config.sts.stsEndpoint }),
            });
            try {
                await stsClient.send(new AssumeRoleCommand({
                    RoleArn: credentials.roleArn,
                    RoleSessionName: 'causeflow-validate-connection',
                    ExternalId: String(tenantId),
                    DurationSeconds: 900,
                }));
            } catch (err) {
                const msg = err instanceof Error ? err.message : 'Unknown error';
                throw new ValidationError(`AWS connection failed: ${msg}. Please verify your IAM Role trust policy and try again.`);
            }
        }

        // Encrypt the entire credentials blob as JSON
        const plaintext = JSON.stringify(credentials);
        const encrypted = await this.encryption.encrypt(plaintext);
        const intId = integrationId(`${provider}-credential`);
        const now = new Date().toISOString();
        await IntegrationEntity.upsert({
            tenantId,
            integrationId: intId,
            provider,
            category: provider === 'aws' ? 'cloud' : 'chat',
            status: 'active',
            displayName: provider.charAt(0).toUpperCase() + provider.slice(1),
            encryptedCredentials: encrypted.ciphertext,
            credentialIv: encrypted.iv,
            credentialTag: encrypted.tag,
            credentialDek: encrypted.encryptedDek,
            connectedBy,
            config: {},
        }).go();
        await this.eventBus?.publish({
            eventType: 'integration.connected',
            occurredAt: now,
            tenantId: tenantId,
            payload: { integrationId: intId, provider, connectedBy },
        });
        return {
            integrationId: intId,
            provider,
            status: 'active',
            connectedBy,
            createdAt: now,
        };
    }
}
