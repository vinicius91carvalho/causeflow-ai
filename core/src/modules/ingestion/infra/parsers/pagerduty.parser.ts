import type { Severity } from '../../../../shared/domain/types.js';
import type { AlertParser, RawAlert, NormalizedAlert } from '../../../../shared/application/ports/alert-source.port.js';
const SEVERITY_MAP: Record<string, Severity> = {
    critical: 'critical',
    error: 'high',
    warning: 'medium',
    info: 'low',
};
export class PagerDutyParser {
    source = 'pagerduty';
    canParse(payload: Record<string, unknown>): boolean {
        // PagerDuty v2/v3 webhooks have event.event_type or messages array
        if (payload['event'] && typeof payload['event'] === 'object')
            return true;
        if (Array.isArray(payload['messages']))
            return true;
        return false;
    }
    parse(raw: RawAlert): NormalizedAlert {
        const p = raw.payload;
        // PagerDuty v3 (Events API v2 webhook)
        const event = p['event'] as Record<string, unknown> | undefined;
        if (event) {
            return this.parseV3(raw, event);
        }
        // PagerDuty v2 (Generic webhook with messages array)
        const messages = p['messages'] as Record<string, unknown>[] | undefined;
        if (messages && messages.length > 0) {
            return this.parseV2(raw, messages[0]!);
        }
        return this.fallback(raw);
    }
    parseV3(raw: RawAlert, event: Record<string, unknown>): NormalizedAlert {
        const data = (event['data'] ?? {}) as Record<string, unknown>;
        const severity = (data['severity'] ?? data['urgency'] ?? 'info') as string;
        const title = (data['title'] ?? data['summary'] ?? 'PagerDuty Alert') as string;
        const serviceObj = data['service'] as Record<string, unknown> | undefined;
        const service = (serviceObj?.['summary'] as string) ?? 'unknown';
        return {
            externalId: raw.externalId,
            source: this.source,
            title,
            description: (data['description'] as string) ?? title,
            severity: SEVERITY_MAP[severity.toLowerCase()] ?? 'medium',
            service,
            environment: 'production',
            tags: this.extractTags(data),
            rawPayload: raw.payload,
            receivedAt: new Date().toISOString(),
        };
    }
    parseV2(raw: RawAlert, message: Record<string, unknown>): NormalizedAlert {
        const incident = (message['incident'] ?? {}) as Record<string, unknown>;
        const urgency = (incident['urgency'] as string) ?? 'low';
        const title = (incident['title'] as string) ?? 'PagerDuty Incident';
        const serviceObj = incident['service'] as Record<string, unknown> | undefined;
        const service = (serviceObj?.['name'] as string) ?? 'unknown';
        return {
            externalId: raw.externalId,
            source: this.source,
            title,
            description: (incident['description'] as string) ?? title,
            severity: urgency === 'high' ? 'high' : 'medium',
            service,
            environment: 'production',
            tags: {},
            rawPayload: raw.payload,
            receivedAt: new Date().toISOString(),
        };
    }
    fallback(raw: RawAlert): NormalizedAlert {
        return {
            externalId: raw.externalId,
            source: this.source,
            title: 'PagerDuty Alert',
            description: JSON.stringify(raw.payload).slice(0, 500),
            severity: 'medium',
            service: 'unknown',
            environment: 'unknown',
            tags: {},
            rawPayload: raw.payload,
            receivedAt: new Date().toISOString(),
        };
    }
    extractTags(data: Record<string, unknown>): Record<string, string> {
        const tags: Record<string, string> = {};
        const customDetails = data['custom_details'] as Record<string, unknown> | undefined;
        if (customDetails) {
            for (const [k, v] of Object.entries(customDetails)) {
                if (typeof v === 'string')
                    tags[k] = v;
            }
        }
        return tags;
    }
}
