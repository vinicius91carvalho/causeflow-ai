import { describe, expect, it } from 'vitest';
import { isSensitivePath, sensitiveLogPaths } from '@shared/config/log-paths.js';

describe('sensitiveLogPaths', () => {
    it('should be a readonly tuple with known sensitive paths', () => {
        expect(sensitiveLogPaths).toContain('/auth');
        expect(sensitiveLogPaths).toContain('/auth/*');
        expect(sensitiveLogPaths).toContain('/webhooks/clerk');
        expect(sensitiveLogPaths).toContain('/oauth');
        expect(sensitiveLogPaths).toContain('/oauth/*');
    });
});

describe('isSensitivePath', () => {
    it('matches exact path /auth', () => {
        expect(isSensitivePath('/auth')).toBe(true);
    });

    it('matches subpath /auth/login', () => {
        expect(isSensitivePath('/auth/login')).toBe(true);
    });

    it('matches exact path /webhooks/clerk', () => {
        expect(isSensitivePath('/webhooks/clerk')).toBe(true);
    });

    it('matches exact path /oauth', () => {
        expect(isSensitivePath('/oauth')).toBe(true);
    });

    it('matches subpath /oauth/callback', () => {
        expect(isSensitivePath('/oauth/callback')).toBe(true);
    });

    it('does NOT match /healthz', () => {
        expect(isSensitivePath('/healthz')).toBe(false);
    });

    it('does NOT match /tenants/123', () => {
        expect(isSensitivePath('/tenants/123')).toBe(false);
    });

    it('does NOT match /auth-something (no naive prefix match)', () => {
        expect(isSensitivePath('/auth-something')).toBe(false);
    });

    it('does NOT match /oauthstuff', () => {
        expect(isSensitivePath('/oauthstuff')).toBe(false);
    });

    it('does NOT match /webhooks/stripe (only /webhooks/clerk is sensitive)', () => {
        expect(isSensitivePath('/webhooks/stripe')).toBe(false);
    });

    it('matches deeply nested auth path', () => {
        expect(isSensitivePath('/auth/sso/callback')).toBe(true);
    });
});
