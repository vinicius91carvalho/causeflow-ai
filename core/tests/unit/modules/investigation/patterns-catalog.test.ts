import { describe, it, expect } from 'vitest';
import { SRE_PATTERNS_CATALOG, renderPatternsCatalogForPrompt } from '../../../../src/modules/investigation/application/modes/shared/patterns-catalog.js';

describe('SRE_PATTERNS_CATALOG', () => {
    it('has a reasonable size (12-30 patterns)', () => {
        expect(SRE_PATTERNS_CATALOG.length).toBeGreaterThanOrEqual(12);
        expect(SRE_PATTERNS_CATALOG.length).toBeLessThanOrEqual(30);
    });

    it('every pattern has unique id', () => {
        const ids = SRE_PATTERNS_CATALOG.map((p) => p.id);
        const uniq = new Set(ids);
        expect(uniq.size).toBe(ids.length);
    });

    it('every pattern covers a supported layer', () => {
        const validLayers = ['infra', 'app', 'data', 'dependency', 'config', 'security'];
        for (const p of SRE_PATTERNS_CATALOG) {
            expect(validLayers).toContain(p.layer);
        }
    });

    it('every pattern has non-empty symptoms + triggers + suggested evidence', () => {
        for (const p of SRE_PATTERNS_CATALOG) {
            expect(p.symptoms.length).toBeGreaterThan(0);
            expect(p.typicalTriggers.length).toBeGreaterThan(0);
            expect(p.suggestedEvidence.length).toBeGreaterThan(0);
        }
    });

    it('covers all major layers (infra + app + data + dependency)', () => {
        const layers = new Set(SRE_PATTERNS_CATALOG.map((p) => p.layer));
        expect(layers.has('infra')).toBe(true);
        expect(layers.has('app')).toBe(true);
        expect(layers.has('data')).toBe(true);
        expect(layers.has('dependency')).toBe(true);
    });
});

describe('renderPatternsCatalogForPrompt', () => {
    it('renders every pattern as a bullet with id in backticks', () => {
        const rendered = renderPatternsCatalogForPrompt();
        for (const p of SRE_PATTERNS_CATALOG) {
            expect(rendered).toContain(`\`${p.id}\``);
            expect(rendered).toContain(p.name);
        }
    });

    it('stays under a conservative token budget (< 4K chars ≈ 1K tokens)', () => {
        const rendered = renderPatternsCatalogForPrompt();
        // One char ≈ 0.25 tokens. 4000 chars ≈ 1000 tokens — safely fits
        // in any prompt context for Sonnet/Opus.
        expect(rendered.length).toBeLessThan(4000);
    });

    it('accepts a custom catalog for test injection', () => {
        const mini = [SRE_PATTERNS_CATALOG[0]!];
        const rendered = renderPatternsCatalogForPrompt(mini);
        expect(rendered).toContain(SRE_PATTERNS_CATALOG[0]!.id);
        expect(rendered).not.toContain(SRE_PATTERNS_CATALOG[1]!.id);
    });
});
