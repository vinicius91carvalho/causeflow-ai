import type { Tracer } from '../../application/ports/tracer.port.js';
import type { MetricRecorder } from '../../application/ports/metric-recorder.port.js';
export interface ObservabilityStack {
    tracer: Tracer;
    metrics: MetricRecorder;
}
export declare function createObservabilityStack(): ObservabilityStack;
