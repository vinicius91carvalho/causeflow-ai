import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('incident.routes — role guard configuration', () => {
    it('module exports createIncidentRoutes function', async () => {
        const mod = await import('./incident.routes.js');
        expect(typeof mod.createIncidentRoutes).toBe('function');
    });

    it('source does not reference stale owner or operator roles', () => {
        const src = fs.readFileSync(
            path.resolve(__dirname, 'incident.routes.ts'),
            'utf8',
        );
        expect(src).not.toContain("'owner'");
        expect(src).not.toContain("'operator'");
    });
});
