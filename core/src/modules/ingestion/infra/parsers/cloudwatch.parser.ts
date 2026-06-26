import type { AlertParser, RawAlert, NormalizedAlert } from '../../../../shared/application/ports/alert-source.port.js';
import type { Severity } from '../../../../shared/domain/types.js';
const SEVERITY_MAP: Record<string, Severity> = {
    ALARM: 'critical',
    INSUFFICIENT_DATA: 'medium',
    OK: 'low',
};
export class CloudWatchParser {
    source = 'cloudwatch';
    canParse(payload: Record<string, unknown>): boolean {
        return typeof payload['AlarmName'] === 'string' && typeof payload['NewStateValue'] === 'string';
    }
    parse(raw: RawAlert): NormalizedAlert {
        const p = raw.payload;
        const stateValue = (p['NewStateValue'] ?? 'ALARM') as string;
        const trigger = (p['Trigger'] ?? {}) as Record<string, unknown>;
        return {
            externalId: raw.externalId,
            source: this.source,
            title: p['AlarmName'] as string,
            description: (p['NewStateReason'] ?? p['AlarmName']) as string,
            severity: SEVERITY_MAP[stateValue as keyof typeof SEVERITY_MAP] ?? 'medium',
            service: (trigger['Namespace'] as string) ?? 'unknown',
            environment: (p['Region'] as string) ?? 'unknown',
            tags: {
                ...(p['Region'] ? { region: p['Region'] as string } : {}),
                ...(p['AlarmArn'] ? { alarmArn: p['AlarmArn'] as string } : {}),
            },
            rawPayload: raw.payload,
            receivedAt: new Date().toISOString(),
        };
    }
}
