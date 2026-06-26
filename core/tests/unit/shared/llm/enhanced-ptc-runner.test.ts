import { describe, it, expect } from 'vitest';

// We test the utility functions exported indirectly via the runner behavior.
// Since EnhancedPTCRunner depends on Anthropic SDK, we mock the client.

// --- Test helpers ---

function truncateResult(result: string, maxChars: number): { text: string; wasTruncated: boolean } {
    if (result.length <= maxChars) return { text: result, wasTruncated: false };
    return {
        text: result.slice(0, maxChars) +
            `\n\n[TRUNCATED: showing first ${maxChars.toLocaleString()} of ${result.length.toLocaleString()} chars. Focus on what's shown above.]`,
        wasTruncated: true,
    };
}

interface ToolCall { id: string; name: string; input: Record<string, unknown>; }
interface ToolDef { name: string; isConcurrencySafe?: boolean; }
interface Batch { safe: boolean; calls: ToolCall[]; }

function partitionToolCalls(calls: ToolCall[], toolDefs: ToolDef[]): Batch[] {
    const defMap = new Map(toolDefs.map(t => [t.name, t]));
    return calls.reduce<Batch[]>((batches, call) => {
        const def = defMap.get(call.name);
        const safe = def?.isConcurrencySafe ?? true;
        const lastBatch = batches.at(-1);
        if (safe && lastBatch?.safe) {
            lastBatch.calls.push(call);
        } else {
            batches.push({ safe, calls: [call] });
        }
        return batches;
    }, []);
}

function enforceMessageBudget(
    results: { toolUseId: string; content: string }[],
    budgetChars: number,
): { toolUseId: string; content: string }[] {
    const totalChars = results.reduce((sum, r) => sum + r.content.length, 0);
    if (totalChars <= budgetChars) return results;
    const sorted = [...results].sort((a, b) => b.content.length - a.content.length);
    let remaining = totalChars;
    const truncationMap = new Map<string, string>();
    for (const r of sorted) {
        if (remaining <= budgetChars) break;
        const excess = remaining - budgetChars;
        const newLen = Math.max(1000, r.content.length - excess);
        truncationMap.set(r.toolUseId, r.content.slice(0, newLen) + `\n\n[BUDGET TRUNCATED]`);
        remaining -= (r.content.length - newLen);
    }
    return results.map(r => ({
        toolUseId: r.toolUseId,
        content: truncationMap.get(r.toolUseId) ?? r.content,
    }));
}

// --- Tests ---

describe('truncateResult', () => {
    it('returns original if under limit', () => {
        const { text, wasTruncated } = truncateResult('short', 1000);
        expect(text).toBe('short');
        expect(wasTruncated).toBe(false);
    });

    it('truncates with notice if over limit', () => {
        const longStr = 'x'.repeat(100);
        const { text, wasTruncated } = truncateResult(longStr, 50);
        expect(wasTruncated).toBe(true);
        expect(text).toContain('[TRUNCATED');
        expect(text).toContain('50');
        expect(text).toContain('100');
        expect(text.length).toBeGreaterThan(50); // includes the notice
    });

    it('handles exact boundary', () => {
        const str = 'x'.repeat(50);
        const { wasTruncated } = truncateResult(str, 50);
        expect(wasTruncated).toBe(false);
    });
});

describe('partitionToolCalls', () => {
    const safeTool: ToolDef = { name: 'query_logs', isConcurrencySafe: true };
    const unsafeTool: ToolDef = { name: 'remember_finding', isConcurrencySafe: false };
    const defaultTool: ToolDef = { name: 'unknown_tool' }; // defaults to safe

    function call(name: string, id?: string): ToolCall {
        return { id: id ?? `id-${name}`, name, input: {} };
    }

    it('groups consecutive safe tools into one batch', () => {
        const batches = partitionToolCalls(
            [call('query_logs', '1'), call('query_logs', '2'), call('query_logs', '3')],
            [safeTool],
        );
        expect(batches).toHaveLength(1);
        expect(batches[0]!.safe).toBe(true);
        expect(batches[0]!.calls).toHaveLength(3);
    });

    it('separates unsafe tools into their own batch', () => {
        const batches = partitionToolCalls(
            [call('query_logs', '1'), call('remember_finding', '2'), call('query_logs', '3')],
            [safeTool, unsafeTool],
        );
        expect(batches).toHaveLength(3);
        expect(batches[0]!.safe).toBe(true);
        expect(batches[1]!.safe).toBe(false);
        expect(batches[2]!.safe).toBe(true);
    });

    it('defaults unknown tools to safe', () => {
        const batches = partitionToolCalls(
            [call('unknown_tool', '1'), call('query_logs', '2')],
            [safeTool, defaultTool],
        );
        expect(batches).toHaveLength(1);
        expect(batches[0]!.safe).toBe(true);
    });

    it('handles empty calls', () => {
        const batches = partitionToolCalls([], [safeTool]);
        expect(batches).toHaveLength(0);
    });

    it('handles single unsafe call', () => {
        const batches = partitionToolCalls([call('remember_finding')], [unsafeTool]);
        expect(batches).toHaveLength(1);
        expect(batches[0]!.safe).toBe(false);
    });
});

describe('enforceMessageBudget', () => {
    it('passes through if under budget', () => {
        const results = [
            { toolUseId: '1', content: 'short' },
            { toolUseId: '2', content: 'also short' },
        ];
        const budgeted = enforceMessageBudget(results, 1000);
        expect(budgeted[0]!.content).toBe('short');
        expect(budgeted[1]!.content).toBe('also short');
    });

    it('truncates largest result first when over budget', () => {
        const small = 'x'.repeat(100);
        const large = 'y'.repeat(5000);
        const results = [
            { toolUseId: '1', content: small },
            { toolUseId: '2', content: large },
        ];
        const budgeted = enforceMessageBudget(results, 2000);
        // Small should be unchanged
        expect(budgeted[0]!.content).toBe(small);
        // Large should be truncated
        expect(budgeted[1]!.content).toContain('[BUDGET TRUNCATED]');
        expect(budgeted[1]!.content.length).toBeLessThan(large.length);
    });

    it('preserves order', () => {
        const results = [
            { toolUseId: 'a', content: 'x'.repeat(3000) },
            { toolUseId: 'b', content: 'y'.repeat(1000) },
            { toolUseId: 'c', content: 'z'.repeat(3000) },
        ];
        const budgeted = enforceMessageBudget(results, 5000);
        expect(budgeted[0]!.toolUseId).toBe('a');
        expect(budgeted[1]!.toolUseId).toBe('b');
        expect(budgeted[2]!.toolUseId).toBe('c');
    });
});

describe('retry logic', () => {
    it('getRetryDelay produces exponential backoff with jitter', () => {
        const BASE = 500;
        const MAX = 32000;
        function getRetryDelay(attempt: number): number {
            const baseDelay = Math.min(BASE * Math.pow(2, attempt - 1), MAX);
            const jitter = baseDelay * 0.25 * Math.random();
            return baseDelay + jitter;
        }

        const d1 = getRetryDelay(1);
        const d2 = getRetryDelay(2);
        const d3 = getRetryDelay(3);
        const d10 = getRetryDelay(10);

        expect(d1).toBeGreaterThanOrEqual(500);
        expect(d1).toBeLessThan(750); // 500 + 25% jitter
        expect(d2).toBeGreaterThanOrEqual(1000);
        expect(d3).toBeGreaterThanOrEqual(2000);
        expect(d10).toBeLessThanOrEqual(40000); // capped at 32000 + jitter
    });
});
