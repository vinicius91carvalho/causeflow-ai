import type { AlertParser, RawAlert, NormalizedAlert } from '../../../../shared/application/ports/alert-source.port.js';
export declare class SentryParser implements AlertParser {
    readonly source = "sentry";
    canParse(payload: Record<string, unknown>): boolean;
    parse(raw: RawAlert): NormalizedAlert;
}
