import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('integration.routes — role guard configuration', () => {
    it('module exports createIntegrationRoutes function', async () => {
        const mod = await import('./integration.routes.js');
        expect(typeof mod.createIntegrationRoutes).toBe('function');
    });

    it('source does not reference stale owner or operator roles', () => {
        const src = fs.readFileSync(
            path.resolve(__dirname, 'integration.routes.ts'),
            'utf8',
        );
        expect(src).not.toContain("'owner'");
        expect(src).not.toContain("'operator'");
    });
});
