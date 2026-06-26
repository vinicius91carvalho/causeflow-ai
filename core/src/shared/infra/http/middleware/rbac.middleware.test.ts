import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('rbac.middleware — requireRole', () => {
    it('module exports requireRole function', async () => {
        const mod = await import('./rbac.middleware.js');
        expect(typeof mod.requireRole).toBe('function');
    });

    it('source does not reference stale owner or operator roles', () => {
        const src = fs.readFileSync(
            path.resolve(__dirname, 'rbac.middleware.ts'),
            'utf8',
        );
        expect(src).not.toContain("'owner'");
        expect(src).not.toContain("'operator'");
    });
});
