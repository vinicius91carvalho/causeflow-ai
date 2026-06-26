import { Hono } from 'hono';
import type { AppEnv } from '../../../shared/infra/http/hono-types.js';
import type { CreateApiKeyUseCase } from '../application/create-api-key.usecase.js';
import type { ListApiKeysUseCase } from '../application/list-api-keys.usecase.js';
import type { RevokeApiKeyUseCase } from '../application/revoke-api-key.usecase.js';
export interface ApiKeyUseCases {
    createApiKey: CreateApiKeyUseCase;
    listApiKeys: ListApiKeysUseCase;
    revokeApiKey: RevokeApiKeyUseCase;
}
export declare function createApiKeyRoutes(useCases: ApiKeyUseCases): Hono<AppEnv, import("hono/types").BlankSchema, "/">;
