import { describe, it, expect } from 'vitest';
import { TriggerEventMapper } from '../../../../src/modules/integration/infra/trigger-event-mapper.js';
import { SentryParser } from '../../../../src/modules/ingestion/infra/parsers/sentry.parser.js';

// Fixture data
import nativePayload from '../../../fixtures/composio/sentry-new-issue.raw.json';

const mapper = new TriggerEventMapper();
const parser = new SentryParser();

// ─── Test 1: Native Sentry format passes through unchanged ────────────────────

describe('TriggerEventMapper.mapSentryAlert — native Sentry format', () => {
    it('passes through a payload that already has action + data.issue', () => {
        // Native shape: { action, data: { issue }, installation }
        const input = nativePayload as unknown as Record<string, unknown>;
        const result = mapper.mapSentryAlert(input);

        expect(result.type).toBe('alert');
        const alertResult = result as { type: 'alert'; source: string; payload: Record<string, unknown> };
        expect(alertResult.source).toBe('sentry');

        // Payload must already carry action at top level (not re-wrapped)
        const payload = alertResult.payload;
        expect(typeof payload['action']).toBe('string');
        expect(payload['action']).toBe('created');

        const data = payload['data'] as Record<string, unknown>;
        expect(typeof data).toBe('object');
        const issue = data['issue'] as Record<string, unknown>;
        expect(typeof issue).toBe('object');
        expect(issue['id']).toBe('12345');
        expect(issue['title']).toBe('ZeroDivisionError: division by zero');
    });

    it('canParse returns true for the passed-through payload', () => {
        const input = nativePayload as unknown as Record<string, unknown>;
        const result = mapper.mapSentryAlert(input);
        const payload = (result as { type: string; source: string; payload: Record<string, unknown> }).payload;

        expect(parser.canParse(payload)).toBe(true);
    });

    it('parse() returns correct NormalizedAlert from native payload', () => {
        const input = nativePayload as unknown as Record<string, unknown>;
        const result = mapper.mapSentryAlert(input);
        const payload = (result as { type: string; source: string; payload: Record<string, unknown> }).payload;

        const normalized = parser.parse({
            source: 'sentry',
            externalId: '',
            payload,
        });

        expect(normalized.title).toBe('ZeroDivisionError: division by zero');
        expect(normalized.severity).toBe('high'); // 'error' → 'high'
        expect(normalized.service).toBe('my-backend');
        expect(normalized.description).toBe('app/views/index.py in divide');
        expect(normalized.externalId).toBe('12345');
        expect(normalized.source).toBe('sentry');
    });
});

// ─── Test 2: Composio-normalized format (no action/data wrapper) ──────────────

describe('TriggerEventMapper.mapSentryAlert — Composio-normalized format', () => {
    const composioNormalized = {
        issue: {
            id: '67890',
            title: 'TypeError: Cannot read property of undefined',
            culprit: 'lib/utils.js in processData',
            level: 'error',
            project: {
                id: 'proj_2',
                name: 'my-frontend',
                slug: 'my-frontend',
            },
        },
    };

    it('wraps flat issue payload into { action: "created", data: <original> }', () => {
        const result = mapper.mapSentryAlert(composioNormalized);

        expect(result.type).toBe('alert');
        const alertResult = result as { type: 'alert'; source: string; payload: Record<string, unknown> };
        expect(alertResult.source).toBe('sentry');

        const payload = alertResult.payload;
        expect(payload['action']).toBe('created');

        const data = payload['data'] as Record<string, unknown>;
        // The original composio payload is nested under 'data'
        expect(data).toBe(composioNormalized);
    });

    it('canParse returns true for the wrapped payload', () => {
        const result = mapper.mapSentryAlert(composioNormalized);
        const payload = (result as { type: string; source: string; payload: Record<string, unknown> }).payload;

        expect(parser.canParse(payload)).toBe(true);
    });

    it('parse() returns correct NormalizedAlert from Composio-normalized payload', () => {
        const result = mapper.mapSentryAlert(composioNormalized);
        const payload = (result as { type: string; source: string; payload: Record<string, unknown> }).payload;

        const normalized = parser.parse({
            source: 'sentry',
            externalId: '',
            payload,
        });

        expect(normalized.title).toBe('TypeError: Cannot read property of undefined');
        expect(normalized.severity).toBe('high'); // 'error' → 'high'
        expect(normalized.service).toBe('my-frontend');
        expect(normalized.description).toBe('lib/utils.js in processData');
        expect(normalized.externalId).toBe('67890');
        expect(normalized.source).toBe('sentry');
    });
});

// ─── Test 3: Level → severity mapping ─────────────────────────────────────────

describe('SentryParser severity mapping via TriggerEventMapper', () => {
    const levels: Array<{ level: string; expectedSeverity: string }> = [
        { level: 'fatal', expectedSeverity: 'critical' },
        { level: 'error', expectedSeverity: 'high' },
        { level: 'warning', expectedSeverity: 'medium' },
    ];

    for (const { level, expectedSeverity } of levels) {
        it(`maps level "${level}" to severity "${expectedSeverity}"`, () => {
            const data = {
                action: 'created',
                data: {
                    issue: {
                        id: '1',
                        title: 'Test Issue',
                        culprit: 'test.js',
                        level,
                        project: { id: 'p1', name: 'test-svc', slug: 'test-svc' },
                    },
                },
            };

            const result = mapper.mapSentryAlert(data);
            const payload = (result as { type: string; source: string; payload: Record<string, unknown> }).payload;

            expect(parser.canParse(payload)).toBe(true);

            const normalized = parser.parse({ source: 'sentry', externalId: '', payload });
            expect(normalized.severity).toBe(expectedSeverity);
        });
    }
});
