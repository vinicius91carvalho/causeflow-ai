import { describe, it, expect } from 'vitest';
import {
    summarizeToolCall,
    collapseToolSummaries,
    formatCollapsedTimeline,
    buildRetentionPayload,
} from '../../../../../src/modules/investigation/application/intelligence/tool-summary.js';
import type { ToolCallRecord } from '../../../../../src/shared/application/ports/agent-runner.port.js';

function call(name: string, input: Record<string, unknown> = {}, output = ''): ToolCallRecord {
    return { name, input, output };
}

describe('summarizeToolCall', () => {
    it('formats query_logs with service and filter', () => {
        const summary = summarizeToolCall(call('query_logs', { service: 'payment-svc', filter: 'error' }));
        expect(summary).toContain('payment-svc');
        expect(summary).toContain('error');
    });

    it('formats query_metrics', () => {
        const summary = summarizeToolCall(call('query_metrics', { metricName: 'CPUUtilization', namespace: 'AWS/ECS' }));
        expect(summary).toContain('CPUUtilization');
        expect(summary).toContain('AWS/ECS');
    });

    it('formats aws_api_call', () => {
        const summary = summarizeToolCall(call('aws_api_call', { service: 'ecs', operation: 'DescribeServices' }));
        expect(summary).toContain('ecs');
        expect(summary).toContain('DescribeServices');
    });

    it('truncates long summaries to 60 chars', () => {
        const summary = summarizeToolCall(call('query_logs', {
            service: 'very-long-service-name-that-exceeds-everything',
            filter: 'some-very-specific-filter-expression',
        }));
        expect(summary.length).toBeLessThanOrEqual(61); // 60 + potential ellipsis
    });

    it('handles unknown tools gracefully', () => {
        const summary = summarizeToolCall(call('custom_tool_xyz', { foo: 'bar' }));
        expect(summary).toContain('custom_tool_xyz');
    });
});

describe('collapseToolSummaries', () => {
    it('groups consecutive same-category tools', () => {
        const records = [
            call('query_logs', { service: 'svc1' }),
            call('query_metrics', { metricName: 'CPU' }),
            call('query_logs', { service: 'svc2' }),
        ];
        const groups = collapseToolSummaries(records);
        // All are 'query' category → 1 group
        expect(groups).toHaveLength(1);
        expect(groups[0]!.count).toBe(3);
        expect(groups[0]!.category).toBe('query');
    });

    it('separates different categories', () => {
        const records = [
            call('query_logs', { service: 'svc1' }),
            call('describe_service', { serviceName: 'svc1' }),
            call('recall_past_incidents', { query: 'OOM' }),
        ];
        const groups = collapseToolSummaries(records);
        expect(groups).toHaveLength(3);
        expect(groups[0]!.category).toBe('query');
        expect(groups[1]!.category).toBe('inspect');
        expect(groups[2]!.category).toBe('memory');
    });

    it('handles empty input', () => {
        expect(collapseToolSummaries([])).toHaveLength(0);
    });
});

describe('formatCollapsedTimeline', () => {
    it('formats single-call groups as bullet points', () => {
        const records = [call('query_logs', { service: 'svc' })];
        const timeline = formatCollapsedTimeline(collapseToolSummaries(records));
        expect(timeline).toMatch(/^• /);
        expect(timeline).toContain('svc');
    });

    it('formats multi-call groups with count', () => {
        const records = [
            call('query_logs', { service: 'a' }),
            call('query_metrics', { metricName: 'CPU' }),
            call('query_logs', { service: 'b' }),
            call('query_metrics', { metricName: 'Mem' }),
        ];
        const timeline = formatCollapsedTimeline(collapseToolSummaries(records));
        expect(timeline).toContain('4 calls');
    });
});

describe('buildRetentionPayload', () => {
    it('builds a retention payload with tags', () => {
        const records = [
            call('query_logs', { service: 'svc' }),
            call('query_metrics', { metricName: 'CPU' }),
        ];
        const payload = buildRetentionPayload('log_analyst', 'OOM Kill in payment-svc', records);
        expect(payload.content).toContain('log_analyst');
        expect(payload.content).toContain('OOM Kill');
        expect(payload.tags).toContain('investigation');
        expect(payload.tags).toContain('log_analyst');
        expect(payload.tags).toContain('query_logs');
    });
});
