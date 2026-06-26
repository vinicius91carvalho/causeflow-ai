import type { AlertParser, RawAlert, NormalizedAlert } from '../../../../shared/application/ports/alert-source.port.js';
import type { Severity } from '../../../../shared/domain/types.js';
const SEVERITY_MAP: Record<string, Severity> = {
    alerting: 'critical',
    no_data: 'high',
    pending: 'medium',
    ok: 'low',
};
export class GrafanaParser {
    source = 'grafana';
    canParse(payload: Record<string, unknown>): boolean {
        return typeof payload['title'] === 'string' && typeof payload['state'] === 'string';
    }
    parse(raw: RawAlert): NormalizedAlert {
        const p = raw.payload;
        const state = (p['state'] ?? 'pending') as string;
        const evalMatches = p['evalMatches'] as Record<string, unknown>[] | undefined;
        const tags = (p['tags'] ?? {}) as Record<string, string>;
        return {
            externalId: raw.externalId,
            source: this.source,
            title: p['title'] as string,
            description: (p['message'] ?? p['title']) as string,
            severity: SEVERITY_MAP[state as keyof typeof SEVERITY_MAP] ?? 'medium',
            service: (evalMatches?.[0]?.['metric'] ?? tags['service'] ?? 'unknown') as string,
            environment: (tags['environment'] ?? 'unknown') as string,
            tags,
            rawPayload: raw.payload,
            receivedAt: new Date().toISOString(),
        };
    }
}
