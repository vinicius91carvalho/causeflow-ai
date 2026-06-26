import Langfuse from 'langfuse';
import { config } from '../../config/index.js';
import { logger } from '../logger.js';
import type { MetricRecorder } from '../../application/ports/metric-recorder.port.js';
export class LangfuseMetricRecorder {
    client;
    constructor() {
        this.client = new Langfuse({
            publicKey: config.langfuse.publicKey,
            secretKey: config.langfuse.secretKey,
            baseUrl: config.langfuse.baseUrl,
        });
    }
    increment(name: string, value: number = 1, tags?: Record<string, string>): void {
        this.recordEvent(name, value, 'counter', tags);
    }
    gauge(name: string, value: number, tags?: Record<string, string>): void {
        this.recordEvent(name, value, 'gauge', tags);
    }
    histogram(name: string, value: number, tags?: Record<string, string>): void {
        this.recordEvent(name, value, 'histogram', tags);
    }
    recordEvent(name: string, value: number, type: string, tags?: Record<string, string>) {
        try {
            this.client.trace({
                name: `metric.${name}`,
                metadata: { type, value, ...tags },
            });
        }
        catch (err) {
            logger.warn({ err, name }, 'Failed to record Langfuse metric');
        }
    }
}
