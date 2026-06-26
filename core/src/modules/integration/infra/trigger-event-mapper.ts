import type { TenantId } from '../../../shared/domain/value-objects.js';

export interface RawAlertPayload {
    source: string;
    payload: Record<string, unknown>;
}

export interface ChangeEventPayload {
    tenantId: TenantId;
    changeType: 'deployment' | 'config_change' | 'code_change';
    description: string;
    source: string;
    metadata: Record<string, unknown>;
}

export type TriggerMappingResult = {
    type: 'alert';
    source: string;
    payload: Record<string, unknown>;
} | {
    type: 'change_event';
    data: ChangeEventPayload;
} | {
    type: 'unknown';
    data: Record<string, unknown>;
};

/**
 * Maps Composio trigger payloads to CauseFlow actions.
 *
 * Alert triggers → IngestAlertUseCase (existing parsers or inline parsing)
 * Change triggers → AddChangeEventUseCase (graph correlation engine)
 */
export class TriggerEventMapper {
    map(triggerSlug: string, data: Record<string, unknown>, tenantId: TenantId): TriggerMappingResult {
        switch (triggerSlug) {
            case 'PAGERDUTY_INCIDENT_TRIGGERED':
                return this.mapPagerDutyAlert(data);
            case 'SENTRY_NEW_ISSUE':
                return this.mapSentryAlert(data);
            case 'DATADOG_MONITOR_TRIGGERED':
                return this.mapDatadogAlert(data);
            // Slack and Jira are intentionally excluded from alert mapping:
            // SLACK_RECEIVE_MESSAGE fires for ALL messages (including "hello") — too noisy.
            // JIRA_ISSUE_CREATED fires for ALL issues (features, tasks) — not just incidents.
            // These would create false incident investigations.
            case 'GITHUB_COMMIT_EVENT':
                return this.mapGitHubCommit(data, tenantId);
            case 'GITHUB_PULL_REQUEST_EVENT':
                return this.mapGitHubPullRequest(data, tenantId);
            default:
                return { type: 'unknown', data };
        }
    }
    mapPagerDutyAlert(data: Record<string, unknown>): TriggerMappingResult {
        // Wrap Composio trigger data into PagerDuty v3 format for existing parser
        return {
            type: 'alert',
            source: 'pagerduty',
            payload: data['event'] ? data : { event: data },
        };
    }
    mapSentryAlert(data: Record<string, unknown>): TriggerMappingResult {
        // Wrap into Sentry webhook format for existing parser
        return {
            type: 'alert',
            source: 'sentry',
            payload: data['action'] ? data : { action: 'created', data },
        };
    }
    mapDatadogAlert(data: Record<string, unknown>): TriggerMappingResult {
        return {
            type: 'alert',
            source: 'datadog',
            payload: data,
        };
    }
    mapSlackAlert(data: Record<string, unknown>): TriggerMappingResult {
        // Inline Slack message → alert mapping (no existing parser)
        const text = (data['text'] ?? data['message'] ?? '') as string;
        const channel = (data['channel'] ?? data['channel_name'] ?? 'unknown') as string;
        const user = (data['user'] ?? data['user_name'] ?? 'unknown') as string;
        const payload = {
            title: text.length > 120 ? `${text.slice(0, 117)}...` : text || 'Slack incident report',
            description: `Reported by ${user} in #${channel}: ${text}`,
            severity: 'medium',
            service: channel,
            environment: 'production',
            tags: { channel, user, source: 'slack-trigger' },
            rawPayload: data,
            receivedAt: new Date().toISOString(),
        };
        return { type: 'alert', source: 'slack', payload };
    }
    mapJiraAlert(data: Record<string, unknown>): TriggerMappingResult {
        // Inline Jira issue → alert mapping
        const issue = (data['issue'] ?? data) as Record<string, unknown>;
        const fields = (issue['fields'] ?? {}) as Record<string, unknown>;
        const priority = (fields['priority'] ?? {}) as Record<string, unknown>;
        const priorityName = ((priority['name'] as string) ?? '').toLowerCase();
        const project = (fields['project'] ?? {}) as Record<string, unknown>;
        const severityMap: Record<string, string> = {
            highest: 'critical',
            high: 'high',
            medium: 'medium',
            low: 'low',
            lowest: 'info',
        };
        const payload = {
            title: (fields['summary'] as string) ?? (issue['key'] as string) ?? 'Jira issue',
            description: (fields['description'] as string) ?? '',
            severity: severityMap[priorityName] ?? 'medium',
            service: (project['name'] as string) ?? (project['key'] as string) ?? 'unknown',
            environment: 'production',
            tags: {
                issueKey: (issue['key'] as string) ?? '',
                issueType: ((fields['issuetype'] as Record<string, unknown>)?.['name'] as string) ?? '',
                source: 'jira-trigger',
            },
            rawPayload: data,
            receivedAt: new Date().toISOString(),
        };
        return { type: 'alert', source: 'jira', payload };
    }
    mapGitHubCommit(data: Record<string, unknown>, tenantId: TenantId): TriggerMappingResult {
        const repo = (data['repository'] ?? {}) as Record<string, unknown>;
        const repoName = (repo['full_name'] as string) ?? (data['repo'] as string) ?? 'unknown';
        const ref = data['ref'] as string | undefined;
        const branch = ref?.replace('refs/heads/', '') ?? (data['branch'] as string) ?? 'main';
        const commits = (data['commits'] as Record<string, unknown>[]) ?? [];
        const headCommit = (data['head_commit'] ?? commits[0] ?? {}) as Record<string, unknown>;
        const message = (headCommit['message'] as string) ?? '';
        const authorObj = headCommit['author'] as Record<string, unknown> | undefined;
        const author = (authorObj?.['name'] as string) ?? 'unknown';
        return {
            type: 'change_event',
            data: {
                tenantId,
                changeType: 'deployment',
                description: `Push to ${repoName}/${branch} by ${author}: ${message}`,
                source: 'composio-trigger',
                metadata: {
                    repoName,
                    branch,
                    commitCount: commits.length,
                    commitSha: headCommit['id'] ?? '',
                    author,
                    message,
                },
            },
        };
    }
    mapGitHubPullRequest(data: Record<string, unknown>, tenantId: TenantId): TriggerMappingResult {
        const pr = (data['pull_request'] ?? data) as Record<string, unknown>;
        const repo = (data['repository'] ?? {}) as Record<string, unknown>;
        const repoName = (repo['full_name'] as string) ?? 'unknown';
        const action = (data['action'] as string) ?? '';
        const title = (pr['title'] as string) ?? '';
        const merged = pr['merged'] === true;
        const userObj = pr['user'] as Record<string, unknown> | undefined;
        const user = (userObj?.['login'] as string) ?? 'unknown';
        return {
            type: 'change_event',
            data: {
                tenantId,
                changeType: merged ? 'deployment' : 'config_change',
                description: `PR ${action} on ${repoName}: ${title} by ${user}${merged ? ' (merged)' : ''}`,
                source: 'composio-trigger',
                metadata: {
                    repoName,
                    action,
                    prNumber: (pr['number'] as number) ?? 0,
                    title,
                    merged,
                    user,
                    baseBranch: ((pr['base'] as Record<string, unknown>)?.['ref'] as string) ?? '',
                    headBranch: ((pr['head'] as Record<string, unknown>)?.['ref'] as string) ?? '',
                },
            },
        };
    }
}
