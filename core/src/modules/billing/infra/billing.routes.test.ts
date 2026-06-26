import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('billing.routes — role guard configuration', () => {
    it('module exports createBillingRoutes function', async () => {
        const mod = await import('./billing.routes.js');
        expect(typeof mod.createBillingRoutes).toBe('function');
    });

    it('source does not reference stale owner or operator roles', () => {
        const src = fs.readFileSync(
            path.resolve(__dirname, 'billing.routes.ts'),
            'utf8',
        );
        expect(src).not.toContain("'owner'");
        expect(src).not.toContain("'operator'");
    });
});
