import { Hono } from 'hono';
import type { AppEnv } from '../../../shared/infra/http/hono-types.js';
import type { ConnectCredentialUseCase } from '../application/connect-credential.usecase.js';
import type { DisconnectIntegrationUseCase } from '../application/disconnect-integration.usecase.js';
import type { ListAllIntegrationsUseCase } from '../application/list-all-integrations.usecase.js';
import type { IntegrationToolProvider } from '../../../shared/application/ports/integration-tool-provider.port.js';
export interface IntegrationUseCases {
    connectCredential: ConnectCredentialUseCase;
    disconnectIntegration: DisconnectIntegrationUseCase;
    listAllIntegrations: ListAllIntegrationsUseCase;
    composioToolProvider?: IntegrationToolProvider;
}
export declare function createIntegrationRoutes(useCases: IntegrationUseCases): Hono<AppEnv, import("hono/types").BlankSchema, "/">;
