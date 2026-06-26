
export interface LogGroupPattern {
    prefix: string;
    suffix?: string;
}

const DEFAULT_PATTERNS: LogGroupPattern[] = [
    { prefix: '/ecs/' },
    { prefix: '/aws/lambda/' },
    { prefix: '/aws/ecs/' },
    { prefix: '' },
];
export function resolveLogGroup(serviceName: string, customPatterns?: LogGroupPattern[]): string[] {
    const patterns = customPatterns ?? DEFAULT_PATTERNS;
    return patterns.map((p) => `${p.prefix}${serviceName}${p.suffix ?? ''}`);
}
