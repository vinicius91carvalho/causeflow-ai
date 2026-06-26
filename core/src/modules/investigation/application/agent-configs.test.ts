import { describe, it, expect } from 'vitest';
import { ORCHESTRATOR_CONFIG } from './agent-configs.js';

describe('ORCHESTRATOR_CONFIG — evidence citation contract (sprint 03 hardening)', () => {
    const prompt = ORCHESTRATOR_CONFIG.staticSystemPrompt ?? ORCHESTRATOR_CONFIG.systemPrompt;

    it('contains the termination clause — inconclusive outcome', () => {
        expect(prompt).toContain('inconclusive');
    });

    it('contains the DISCARDED consequence for zero cite_evidence calls', () => {
        expect(prompt).toContain('DISCARDED');
    });

    it('explicitly states there is no fallback path', () => {
        expect(prompt).toContain('no fallback path');
    });

    it('includes a worked example showing correct tool → cite_evidence → finding ordering', () => {
        expect(prompt).toContain('cite_evidence');
        expect(prompt).toContain('toolCallId');
        // worked example uses query_logs as the first tool call
        expect(prompt).toContain('query_logs');
    });

    it('includes guidance on what to do when evidence cannot be found', () => {
        expect(prompt).toContain('cannot find evidence');
    });
});
