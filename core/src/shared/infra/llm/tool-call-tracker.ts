import { randomUUID } from 'node:crypto';

export interface TrackedToolCall {
    id: string;
    name: string;
    input: Record<string, unknown>;
    output: string;
}

/**
 * Per-run tracker of tool calls. Shared between the Mastra tool adapter
 * (which registers each call as it completes) and downstream consumers
 * like the `cite_evidence` tool (which validates citations against
 * real tool outputs during the same run).
 */
export class ToolCallTracker {
    private calls = new Map<string, TrackedToolCall>();

    register(name: string, input: Record<string, unknown>, output: string): string {
        const id = `tc_${randomUUID().replace(/-/g, '').slice(0, 8)}`;
        this.calls.set(id, { id, name, input, output });
        return id;
    }

    lookup(id: string): TrackedToolCall | undefined {
        return this.calls.get(id);
    }

    all(): TrackedToolCall[] {
        return [...this.calls.values()];
    }

    size(): number {
        return this.calls.size;
    }
}
