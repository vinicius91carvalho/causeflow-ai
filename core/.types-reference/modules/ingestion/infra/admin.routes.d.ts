import { Hono } from 'hono';
import type { AppEnv } from '../../../shared/infra/http/hono-types.js';
import type { IIncidentRepository } from '../domain/incident.repository.js';
export interface AdminDeps {
    incidentRepo: IIncidentRepository;
}
export declare function createAdminRoutes(deps: AdminDeps): Hono<AppEnv, import("hono/types").BlankSchema, "/">;
