import { getComposioClient, COMPOSIO_APP_MAP, COMPOSIO_PROVIDERS } from './composio-client.js';
import { logger } from '../logger.js';
import type { ToolDefinition } from '../../application/ports/agent-runner.port.js';
import type { IntegrationToolProvider } from '../../application/ports/integration-tool-provider.port.js';

/**
 * Composio-backed integration tool provider (v3 SDK).
 *
 * Uses the direct tools API (NOT session-based meta-tools):
 *   composio.tools.getRawComposioTools({ toolkits }) → real tool definitions
 *   session.execute(slug, params) → execute with tenant's OAuth token
 *
 * Each CauseFlow tenantId maps to a Composio user_id.
 * Only tools from connected providers are loaded (filtered by connectedApps).
 * Write/destructive operations are blocked — investigation is read-only.
 */

/**
 * Curated read-only tools per provider, selected for SRE investigation context.
 * Only these tools are exposed to the investigation agent — all are read-only.
 *
 * Selection criteria:
 * - Relevant for incident investigation (commits, PRs, issues, logs, metrics)
 * - Read-only (no create, update, delete, write)
 * - Minimal but sufficient for root cause analysis
 */
const CURATED_TOOLS: Record<string, string[]> = {
  github: [
    // Repo & code
    'GITHUB_GET_A_REPOSITORY',
    'GITHUB_GET_A_BRANCH',
    'GITHUB_LIST_BRANCHES',
    'GITHUB_GET_A_REPOSITORY_README',
    'GITHUB_GET_REPOSITORY_CONTENT',
    'GITHUB_GET_A_BLOB',
    'GITHUB_GET_A_TREE',
    // Commits & diffs
    'GITHUB_GET_A_COMMIT',
    'GITHUB_LIST_COMMITS',
    'GITHUB_COMPARE_TWO_COMMITS',
    // PRs
    'GITHUB_FIND_PULL_REQUESTS',
    'GITHUB_GET_A_PULL_REQUEST',
    'GITHUB_LIST_PULL_REQUESTS',
    'GITHUB_LIST_PULL_REQUEST_FILES',
    'GITHUB_LIST_PULL_REQUEST_COMMITS',
    'GITHUB_CHECK_IF_PULL_REQUEST_HAS_BEEN_MERGED',
    // Issues
    'GITHUB_GET_AN_ISSUE',
    'GITHUB_LIST_ISSUE_COMMENTS',
    'GITHUB_LIST_ISSUE_EVENTS',
    // Deployments & releases
    'GITHUB_LIST_DEPLOYMENTS',
    'GITHUB_LIST_DEPLOYMENT_STATUSES',
    'GITHUB_GET_A_RELEASE',
    'GITHUB_GET_A_RELEASE_BY_TAG_NAME',
    'GITHUB_LIST_RELEASES',
    // Workflows / CI
    'GITHUB_LIST_REPOSITORY_WORKFLOWS',
    'GITHUB_LIST_WORKFLOW_RUNS',
    'GITHUB_GET_AN_ENVIRONMENT',
  ],
  gitlab: [
    'GITLAB_GET_A_PROJECT',
    'GITLAB_LIST_PROJECT_MERGE_REQUESTS',
    'GITLAB_GET_A_MERGE_REQUEST',
    'GITLAB_LIST_REPOSITORY_COMMITS',
    'GITLAB_GET_A_COMMIT',
    'GITLAB_LIST_PROJECT_PIPELINES',
    'GITLAB_GET_A_PIPELINE',
    'GITLAB_LIST_PROJECT_ISSUES',
  ],
  bitbucket: [
    'BITBUCKET_GET_A_REPOSITORY',
    'BITBUCKET_LIST_PULL_REQUESTS',
    'BITBUCKET_GET_A_PULL_REQUEST',
    'BITBUCKET_LIST_COMMITS',
    'BITBUCKET_LIST_PIPELINES',
    'BITBUCKET_GET_A_PIPELINE',
  ],
  slack: [
    'SLACK_LIST_CHANNELS',
    'SLACK_SEARCH_MESSAGES',
    'SLACK_GET_CHANNEL_HISTORY',
    'SLACK_GET_CHANNEL_INFO',
    'SLACK_LIST_USERS',
    'SLACK_GET_USER_INFO',
  ],
  'microsoft-teams': [
    'MICROSOFTTEAMS_LIST_CHANNELS',
    'MICROSOFTTEAMS_GET_CHANNEL_MESSAGES',
    'MICROSOFTTEAMS_LIST_TEAMS',
    'MICROSOFTTEAMS_SEARCH_MESSAGES',
  ],
  discord: ['DISCORD_LIST_CHANNELS', 'DISCORD_GET_CHANNEL_MESSAGES', 'DISCORD_SEARCH_MESSAGES'],
  jira: [
    'JIRA_GET_ISSUE',
    'JIRA_SEARCH_ISSUES',
    'JIRA_GET_PROJECT',
    'JIRA_LIST_PROJECTS',
    'JIRA_GET_ISSUE_COMMENTS',
    'JIRA_GET_CHANGELOGS',
    'JIRA_FIND_USERS',
    'JIRA_GET_ISSUE_TRANSITIONS',
  ],
  linear: [
    'LINEAR_LIST_ISSUES',
    'LINEAR_GET_ISSUE',
    'LINEAR_SEARCH_ISSUES',
    'LINEAR_LIST_PROJECTS',
    'LINEAR_GET_PROJECT',
    'LINEAR_LIST_TEAMS',
  ],
  trello: [
    'TRELLO_GET_A_BOARD',
    'TRELLO_LIST_CARDS',
    'TRELLO_GET_A_CARD',
    'TRELLO_LIST_BOARDS',
    'TRELLO_LIST_LISTS',
    'TRELLO_SEARCH_CARDS',
  ],
  shortcut: [
    'SHORTCUT_GET_STORY',
    'SHORTCUT_SEARCH_STORIES',
    'SHORTCUT_LIST_STORIES',
    'SHORTCUT_GET_EPIC',
    'SHORTCUT_LIST_EPICS',
    'SHORTCUT_GET_PROJECT',
    'SHORTCUT_LIST_ITERATIONS',
    'SHORTCUT_STORY_HISTORY',
  ],
  clickup: [
    'CLICKUP_GET_TASK',
    'CLICKUP_LIST_TASKS',
    'CLICKUP_SEARCH_TASKS',
    'CLICKUP_GET_SPACE',
    'CLICKUP_LIST_SPACES',
    'CLICKUP_LIST_FOLDERS',
  ],
  asana: [
    'ASANA_GET_A_TASK',
    'ASANA_SEARCH_TASKS_IN_A_WORKSPACE',
    'ASANA_GET_A_PROJECT',
    'ASANA_LIST_TASKS',
    'ASANA_GET_TASK_STORIES',
    'ASANA_LIST_PROJECTS',
  ],
  datadog: [
    'DATADOG_LIST_INCIDENTS',
    'DATADOG_GET_INCIDENT',
    'DATADOG_SEARCH_EVENTS',
    'DATADOG_LIST_MONITORS',
    'DATADOG_GET_MONITOR',
    'DATADOG_QUERY_METRICS',
    'DATADOG_SEARCH_LOGS',
    'DATADOG_LIST_DASHBOARDS',
  ],
  sentry: [
    'SENTRY_LIST_ISSUES',
    'SENTRY_GET_ISSUE',
    'SENTRY_LIST_EVENTS',
    'SENTRY_GET_EVENT',
    'SENTRY_LIST_PROJECTS',
    'SENTRY_GET_PROJECT',
    'SENTRY_SEARCH_ISSUES',
  ],
  pagerduty: [
    'PAGERDUTY_LIST_INCIDENTS',
    'PAGERDUTY_GET_INCIDENT',
    'PAGERDUTY_LIST_SERVICES',
    'PAGERDUTY_GET_SERVICE',
    'PAGERDUTY_LIST_ON_CALLS',
    'PAGERDUTY_LIST_ALERTS',
  ],
  new_relic: [
    'NEWRELIC_LIST_APPLICATIONS',
    'NEWRELIC_GET_APPLICATION',
    'NEWRELIC_LIST_ALERTS',
    'NEWRELIC_GET_ALERT',
    'NEWRELIC_QUERY_NRQL',
    'NEWRELIC_LIST_DEPLOYMENTS',
  ],
  notion: [
    'NOTION_SEARCH_NOTION_PAGE',
    'NOTION_RETRIEVE_PAGE',
    'NOTION_GET_PAGE_MARKDOWN',
    'NOTION_QUERY_DATABASE',
    'NOTION_FETCH_DATABASE',
    'NOTION_FETCH_COMMENTS',
    'NOTION_FETCH_BLOCK_CONTENTS',
  ],
  confluence: [
    'CONFLUENCE_SEARCH_CONTENT',
    'CONFLUENCE_GET_PAGE',
    'CONFLUENCE_LIST_PAGES',
    'CONFLUENCE_GET_SPACE',
    'CONFLUENCE_LIST_SPACES',
    'CONFLUENCE_GET_PAGE_CONTENT',
  ],
  hubspot: [
    'HUBSPOT_LIST_CONTACTS',
    'HUBSPOT_GET_CONTACT',
    'HUBSPOT_SEARCH_CONTACTS',
    'HUBSPOT_LIST_DEALS',
    'HUBSPOT_GET_DEAL',
    'HUBSPOT_LIST_TICKETS',
  ],
  zendesk: [
    'ZENDESK_LIST_TICKETS',
    'ZENDESK_GET_TICKET',
    'ZENDESK_SEARCH_TICKETS',
    'ZENDESK_LIST_USERS',
    'ZENDESK_GET_TICKET_COMMENTS',
  ],
  intercom: [
    'INTERCOM_LIST_CONVERSATIONS',
    'INTERCOM_GET_CONVERSATION',
    'INTERCOM_SEARCH_CONVERSATIONS',
    'INTERCOM_LIST_CONTACTS',
    'INTERCOM_GET_CONTACT',
    'INTERCOM_SEARCH_CONTACTS',
  ],
};

/** All curated slugs flattened into a Set for fast lookup */
const CURATED_SET = new Set(Object.values(CURATED_TOOLS).flat());

/** Check if a tool is in our curated read-only list */
function isCuratedTool(slug: string): boolean {
  return CURATED_SET.has(slug);
}

/** Fallback: if a curated tool doesn't exist in Composio, match by read-only pattern */
const READ_PATTERNS = [
  '_GET_',
  '_LIST_',
  '_SEARCH_',
  '_FIND_',
  '_CHECK_',
  '_COMPARE_',
  '_FETCH_',
  '_QUERY_',
  '_RETRIEVE_',
];
function isReadOnlyFallback(slug: string): boolean {
  const s = slug.toUpperCase();
  return READ_PATTERNS.some((p) => s.includes(p));
}

export class ComposioToolProvider {
  toolPrefix = 'composio_';

  async getTools(tenantId: string, apps?: string[]): Promise<ToolDefinition[]> {
    const client = await getComposioClient();
    if (!client) return [];

    const requestedApps = (apps ?? []).filter((app) => COMPOSIO_PROVIDERS.has(app));
    if (requestedApps.length === 0) return [];

    try {
      const toolkits = requestedApps
        .map((app) => COMPOSIO_APP_MAP[app as keyof typeof COMPOSIO_APP_MAP])
        .filter(Boolean);

      // Fetch each toolkit with important=false, filter to curated read-only list
      const allTools: any[] = [];
      for (const toolkit of toolkits) {
        const curatedForToolkit = CURATED_TOOLS[toolkit] ?? [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const tools: any[] = await (client as any).tools.getRawComposioTools({
          toolkits: [toolkit],
          important: false,
          limit: 100,
        });
        // Prefer curated tools; fall back to read-only pattern if curated list misses
        const matched = tools.filter((t: any) => {
          const slug = t.slug ?? t.name ?? '';
          return (
            isCuratedTool(slug) || (curatedForToolkit.length === 0 && isReadOnlyFallback(slug))
          );
        });
        allTools.push(...matched);
      }

      logger.info(
        { tenantId, toolkits, toolCount: allTools.length },
        'Composio curated read-only tools loaded',
      );

      return allTools.map((tool: any) => ({
        name: `${this.toolPrefix}${tool.slug ?? tool.name}`,
        description: tool.description ?? '',
        inputSchema: tool.inputParameters ?? tool.input_parameters ?? {},
      }));
    } catch (err) {
      logger.warn(
        { err: err instanceof Error ? err.message : err, tenantId, apps: requestedApps },
        'Composio getTools failed',
      );
      return [];
    }
  }

  async executeAction(
    tenantId: string,
    actionName: string,
    params: Record<string, unknown>,
  ): Promise<string> {
    const client = await getComposioClient();
    if (!client) return JSON.stringify({ error: 'Composio not configured' });

    const toolSlug = actionName.replace(this.toolPrefix, '');

    // Safety check: block non-curated/write operations at execution time
    if (!isCuratedTool(toolSlug) && !isReadOnlyFallback(toolSlug)) {
      logger.warn({ tenantId, action: toolSlug }, 'Blocked write operation during investigation');
      return JSON.stringify({
        error: `Action ${toolSlug} is a write operation and is blocked during investigation. Only read-only operations are allowed.`,
      });
    }

    try {
      // Session-based execution resolves toolkit_versions + OAuth token
      const session = await client.create(tenantId);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (session as any).execute(toolSlug, params);
      const output =
        typeof result === 'string'
          ? result
          : result?.data
            ? JSON.stringify(result.data)
            : JSON.stringify(result);
      return output;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.warn({ err: message, tenantId, action: toolSlug }, 'Composio executeAction failed');
      return JSON.stringify({ error: message });
    }
  }

  isOwnTool(toolName: string): boolean {
    return toolName.startsWith(this.toolPrefix);
  }

  async initiateAuth(tenantId: string, provider: string, redirectUrl: string): Promise<string> {
    const client = await getComposioClient();
    if (!client) throw new Error('Composio not configured');

    const composioApp = COMPOSIO_APP_MAP[provider as keyof typeof COMPOSIO_APP_MAP];
    if (!composioApp) throw new Error(`Provider "${provider}" not supported by Composio`);

    try {
      const session = await client.create(tenantId);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const connection: any = await (session as any).authorize(composioApp, {
        callbackUrl: redirectUrl,
      });
      return connection.redirectUrl ?? '';
    } catch {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const connection: any = await (client.connectedAccounts as any).link(tenantId, composioApp, {
        callbackUrl: redirectUrl,
      });
      return connection.redirectUrl ?? '';
    }
  }

  async getConnectionStatus(tenantId: string) {
    const client = await getComposioClient();
    if (!client) return [];

    try {
      const connections = await client.connectedAccounts.list({ userIds: [tenantId] });
      const reverseMap: Record<string, string> = Object.entries(COMPOSIO_APP_MAP).reduce(
        (acc: Record<string, string>, [cf, comp]) => {
          acc[comp] = cf;
          return acc;
        },
        {},
      );

      return (connections.items ?? [])
        .map((conn: any) => {
          const composioSlug = conn.appName ?? conn.toolkit?.slug ?? '';
          const causeflowProvider = reverseMap[composioSlug] ?? composioSlug;
          return {
            provider: causeflowProvider,
            status:
              conn.status === 'ACTIVE'
                ? ('connected' as const)
                : conn.status === 'FAILED'
                  ? ('error' as const)
                  : ('disconnected' as const),
            createdAt: conn.createdAt,
          };
        })
        .filter((conn: any) => conn.provider !== '');
    } catch (err) {
      logger.warn(
        { err: err instanceof Error ? err.message : err, tenantId },
        'Composio getConnectionStatus failed',
      );
      return [];
    }
  }

  async revokeConnection(tenantId: string, provider: string): Promise<void> {
    const client = await getComposioClient();
    if (!client) return;

    const composioApp = COMPOSIO_APP_MAP[provider as keyof typeof COMPOSIO_APP_MAP];
    if (!composioApp) return;

    try {
      const connections = await client.connectedAccounts.list({ userIds: [tenantId] });
      for (const conn of (connections.items ?? []) as any[]) {
        if (
          ((conn as any).appName === composioApp || (conn as any).integrationId === composioApp) &&
          conn.id
        ) {
          await client.connectedAccounts.delete(conn.id);
        }
      }
    } catch (err) {
      logger.warn(
        { err: err instanceof Error ? err.message : err, tenantId, provider },
        'Composio revokeConnection failed',
      );
    }
  }
}
