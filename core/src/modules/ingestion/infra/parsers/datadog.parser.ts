import type { AlertParser, RawAlert, NormalizedAlert } from '../../../../shared/application/ports/alert-source.port.js';
import type { Severity } from '../../../../shared/domain/types.js';
const SEVERITY_MAP: Record<string, Severity> = {
    error: 'critical',
    warning: 'high',
    info: 'medium',
    success: 'low',
};
export class DatadogParser {
    source = 'datadog';
    canParse(payload: Record<string, unknown>): boolean {
        return typeof payload['alert_type'] === 'string' && typeof payload['title'] === 'string';
    }
    parse(raw: RawAlert): NormalizedAlert {
        const p = raw.payload;
        const alertType = (p['alert_type'] ?? 'info') as string;
        const tags = this.parseTags(p['tags'] as string[] | undefined);
        return {
            externalId: raw.externalId,
            source: this.source,
            title: p['title'] as string,
            description: (p['body'] ?? p['title']) as string,
            severity: SEVERITY_MAP[alertType as keyof typeof SEVERITY_MAP] ?? 'medium',
            service: (p['aggreg_key'] as string) ?? tags['service'] ?? 'unknown',
            environment: tags['env'] ?? 'unknown',
            tags,
            rawPayload: raw.payload,
            receivedAt: new Date().toISOString(),
        };
    }
    parseTags(tags: string[] | undefined): Record<string, string> {
        if (!tags)
            return {};
        const result: Record<string, string> = {};
        for (const tag of tags) {
            const [key, value] = tag.split(':');
            if (key && value) {
                result[key] = value;
            }
        }
        return result;
    }
}
