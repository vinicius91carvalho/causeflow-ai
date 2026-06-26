import { Hono } from 'hono';
import type { AppEnv } from '../../../shared/infra/http/hono-types.js';
import type { GetIncidentAnalyticsUseCase } from '../application/get-incident-analytics.usecase.js';
export interface AnalyticsUseCases {
    getIncidentAnalytics: GetIncidentAnalyticsUseCase;
}
export declare function createAnalyticsRoutes(useCases: AnalyticsUseCases): Hono<AppEnv, import("hono/types").BlankSchema, "/">;
