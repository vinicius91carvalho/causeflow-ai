import {
  Activity,
  Bot,
  Brain,
  Database,
  FileSearch,
  Loader2,
  Radio,
  Save,
  Shield,
  Sparkles,
} from 'lucide-react';

export function getRelayWsUrl(relayUrl: string, token: string, incidentId: string): string | null {
  if (!relayUrl) return null;
  return `${relayUrl}?incidentId=${encodeURIComponent(incidentId)}&role=dashboard&token=${encodeURIComponent(token)}`;
}

export const COMPOSIO_DISPLAY_NAMES: Record<string, string> = {
  github: 'GitHub',
  gitlab: 'GitLab',
  bitbucket: 'Bitbucket',
  slack: 'Slack',
  teams: 'Microsoft Teams',
  discord: 'Discord',
  jira: 'Jira',
  linear: 'Linear',
  trello: 'Trello',
  shortcut: 'Shortcut',
  clickup: 'ClickUp',
  asana: 'Asana',
  datadog: 'Datadog',
  sentry: 'Sentry',
  pagerduty: 'PagerDuty',
  newrelic: 'New Relic',
  notion: 'Notion',
  confluence: 'Confluence',
  hubspot: 'HubSpot',
  zendesk: 'Zendesk',
  intercom: 'Intercom',
};

export function parseComposioToolName(
  toolName: string,
): { provider: string; displayName: string; action: string; logo: string } | null {
  if (!toolName.startsWith('composio_')) return null;
  const raw = toolName.slice('composio_'.length);
  const parts = raw.split('_');
  for (let i = 1; i <= Math.min(parts.length - 1, 3); i++) {
    const candidate = parts.slice(0, i).join('_').toLowerCase();
    if (COMPOSIO_DISPLAY_NAMES[candidate] || candidate.length <= 10) {
      const action = parts
        .slice(i)
        .join(' ')
        .toLowerCase()
        .replace(/\b\w/g, (c) => c.toUpperCase());
      const provider = candidate;
      const displayName =
        COMPOSIO_DISPLAY_NAMES[provider] ?? provider.charAt(0).toUpperCase() + provider.slice(1);
      return { provider, displayName, action, logo: `https://logos.composio.dev/api/${provider}` };
    }
  }
  const provider = parts[0].toLowerCase();
  const action = parts
    .slice(1)
    .join(' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
  return {
    provider,
    displayName: COMPOSIO_DISPLAY_NAMES[provider] ?? provider,
    action,
    logo: `https://logos.composio.dev/api/${provider}`,
  };
}

export const AGENT_ROLE_DISPLAY: Record<string, { label: string; color: string }> = {
  scout: {
    label: 'Scout',
    color: 'bg-success/10 text-success /50',
  },
  'deep-dive': {
    label: 'Deep Dive',
    color: 'bg-primary/10 text-primary /50',
  },
  diagnosis_verifier: {
    label: 'Verifier',
    color: 'bg-warning/10 text-warning /50',
  },
};

export const PHASE_LABELS: Record<string, string> = {
  memory_check: 'Memory Check',
  capability_check: 'Capability Detection',
  capabilities_ready: 'Capabilities Ready',
  orchestrator_started: 'Investigation',
  synthesizing: 'Synthesis',
  saving_evidence: 'Saving Evidence',
};

export function isPhaseStage(stage: string): boolean {
  return stage in PHASE_LABELS;
}

export function formatToolInputBrief(toolName: string, input?: Record<string, unknown>): string {
  if (!input) return '';
  if (toolName === 'aws_api_call') {
    const service = input.service ?? '';
    const action = input.action ?? '';
    return service || action ? `${service} / ${action}` : '';
  }
  if (toolName === 'recall_past_incidents' || toolName === 'reflect_on_knowledge') {
    return input.query ? String(input.query).slice(0, 80) : '';
  }
  if (toolName === 'get_incident_details') return 'incident details';
  if (toolName === 'report_finding') return String(input.finding ?? '').slice(0, 80);
  const firstValue = Object.values(input).find((v) => typeof v === 'string' && v.length > 0);
  return firstValue ? String(firstValue).slice(0, 60) : '';
}

export const PROGRESS_ICONS: Record<string, typeof Loader2> = {
  provisioning: Loader2,
  connecting: Radio,
  memory_check: Brain,
  capability_check: Shield,
  capabilities_ready: Shield,
  orchestrator_started: Bot,
  orchestrator_running: Bot,
  orchestrator_completed: Bot,
  synthesizing: Sparkles,
  saving_evidence: Save,
};

export const EVIDENCE_ICONS: Record<string, typeof FileSearch> = {
  log_snippet: FileSearch,
  metric_snapshot: Activity,
  resource_state: Database,
  historical_context: Brain,
  agent_reasoning: Bot,
};

export const EVIDENCE_STYLES: Record<string, { bg: string; border: string; badge: string }> = {
  log_snippet: {
    bg: 'bg-muted /30',
    border: 'border-border',
    badge: 'bg-muted text-muted-foreground',
  },
  metric_snapshot: {
    bg: 'bg-accent/10 /30',
    border: 'border-accent/40',
    badge: 'bg-accent/10 text-accent-foreground',
  },
  resource_state: {
    bg: 'bg-accent/10 /30',
    border: 'border-accent/40',
    badge: 'bg-accent/10 text-accent-foreground',
  },
  historical_context: {
    bg: 'bg-warning/10 /30',
    border: 'border-warning/40',
    badge: 'bg-warning/10 text-warning',
  },
};

export const DEFAULT_EVIDENCE_STYLE = {
  bg: 'bg-success/10 /30',
  border: 'border-success/40',
  badge: 'bg-success/10 text-success',
};

export const SEVERITY_STYLES: Record<string, string> = {
  critical: 'bg-destructive/10 text-destructive /50',
  high: 'bg-warning/10 text-warning /50',
  medium: 'bg-warning/10 text-warning /50',
  low: 'bg-success/10 text-success /50',
};

export function formatMemoryContent(raw: string): string {
  try {
    const data = JSON.parse(raw) as {
      results?: Array<{ rank?: number; type?: string; text?: string }>;
      memoriesFound?: number;
      message?: string;
    };
    if (data.message && (!data.results || data.results.length === 0)) return data.message;
    if (!data.results || data.results.length === 0) return raw;
    const lines = data.results.map((r) => {
      const prefix = r.rank ? `**${r.rank}.** ` : '- ';
      const typeTag = r.type === 'observation' ? ' _(observation)_' : '';
      return `${prefix}${r.text ?? ''}${typeTag}`;
    });
    if (data.memoriesFound != null) {
      lines.unshift(`_${data.memoriesFound} relevant memories found:_\n`);
    }
    return lines.join('\n\n');
  } catch {
    return raw;
  }
}

export function formatDuration(ms: number): string {
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  const min = Math.floor(ms / 60_000);
  const sec = Math.round((ms % 60_000) / 1000);
  return sec > 0 ? `${min}m ${sec}s` : `${min}m`;
}
