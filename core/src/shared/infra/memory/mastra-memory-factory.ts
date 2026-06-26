/**
 * Factory for creating Mastra Memory instances backed by DynamoDB.
 *
 * Each investigation gets a thread (threadId = investigation-{incidentId}).
 * Each tenant is a resource (resourceId = tenantId).
 *
 * Memory persists full conversation history (messages + tool calls)
 * so follow-up conversations have complete context.
 */
import { Memory } from '@mastra/memory';
import { DynamoDBStore } from '@mastra/dynamodb';
import { config } from '../../config/index.js';
import { logger } from '../logger.js';

let _store: DynamoDBStore | null = null;
let _memory: Memory | null = null;

function getStore(): DynamoDBStore {
    if (_store) return _store;

    _store = new DynamoDBStore({
        name: 'causeflow-memory',
        config: {
            id: 'causeflow-memory',
            tableName: config.aws.tableName ? `${config.aws.tableName}-memory` : 'causeflow-staging-memory',
            region: config.aws.region,
            disableInit: false, // Auto-create table structure if needed
            ttl: {
                message: {
                    enabled: true,
                    defaultTtlSeconds: 90 * 24 * 60 * 60, // 90 days
                },
                thread: {
                    enabled: true,
                    defaultTtlSeconds: 90 * 24 * 60 * 60, // 90 days
                },
            },
        },
    });

    return _store;
}

export function getMastraMemory(): Memory {
    if (_memory) return _memory;

    const store = getStore();

    _memory = new Memory({
        storage: store,
        options: {
            lastMessages: 40, // Keep last 40 messages in context (investigation can be long)
            semanticRecall: false, // Hindsight handles cross-investigation recall
            workingMemory: {
                enabled: true,
                scope: 'thread', // Per-investigation working memory
                template: `# Investigation State
- **Phase**: [triage/discover/deepen/correlate/conclude]
- **Confidence**: [0.0-1.0]
- **Root Cause Hypothesis**: [current hypothesis]
- **Key Findings**: [bullet list]
- **Open Questions**: [what still needs to be verified]
- **Operator Corrections**: [any corrections from the operator]`,
            },
        },
    });

    logger.info('Mastra Memory initialized with DynamoDB store');
    return _memory;
}

/** Build the memory option for agent.generate() */
export function buildMemoryOption(tenantId: string, incidentId: string) {
    return {
        thread: {
            id: `investigation-${incidentId}`,
            metadata: { incidentId, type: 'investigation' },
        },
        resource: tenantId,
    };
}
