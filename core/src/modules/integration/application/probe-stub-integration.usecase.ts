import { ValidationError } from '../../../shared/domain/errors.js';
import type { TenantId } from '../../../shared/domain/value-objects.js';
import type { IIntegrationRepository } from '../domain/integration.repository.js';

export interface ProbeStubIntegrationInput {
  tenantId: TenantId;
}

export interface ProbeStubIntegrationOutput {
  success: boolean;
  message: string;
  probeCount: number;
  stubState: Record<string, unknown>;
  probedAt: string;
}

export class ProbeStubIntegrationUseCase {
  constructor(private readonly integrationRepo: IIntegrationRepository) {}

  async execute(input: ProbeStubIntegrationInput): Promise<ProbeStubIntegrationOutput> {
    const integration = await this.integrationRepo.findByProvider(input.tenantId, 'stub-upstream');
    if (!integration) {
      throw new ValidationError('Stub upstream integration is not connected for this tenant');
    }

    const stubBaseUrl = String(integration.config['stubBaseUrl'] ?? '').replace(/\/$/, '');
    if (!stubBaseUrl) {
      throw new ValidationError('Stub integration is missing stubBaseUrl');
    }

    let res: Response;
    try {
      res = await fetch(`${stubBaseUrl}/v1/probe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: String(input.tenantId) }),
        signal: AbortSignal.timeout(10_000),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new ValidationError(`Stub upstream unreachable at ${stubBaseUrl}: ${message}`);
    }
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      throw new ValidationError(
        typeof body['error'] === 'string'
          ? body['error']
          : `Stub probe failed with HTTP ${res.status}`,
      );
    }

    const probedAt = new Date().toISOString();
    await this.integrationRepo.updateHealthCheck(
      input.tenantId,
      integration.integrationId,
      probedAt,
    );

    const stubState = (body['state'] as Record<string, unknown>) ?? {};
    const probeCount = Number(body['probeCount'] ?? stubState['probeCount'] ?? 0);

    return {
      success: true,
      message: 'Stub upstream probe succeeded',
      probeCount,
      stubState,
      probedAt,
    };
  }
}
