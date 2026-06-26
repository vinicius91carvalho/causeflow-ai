import { describe, it, expect, vi } from 'vitest';
import { Recon } from '../../../../src/modules/investigation/application/modes/shared/recon.js';
import { tenantId, incidentId } from '../../../../src/shared/domain/value-objects.js';
import type { Incident } from '../../../../src/modules/ingestion/domain/incident.entity.js';
import type { AgentRunner, AgentRunResult } from '../../../../src/shared/application/ports/agent-runner.port.js';

function makeIncident(): Incident {
    return {
        incidentId: incidentId('inc-1'),
        tenantId: tenantId('t-1'),
        title: '5xx spike',
        description: 'errors 0.1 → 12%',
        severity: 'high',
        status: 'triaging',
        sourceProvider: 'datadog',
        sourceAlertId: 'dd-1',
        createdAt: '2026-04-17T00:00:00Z',
        updatedAt: '2026-04-17T00:00:00Z',
    };
}

function runner(result: AgentRunResult): AgentRunner {
    return { run: vi.fn(async () => result) };
}

const BASE_RUN: AgentRunResult = {
    response: `## Recent deploys
- PR #412 merged at 14:29 UTC — "bump ORM to 2.4"

## Error signals
- api-server /users endpoint 500s from 14:32 UTC`,
    toolCalls: [
        { name: 'composio_GITHUB_LIST_PULL_REQUESTS', input: {}, output: '[{"number":412}]' },
        { name: 'aws_api_call', input: { service: 'cloudwatch' }, output: '{"errors":1200}' },
    ],
    totalUsage: { inputTokens: 800, outputTokens: 300 },
    turns: 3,
    model: 'claude-sonnet-4-6',
    costUsd: 0.02,
};

describe('Recon', () => {
    it('returns the agent summary when substantive', async () => {
        const recon = new Recon({ agentRunner: runner(BASE_RUN) });
        const result = await recon.run({
            incident: makeIncident(),
            tools: [],
            toolHandler: async () => 'stub',
            capabilitiesPrompt: '\n\n## Capabilities\n- AWS',
        });

        expect(result.empty).toBe(false);
        expect(result.summary).toContain('PR #412');
        expect(result.run.toolCalls).toHaveLength(2);
    });

    it('flags empty when the agent response is trivially short', async () => {
        const recon = new Recon({ agentRunner: runner({ ...BASE_RUN, response: '(no data)', toolCalls: [] }) });
        const result = await recon.run({
            incident: makeIncident(),
            tools: [],
            toolHandler: async () => 'stub',
            capabilitiesPrompt: '',
        });

        expect(result.empty).toBe(true);
    });

    it('flags empty when the agent says "no data available" with little else', async () => {
        const recon = new Recon({
            agentRunner: runner({ ...BASE_RUN, response: '## Recent deploys\n- no data available', toolCalls: [] }),
        });
        const result = await recon.run({
            incident: makeIncident(),
            tools: [],
            toolHandler: async () => 'stub',
            capabilitiesPrompt: '',
        });

        expect(result.empty).toBe(true);
    });

    it('passes capabilitiesPrompt into the system prompt', async () => {
        const runSpy = runner(BASE_RUN);
        const recon = new Recon({ agentRunner: runSpy });
        await recon.run({
            incident: makeIncident(),
            tools: [],
            toolHandler: async () => 'stub',
            capabilitiesPrompt: '\n\n## Capabilities\n- GitHub via composio_GITHUB_*',
        });

        const call = (runSpy.run as unknown as ReturnType<typeof vi.fn>).mock.calls[0]![0];
        expect(call.systemPrompt).toContain('GitHub via composio_GITHUB_*');
    });

    it('caps maxTurns by default (<= 6)', async () => {
        const runSpy = runner(BASE_RUN);
        const recon = new Recon({ agentRunner: runSpy });
        await recon.run({
            incident: makeIncident(),
            tools: [],
            toolHandler: async () => 'stub',
            capabilitiesPrompt: '',
        });

        const call = (runSpy.run as unknown as ReturnType<typeof vi.fn>).mock.calls[0]![0];
        expect(call.maxTurns).toBeLessThanOrEqual(6);
    });
});
