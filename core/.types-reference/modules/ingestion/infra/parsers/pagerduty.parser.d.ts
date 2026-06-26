import type { AlertParser, RawAlert, NormalizedAlert } from '../../../../shared/application/ports/alert-source.port.js';
export declare class PagerDutyParser implements AlertParser {
    readonly source = "pagerduty";
    canParse(payload: Record<string, unknown>): boolean;
    parse(raw: RawAlert): NormalizedAlert;
    private parseV3;
    private parseV2;
    private fallback;
    private extractTags;
}
