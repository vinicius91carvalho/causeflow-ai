import { describe, it, expect, vi } from 'vitest';
import { Seeker } from '../../../../src/modules/investigation/application/modes/shared/seeker.js';
import { tenantId, incidentId } from '../../../../src/shared/domain/value-objects.js';
import type { IncidentId, TenantId } from '../../../../src/shared/domain/value-objects.js';
import type { Incident } from '../../../../src/modules/ingestion/domain/incident.entity.js';
import type { Hypothesis } from '../../../../src/modules/investigation/domain/hypothesis.entity.js';
import type { IHypothesisRepository } from '../../../../src/modules/investigation/domain/hypothesis.repository.js';
import type { LLMClient } from '../../../../src/shared/application/ports/llm-client.port.js';
import type { SeekerOutput } from '../../../../src/modules/investigation/application/modes/shared/seeker-schema.js';

function makeIncident(): Incident {
    return {
        incidentId: incidentId('inc-1'),
        tenantId: tenantId('t-1'),
        title: '5xx spike on api',
        description: 'errors from 0.1% → 12%',
        severity: 'high',
        status: 'triaging',
        sourceProvider: 'datadog',
        sourceAlertId: 'dd-1',
        createdAt: '2026-04-17T00:00:00Z',
        updatedAt: '2026-04-17T00:00:00Z',
    };
}

function makeRepo(): IHypothesisRepository {
    const state: Hypothesis[] = [];
    return {
        create: vi.fn(async (h: Hypothesis) => {
            state.push(h);
            return h;
        }),
        findById: vi.fn(
            async (_t: TenantId, _i: IncidentId, id: string) =>
                state.find((h) => h.hypothesisId === id) ?? null,
        ),
        listByIncident: vi.fn(async () => state),
        update: vi.fn(
            async (
                _t: TenantId,
                _i: IncidentId,
                id: string,
                patch: Partial<Hypothesis>,
            ) => {
                const h = state.find((x) => x.hypothesisId === id);
                if (!h) throw new Error('not found');
                Object.assign(h, patch);
                return h;
            },
        ),
    };
}

function llmReturning(output: SeekerOutput, spy: { systemPrompt?: string; userPrompt?: string }): LLMClient {
    return {
        complete: vi.fn(async (params) => {
            spy.systemPrompt = params.systemPrompt;
            spy.userPrompt = params.userPrompt;
            return {
                content: output as unknown as string,
                usage: { inputTokens: 500, outputTokens: 200 },
                model: params.model ?? 'claude-sonnet-4-6',
                costUsd: 0.01,
            };
        }) as unknown as LLMClient['complete'],
    };
}

describe('Seeker', () => {
    it('injects the SRE patterns catalog into the user prompt', async () => {
        const spy: { systemPrompt?: string; userPrompt?: string } = {};
        const seeker = new Seeker({
            llmClient: llmReturning({
                hypotheses: [
                    { statement: 'A', rationale: 'because', priorConfidence: 0.5, informedBy: ['pattern:deploy-regression'] },
                    { statement: 'B', rationale: 'because', priorConfidence: 0.3, informedBy: ['pattern:connection-pool-exhaustion'] },
                ],
            }, spy),
            hypothesisRepo: makeRepo(),
        });

        await seeker.run(makeIncident());

        expect(spy.userPrompt).toContain('Common SRE failure patterns');
        expect(spy.userPrompt).toContain('deploy-regression');
        expect(spy.userPrompt).toContain('connection-pool-exhaustion');
    });

    it('system prompt instructs the model to cite informedBy sources', async () => {
        const spy: { systemPrompt?: string; userPrompt?: string } = {};
        const seeker = new Seeker({
            llmClient: llmReturning({
                hypotheses: [
                    { statement: 'A', rationale: 'x', priorConfidence: 0.5, informedBy: ['llm:prior'] },
                    { statement: 'B', rationale: 'y', priorConfidence: 0.3, informedBy: ['pattern:deploy-regression'] },
                ],
            }, spy),
            hypothesisRepo: makeRepo(),
        });

        await seeker.run(makeIncident());

        expect(spy.systemPrompt).toContain('informedBy');
        expect(spy.systemPrompt).toContain('pattern:<id>');
        expect(spy.systemPrompt).toContain('llm:prior');
    });

    it('persists informedBy on each created hypothesis', async () => {
        const repo = makeRepo();
        const seeker = new Seeker({
            llmClient: llmReturning({
                hypotheses: [
                    { statement: 'deploy regression on api', rationale: 'timing', priorConfidence: 0.6, informedBy: ['pattern:deploy-regression', 'integration:github:PR-412'] },
                    { statement: 'pool exhaustion', rationale: 'history', priorConfidence: 0.25, informedBy: ['pattern:connection-pool-exhaustion'] },
                ],
            }, {}),
            hypothesisRepo: repo,
        });

        const result = await seeker.run(makeIncident());

        expect(result.hypotheses).toHaveLength(2);
        expect(result.hypotheses[0]!.informedBy).toEqual([
            'pattern:deploy-regression',
            'integration:github:PR-412',
        ]);
        expect(result.hypotheses[1]!.informedBy).toEqual(['pattern:connection-pool-exhaustion']);
    });

    it('passes the configured model through to the LLM client', async () => {
        const llmClient: LLMClient = {
            complete: vi.fn(async (params) => ({
                content: {
                    hypotheses: [
                        { statement: 'A', rationale: 'x', priorConfidence: 0.5, informedBy: ['llm:prior'] },
                        { statement: 'B', rationale: 'y', priorConfidence: 0.3, informedBy: ['llm:prior'] },
                    ],
                } as unknown as string,
                usage: { inputTokens: 500, outputTokens: 200 },
                model: params.model!,
                costUsd: 0.01,
            })) as unknown as LLMClient['complete'],
        };

        const seeker = new Seeker({
            llmClient,
            hypothesisRepo: makeRepo(),
            model: 'claude-opus-4-5',
        });

        await seeker.run(makeIncident());

        expect(llmClient.complete).toHaveBeenCalledWith(
            expect.objectContaining({ model: 'claude-opus-4-5' }),
        );
    });
});
