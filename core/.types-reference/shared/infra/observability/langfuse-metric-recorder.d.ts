import type { MetricRecorder } from '../../application/ports/metric-recorder.port.js';
export declare class LangfuseMetricRecorder implements MetricRecorder {
    private readonly client;
    constructor();
    increment(name: string, value?: number, tags?: Record<string, string>): void;
    gauge(name: string, value: number, tags?: Record<string, string>): void;
    histogram(name: string, value: number, tags?: Record<string, string>): void;
    private recordEvent;
}
