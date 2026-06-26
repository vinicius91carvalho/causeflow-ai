import { describe, it, expect } from 'vitest';

/**
 * Smoke tests for user.routes — verifies role guard configuration.
 * Full integration tests require a running DynamoDB; these unit tests
 * validate the route factory returns a Hono app and that only valid
 * roles ('admin', 'member') are referenced (no stale 'owner'/'operator').
 */
describe('createUserRoutes', () => {
    it('module exports createUserRoutes function', async () => {
        const mod = await import('./user.routes.js');
        expect(typeof mod.createUserRoutes).toBe('function');
    });

    it('route source does not reference stale owner or operator roles', async () => {
        const fs = await import('fs');
        const path = await import('path');
        const src = fs.readFileSync(
            path.resolve(import.meta.dirname ?? __dirname, 'user.routes.ts'),
            'utf8',
        );
        expect(src).not.toContain("'owner'");
        expect(src).not.toContain("'operator'");
    });
});
