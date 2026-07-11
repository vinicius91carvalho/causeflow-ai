import type { IntegrationType } from '@/contexts/integrations/domain/types';
import type { IntegrationCategory } from './category-filter';

export type IntegrationPhase = 'mvp' | 'v1' | 'v2' | 'v3';

export interface IntegrationCatalogEntry {
  type: IntegrationType;
  name: string;
  description: string;
  category: IntegrationCategory;
  icon: string;
  phase: IntegrationPhase;
  color: string;
  /** Optional differentiator note shown on the card */
  differentiator?: string;
}

export const INTEGRATION_CATALOG: IntegrationCatalogEntry[] = [
  {
    type: 'slack',
    name: 'Slack',
    description: 'Real-time incident alerts and team collaboration',
    category: 'communication',
    icon: '/icons/integrations/slack.svg',
    phase: 'mvp',
    color: '#4A154B',
  },
  {
    type: 'github',
    name: 'GitHub',
    description: 'Code changes, deployments, and PR correlation',
    category: 'code',
    icon: '/icons/integrations/github.svg',
    phase: 'mvp',
    color: '#181717',
  },
  {
    type: 'jira',
    name: 'Jira',
    description: 'Incident tickets, resolution tracking, SLA monitoring',
    category: 'management',
    icon: '/icons/integrations/jira.svg',
    phase: 'mvp',
    color: '#0052CC',
  },
  {
    type: 'cloudwatch',
    name: 'AWS',
    description: 'Read-only access across all AWS services via IAM Assume Role',
    category: 'monitoring',
    icon: '/icons/integrations/aws-cloudwatch.svg',
    phase: 'mvp',
    color: '#FF9900',
  },
  {
    type: 'hubspot',
    name: 'HubSpot',
    description: 'Customer impact tracking and communication automation',
    category: 'crm',
    icon: '/icons/integrations/hubspot.svg',
    phase: 'mvp',
    color: '#FF7A59',
    differentiator: 'Unique: CRM integration for customer impact tracking',
  },
  {
    type: 'trello',
    name: 'Trello',
    description: 'Visual incident boards and task tracking',
    category: 'management',
    icon: '/icons/integrations/trello.svg',
    phase: 'mvp',
    color: '#0052CC',
  },
  {
    type: 'sentry',
    name: 'Sentry',
    description: 'Error tracking and application performance monitoring',
    category: 'monitoring',
    icon: '/icons/integrations/sentry.svg',
    phase: 'mvp',
    color: '#362D59',
  },
  {
    type: 'postgresql',
    name: 'PostgreSQL',
    description: 'Database performance monitoring and query analysis',
    category: 'database',
    icon: '/icons/integrations/postgresql.svg',
    phase: 'v1',
    color: '#4169E1',
  },
  {
    type: 'linear',
    name: 'Linear',
    description: 'Issue tracking and engineering workflow automation',
    category: 'management',
    icon: '/icons/integrations/linear.svg',
    phase: 'v1',
    color: '#5E6AD2',
  },
  {
    type: 'mongodb',
    name: 'MongoDB',
    description: 'NoSQL database monitoring and performance insights',
    category: 'database',
    icon: '/icons/integrations/mongodb.svg',
    phase: 'v2',
    color: '#47A248',
  },
  {
    type: 'datadog',
    name: 'Datadog',
    description: 'Infrastructure monitoring and APM correlation',
    category: 'monitoring',
    icon: '/icons/integrations/datadog.svg',
    phase: 'v2',
    color: '#632CA6',
  },
  {
    type: 'pagerduty',
    name: 'PagerDuty',
    description: 'On-call management and escalation automation',
    category: 'monitoring',
    icon: '/icons/integrations/pagerduty.svg',
    phase: 'v2',
    color: '#06AC38',
  },
  {
    type: 'grafana',
    name: 'Grafana',
    description: 'Dashboard metrics and visualization correlation',
    category: 'monitoring',
    icon: '/icons/integrations/grafana.svg',
    phase: 'v2',
    color: '#F46800',
  },
  {
    type: 'confluence',
    name: 'Confluence',
    description: 'Knowledge base and runbook integration',
    category: 'knowledge',
    icon: '/icons/integrations/confluence.svg',
    phase: 'v2',
    color: '#172B4D',
  },
  {
    type: 'webhooks',
    name: 'Custom Webhooks',
    description: 'Connect any tool via HTTP webhooks',
    category: 'api',
    icon: '/icons/integrations/webhook.svg',
    phase: 'v3',
    color: '#6B7280',
  },
];

// TRIGGER_CATALOG: slugs must map to an active case in core trigger-event-mapper.ts
// Only add slugs here when a corresponding mapper case is implemented in core.

/**
 * Composio trigger catalog — maps each provider to its available triggers.
 * Used by IntegrationCard to show the "Add trigger" dropdown.
 *
 * IMPORTANT: Only slugs with active handlers in trigger-event-mapper.ts are included.
 * Active incident slugs: SENTRY_NEW_ISSUE, PAGERDUTY_INCIDENT_TRIGGERED,
 * GITHUB_COMMIT_EVENT, GITHUB_PULL_REQUEST_EVENT.
 * Providers with no active mapper cases are set to [] — their cards remain visible.
 */
export const TRIGGER_CATALOG: Record<string, Array<{ slug: string; labelKey: string }>> = {
  // Active incident triggers — have handlers in trigger-event-mapper.ts
  sentry: [{ slug: 'SENTRY_NEW_ISSUE', labelKey: 'triggers.sentry.new_issue' }],
  pagerduty: [
    { slug: 'PAGERDUTY_INCIDENT_TRIGGERED', labelKey: 'triggers.pagerduty.incident_triggered' },
  ],
  github: [
    { slug: 'GITHUB_COMMIT_EVENT', labelKey: 'triggers.github.commit_event' },
    { slug: 'GITHUB_PULL_REQUEST_EVENT', labelKey: 'triggers.github.pull_request_event' },
  ],

  // Active incident trigger for Datadog — webhook-only, handled by trigger-event-mapper.ts
  datadog: [{ slug: 'DATADOG_MONITOR_TRIGGERED', labelKey: 'triggers.datadog.monitor_triggered' }],

  // Providers with no active incident mapper cases — set to [] so cards stay visible
  // but show "No incident triggers supported yet" in the dropdown.
  slack: [],
  jira: [],
  linear: [],
  hubspot: [],
  confluence: [],
  discord: [],
  zendesk: [],
  asana: [],
};

/** MVP integrations — can be connected immediately */
export const MVP_INTEGRATION_TYPES = new Set<IntegrationType>(
  INTEGRATION_CATALOG.filter((e) => e.phase === 'mvp').map((e) => e.type),
);
