import { Hono } from 'hono';
import type { AppEnv } from '../../../shared/infra/http/hono-types.js';
import type { GetIncidentAnalyticsUseCase } from '../application/get-incident-analytics.usecase.js';

export interface AnalyticsUseCases {
    getIncidentAnalytics: GetIncidentAnalyticsUseCase;
}

export function createAnalyticsRoutes(useCases: AnalyticsUseCases): Hono<AppEnv, import("hono/types").BlankSchema, "/"> {
    const app = new Hono<AppEnv>();
    app.get('/incidents', async (c) => {
        const tenantId = c.get('tenantId');
        const analytics = await useCases.getIncidentAnalytics.execute(tenantId);
        return c.json(analytics);
    });
    return app;
}
