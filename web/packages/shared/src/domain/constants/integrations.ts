import type { Integration } from '../types';

export const INTEGRATIONS: Integration[] = [
  // Monitoring & Observability
  {
    id: 'aws-cloudwatch',
    name: 'AWS CloudWatch',
    category: 'monitoring',
    description: 'Analyzes error logs, metrics, and alarms from AWS infrastructure in real time.',
    agentConnection: 'log_analyst, metric_analyst',
    featured: true,
  },
  {
    id: 'datadog',
    name: 'Datadog',
    category: 'monitoring',
    description: 'Ingests metrics, logs, and distributed traces to identify performance anomalies.',
    agentConnection: 'log_analyst, metric_analyst',
    featured: true,
  },
  {
    id: 'sentry',
    name: 'Sentry',
    category: 'monitoring',
    description: 'Captures real-time errors, exceptions, and stack traces for root cause analysis.',
    agentConnection: 'ingestion',
    featured: true,
  },
  {
    id: 'pagerduty',
    name: 'PagerDuty',
    category: 'monitoring',
    description: 'Receives alert payloads and on-call context to trigger automated investigations.',
    agentConnection: 'ingestion',
    featured: true,
  },
  {
    id: 'grafana',
    name: 'Grafana',
    category: 'monitoring',
    description: 'Reads dashboard panels and alert states to correlate metrics with incidents.',
    agentConnection: 'metric_analyst',
    featured: true,
  },
  {
    id: 'new-relic',
    name: 'New Relic',
    category: 'monitoring',
    description: 'Analyzes APM traces, error rates, and infrastructure metrics.',
    agentConnection: 'log_analyst, metric_analyst',
    featured: false,
  },
  {
    id: 'opsgenie',
    name: 'Opsgenie',
    category: 'monitoring',
    description: 'Ingests alert payloads and on-call schedule data to start investigations.',
    agentConnection: 'ingestion',
    featured: false,
  },
  {
    id: 'splunk',
    name: 'Splunk',
    category: 'monitoring',
    description: 'Queries log indexes and saved searches to surface relevant error patterns.',
    agentConnection: 'log_analyst',
    featured: false,
  },

  // Communication
  {
    id: 'slack',
    name: 'Slack',
    category: 'communication',
    description:
      'Receives incident reports from engineering and support. Responds directly in incident channels.',
    agentConnection: 'notification',
    featured: true,
  },
  {
    id: 'microsoft-teams',
    name: 'Microsoft Teams',
    category: 'communication',
    description:
      'Accepts investigations triggered from Teams channels and posts results as replies.',
    agentConnection: 'notification',
    featured: true,
  },
  {
    id: 'discord',
    name: 'Discord',
    category: 'communication',
    description: 'Delivers investigation summaries and root cause findings to Discord channels.',
    agentConnection: 'notification',
    featured: false,
  },

  // Code & Version Control
  {
    id: 'github',
    name: 'GitHub',
    category: 'code',
    description: 'Analyzes commits, PRs, and recent releases. Generates and opens fix PRs.',
    agentConnection: 'code_analyzer, code_fixer',
    featured: true,
  },
  {
    id: 'gitlab',
    name: 'GitLab',
    category: 'code',
    description: 'Reads merge requests, pipelines, and commit history for change correlation.',
    agentConnection: 'code_analyzer, code_fixer',
    featured: true,
  },
  {
    id: 'bitbucket',
    name: 'Bitbucket',
    category: 'code',
    description:
      'Inspects pull requests and commit diffs to identify changes that introduced issues.',
    agentConnection: 'code_analyzer',
    featured: false,
  },

  // Project Management
  {
    id: 'jira',
    name: 'Jira',
    category: 'management',
    description:
      'Reads ticket context, creates investigation comments, and links root cause findings.',
    agentConnection: 'ticketing',
    featured: true,
  },
  {
    id: 'linear',
    name: 'Linear',
    category: 'management',
    description:
      'Integrates with Linear issues to attach investigation results and track resolution.',
    agentConnection: 'ticketing',
    featured: true,
  },
  {
    id: 'shortcut',
    name: 'Shortcut',
    category: 'management',
    description: 'Reads stories and epics, creates comments with investigation results.',
    agentConnection: 'ticketing',
    featured: false,
  },
  {
    id: 'trello',
    name: 'Trello',
    category: 'management',
    description:
      'Assigns cards to CauseFlow for automated investigation with results as card comments.',
    agentConnection: 'ticketing',
    featured: false,
  },
  {
    id: 'asana',
    name: 'Asana',
    category: 'management',
    description:
      'Connects Asana tasks to incident investigations and posts findings as task comments.',
    agentConnection: 'ticketing',
    featured: false,
  },
  {
    id: 'servicenow',
    name: 'ServiceNow',
    category: 'management',
    description:
      'Reads incident records and CMDB context to enrich investigations with service topology.',
    agentConnection: 'ticketing',
    featured: true,
  },

  // Knowledge & Documentation
  {
    id: 'notion',
    name: 'Notion',
    category: 'knowledge',
    description:
      'Accesses runbooks, post-mortems, and documentation pages for investigation context.',
    agentConnection: 'doc_enricher',
    featured: true,
  },
  {
    id: 'confluence',
    name: 'Confluence',
    category: 'knowledge',
    description: 'Reads internal documentation and runbooks to inform investigation hypotheses.',
    agentConnection: 'doc_enricher',
    featured: true,
  },
  {
    id: 'google-docs',
    name: 'Google Docs',
    category: 'knowledge',
    description: 'Retrieves relevant runbooks and design documents stored in Google Drive.',
    agentConnection: 'doc_enricher',
    featured: false,
  },

  // CRM & Customer Support
  {
    id: 'hubspot',
    name: 'HubSpot',
    category: 'crm',
    description:
      'Checks customer impact, account data, and history when investigating customer issues.',
    differentiator: 'Unique to CauseFlow — bridges engineering and business data.',
    agentConnection: 'customer_bridge',
    featured: true,
  },
  {
    id: 'salesforce',
    name: 'Salesforce',
    category: 'crm',
    description:
      'Cross-references affected accounts and opportunities to quantify customer impact.',
    agentConnection: 'customer_bridge',
    featured: true,
  },
  {
    id: 'zendesk',
    name: 'Zendesk',
    category: 'crm',
    description:
      'Correlates support tickets with production incidents to surface customer-reported patterns.',
    agentConnection: 'customer_bridge',
    featured: false,
  },
  {
    id: 'intercom',
    name: 'Intercom',
    category: 'crm',
    description:
      'Links customer conversations to technical root causes and generates customer-facing explanations.',
    agentConnection: 'customer_bridge',
    featured: false,
  },

  // Databases
  {
    id: 'postgresql',
    name: 'PostgreSQL',
    category: 'database',
    description:
      'Executes read-only queries to validate data state and detect anomalies during incidents.',
    differentiator:
      'Unique to CauseFlow — accessed via encrypted Relay with zero inbound exposure.',
    agentConnection: 'db_analyst',
    featured: false,
  },
  {
    id: 'mysql',
    name: 'MySQL',
    category: 'database',
    description:
      'Reads table statistics and slow query logs to identify database-layer root causes.',
    agentConnection: 'db_analyst',
    featured: false,
  },
  {
    id: 'mongodb',
    name: 'MongoDB',
    category: 'database',
    description:
      'Queries NoSQL collections in read-only mode to detect data inconsistencies and performance issues.',
    agentConnection: 'db_analyst',
    featured: false,
  },

  // CI/CD
  {
    id: 'github-actions',
    name: 'GitHub Actions',
    category: 'ci-cd',
    description: 'Correlates CI/CD pipeline runs and deployment events with incident timelines.',
    agentConnection: 'change_detector',
    featured: false,
  },
  {
    id: 'circleci',
    name: 'CircleCI',
    category: 'ci-cd',
    description: 'Reads build and deployment history to identify changes that triggered incidents.',
    agentConnection: 'change_detector',
    featured: false,
  },
  {
    id: 'jenkins',
    name: 'Jenkins',
    category: 'ci-cd',
    description: 'Ingests build logs and deployment records for change impact analysis.',
    agentConnection: 'change_detector',
    featured: false,
  },
  {
    id: 'argocd',
    name: 'Argo CD',
    category: 'ci-cd',
    description: 'Tracks GitOps deployment syncs and rollback events across Kubernetes clusters.',
    agentConnection: 'change_detector',
    featured: false,
  },

  // API
  {
    id: 'rest-api',
    name: 'REST API',
    category: 'api',
    description: 'Send incidents and receive investigation results via CauseFlow REST API.',
    agentConnection: 'ingestion',
    featured: false,
  },
  {
    id: 'custom-webhooks',
    name: 'Custom Webhooks',
    category: 'api',
    description: 'Trigger investigations from any tool using configurable inbound webhooks.',
    agentConnection: 'ingestion',
    featured: false,
  },
  {
    id: 'graphql',
    name: 'GraphQL',
    category: 'api',
    description:
      'Query investigation results, patterns, and audit trails via the GraphQL endpoint.',
    agentConnection: 'ingestion',
    featured: false,
  },

  // Cloud Infrastructure
  {
    id: 'aws',
    name: 'AWS',
    category: 'cloud',
    description:
      'Inspects ECS tasks, EC2 instances, Lambda functions, and CloudTrail events for infrastructure issues.',
    agentConnection: 'infra_inspector',
    featured: false,
  },
  {
    id: 'google-cloud',
    name: 'Google Cloud',
    category: 'cloud',
    description:
      'Reads GKE cluster state, Cloud Run services, and audit logs to diagnose infrastructure failures.',
    agentConnection: 'infra_inspector',
    featured: false,
  },
  {
    id: 'azure',
    name: 'Azure',
    category: 'cloud',
    description:
      'Inspects Azure resource health, activity logs, and AKS clusters during incidents.',
    agentConnection: 'infra_inspector',
    featured: false,
  },
  {
    id: 'kubernetes',
    name: 'Kubernetes',
    category: 'cloud',
    description:
      'Reads pod status, events, and resource constraints to identify container orchestration issues.',
    agentConnection: 'infra_inspector',
    featured: false,
  },
];
