import type { AlertParser, RawAlert, NormalizedAlert } from '../../../../shared/application/ports/alert-source.port.js';
export declare class DatadogParser implements AlertParser {
    readonly source = "datadog";
    canParse(payload: Record<string, unknown>): boolean;
    parse(raw: RawAlert): NormalizedAlert;
    private parseTags;
}
