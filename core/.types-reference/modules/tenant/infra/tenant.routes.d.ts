import { Hono } from 'hono';
import type { AppEnv } from '../../../shared/infra/http/hono-types.js';
import type { CreateTenantUseCase } from '../application/create-tenant.usecase.js';
import type { GetTenantUseCase } from '../application/get-tenant.usecase.js';
import type { UpdateTenantUseCase } from '../application/update-tenant.usecase.js';
import type { ListTenantsUseCase } from '../application/list-tenants.usecase.js';
export interface TenantUseCases {
    createTenant: CreateTenantUseCase;
    getTenant: GetTenantUseCase;
    updateTenant: UpdateTenantUseCase;
    listTenants: ListTenantsUseCase;
}
export declare function createTenantRoutes(useCases: TenantUseCases): Hono<AppEnv, import("hono/types").BlankSchema, "/">;
