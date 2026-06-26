import { Hono } from 'hono';
import type { AppEnv } from '../../../shared/infra/http/hono-types.js';
import type { HandleComposioWebhookUseCase } from '../application/handle-composio-webhook.usecase.js';
import type { CreateTriggerUseCase } from '../application/create-trigger.usecase.js';
import type { ListTriggersUseCase } from '../application/list-triggers.usecase.js';
import type { DeleteTriggerUseCase } from '../application/delete-trigger.usecase.js';
import type { ComposioTriggerService } from '../../../shared/infra/integrations/composio-trigger-service.js';
export interface ComposioWebhookDeps {
    handleComposioWebhook: HandleComposioWebhookUseCase;
}
export declare function createComposioWebhookRoute(deps: ComposioWebhookDeps): Hono<AppEnv, import("hono/types").BlankSchema, "/">;
export interface TriggerUseCases {
    createTrigger: CreateTriggerUseCase;
    listTriggers: ListTriggersUseCase;
    deleteTrigger: DeleteTriggerUseCase;
    composioTriggerService: ComposioTriggerService;
}
export declare function createTriggerRoutes(useCases: TriggerUseCases): Hono<AppEnv, import("hono/types").BlankSchema, "/">;
