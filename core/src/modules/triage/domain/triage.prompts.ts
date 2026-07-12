import { z } from 'zod';
export const triageResultSchema = z.object({
  priority: z.enum(['critical', 'high', 'medium', 'low', 'info']),
  category: z.enum([
    'infrastructure',
    'application',
    'deployment',
    'third_party',
    'database',
    'unknown',
  ]),
  suggestedAgents: z.array(z.string()),
  summary: z.string(),
  confidence: z.number().min(0).max(1),
  investigationMode: z.enum(['orchestrator', 'hypothesis', 'debate']),
});
const AGENT_CATALOG = [
  { name: 'log_analyst', description: 'Analyzes CloudWatch logs', requires: 'AWS' },
  { name: 'metric_analyst', description: 'Analyzes CloudWatch metrics', requires: 'AWS' },
  { name: 'infra_inspector', description: 'Checks ECS/EC2/Lambda state', requires: 'AWS' },
  {
    name: 'change_detector',
    description: 'Finds recent deployments and config changes',
    requires: 'AWS',
  },
  {
    name: 'code_analyzer',
    description: 'Analyzes git history and code changes',
    requires: 'GitHub',
  },
  { name: 'db_analyst', description: 'Queries customer databases', requires: 'Relay' },
  {
    name: 'issue_correlator',
    description: 'Searches related issues/tickets',
    requires: 'Jira/Linear/ClickUp via Composio',
  },
  {
    name: 'apm_analyst',
    description: 'Analyzes APM traces, errors, performance',
    requires: 'Datadog/Sentry/New Relic via Composio',
  },
  {
    name: 'notification_sender',
    description: 'Posts investigation updates',
    requires: 'Slack/Teams/Discord via Composio',
  },
];
/**
 * Map integration provider names to the "requires" labels used in agent specs.
 * A connected integration may satisfy multiple requirement labels.
 */
const INTEGRATION_TO_REQUIREMENT = {
  aws: ['AWS'],
  github: ['GitHub'],
  relay: ['Relay'],
  jira: ['Jira/Linear/ClickUp via Composio'],
  linear: ['Jira/Linear/ClickUp via Composio'],
  clickup: ['Jira/Linear/ClickUp via Composio'],
  datadog: ['Datadog/Sentry/New Relic via Composio'],
  sentry: ['Datadog/Sentry/New Relic via Composio'],
  newrelic: ['Datadog/Sentry/New Relic via Composio'],
  new_relic: ['Datadog/Sentry/New Relic via Composio'],
  slack: ['Slack/Teams/Discord via Composio'],
  teams: ['Slack/Teams/Discord via Composio'],
  discord: ['Slack/Teams/Discord via Composio'],
};
function resolveAvailableRequirements(connectedIntegrations: string[]) {
  const requirements = new Set();
  for (const integration of connectedIntegrations) {
    const reqs = (INTEGRATION_TO_REQUIREMENT as Record<string, string[]>)[
      integration.toLowerCase()
    ];
    if (reqs) {
      for (const r of reqs) requirements.add(r);
    }
  }
  return requirements;
}
/**
 * Build a triage system prompt that includes available integrations and agents.
 * When connectedIntegrations is empty, falls back to the default agent list.
 */
export function buildTriagePrompt(connectedIntegrations: string[]): string {
  const hasIntegrationInfo = connectedIntegrations.length > 0;
  let agentSection;
  if (hasIntegrationInfo) {
    const availableReqs = resolveAvailableRequirements(connectedIntegrations);
    const availableAgents = AGENT_CATALOG.filter((a) => {
      // An agent is available if ALL its required integrations are satisfied
      // For compound requirements like "AWS + GitHub", check each part
      const parts = a.requires.split(' + ').map((p) => p.trim());
      return parts.every((part) => availableReqs.has(part));
    });
    const agentLines = AGENT_CATALOG.map(
      (a) =>
        `- ${a.name}: ${a.description} (requires: ${a.requires})${availableAgents.includes(a) ? '' : ' [NOT AVAILABLE]'}`,
    ).join('\n');
    const hasUnavailable = availableAgents.length < AGENT_CATALOG.length;
    agentSection = `Available integrations for this tenant: ${connectedIntegrations.join(', ')}

Available agents:
${agentLines}${hasUnavailable ? '\n\nIMPORTANT: Only suggest agents that have their required integrations available (not marked [NOT AVAILABLE]).' : ''}`;
  } else {
    // Fallback: no integration info — suggest default AWS agents only
    agentSection = `Agent roles available: log_analyst, metric_analyst, infra_inspector, change_detector, code_analyzer, remediator
- Use code_analyzer when the incident may be caused by code changes, dependency updates, or configuration drift in source repositories`;
  }
  return `You are an SRE triage specialist. Analyze the incident and classify it.

Evaluate:
1. True severity (may differ from alert source)
2. Incident category (infrastructure, application, deployment, third_party, database, or unknown)
3. Which specialist agents should investigate
4. Confidence in your assessment (0.0-1.0)

${agentSection}

Respond in JSON format:
{
  "priority": "critical|high|medium|low|info",
  "category": "infrastructure|application|deployment|third_party|database|unknown",
  "suggestedAgents": ["agent_role1", "agent_role2"],
  "summary": "Brief analysis of the incident",
  "confidence": 0.85,
  "investigationMode": "orchestrator|hypothesis|debate"
}

Choose investigationMode based on the incident complexity:
- "orchestrator": Standard multi-agent investigation with coordinator (default)
- "hypothesis": Generate and test multiple competing hypotheses
- "debate": Multiple agents debate to find root cause (best for ambiguous incidents)`;
}
/** @deprecated Use buildTriagePrompt() instead. Kept for backward compatibility. */
export const TRIAGE_SYSTEM_PROMPT = buildTriagePrompt([]);
