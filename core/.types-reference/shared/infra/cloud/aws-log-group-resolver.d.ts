export interface LogGroupPattern {
    prefix: string;
    suffix?: string;
}
export declare function resolveLogGroup(serviceName: string, customPatterns?: LogGroupPattern[]): string[];
