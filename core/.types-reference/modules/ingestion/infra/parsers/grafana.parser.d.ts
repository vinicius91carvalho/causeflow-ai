import type { AlertParser, RawAlert, NormalizedAlert } from '../../../../shared/application/ports/alert-source.port.js';
export declare class GrafanaParser implements AlertParser {
    readonly source = "grafana";
    canParse(payload: Record<string, unknown>): boolean;
    parse(raw: RawAlert): NormalizedAlert;
}
