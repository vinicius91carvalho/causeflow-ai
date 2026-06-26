import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('trigger.routes — role guard configuration', () => {
    it('module exports createTriggerRoutes function', async () => {
        const mod = await import('./trigger.routes.js');
        expect(typeof mod.createTriggerRoutes).toBe('function');
    });

    it('source does not reference stale owner or operator roles', () => {
        const src = fs.readFileSync(
            path.resolve(__dirname, 'trigger.routes.ts'),
            'utf8',
        );
        expect(src).not.toContain("'owner'");
        expect(src).not.toContain("'operator'");
    });

    it('POST / has requireRole(admin) guard', () => {
        const src = fs.readFileSync(
            path.resolve(__dirname, 'trigger.routes.ts'),
            'utf8',
        );
        // POST handler must use requireRole('admin')
        expect(src).toContain("requireRole('admin')");
    });

    it('handles TriggerAlreadyExistsError with 409 response', () => {
        const src = fs.readFileSync(
            path.resolve(__dirname, 'trigger.routes.ts'),
            'utf8',
        );
        expect(src).toContain('TriggerAlreadyExistsError');
        expect(src).toContain('409');
        expect(src).toContain('TRIGGER_ALREADY_EXISTS');
    });
});
