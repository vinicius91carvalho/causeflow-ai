import { STSClient, AssumeRoleCommand } from '@aws-sdk/client-sts';
import { buildSessionPolicy } from './role-policy-builder.js';
import { config } from '../../config/index.js';
import { logger } from '../logger.js';
import type { CredentialVendor, CredentialRequest } from '../../application/ports/credential-vendor.port.js';
import type { CloudCredentials } from '../../application/ports/cloud-provider.port.js';
import type { ITenantRepository } from '../../../modules/tenant/domain/tenant.repository.js';
import type { GetCloudIntegrationUseCase } from '../../../modules/integration/application/get-cloud-integration.usecase.js';
const AGENT_DURATION_SECONDS = 900;
const REMEDIATION_DURATION_SECONDS = 3600;
export class STSCredentialVendor {
    client;
    tenantRepo;
    getCloudIntegration;
    constructor(client?: STSClient, tenantRepo?: ITenantRepository, getCloudIntegration?: GetCloudIntegrationUseCase) {
        this.client = client ?? new STSClient({
            region: config.aws.region,
            ...(config.sts.stsEndpoint && { endpoint: config.sts.stsEndpoint }),
        });
        this.tenantRepo = tenantRepo;
        this.getCloudIntegration = getCloudIntegration;
    }
    async resolveIntegration(request: CredentialRequest): Promise<{ roleArn: string; region?: string } | null> {
        // 1. Try Integration entity (generic model)
        if (this.getCloudIntegration) {
            try {
                const cloudIntegration = await this.getCloudIntegration.execute(request.tenantId as import('../../domain/value-objects.js').TenantId);
                if (cloudIntegration) {
                    logger.info({ tenantId: request.tenantId, roleArn: cloudIntegration.roleArn, region: cloudIntegration.region }, 'Using AWS role from Integration entity');
                    return { roleArn: cloudIntegration.roleArn, region: cloudIntegration.region };
                }
            }
            catch (err) {
                logger.warn({ err, tenantId: request.tenantId }, 'Failed to lookup cloud integration, falling back to tenant settings');
            }
        }
        // 2. Fallback to request-level or global config
        const fallbackArn = request.requestedPermissions[0] ?? config.sts.roleArn;
        return fallbackArn ? { roleArn: fallbackArn } : null;
    }
    async vend(request: CredentialRequest): Promise<CloudCredentials> {
        const integration = await this.resolveIntegration(request);
        const roleArn = integration?.roleArn;
        if (!roleArn) {
            throw new Error('No AWS Role ARN configured for credential vending');
        }
        const isRemediation = request.agentRole === 'remediator';
        const duration = isRemediation ? REMEDIATION_DURATION_SECONDS : AGENT_DURATION_SECONDS;
        const sessionName = `${config.sts.roleSessionPrefix}-${request.incidentId}-${request.agentRole}`.slice(0, 64);
        logger.info({ tenantId: request.tenantId, incidentId: request.incidentId, agentRole: request.agentRole, duration }, 'Vending STS credentials');
        // Session policy omitted for investigation agents — customer's role defines permissions.
        // aws_api_call tool handler validates read-only actions as defense-in-depth.
        // Only remediator gets a session policy (allows specific write actions).
        const command = new AssumeRoleCommand({
            RoleArn: roleArn,
            RoleSessionName: sessionName,
            ExternalId: request.tenantId,
            DurationSeconds: duration,
            ...(isRemediation && { Policy: buildSessionPolicy(request.agentRole) }),
        });
        const response = await this.client.send(command);
        if (!response.Credentials) {
            throw new Error('STS AssumeRole returned no credentials');
        }
        const clientRegion = integration?.region ?? config.aws.region;
        logger.info({ tenantId: request.tenantId, region: clientRegion }, 'Credentials vended with region');
        return {
            provider: 'aws',
            credentials: {
                accessKeyId: response.Credentials.AccessKeyId ?? '',
                secretAccessKey: response.Credentials.SecretAccessKey ?? '',
                sessionToken: response.Credentials.SessionToken ?? '',
            },
            region: clientRegion,
            expiresAt: response.Credentials.Expiration?.toISOString(),
        };
    }
    async revoke(_tenantId: string, _incidentId: string): Promise<void> {
        logger.info({ tenantId: _tenantId, incidentId: _incidentId }, 'STS credentials will expire naturally (no explicit revocation)');
    }
}
