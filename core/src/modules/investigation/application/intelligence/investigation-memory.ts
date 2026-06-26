/**
 * Investigation Memory — Continuous notes during investigation
 *
 * Inspired by quacode's SessionMemory (background extraction of key findings).
 * Enhanced with Hindsight: instead of just in-session memory, findings are
 * retained in Hindsight for cross-investigation learning.
 *
 * Three functions:
 * 1. retainAgentFindings() — after each agent completes, store findings
 * 2. retainInvestigationSummary() — after synthesis, store the full RCA
 * 3. retainToolPatterns() — store what tools/strategies worked
 *
 * This creates a feedback loop: future investigations on the same tenant
 * can recall "last time service X had an OOM, the log_analyst found Y".
 */
import type { AgentMemory } from '../../../../shared/application/ports/agent-memory.port.js';
import type { SubAgentResult } from '../../domain/investigation.types.js';
import type { ToolCallRecord } from '../../../../shared/application/ports/agent-runner.port.js';
import { collapseToolSummaries, formatCollapsedTimeline } from './tool-summary.js';

// --- Agent Findings Retention ---

/**
 * Retain an agent's findings in Hindsight after it completes.
 * This allows future investigations to recall: "log_analyst previously
 * found connection pool exhaustion in payment-service".
 */
export async function retainAgentFindings(
    agentMemory: AgentMemory,
    tenantId: string,
    incidentTitle: string,
    incidentId: string,
    result: SubAgentResult,
    toolCalls: ToolCallRecord[],
): Promise<void> {
    const collapsed = collapseToolSummaries(toolCalls);
    const timeline = formatCollapsedTimeline(collapsed);

    const content = [
        `Agent: ${result.agentRole}`,
        `Incident: "${incidentTitle}"`,
        `Findings: ${result.findings.join('; ')}`,
        `Investigation steps:\n${timeline}`,
    ].join('\n');

    await agentMemory.retain(tenantId, content, {
        tags: [
            'investigation',
            'agent_findings',
            result.agentRole,
            `wave:${result.wave ?? 'unknown'}`,
            `confidence:${result.confidence >= 0.7 ? 'high' : result.confidence >= 0.4 ? 'medium' : 'low'}`,
        ],
        metadata: {
            incidentId,
            agentRole: result.agentRole,
        },
    });
}

// --- Investigation Summary Retention ---

/**
 * Retain the full investigation summary (root cause + actions) in Hindsight.
 * This is the highest-value memory: it captures the synthesized diagnosis
 * that multiple agents converged on.
 */
export async function retainInvestigationSummary(
    agentMemory: AgentMemory,
    tenantId: string,
    incidentId: string,
    incidentTitle: string,
    rootCause: string,
    findings: Array<{ text: string; evidenceIds?: string[] } | string>,
    recommendedActions: Array<{ action: string; params: Record<string, unknown> }>,
    _totalCostUsd: number,
    _durationMs: number,
    _agentsUsed: string[],
): Promise<void> {
    const actionsSummary = recommendedActions
        .map(a => `- ${a.action}${Object.keys(a.params).length > 0 ? ` (${JSON.stringify(a.params)})` : ''}`)
        .join('\n');

    const findingTexts = findings.map((f) => (typeof f === 'string' ? f : f.text));
    const content = [
        `Investigation completed for "${incidentTitle}"`,
        `Root Cause: ${rootCause}`,
        `Key Findings:\n${findingTexts.slice(0, 5).map(t => `- ${t}`).join('\n')}`,
        `Recommended Actions:\n${actionsSummary}`,
    ].join('\n');

    await agentMemory.retain(tenantId, content, {
        tags: ['investigation', 'summary', 'root_cause', 'remediation'],
        metadata: {
            incidentId,
            rootCause: rootCause.slice(0, 200),
        },
    });
}

// --- Tool Strategy Retention ---

/**
 * Retain which tool strategies were effective for this type of incident.
 * Over time, Hindsight builds a knowledge base of "for OOM incidents,
 * query_metrics for MemoryUsage + query_logs for 'oom' filter works best".
 */
export async function retainToolStrategies(
    agentMemory: AgentMemory,
    tenantId: string,
    incidentTitle: string,
    agentResults: SubAgentResult[],
    allToolCalls: ToolCallRecord[],
): Promise<void> {
    // Only retain strategies from high-confidence agents
    const highConfidence = agentResults.filter(r => r.confidence >= 0.6);
    if (highConfidence.length === 0) return;

    const toolFrequency = new Map<string, number>();
    for (const call of allToolCalls) {
        toolFrequency.set(call.name, (toolFrequency.get(call.name) ?? 0) + 1);
    }

    const topTools = [...toolFrequency.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([name, count]) => `${name} (${count}x)`);

    const content = [
        `Effective tool strategies for incident type: "${incidentTitle}"`,
        `High-confidence agents: ${highConfidence.map(r => `${r.agentRole} (${r.confidence})`).join(', ')}`,
        `Most used tools: ${topTools.join(', ')}`,
        `Total tool calls: ${allToolCalls.length}`,
        `Agent wave structure: ${[...new Set(agentResults.map(r => `wave${r.wave}`))].join(' → ')}`,
    ].join('\n');

    await agentMemory.retain(tenantId, content, {
        tags: ['investigation', 'tool_strategy', 'effective_patterns'],
        metadata: {
            highConfidenceAgents: highConfidence.map(r => r.agentRole),
            topTools: topTools.slice(0, 5),
        },
    });
}
