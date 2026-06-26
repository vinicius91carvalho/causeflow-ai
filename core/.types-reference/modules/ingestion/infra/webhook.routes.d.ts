import { Hono } from 'hono';
import type { IngestAlertUseCase } from '../application/ingest-alert.usecase.js';
import type { AppEnv } from '../../../shared/infra/http/hono-types.js';
import type { CheckQuotaUseCase } from '../../billing/application/check-quota.usecase.js';
import type { RecordUsageUseCase } from '../../billing/application/record-usage.usecase.js';
import type { IApiKeyRepository } from '../../tenant/domain/api-key.repository.js';
export interface WebhookUseCases {
    ingestAlert: IngestAlertUseCase;
    checkQuota?: CheckQuotaUseCase;
    recordUsage?: RecordUsageUseCase;
    apiKeyRepo?: IApiKeyRepository;
}
export declare function createWebhookRoutes(useCases: WebhookUseCases): Hono<AppEnv, import("hono/types").BlankSchema, "/">;
