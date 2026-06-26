import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('investigation.routes — role guard configuration', () => {
    it('module exports createInvestigationRoutes function', async () => {
        const mod = await import('./investigation.routes.js');
        expect(typeof mod.createInvestigationRoutes).toBe('function');
    });

    it('source does not reference stale owner or operator roles', () => {
        const src = fs.readFileSync(
            path.resolve(__dirname, 'investigation.routes.ts'),
            'utf8',
        );
        expect(src).not.toContain("'owner'");
        expect(src).not.toContain("'operator'");
    });
});
