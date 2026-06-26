import type { KnownBlock } from '@slack/web-api';
import type { Severity } from '../../domain/types.js';

const SEVERITY_EMOJI: Record<string, string> = {
    critical: '🔴',
    high: '🟠',
};

export type SlackIncidentBlocksInput = {
    severity: Severity;
    title: string;
    service: string;
    environment: string;
    triageSummary?: string;
    investigationUrl: string;
    triggeredAt: string;
};

export type SlackInvestigationStartedBlocksInput = {
    incidentTitle: string;
    severity: string;
    investigationUrl: string;
    startedAt: string;
};

export type SlackResolutionBlocksInput = {
    incidentTitle: string;
    rootCause: string;
    recommendedActions: string[];
    durationMs: number;
    reportUrl: string;
};

export function formatIncidentBlocks(input: SlackIncidentBlocksInput): KnownBlock[] {
    const { severity, title, service, environment, triageSummary, investigationUrl, triggeredAt } = input;
    const emoji = SEVERITY_EMOJI[severity] ?? '⚪';
    const severityLabel = severity.charAt(0).toUpperCase() + severity.slice(1);

    const blocks: KnownBlock[] = [
        {
            type: 'header',
            text: {
                type: 'plain_text',
                text: `${emoji} [${severityLabel}] ${title}`,
                emoji: true,
            },
        },
        {
            type: 'section',
            text: {
                type: 'mrkdwn',
                text: `*${title}*\nService: \`${service}\` | Environment: \`${environment}\``,
            },
        },
        {
            type: 'section',
            fields: [
                {
                    type: 'mrkdwn',
                    text: `*Severity*\n${severityLabel}`,
                },
                {
                    type: 'mrkdwn',
                    text: `*Service*\n${service}`,
                },
                {
                    type: 'mrkdwn',
                    text: `*Environment*\n${environment}`,
                },
                {
                    type: 'mrkdwn',
                    text: `*Triggered*\n${triggeredAt}`,
                },
            ],
        },
    ];

    if (triageSummary) {
        blocks.push({
            type: 'section',
            text: {
                type: 'mrkdwn',
                text: `*AI Triage Summary*\n${triageSummary}`,
            },
        });
    }

    blocks.push({
        type: 'actions',
        elements: [
            {
                type: 'button',
                text: {
                    type: 'plain_text',
                    text: 'View Investigation →',
                    emoji: true,
                },
                url: investigationUrl,
                action_id: 'view_investigation',
            },
        ],
    });

    return blocks;
}

export function formatInvestigationStartedBlocks(input: SlackInvestigationStartedBlocksInput): KnownBlock[] {
    const { incidentTitle, severity, investigationUrl, startedAt } = input;
    const severityLabel = severity.charAt(0).toUpperCase() + severity.slice(1);

    return [
        {
            type: 'header',
            text: {
                type: 'plain_text',
                text: `🔍 AI Investigation Started — ${incidentTitle}`,
                emoji: true,
            },
        },
        {
            type: 'section',
            fields: [
                { type: 'mrkdwn', text: `*Severity*\n${severityLabel}` },
                { type: 'mrkdwn', text: `*Started*\n${startedAt}` },
            ],
        },
        {
            type: 'actions',
            elements: [
                {
                    type: 'button',
                    text: { type: 'plain_text', text: 'View Investigation →', emoji: true },
                    url: investigationUrl,
                    action_id: 'view_investigation_started',
                },
            ],
        },
    ];
}

export function formatResolutionBlocks(input: SlackResolutionBlocksInput): KnownBlock[] {
    const { incidentTitle, rootCause, recommendedActions, durationMs, reportUrl } = input;

    const truncatedRootCause = rootCause.length > 200
        ? `${rootCause.slice(0, 200)}…`
        : rootCause;

    const topActions = recommendedActions.slice(0, 2);
    const actionsText = topActions.map((a) => `• ${a}`).join('\n');

    const durationMinutes = Math.round(durationMs / 60_000);
    const durationText = durationMinutes >= 60
        ? `${Math.round(durationMinutes / 60)}h ${durationMinutes % 60}m`
        : `${durationMinutes}m`;

    const blocks: KnownBlock[] = [
        {
            type: 'header',
            text: {
                type: 'plain_text',
                text: `✅ Incident Resolved — ${incidentTitle}`,
                emoji: true,
            },
        },
        {
            type: 'section',
            text: {
                type: 'mrkdwn',
                text: `*Root Cause*\n${truncatedRootCause}`,
            },
        },
    ];

    if (topActions.length > 0) {
        blocks.push({
            type: 'section',
            text: {
                type: 'mrkdwn',
                text: `*Recommended Actions*\n${actionsText}`,
            },
        });
    }

    blocks.push({
        type: 'context',
        elements: [
            {
                type: 'mrkdwn',
                text: `Duration: ${durationText} | <${reportUrl}|View Full Report>`,
            },
        ],
    });

    return blocks;
}
