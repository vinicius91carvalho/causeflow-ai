import type { AlertParser, RawAlert, NormalizedAlert } from '../../../../shared/application/ports/alert-source.port.js';
import type { Severity } from '../../../../shared/domain/types.js';
const SEVERITY_MAP = {
    fatal: 'critical',
    error: 'high',
    warning: 'medium',
    info: 'low',
};
export class SentryParser {
    source = 'sentry';
    canParse(payload: Record<string, unknown>): boolean {
        return typeof payload['action'] === 'string' && typeof payload['data'] === 'object' && payload['data'] !== null
            && typeof (payload['data'] as Record<string, unknown>)['issue'] === 'object';
    }
    parse(raw: RawAlert): NormalizedAlert {
        const p = raw.payload;
        const data = p['data'] as Record<string, unknown>;
        const issue = data['issue'] as Record<string, any>;
        const level = (issue['level'] ?? 'error') as string;
        return {
            externalId: raw.externalId || String(issue['id'] ?? ''),
            source: this.source,
            title: issue['title'] ?? 'Sentry Issue',
            description: issue['culprit'] ?? issue['title'] ?? '',
            severity: ((SEVERITY_MAP as Record<string, string>)[level] ?? 'medium') as Severity,
            service: String(p['project_name'] ?? issue['project']?.['name'] ?? 'unknown'),
            environment: String(p['environment'] ?? 'unknown'),
            tags: {
                ...(p['project_name'] ? { project: String(p['project_name']) } : {}),
                ...(issue['id'] ? { issueId: String(issue['id']) } : {}),
            },
            rawPayload: raw.payload,
            receivedAt: new Date().toISOString(),
        };
    }
}
