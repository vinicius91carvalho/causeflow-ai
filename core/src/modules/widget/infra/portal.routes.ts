import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Hono } from 'hono';
import type { AppEnv } from '../../../shared/infra/http/hono-types.js';
import type { ITenantRepository } from '../../tenant/domain/tenant.repository.js';
import type { IApiKeyRepository } from '../../tenant/domain/api-key.repository.js';
import { logger } from '../../../shared/infra/logger.js';

export interface PortalRouteDeps {
    tenantRepo: ITenantRepository;
    apiKeyRepo: IApiKeyRepository;
}

let portalTemplate: string | null = null;

function getPortalTemplate(): string {
    if (!portalTemplate) {
        portalTemplate = readFileSync(
            resolve('src/modules/widget/infra/portal-shell.html'),
            'utf-8',
        );
    }
    return portalTemplate;
}

export function createPortalRoutes(deps: PortalRouteDeps) {
    const app = new Hono<AppEnv>();

    // GET /portal — resolve custom domain → serve widget full-screen
    app.get('/', async (c) => {
        const hostname = c.req.header('Host')?.split(':')[0];
        if (!hostname) {
            return c.text('Bad Request', 400);
        }

        const tenant = await deps.tenantRepo.findByCustomDomain(hostname);
        if (!tenant) {
            return c.text('Portal not found', 404);
        }

        const widgetConfig = tenant.settings?.widgetConfig;
        if (!widgetConfig?.enabled) {
            return c.text('Portal not enabled', 403);
        }

        // Find an active API key for this tenant to embed in the portal
        const keys = await deps.apiKeyRepo.listByTenant(tenant.tenantId);
        const activeKey = keys.find((k) => k.status === 'active');
        if (!activeKey) {
            logger.warn({ tenantId: tenant.tenantId }, 'No active API key for portal');
            return c.text('Portal configuration incomplete', 503);
        }

        const template = getPortalTemplate();
        const branding = widgetConfig.branding ?? {};

        const html = template
            .replace('{{TENANT_NAME}}', tenant.name)
            .replace('{{API_KEY_PREFIX}}', activeKey.prefix)
            .replace('{{PRIMARY_COLOR}}', branding.primaryColor ?? '#6366f1')
            .replace('{{LOGO_URL}}', branding.logoUrl ?? '')
            .replace('{{HEADER_TEXT}}', branding.headerText ?? tenant.name)
            .replace('{{WELCOME_MESSAGE}}', branding.welcomeMessage ?? `Olá! Como posso ajudar com ${tenant.name}?`)
            .replace('{{BASE_URL}}', c.req.url.split('/portal')[0] ?? '');

        return c.html(html);
    });

    return app;
}
