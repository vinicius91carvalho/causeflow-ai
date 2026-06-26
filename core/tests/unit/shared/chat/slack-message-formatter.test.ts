/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return */
import { describe, it, expect } from 'vitest';
import {
    formatIncidentBlocks,
    formatResolutionBlocks,
} from '../../../../src/shared/infra/chat/slack-message-formatter.js';

describe('formatIncidentBlocks', () => {
    const baseInput = {
        severity: 'critical' as const,
        title: 'Database connection pool exhausted',
        service: 'payments-api',
        environment: 'production',
        investigationUrl: 'https://app.causeflow.io/investigations/inc-001',
        triggeredAt: '2026-04-24T10:00:00.000Z',
    };

    it('should start header with 🔴 for critical severity', () => {
        const blocks = formatIncidentBlocks(baseInput);
        const header = blocks.find((b) => b.type === 'header');
        expect(header).toBeDefined();
        const headerBlock = header as any;
        expect(headerBlock.text.text).toContain('🔴');
    });

    it('should start header with 🟠 for high severity', () => {
        const blocks = formatIncidentBlocks({ ...baseInput, severity: 'high' });
        const header = blocks.find((b) => b.type === 'header') as any;
        expect(header.text.text).toContain('🟠');
    });

    it('should include severity, service and environment in fields section', () => {
        const blocks = formatIncidentBlocks(baseInput);
        const sections = blocks.filter((b) => b.type === 'section') as any[];
        const fieldsSection = sections.find((s) => Array.isArray(s.fields));
        expect(fieldsSection).toBeDefined();
        const fieldTexts = fieldsSection.fields.map((f: any) => f.text);
        expect(fieldTexts.some((t: string) => t.includes('Critical'))).toBe(true);
        expect(fieldTexts.some((t: string) => t.includes('payments-api'))).toBe(true);
        expect(fieldTexts.some((t: string) => t.includes('production'))).toBe(true);
    });

    it('should include a button with the correct investigation URL', () => {
        const blocks = formatIncidentBlocks(baseInput);
        const actions = blocks.find((b) => b.type === 'actions') as any;
        expect(actions).toBeDefined();
        const button = actions.elements[0];
        expect(button.url).toBe('https://app.causeflow.io/investigations/inc-001');
        expect(button.text.text).toContain('View Investigation');
    });

    it('should NOT include an AI Triage section when triageSummary is absent', () => {
        const blocks = formatIncidentBlocks(baseInput);
        const sections = blocks.filter((b) => b.type === 'section') as any[];
        const triageSection = sections.find((s) => s.text?.text?.includes('AI Triage'));
        expect(triageSection).toBeUndefined();
    });

    it('should include an AI Triage section when triageSummary is present', () => {
        const blocks = formatIncidentBlocks({ ...baseInput, triageSummary: 'High error rate on DB queries' });
        const sections = blocks.filter((b) => b.type === 'section') as any[];
        const triageSection = sections.find((s) => s.text?.text?.includes('AI Triage'));
        expect(triageSection).toBeDefined();
        expect(triageSection.text.text).toContain('High error rate on DB queries');
    });
});

describe('formatResolutionBlocks', () => {
    const baseInput = {
        incidentTitle: 'Database connection pool exhausted',
        rootCause: 'Connection leak in the payments service introduced in v2.3.1',
        recommendedActions: ['Restart payments-api pods', 'Roll back to v2.3.0', 'Add connection pool monitoring'],
        durationMs: 3_600_000, // 1 hour
        reportUrl: 'https://app.causeflow.io/investigations/inc-001',
    };

    it('should have header containing ✅ and incident title', () => {
        const blocks = formatResolutionBlocks(baseInput);
        const header = blocks.find((b) => b.type === 'header') as any;
        expect(header).toBeDefined();
        expect(header.text.text).toContain('✅');
        expect(header.text.text).toContain('Database connection pool exhausted');
    });

    it('should truncate root cause at 200 characters', () => {
        const longRootCause = 'A'.repeat(250);
        const blocks = formatResolutionBlocks({ ...baseInput, rootCause: longRootCause });
        const sections = blocks.filter((b) => b.type === 'section') as any[];
        const rootCauseSection = sections.find((s) => s.text?.text?.includes('Root Cause'));
        expect(rootCauseSection).toBeDefined();
        // 200 chars + ellipsis + label
        const text: string = rootCauseSection.text.text;
        // The actual root cause portion should be <= 201 chars (200 + ellipsis char)
        expect(text.length).toBeLessThan(250);
        expect(text).toContain('…');
    });

    it('should include only top 2 recommended actions', () => {
        const blocks = formatResolutionBlocks(baseInput);
        const sections = blocks.filter((b) => b.type === 'section') as any[];
        const actionsSection = sections.find((s) => s.text?.text?.includes('Recommended Actions'));
        expect(actionsSection).toBeDefined();
        const text: string = actionsSection.text.text;
        expect(text).toContain('Restart payments-api pods');
        expect(text).toContain('Roll back to v2.3.0');
        expect(text).not.toContain('Add connection pool monitoring');
    });

    it('should include report URL in context element', () => {
        const blocks = formatResolutionBlocks(baseInput);
        const context = blocks.find((b) => b.type === 'context') as any;
        expect(context).toBeDefined();
        const elementText = context.elements[0].text;
        expect(elementText).toContain('https://app.causeflow.io/investigations/inc-001');
    });
});
