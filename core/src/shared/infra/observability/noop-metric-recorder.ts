import type { MetricRecorder } from '../../application/ports/metric-recorder.port.js';
export class NoopMetricRecorder {
    increment(_name: string, _value?: number, _tags?: Record<string, string>): void { }
    gauge(_name: string, _value: number, _tags?: Record<string, string>): void { }
    histogram(_name: string, _value: number, _tags?: Record<string, string>): void { }
}
