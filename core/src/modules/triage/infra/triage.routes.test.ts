import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('triage.routes — role guard configuration', () => {
    it('module exports createTriageRoutes function', async () => {
        const mod = await import('./triage.routes.js');
        expect(typeof mod.createTriageRoutes).toBe('function');
    });

    it('source does not reference stale owner or operator roles', () => {
        const src = fs.readFileSync(
            path.resolve(__dirname, 'triage.routes.ts'),
            'utf8',
        );
        expect(src).not.toContain("'owner'");
        expect(src).not.toContain("'operator'");
    });
});
