/**
 * Tool Use Summary & Collapsibility
 *
 * Inspired by quacode's toolUseSummaryGenerator.ts and collapseReadSearch.ts.
 * Enhanced with Hindsight: summaries are retained as observations so future
 * investigations on the same service can recall "last time we queried this
 * service's logs, we found X".
 *
 * Two functions:
 * 1. summarizeToolCall() — generates a short label for each tool call
 * 2. collapseToolSummaries() — groups consecutive same-type calls into counts
 */
import type { ToolCallRecord } from '../../../../shared/application/ports/agent-runner.port.js';

const MAX_SUMMARY_LENGTH = 60;

// --- Tool Categories ---

type ToolCategory = 'query' | 'inspect' | 'search' | 'read' | 'write' | 'memory' | 'other';

const TOOL_CATEGORIES: Record<string, ToolCategory> = {
    query_logs: 'query',
    query_metrics: 'query',
    db_query: 'query',
    db_explain: 'query',
    describe_service: 'inspect',
    aws_api_call: 'inspect',
    db_list_resources: 'inspect',
    db_list_tables: 'inspect',
    db_describe_table: 'inspect',
    get_recent_commits: 'search',
    get_commit_diff: 'read',
    get_file_content: 'read',
    get_deployments: 'search',
    get_incident_details: 'read',
    recall_past_incidents: 'memory',
    remember_finding: 'write',
    get_service_topology: 'memory',
    get_recent_changes: 'memory',
    check_remediation_history: 'memory',
    project_tool_call: 'search',
};

// --- Tool Use Summary ---

/**
 * Generate a short human-readable label for a tool call.
 * E.g., "Queried logs for 'payment-service' (error)" → max 60 chars.
 */
export function summarizeToolCall(record: ToolCallRecord): string {
    const input = record.input;

    const str = (v: unknown) => (v != null ? (v as string | number | boolean).toString() : '?');
    switch (record.name) {
        case 'query_logs': {
            const service = str(input['service']);
            const filter = input['filter'] ? ` (${str(input['filter'])})` : '';
            return truncLabel(`Queried logs for '${service}'${filter}`);
        }
        case 'query_metrics': {
            const metric = str(input['metricName']);
            const ns = input['namespace'] ? ` in ${str(input['namespace'])}` : '';
            return truncLabel(`Queried ${metric}${ns}`);
        }
        case 'describe_service':
            return truncLabel(`Inspected service '${str(input['serviceName'])}'`);
        case 'aws_api_call': {
            const svc = str(input['service']);
            const op = str(input['operation']);
            return truncLabel(`AWS ${svc}.${op}`);
        }
        case 'get_recent_commits':
            return truncLabel(`Checked commits in ${str(input['repo'] ?? input['owner'])}`);
        case 'get_commit_diff':
            return truncLabel(`Read diff for ${((input['sha'] as string | undefined) ?? '?').slice(0, 8)}`);
        case 'get_file_content':
            return truncLabel(`Read file ${str(input['path'])}`);
        case 'get_deployments':
            return truncLabel(`Checked deployments for ${str(input['repo'])}`);
        case 'get_incident_details':
            return 'Fetched incident details';
        case 'recall_past_incidents':
            return truncLabel(`Recalled past incidents: "${str(input['query'])}"`);
        case 'remember_finding':
            return truncLabel(`Stored finding`);
        case 'get_service_topology':
            return truncLabel(`Checked topology for '${str(input['serviceName'])}'`);
        case 'get_recent_changes':
            return truncLabel(`Checked recent changes for '${str(input['serviceName'])}'`);
        case 'check_remediation_history':
            return 'Checked remediation history';
        case 'db_query':
            return truncLabel(`DB query: ${((input['sql'] as string | undefined) ?? (input['query'] as string | undefined) ?? '?').slice(0, 40)}`);
        case 'db_list_resources':
            return 'Listed database resources';
        case 'db_list_tables':
            return truncLabel(`Listed tables in ${str(input['resourceId'])}`);
        case 'db_describe_table':
            return truncLabel(`Described table ${str(input['tableName'])}`);
        case 'db_explain':
            return truncLabel(`Explained query plan`);
        case 'project_tool_call':
            return truncLabel(`Searched ${str(input['platform'] ?? 'project')}: ${str(input['path'])}`);
        default:
            return truncLabel(`Called ${record.name}`);
    }
}

function truncLabel(s: string): string {
    return s.length <= MAX_SUMMARY_LENGTH ? s : s.slice(0, MAX_SUMMARY_LENGTH - 1) + '…';
}

// --- Collapsibility ---

export interface CollapsedGroup {
    category: ToolCategory;
    label: string;
    count: number;
    summaries: string[];
}

/**
 * Collapse tool calls into grouped summaries for incident timelines.
 * E.g., 5 query_logs calls → "Queried logs (5 calls)"
 */
export function collapseToolSummaries(records: ToolCallRecord[]): CollapsedGroup[] {
    if (records.length === 0) return [];

    const groups: CollapsedGroup[] = [];
    let currentCategory: ToolCategory | null = null;
    let currentGroup: CollapsedGroup | null = null;

    for (const record of records) {
        const category = TOOL_CATEGORIES[record.name] ?? 'other';
        const summary = summarizeToolCall(record);

        if (category === currentCategory && currentGroup) {
            currentGroup.count++;
            currentGroup.summaries.push(summary);
        } else {
            if (currentGroup) groups.push(currentGroup);
            currentCategory = category;
            currentGroup = {
                category,
                label: getCategoryLabel(category),
                count: 1,
                summaries: [summary],
            };
        }
    }
    if (currentGroup) groups.push(currentGroup);

    return groups;
}

function getCategoryLabel(cat: ToolCategory): string {
    switch (cat) {
        case 'query': return 'Queried data';
        case 'inspect': return 'Inspected infrastructure';
        case 'search': return 'Searched for changes';
        case 'read': return 'Read files/details';
        case 'write': return 'Stored findings';
        case 'memory': return 'Checked investigation memory';
        case 'other': return 'Performed actions';
    }
}

/**
 * Format collapsed groups into a human-readable timeline string.
 */
export function formatCollapsedTimeline(groups: CollapsedGroup[]): string {
    return groups.map(g => {
        if (g.count === 1) return `• ${g.summaries[0]}`;
        return `• ${g.label} (${g.count} calls): ${g.summaries.slice(0, 3).join(', ')}${g.count > 3 ? `, +${g.count - 3} more` : ''}`;
    }).join('\n');
}

/**
 * Build a retention payload from tool summaries for Hindsight.
 * This lets future investigations recall what tools were used and what was found.
 */
export function buildRetentionPayload(
    agentRole: string,
    incidentTitle: string,
    records: ToolCallRecord[],
): { content: string; tags: string[] } {
    const collapsed = collapseToolSummaries(records);
    const timeline = formatCollapsedTimeline(collapsed);
    const toolNames = [...new Set(records.map(r => r.name))];

    return {
        content: `Investigation step by ${agentRole} for "${incidentTitle}":\n${timeline}\n\nTools used: ${toolNames.join(', ')}`,
        tags: ['investigation', 'tool_usage', agentRole, ...toolNames],
    };
}
